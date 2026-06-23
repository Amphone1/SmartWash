# A5_DUAL_WRITE_STRATEGY.md — mechanics of the shadow dual-write

> **PLANNING ONLY — no code/schema/API changed.** Mechanics behind
> `A5_IMPLEMENTATION_PLAN.md`. EPIC A · A5.

## 1. Hook point & why
The mirror must share the authoritative write's DB transaction (advance gate: *same-DB-txn*).
The legacy entry is written by `PgLedgerRepository.postAtomic` / `postRefund` inside
`Database.withTransaction(client)`. That `client` is the **only** handle that can carry both
writes atomically. The saga reaches the ledger over HTTP, so any caller-side mirror would be a
*different* transaction — rejected. **Decision: shim inside the ledger repository.**

## 2. The A4 `postWithClient` refactor (prerequisite)
A4 `PgTransactionRepository.post(intent)` opens its own `withTransaction`. A5 needs the same
logic on the **legacy** client:
```
postWithClient(client, intent)   // resolve → lock → balance → overdraft → insert → posted.v2
post(intent) = db.withTransaction(c => postWithClient(c, intent))   // A4 keeps its wrapper
```
Pure refactor; A4's integration gate (balanced/replay/concurrency/overdraft) must stay green.

## 3. Context threading (the missing inputs)
Legacy `PostEntryDto` = `{ userId, type, amount, refType, refId }`. Building new intents needs
more: `branchId` (clearing/bank/revenue), `vatBps` (CAPTURE split), `channel` (`wash`/`delivery`).
**Decision:** extend `PostEntryDto`/`PostInput` with **optional** `branchId?`, `vatBps?`,
`channel?` (additive, backward-compatible). Callers (saga activities) already hold these and
pass them. If required context is absent for a flow, the mirror is **skipped** for that write
(counts as `dual_write_error{reason=missing_context}` so coverage gaps are visible), legacy
unaffected.

## 4. Legacy → new mapping
Goal: keep **new `current(u)` == legacy `balance(u)`** after every operation, while exercising
the real reserve→capture lifecycle so the shadow validates the new model (not just net sums).

| Legacy op (refType) | New intent(s) (A3 builders) | Net wallet effect | Notes |
|---|---|---|---|
| `TOPUP` (topup) | `buildTopup` **+** `buildTopupSettle` | `available += amount` | settle so funds are spendable, mirroring legacy's single spendable balance |
| `DEDUCT` (order, wash) | `buildReserve` **+** `buildCapture(channel=wash)` | `available -= amount`; `revenue+vat += amount` | reserve-from-available then capture; needs `branchId`+`vatBps` |
| `DEDUCT` (order, delivery) | `buildHold` **+** `buildCapture(channel=delivery)` | `available -= amount` | hold→capture |
| `REFUND_REVERSAL` (refund) | `buildRefundReversal` | `available += amount`; revenue/vat reversed | partial uses `:partial:{seq}` |
| `ADJUSTMENT` (recon) | `buildAdjustment` (case-by-case) | balanced | **open item** — legacy per-user ± has no fixed counter-account; needs an explicit pairing rule (e.g. `equity:adjust` or `suspense`) decided before enabling the `adjust` flow |

**Idempotency keys for mirror intents** are derived from the legacy `refId` so retries replay:
`dual:reserve:{refId}`, `dual:capture:{refId}`, `dual:topup:{refId}`, `dual:settle:{refId}`,
`dual:refund:{refId}`. (Distinct from the real saga keys; the mirror is its own keyspace until
cutover, when A8 switches to the canonical keys.)

### Reconcile-identity choice (pending vs available)
- Mapping above settles topups to **available**, so `legacy balance == new available == new
  current` (reserved/held net to zero outside an in-flight op). The reconcile identity is
  **`legacy wallets.balance(u) == new current(u)`** — `current` (sum of all four sub-balances)
  is used so a transiently-reserved mid-saga amount never reads as drift.
- **Alternative (simpler, less fidelity):** map `TOPUP→pending` only and compare `current`;
  rejected as primary because it never exercises available/reserved.

## 5. Shadow reconcile — computation
```
new_current(u) = Σ naturalBalance(latest posting) over accounts WHERE owner_type='user' AND owner_id=u
legacy_balance(u) = wallets.balance(u)   (or latest ledger_entries.balance_after)
drift = new_current(u) − legacy_balance(u)
```
- **Inline:** computed on the same `client` right after the mirror (sees uncommitted mirror rows)
  → emit `ledger_shadow_drift_*` if non-zero.
- **Batch:** a separate read-only job over a time window (committed data) for the zero-drift
  evidence + per-branch L2 sanity (`bank+clearing` postings vs statements — report-only here).

## 6. What the shadow does and does not prove
- **Proves:** per-user balance equivalence, mirror determinism, idempotent replay, no double
  write, latency budget, and that the A1 balanced/append-only guarantees hold on real traffic.
- **Does not prove (out of A5):** that *reads* off the new ledger are correct (A7/A8), nor the
  four-balance projection (A7), nor reconciliation enforcement (EPIC C). A5 is observe-only.

## 7. Concurrency & ordering
- The mirror reuses A4's advisory-lock-by-account strategy on the **same** client, so it
  inherits deadlock-free serialization. Because legacy `postAtomic` already holds a per-user
  advisory lock, mirror writes for one user are serialized end-to-end.
- Mirror intents that expand one legacy op into two (e.g. RESERVE+CAPTURE) are posted in order
  on the same client; each is its own balanced `ledger_transactions` row.

## 8. Open design items to lock before coding
1. ADJUSTMENT counter-account pairing rule (§4).
2. Whether topup mirrors as TOPUP+SETTLE (chosen) vs TOPUP-only (pending).
3. Exact optional-context contract on `PostEntryDto` + which saga activities populate it.
4. Mirror keyspace (`dual:*`) vs canonical keys, and the A8 switch-over plan.
5. Inline vs batch-only reconcile in prod (latency budget) — recommend inline in staging,
   batch + sampled-inline in prod.

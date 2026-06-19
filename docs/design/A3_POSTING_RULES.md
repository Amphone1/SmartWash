# A3 — Posting Rules + Transaction Builder

> EPIC A · increment **A3**. Implemented 2026-06-19 on branch `epic-a/a2-accounts`.
> Pure domain (`services/ledger/src/domain/posting-rules.ts`) — maps each of the 9
> ledger operations to a **balanced** double-entry `TransactionIntent`. No DB, no
> outbox, no FSM side effects (those are **A4**). Realizes `FINANCIAL_CONTRACT.md` §4
> and `MONEY_MODEL_PROPOSED.md` §3; preserves all ADRs, the money model, chart of
> accounts, reconciliation model, and append-only/double-entry guarantees.

## Builder contract
- Input: typed per-op parameters (ids + amounts in `Kip`).
- Output: `TransactionIntent { type, idempotencyKey, correlationId?, postings[] }` where
  each `PostingIntent { account: AccountRef, accountKey, direction, amount }` references
  an **account ref** (A2), not a DB id. A4 calls `resolveAccount()` per ref and persists.
- Every line is validated through A2 `validateAccountRef` (fail-closed on
  vendor/franchise/unknown/bad owner) and must have `amount > 0`.
- Every transaction is asserted **balanced** (`Σ DR = Σ CR`, ≥2 postings) →
  `UnbalancedTransactionError` otherwise (internal guard; the A1 DB trigger is the
  final backstop).
- Idempotency keys are the deterministic business keys from `FINANCIAL_CONTRACT.md` §4.

## The 9 operations
| Op | Idempotency key | Postings (DR → CR) |
|---|---|---|
| TOPUP | `topup:{qrRef}` | DR `clearing:branch` / CR `pending:user` |
| TOPUP_SETTLE | `topup-settle:{qrRef}` | DR `bank:branch` / CR `clearing:branch` **and** DR `pending:user` / CR `available:user` |
| RESERVE | `reserve:{orderId}` | DR `available:user` / CR `reserved:user` |
| HOLD | `hold:{orderId}` | DR `available:user` / CR `held:user` |
| CAPTURE | `wash-deduct:{orderId}` / `delivery-deduct:{orderId}` | DR `reserved\|held:user` (gross) / CR `revenue:branch` (net) + CR `vat:tax` (vat) |
| RELEASE | `release:{orderId}` | DR `reserved\|held:user` / CR `available:user` |
| REFUND_REVERSAL | `wash-refund:{orderId}`(`:partial:{seq}`) | DR `revenue:branch` (net) + DR `vat:tax` (vat) / CR `available:user` (gross) |
| ADJUSTMENT | `adjust:{ref}`(`:{seq}`) | caller-supplied balanced line set |
| SETTLEMENT | `settle:{branchId}:{period}` | DR `payable:staff` / CR `bank:platform` |

(`channel: 'wash'` → `reserved` + `wash-deduct`; `'delivery'` → `held` + `delivery-deduct`.)

## VAT split — decision & rationale
CAPTURE/REFUND split the wallet-side **gross** into revenue **net** + **VAT** via
`splitVatInclusive(gross, vatBps)` (`@smartwash/common`):

```
net = floor(gross * 10000 / (10000 + vatBps))   ;   vat = gross − net
```

- **Recon-safe:** `net + vat === gross` exactly; the floor remainder posts to VAT
  (`FINANCIAL_CONTRACT.md` §1).
- **Rate-consistent with order pricing** (`services/order/src/domain/pricing.ts`,
  `total = net + applyBasisPoints(net, vatBps)`): the gross is VAT-inclusive at
  `vatBps`-of-net, so the inclusive inverse recovers the same rate.
- **Rounding note (flagged for finance sign-off):** because exclusive pricing floors
  VAT, the inclusive inverse may differ from the quoted VAT by **≤1 kip**, which lands
  in VAT by policy. This is internally consistent (the ledger is the source of truth and
  trial balance still nets to zero); it is *not* a quote-vs-ledger reconciliation input.
  If finance wants quoted-VAT parity, CAPTURE can instead take explicit `net`/`vat`
  carried from the order — a localized change to one builder. **No money-model change.**
- `vatBps = 0` → single CR to `revenue:branch` (no VAT line).

## Invariants preserved
- **Double-entry / balanced (C3):** asserted in the builder and by the A1 deferred trigger.
- **Append-only (C4):** A3 writes nothing; corrections are new ADJUSTMENT/REFUND txns.
- **Idempotency (C5):** deterministic keys; the DB `idempotency_key UNIQUE` backstop (A1).
- **Auditability (C6):** `correlationId` is carried on the intent for A4 to propagate.
- **Chart of accounts (A2):** every ref is a catalogued kind; vendor/franchise rejected.

## Out of scope (A4+)
Persistence, advisory lock, running `balance_after`, outbox `posted.v2`, FSM transitions,
and `resolveAccount()` calls are **A4**. A3 produces intents only.

## Verification
- Unit: `posting-rules.spec.ts` (per-op DR/CR, keys, VAT, guards) + `money.spec.ts`
  (`splitVatInclusive`).
- Integration: `posting-rules.integration.spec.ts` (all 9 ops: balanced, ≥2 postings,
  positive amounts, resolvable refs, key shape; net+vat=gross).
- DB cross-layer: `infra/db/init/tests/a3_posting_rules.verify.sql` (3-line CAPTURE and
  4-line TOPUP_SETTLE accepted by the A1 balanced trigger; unbalanced rejected) — CI-wired.
- **No migration** — A3 adds no schema (see the change summary's migration-impact: none).

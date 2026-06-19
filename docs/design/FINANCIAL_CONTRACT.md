# SmartWash — Financial Contract (normative)

> **Version:** 1.1 (2026-06-19) — see Changelog at the end.
> **Status: PROPOSED — design only, NO-GO active. No code is changed by this doc.**
> This is the authoritative behavioral contract every service MUST honor for any
> money movement. It binds: ledger, wallet, payment, saga, settlement,
> reconciliation, audit. Data shapes live in `MONEY_MODEL_PROPOSED.md`; runtime
> sequences in `MONEY_FLOW_SPEC.md`. Realizes ADR-0002/0003/0004/0007.
>
> Keywords MUST / MUST NOT / SHOULD per RFC-2119.

## 0. Precedence
1. The 10 non-negotiable rules (CLAUDE.md).
2. This contract.
3. Service-local design.
On conflict, the higher tier wins. Any deviation requires an ADR + STOP-and-ask.

## 1. Units & types
- All amounts are `BIGINT` **kip**. Floats MUST NOT appear in any money path.
- `currency` defaults `LAK`; a transaction MUST NOT mix currencies (CurrencyMismatch).
- VAT/fees use basis points via `applyBasisPoints()`; rounding is **floor**, the
  rounding remainder posts to `tax:vat` (deterministic, recon-safe).
- Amounts in `ledger_postings.amount` are **positive**; sign is carried by `DR`/`CR`.

## 2. Core principles (restated as contract)
- **C1** The ledger is the single source of truth. The wallet is a derived cache.
- **C2** The wallet MUST NOT be updated before the corresponding ledger posting.
- **C3** Every money movement is a **balanced** double-entry transaction (`Σ DR = Σ CR`).
- **C4** Ledger postings are append-only. Corrections are new `ADJUSTMENT` /
  `REFUND_REVERSAL` transactions — never UPDATE/DELETE.
- **C5** Every money-moving operation is idempotent on a deterministic key.
- **C6** Every money transaction is auditable (actor or system) and carries a
  `correlation_id` propagated across all hops.

## 3. Account model
Chart of accounts is normative in `MONEY_MODEL_PROPOSED.md` §3. An account key is
`{sub}:{owner_type}:{owner_id}` (e.g. `wallet:available:{userId}`,
`bank:branch:{branchId}`). A posting MUST reference an existing active account
(AccountNotFound otherwise).

## 4. Operation contract
Each operation is ONE `ledger_transactions` row + ≥2 `ledger_postings`. Format:
**idempotency key · preconditions · postings (DR→CR) · events · FSM · errors.**

### 4.1 TOPUP (provisional credit on slip approval)
- **Key:** `topup:{qrRef}`
- **Pre:** payment_request APPROVED; `slip_hash` unique; amount = `amount_expected`.
- **Postings:** `DR clearing:branch:{b}` → `CR wallet:pending:{u}`
- **Events:** `smartwash.ledger.transaction.posted.v2`
- **FSM:** payment → APPROVED. Wallet `pending += amount`.
- **Errors:** IdempotencyConflict (key reuse, different amount), ValidationError.

### 4.2 TOPUP_SETTLE (bank statement matched → funds become spendable)
- **Key:** `topup-settle:{qrRef}`
- **Pre:** matching `bank_statement_lines` row VERIFIED.
- **Postings:** `DR bank:branch:{b}` → `CR clearing:branch:{b}` **and**
  `DR wallet:pending:{u}` → `CR wallet:available:{u}`
- **Events:** transaction.posted.v2; recon line → VERIFIED.
- **FSM:** wallet `pending -= amount; available += amount`.

### 4.3 RESERVE (commit funds to an in-flight wash)
- **Key:** `reserve:{orderId}`
- **Pre:** `wallet:available >= total`.
- **Postings:** `DR wallet:available:{u}` → `CR wallet:reserved:{u}`
- **FSM:** Order → RESERVED (with Redis SETNX machine lock, separate concern).
- **Errors:** InsufficientFunds.

### 4.4 HOLD (authorization hold, charge-on-delivery)
- **Key:** `hold:{orderId}`
- **Postings:** `DR wallet:available:{u}` → `CR wallet:held:{u}`

### 4.5 CAPTURE / DEDUCT (recognize revenue)
- **Key:** `wash-deduct:{orderId}` (delivery: `delivery-deduct:{orderId}`)
- **Pre:** funds in `reserved` (wash) or `held` (delivery) ≥ total.
- **Postings:** `DR wallet:reserved|held:{u}` → `CR revenue:branch:{b}` (net) **+**
  `CR tax:vat` (VAT portion)
- **Events:** transaction.posted.v2; Order → PAID.

### 4.6 RELEASE (un-commit reserved/held funds)
- **Key:** `release:{orderId}`
- **Postings:** `DR wallet:reserved|held:{u}` → `CR wallet:available:{u}`

### 4.7 REFUND_REVERSAL
- **Key:** `wash-refund:{orderId}` (+ `:partial:{seq}` for pro-rata)
- **Postings:** `DR revenue:branch:{b}` (+`DR tax:vat`) → `CR wallet:available:{u}`
- **Side-effect:** a `refunds` row (state=REVERSED) linked to the transaction, same txn.
- **FSM:** Order → REFUND_PENDING → REFUNDED.

### 4.8 ADJUSTMENT (recon mismatch / correction)
- **Key:** `adjust:{reconRunId}:{seq}` (or `adjust:{ref}`)
- **Postings:** balanced; account pair depends on the correction. MUST reference the
  reason and the source exception. Never edits a prior row.

### 4.9 SETTLEMENT (payout to staff/branch)
- **Key:** `settle:{branchId}:{period}`
- **Pre:** only VERIFIED (reconciled) revenue is settleable (S1).
- **Postings:** `DR payable:staff:{d}` (or `revenue:branch`) → `CR bank:platform`

## 5. Idempotency contract
- Keys are deterministic business keys (§4). A retry with the **same** key + same
  payload MUST replay the original result (no second posting).
- Same key + **different** material payload MUST raise `IdempotencyConflict`.
- The ledger MUST enforce `ledger_transactions.idempotency_key UNIQUE` as the final
  backstop. API-level `idempotency_keys` is the first line.
- Replay MUST NOT re-fire external side effects (MQTT START, notifications, payout).

## 6. Event contract (money events)
- All money events use the Envelope (`events.schema.json`): `id, type, source, time,
  correlationId, data`. `type` = `smartwash.ledger.transaction.posted.v2`.
- **Payload (v2):**
  ```
  { txnId, type, correlationId,
    postings: [ { accountKey, ownerType, ownerId, direction, amount, balanceAfter } ],
    userId? }                                  // userId present when a wallet account moves
  ```
- **Consumer idempotency:** consumers MUST dedup on Envelope `id` (inbox
  `processed_events(consumer, event_id)`); processing MUST be idempotent.
- **Ordering:** per-aggregate (`userId` for wallet projection). The wallet projector
  MUST apply monotonically by `txnId` and ignore `txnId <= last_txn_id` (no stale
  overwrite).
- **DLQ:** after bounded retries → `smartwash.ledger.transaction.posted.dlq`; never
  silently drop a money event.
- `LedgerPosted.v1` remains valid during transition; v2 is additive.

## 7. API contract (money surfaces)
- Every state-changing money POST MUST require `Idempotency-Key` (UUID v4) and be
  internal-only (`X-Internal-Token`) except where fronted by BFF + RBAC.
- `GET /wallets/{userId}` MUST return the four balances:
  `{ available, reserved, held, pending, current, currency }` where
  `current = available+reserved+held+pending`.
- Ledger endpoints (`/ledger/post`, `/ledger/refund`, `/ledger/adjust`) accept a
  transaction intent and return `{ txnId, postings[], replayed }`.
- **Error model (canonical):** `ValidationError(400)`, `InsufficientFunds(409)`,
  `IdempotencyConflict(409)`, `AccountNotFound(404)`, `AccountInactive(409)`,
  `CurrencyMismatch(422)`, `UnbalancedTransaction(500, internal guard)`.
  `AccountInactive(409)` = the resolved account exists but is not `active`
  (e.g. closed); `resolveAccount()` raises it rather than silently reactivating.

## 8. Invariants (machine-checkable)
| ID | Assertion | Enforced by |
|---|---|---|
| C3/L1 | per txn `Σ DR.amount = Σ CR.amount` | deferred constraint trigger |
| C4/L2 | postings/transactions immutable | ADR-0002 trigger + REVOKE |
| C5/L3 | `idempotency_key UNIQUE` | DB unique + advisory lock |
| W1 | `current = available+reserved+held+pending` | projector + L1 recon |
| W2 | `wallet.current(u) = Σ user wallet postings` | L1 recon job + alert |
| W3 | apply only `txnId > last_txn_id` | projector guard |
| R1 | no bank line / ledger credit silently dropped | suspense + exception queue |
| S1 | branch settled ≤ reconciled `bank:branch` | settlement precondition |

## 9. Failure & compensation contract
- A money operation MUST be all-or-nothing within one DB transaction (entry +
  outbox together).
- Saga compensation MUST post a **new** reversing transaction (never UPDATE), keyed
  deterministically, idempotent on retry.
- On any unbalanced posting attempt the transaction MUST abort (UnbalancedTransaction).
- A failed downstream MUST leave funds recoverable (RELEASE or REFUND), never stranded
  outside an account.

## 10. Audit & traceability contract
- Every money transaction MUST produce an audit record. System-initiated → audit
  firehose (actor=system); privileged actions (slip approve, manual refund/adjust,
  settlement) MUST be logged via the internal audit POST with `actor_id`, `actor_role`,
  `ip`, `before`, `after`.
- `correlation_id` set at the originating request MUST be propagated to every posting,
  event, and audit row in the flow.

## Approval
This contract is binding only after the `MONEY_MODEL_PROPOSED.md` artifacts are
approved (NO-GO lift). Until then it is the agreed target specification.

## Changelog
- **1.1 (2026-06-19, A2):** Add `AccountInactive(409)` to the §7 error model
  (`resolveAccount()` rejects posting to a non-active account). No money-model,
  chart-of-accounts, or reconciliation change.
- **1.0 (2026-06-17):** Initial financial contract (NO-GO lift).

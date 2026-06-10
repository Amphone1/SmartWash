# Saga Compensation Audit (Phase 6)

Confirms every saga's failure branches compensate correctly. All money moves are
idempotent via deterministic ledger keys; the ledger `idempotency_key` UNIQUE is
the final backstop against double charge/refund. The ledger is append-only —
reversals are new `REFUND_REVERSAL` rows (rule #2), now also recorded in the
`refunds` table.

## topup
SlipUploaded → OCR → Risk → Fraud → (PASS|MANUAL_REVIEW|REJECT) → Ledger TOPUP.
- **Reject / staff-reject / timeout** → no ledger movement. Nothing to compensate.
- Ledger key `topup:{qrRef}` → exact-once credit.

## wash_order
reserveMachine → ensureFunds → **DEDUCT** → startMachine → await RUNNING →
await finished/error → finalize.

| Failure point | Compensation |
|---|---|
| insufficient funds (pre-deduct) | release machine → Order PAYMENT_PENDING |
| deduct fails | release machine → Order PAYMENT_PENDING |
| no RUNNING ack (device offline) | **refund (FULL)** + stop + release → REFUND_PENDING → REFUNDED |
| ERROR mid-cycle | **refund (pro-rata PARTIAL / FULL)** + stop → REFUND_PENDING → REFUNDED |

- Deduct key `wash-deduct:{orderId}`, refund key `wash-refund:{orderId}`.
- Refunds go through `POST /ledger/refund` → `REFUND_REVERSAL` entry **+ `refunds`
  row** (`state=REVERSED`, `ledger_id` link) in one transaction.

## delivery_order (charge-on-delivery)
createDelivery → run delivery (driver/machine FSMs) → on `delivered`: **DEDUCT
wash+fee** → COMPLETED.
- Money moves **only at the end**, so there is nothing to refund.
- **timeout** → CANCELLED (no charge). **deduct fails post-delivery** →
  PAYMENT_PENDING (outstanding debt — the accepted operator-risk tradeoff).

## Gaps / future
- Staff-initiated manual refunds (`PENDING→APPROVED→REVERSED`) — only automatic
  (`REVERSED`) refunds are implemented.
- `delivery_order` does not currently refund a partial failure after a successful
  wash but failed return (no charge has occurred, so the customer isn't out of
  pocket; the operator absorbs the wash cost — revisit if charging splits).

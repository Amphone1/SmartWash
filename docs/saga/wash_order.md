# wash_order Saga (Temporal Workflow)

Orchestrates a self-service wash from reservation to completion, keeping the
**Order FSM** and **Machine FSM** consistent. Every forward step has a
compensation. Run as a Temporal workflow; activities are idempotent.

## Forward path

| # | Step (activity)            | Owner service | On success            | Compensation              |
|---|----------------------------|---------------|-----------------------|---------------------------|
| 1 | ReserveMachine             | Order/Queue   | Redis SETNX, Order=RESERVED, Machine=RESERVED | ReleaseLock (DEL), Machine=IDLE |
| 2 | EnsureFunds                | Ledger        | wallet >= total OR credit ok | (no-op)             |
| 3 | DeductWallet               | Ledger        | LedgerPosted DEDUCT, Order=PAID | PostReversal (REFUND_REVERSAL) |
| 4 | StartMachine               | Machine       | MQTT START + ACK, Machine=STARTING→RUNNING, Order=RUNNING | StopMachine + mark FAILED |
| 5 | AwaitFinish (signal/timer) | Machine       | MachineFinished, Machine=FINISHING→IDLE | (n/a — terminal-ish) |
| 6 | FinalizeOrder              | Order         | Order=COMPLETED, receipt, notify | (n/a) |

## Failure handling

- **Step 1 fails** (lock taken): workflow ends, Order=EXPIRED/CANCELLED, user re-picks.
- **Step 3 fails** (insufficient funds): compensate step 1, Order=PAYMENT_PENDING or CANCELLED.
- **Step 4 fails** (no ACK / device offline within timeout): compensate 3 (reversal → wallet refunded), 1 (release lock); Order=REFUND_PENDING→REFUNDED, Machine→ERROR/OFFLINE; notify user.
- **Step 5 ERROR mid-cycle**: trigger partial refund saga (PostReversal pro-rated by progress%); Order=REFUND_PENDING; Machine→ERROR→MAINTENANCE.

## Rules

- All activities take an idempotency key derived from `{orderId}:{step}`.
- Wallet movements go only through Ledger (append-only); compensation = new
  REVERSAL row, never an UPDATE.
- Machine commands are fire-via-MQTT then await status event (do not block on MQTT ack alone; use the status uplink + timeout).
- Workflow id = orderId (dedup concurrent starts).

## Topup saga (simpler sibling)

SlipUploaded → (FraudCheck → RiskScore → OCR → AutoMatch) → LedgerPosted TOPUP.
On reject at any gate: Order/payment = REJECTED, no ledger movement. On manual
review: park workflow on a signal awaiting staff approve/reject.

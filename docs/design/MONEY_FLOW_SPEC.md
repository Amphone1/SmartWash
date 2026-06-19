# SmartWash — Money Flow Spec (normative sequences)

> **Status: PROPOSED — design only, NO-GO active. No code changed by this doc.**
> Runtime sequences for every money flow. Each posting refers to the
> `FINANCIAL_CONTRACT.md` operation (§4) and the chart of accounts in
> `MONEY_MODEL_PROPOSED.md`. Notation: `DR x / CR y  amount` = one balanced
> transaction; `[key]` = idempotency key; `→evt` = event emitted.

## Legend
- Accounts: `wa`=wallet:available, `wr`=wallet:reserved, `wh`=wallet:held,
  `wp`=wallet:pending, `clr`=clearing:branch, `bnk`=bank:branch,
  `rev`=revenue:branch, `vat`=tax:vat, `pay`=payable:staff, `bp`=bank:platform,
  `sus`=suspense:topup.
- All transactions are append-only, idempotent, auditable, correlation-tagged.

---

## FLOW 1 — Top-up (No-Bank-API)

```
Customer transfers to Branch QR (out of band) ──► uploads slip
payment: slip_hash unique? ──► OCR ──► Risk ──► Fraud ──► decision
  REJECT  → payment REJECTED, →evt PaymentRejected, NO ledger movement
  MANUAL  → park on staffDecisionSignal (timeout → REJECT)
  APPROVE ▼
TOPUP            [topup:{qrRef}]        DR clr:{b} / CR wp:{u}  amount   →evt posted.v2
  wallet.pending += amount   (NOT yet spendable)
... daily reconciliation imports bank statement ...
match found ▼
TOPUP_SETTLE     [topup-settle:{qrRef}] DR bnk:{b}/CR clr:{b}  +  DR wp:{u}/CR wa:{u}
  wallet.pending -= amount ; wallet.available += amount   (now spendable)
no match by T+N → recon exception → suspense / ADJUSTMENT (FLOW 5)
```
**Idempotency:** retried slip → same `qrRef` key → replay, never double credit.
**Invariants touched:** W1, W2, R1.

---

## FLOW 2 — Self-service wash (reserve → capture → finish)

```
OrderWashRequested ──► saga wash_order (Temporal, workflowId=orderId)
1 ReserveMachine : Redis SETNX + Order=RESERVED + Machine=RESERVED
  RESERVE        [reserve:{orderId}]    DR wa:{u} / CR wr:{u}  total
2 EnsureFunds    : wallet.available was sufficient (checked pre-reserve)
3 CAPTURE/DEDUCT [wash-deduct:{orderId}] DR wr:{u} / CR rev:{b} (net) + CR vat (vat)
  Order=PAID   →evt posted.v2
4 StartMachine   : MQTT START + await RUNNING uplink ; Order=RUNNING
5 AwaitFinish    : MachineFinished ; Order=COMPLETED ; receipt + notify
```
**Failure / compensation (new reversing txns, never UPDATE):**
```
step1 lock taken      → end; Order=EXPIRED/CANCELLED; no money moved
step3 insufficient    → RELEASE [release:{orderId}] DR wr/CR wa ; Order=PAYMENT_PENDING
step4 no RUNNING ack  → REFUND_REVERSAL [wash-refund:{orderId}] DR rev(+vat)/CR wa (FULL)
                        StopMachine ; Order=REFUND_PENDING→REFUNDED ; Machine=ERROR/OFFLINE
step5 ERROR mid-cycle → REFUND_REVERSAL pro-rata by progress% (PARTIAL or FULL)
                        [wash-refund:{orderId}:partial:{seq}] ; Order=REFUND_PENDING→REFUNDED
```
**Invariants:** C3, W1, W3; refund recognized by reversing revenue, not by editing.

---

## FLOW 3 — Delivery (charge-on-delivery, hold → capture)

```
OrderDeliveryRequested ──► HOLD [hold:{orderId}] DR wa:{u}/CR wh:{u} (wash+fee est.)
driver/delivery FSM advances (CREATED→…→DELIVERED)  [no money move]
on DELIVERED ▼
CAPTURE [delivery-deduct:{orderId}] DR wh:{u}/CR rev:{b}(net)+CR vat ; Order=COMPLETED
```
**Failure:**
```
timeout / cancelled before delivery → RELEASE [release:{orderId}] DR wh/CR wa ; no charge
capture fails post-delivery (insufficient) → Order=PAYMENT_PENDING (outstanding debt;
   accepted operator risk; credit_limits may cover when wired) — flagged to ops
```

---

## FLOW 4 — Refund / reversal (operator or auto)

```
trigger: saga error (auto) OR staff-initiated (manual, PENDING→APPROVED→REVERSED)
REFUND_REVERSAL [wash-refund:{orderId}] DR rev:{b}(+vat) / CR wa:{u}  amount
  + refunds row (state=REVERSED, ledger_txn link) in the SAME db transaction
  →evt posted.v2 ; Order REFUND_PENDING→REFUNDED ; audit(actor for manual)
```
Manual refund MUST be audited with `actor_id/role/ip`. Idempotent on the refund key.

---

## FLOW 5 — Adjustment (reconciliation mismatch)

```
recon exception (orphan bank line OR unmatched ledger credit OR amount drift)
  orphan bank line   → DR bnk:{b} / CR sus  (park) ; ops investigates
  over-credit found  → ADJUSTMENT [adjust:{reconRunId}:{seq}] balanced clawback
  short-credit found → ADJUSTMENT top-up balanced
All adjustments are NEW balanced transactions with reason + source exception ref.
NEVER edit or delete the original posting (C4).
```

---

## FLOW 6 — Settlement (period close, payout)

```
period close per branch (only VERIFIED revenue, S1):
  compute split: platform fee | branch share | staff/driver payout
  accrue driver payout from delivery completions → payable:staff:{d}
SETTLEMENT [settle:{branchId}:{period}] DR pay:{d} / CR bp   (payout executed)
status → settled ; audit(actor=finance) ; vendor/franchise roll-up = reserved (ADR-0006)
```
**Invariant:** S1 (never settle beyond reconciled `bank:branch`), S2 (balanced txn).

---

## FLOW 7 — Reconciliation L1 / L2 / L3

```
L1 (continuous + scheduled):
   assert wallet.current(u) == Σ user wallet postings
   drift → alert + freeze that user's wallet writes until resolved
L2 (daily, per branch):
   import bank statement → auto-match (amount, ref, time-window, account)
     VERIFIED      → TOPUP_SETTLE (FLOW 1)
     REVIEW/SUSPIC → manual queue (audited decision)
     ORPHAN        → suspense (FLOW 5)
L3 (daily, platform):
   trial balance Σ DR == Σ CR across all accounts
   Σ wallet LIAB == Σ ASSET − REVENUE − VAT
   imbalance → page on-call ; HALT settlement until green
```

---

## FLOW 8 — Inter-branch (top-up at A, spend at B)

```
top-up at branch A  → cash lands in bnk:A (FLOW 1 settle), wallet liability is platform-wide
wash at branch B    → CAPTURE credits rev:B, debits wallet (FLOW 2)
settlement          → inter-branch clearing: DR due-from:A / CR due-to:B  (balanced)
   so B's recognized revenue is funded from A's held cash at settlement.
```
This flow is the concrete reason single-entry (B1) is insufficient and double-entry
(ADR-0003) is required.

---

## Cross-cutting requirements (all flows)
- **Ledger-before-wallet (C2):** wallet projection updates only on `posted.v2` consume.
- **Idempotent + replay-safe:** retries never double-move; replay never re-fires
  MQTT/notification/payout side effects.
- **Audit + correlation:** every transaction → audit row + propagated `correlation_id`.
- **Append-only (C4):** corrections are FLOW 4/5 reversing transactions only.

## Approval
Binding after the `MONEY_MODEL_PROPOSED.md` artifacts are approved (NO-GO lift).

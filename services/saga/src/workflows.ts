/**
 * topup saga (Temporal workflow). SlipUploaded → OCR → auto-match → Risk →
 * Fraud → apply decision → (PASS or staff-approved) → Ledger TOPUP.
 *
 * Determinism: workflowId = `topup:${qrRef}` (set by the trigger) and the ledger
 * idempotency key = `topup:${qrRef}` — retries and duplicate events never
 * double-credit. Topup has no money compensation (reject = no ledger movement).
 */
import {
  proxyActivities,
  defineSignal,
  setHandler,
  condition,
} from '@temporalio/workflow';
import type * as activities from './activities';
import {
  ownerMatch,
  refundForError,
  routeAfterFraud,
  topupLedgerKey,
  washDeductKey,
  washRefundKey,
} from './routing';

const a = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 5, initialInterval: '1 second' },
});

export type StaffDecision = 'approve' | 'reject';
export const staffDecisionSignal = defineSignal<[StaffDecision]>('staffDecision');

export interface TopupInput {
  qrRef: string;
  slipId: string;
  userId: string;
  slipHash: string;
  imageObjectKey: string;
  amountExpected: number;
  ownerAccount: string;
  staffTimeoutMs: number;
}

export interface TopupResult {
  outcome: 'approved' | 'rejected';
  reason?: string;
}

export async function topupWorkflow(input: TopupInput): Promise<TopupResult> {
  // 1) OCR + persist parsed fields.
  const ocr = await a.ocrParse(input.imageObjectKey);
  await a.recordOcr(input.qrRef, ocr);

  // 2) Auto-match + risk.
  const accountMatch = ownerMatch(ocr.account, input.ownerAccount);
  const risk = await a.riskScore({
    amountExpected: input.amountExpected,
    ocrAmount: ocr.amount,
    accountMatch,
  });

  // 3) Fraud gate + apply to the payment FSM.
  const fraud = await a.fraudEvaluate({
    duplicate: false,
    accountMatch,
    amountExpected: input.amountExpected,
    ocrAmount: ocr.amount,
    ocrConfidence: ocr.confidence,
    riskScore: risk.score,
    riskBand: risk.band,
  });
  await a.applyDecision(input.qrRef, fraud.state, fraud.reason ?? null);

  const route = routeAfterFraud(fraud.state);
  if (route === 'end') {
    return { outcome: 'rejected', reason: fraud.reason };
  }

  if (route === 'await_staff') {
    // Park until staff resolves (signalled by the PaymentApproved/Rejected
    // consumer) or the review window elapses.
    let decision: StaffDecision | undefined;
    setHandler(staffDecisionSignal, (d) => {
      decision = d;
    });
    const resolved = await condition(
      () => decision !== undefined,
      input.staffTimeoutMs,
    );
    if (!resolved) {
      // Timeout → reject the still-pending payment; no money moves.
      await a.applyDecision(input.qrRef, 'REJECT', 'staff_reject');
      return { outcome: 'rejected', reason: 'timeout' };
    }
    if (decision !== 'approve') {
      // Payment was already moved to REJECTED by the staff-decision endpoint.
      return { outcome: 'rejected', reason: 'staff_reject' };
    }
    // Staff approved (payment already APPROVED via its endpoint) → fall through.
  }

  // 4) Post the Ledger TOPUP (idempotent).
  await a.postLedgerTopup({
    userId: input.userId,
    amount: input.amountExpected,
    refId: input.slipId,
    idempotencyKey: topupLedgerKey(input.qrRef),
  });
  return { outcome: 'approved' };
}

// ============================================================================
// wash_order saga (docs/saga/wash_order.md). Forward steps each push a
// compensation; failures unwind the stack (LIFO). Money moves are idempotent
// via deterministic ledger keys, so retries/compensation never double-charge or
// double-refund (the ledger idempotency_key UNIQUE is the backstop).
// ============================================================================
const w = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 5, initialInterval: '1 second' },
});

export type MachineEventType = 'running' | 'finished' | 'error';
export interface MachineEvent {
  type: MachineEventType;
  errorCode?: string;
}
export const machineEventSignal = defineSignal<[MachineEvent]>('machineEvent');

export interface WashInput {
  orderId: string;
  startAckTimeoutMs: number;
  cycleTimeoutMs: number;
  refundPolicy: string; // pro_rata | full
}
export interface WashResult {
  outcome: 'completed' | 'refunded' | 'payment_pending';
  reason?: string;
}

export async function washOrderWorkflow(input: WashInput): Promise<WashResult> {
  const o = await w.getOrder(input.orderId);
  const comp: Array<() => Promise<void>> = [];
  const unwind = async (): Promise<void> => {
    for (const c of comp.reverse()) {
      try {
        await c();
      } catch {
        /* best-effort compensation */
      }
    }
  };

  // Collect machine events into a buffer the conditions watch.
  const events: MachineEvent[] = [];
  setHandler(machineEventSignal, (e) => {
    events.push(e);
  });
  const sawEvent = (t: MachineEventType): boolean =>
    events.some((e) => e.type === t);

  // 1) ReserveMachine (Order is already RESERVED from creation).
  await w.machineReserve(o.machineId, input.orderId);
  comp.push(() => w.machineRelease(o.machineId));

  // 2) EnsureFunds — soft pre-check; the ledger DEDUCT is the real guard.
  const balance = await w.walletBalance(o.userId);
  if (balance < o.total) {
    await unwind();
    await w.orderTransition(input.orderId, 'PAYMENT_PENDING', 'insufficient_funds');
    return { outcome: 'payment_pending', reason: 'insufficient_funds' };
  }

  // 3) DeductWallet (MONEY) — idempotent; ledger rejects overdraft.
  try {
    await w.deductWallet({
      userId: o.userId,
      amount: o.total,
      orderId: input.orderId,
      idempotencyKey: washDeductKey(input.orderId),
    });
  } catch {
    await unwind();
    await w.orderTransition(input.orderId, 'PAYMENT_PENDING', 'deduct_failed');
    return { outcome: 'payment_pending', reason: 'deduct_failed' };
  }
  await w.orderTransition(input.orderId, 'PAID', 'wallet_deducted');
  comp.push(() =>
    w.refundWallet({
      userId: o.userId,
      amount: o.total,
      orderId: input.orderId,
      idempotencyKey: washRefundKey(input.orderId),
      type: 'FULL',
      reason: 'wash_failed',
    }),
  );

  // 4) StartMachine, then await the RUNNING status uplink (not the MQTT ack).
  await w.machineStart(o.machineId, input.orderId, o.cycle);
  comp.push(() => w.machineStop(o.machineId, input.orderId));
  const running = await condition(
    () => sawEvent('running'),
    input.startAckTimeoutMs,
  );
  if (!running) {
    await unwind(); // refund + stop + release
    await w.orderTransition(input.orderId, 'REFUND_PENDING', 'machine_no_ack');
    await w.orderTransition(input.orderId, 'REFUNDED', 'refunded');
    return { outcome: 'refunded', reason: 'machine_no_ack' };
  }
  await w.orderTransition(input.orderId, 'RUNNING', 'machine_running');

  // 5) AwaitFinish (or ERROR mid-cycle → pro-rated refund).
  const done = await condition(
    () => sawEvent('finished') || sawEvent('error'),
    input.cycleTimeoutMs,
  );
  if (done && sawEvent('error')) {
    const progress = await w.machineProgress(o.machineId);
    const amount = refundForError(o.total, progress, input.refundPolicy);
    if (amount > 0) {
      await w.refundWallet({
        userId: o.userId,
        amount,
        orderId: input.orderId,
        idempotencyKey: washRefundKey(input.orderId),
        type: amount >= o.total ? 'FULL' : 'PARTIAL',
        reason: 'machine_error',
      });
    }
    await w.machineStop(o.machineId, input.orderId);
    await w.orderTransition(input.orderId, 'REFUND_PENDING', 'machine_error');
    await w.orderTransition(input.orderId, 'REFUNDED', 'refunded');
    return { outcome: 'refunded', reason: 'machine_error' };
  }

  // 6) FinalizeOrder.
  await w.orderTransition(input.orderId, 'COMPLETED', 'wash_complete');
  return { outcome: 'completed' };
}

// ============================================================================
// delivery_order saga (pickup/delivery orders). Charge-on-successful-delivery:
// no money moves until the delivery completes, so there is nothing to refund.
// If the customer can't cover the charge at delivery time, the order is parked
// PAYMENT_PENDING (outstanding debt) — the operator-risk tradeoff of charging
// at the end. Delivery itself runs via the delivery/driver/machine FSMs.
// ============================================================================
export interface DeliveryEvent {
  type: 'completed' | 'failed';
}
export const deliveryEventSignal = defineSignal<[DeliveryEvent]>('deliveryEvent');

export interface DeliveryOrderInput {
  orderId: string;
  pickup: Record<string, unknown>;
  dropoff: Record<string, unknown>;
  deliveryTimeoutMs: number;
}
export interface DeliveryOrderResult {
  outcome: 'completed' | 'cancelled' | 'payment_pending';
  reason?: string;
}

export async function deliveryOrderWorkflow(
  input: DeliveryOrderInput,
): Promise<DeliveryOrderResult> {
  const o = await w.getOrder(input.orderId);

  // 1) Create + price the delivery (delivery service auto-assigns a driver).
  const delivery = await w.createDelivery(input.orderId, input.pickup, input.dropoff);
  const charge = o.total + delivery.fee;

  // 2) Track completion. No money has moved yet; the order stays RESERVED while
  //    the delivery/driver/machine FSMs run the pickup→wash→return.
  const events: DeliveryEvent[] = [];
  setHandler(deliveryEventSignal, (e) => {
    events.push(e);
  });

  const completed = await condition(
    () => events.some((e) => e.type === 'completed'),
    input.deliveryTimeoutMs,
  );
  if (!completed) {
    await w.orderTransition(input.orderId, 'CANCELLED', 'delivery_timeout');
    return { outcome: 'cancelled', reason: 'delivery_timeout' };
  }

  // 3) Charge wash+fee now that the delivery succeeded (idempotent).
  try {
    await w.deductWallet({
      userId: o.userId,
      amount: charge,
      orderId: input.orderId,
      idempotencyKey: `delivery-deduct:${input.orderId}`,
    });
  } catch {
    await w.orderTransition(input.orderId, 'PAYMENT_PENDING', 'charge_failed_post_delivery');
    return { outcome: 'payment_pending', reason: 'charge_failed' };
  }
  await w.orderTransition(input.orderId, 'PAID', 'wallet_deducted');
  await w.orderTransition(input.orderId, 'COMPLETED', 'delivery_complete');
  return { outcome: 'completed' };
}

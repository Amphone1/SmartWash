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
import { ownerMatch, routeAfterFraud, topupLedgerKey } from './routing';

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

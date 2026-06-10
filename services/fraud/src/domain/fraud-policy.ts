/**
 * Fraud decision policy — the categorical approve/reject gate for a topup slip.
 * Pure & deterministic. Consumes already-gathered signals (OCR fields, the
 * auto-match comparison vs the QR's expected amount + owner account, and the
 * risk score) and returns PASS / MANUAL_REVIEW / REJECT.
 *
 * Reject reasons map 1:1 onto the PaymentRejected event enum.
 */
export type FraudState = 'PASS' | 'MANUAL_REVIEW' | 'REJECT';
export type RejectReason =
  | 'duplicate'
  | 'wrong_account'
  | 'amount_mismatch'
  | 'high_risk';

export interface FraudInput {
  duplicate: boolean; // slip_hash already seen (soft; DB UNIQUE is the hard guard)
  accountMatch: boolean; // OCR account == branch owner_account
  amountExpected: number; // kip the QR was issued for
  ocrAmount: number; // kip OCR read
  ocrConfidence: number; // 0..1
  riskScore: number; // 0..100
  riskBand: 'low' | 'medium' | 'high';
}

export interface FraudDecision {
  state: FraudState;
  reason?: RejectReason;
}

export const CONFIDENCE_MIN = 0.85;
export const AMOUNT_TOLERANCE_KIP = 0; // topup must match the QR amount exactly
const RISK_HIGH = 70;
const RISK_MEDIUM = 30;

export function decide(i: FraudInput): FraudDecision {
  if (i.duplicate) return { state: 'REJECT', reason: 'duplicate' };
  if (!i.accountMatch) return { state: 'REJECT', reason: 'wrong_account' };
  if (Math.abs(i.ocrAmount - i.amountExpected) > AMOUNT_TOLERANCE_KIP) {
    return { state: 'REJECT', reason: 'amount_mismatch' };
  }
  if (i.riskBand === 'high' || i.riskScore >= RISK_HIGH) {
    return { state: 'REJECT', reason: 'high_risk' };
  }
  if (i.ocrConfidence < CONFIDENCE_MIN) return { state: 'MANUAL_REVIEW' };
  if (i.riskBand === 'medium' || i.riskScore >= RISK_MEDIUM) {
    return { state: 'MANUAL_REVIEW' };
  }
  return { state: 'PASS' };
}

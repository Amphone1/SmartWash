/**
 * Topup saga activities (run on the Node side; may do I/O). Each calls a single
 * downstream service. Activities are retried by Temporal, so they must be safe
 * to repeat — the ledger post is deduped by its idempotency_key.
 */
import { config } from './config';
import { callService } from './shared/service-client';

export interface OcrResult {
  amount: number;
  ref: string;
  account: string;
  confidence: number;
  raw: Record<string, unknown>;
}

export async function ocrParse(imageObjectKey: string): Promise<OcrResult> {
  return callService(config.ocrUrl, '/ocr/parse', 'POST', {
    imageObjectKey,
  }) as Promise<OcrResult>;
}

export async function recordOcr(qrRef: string, ocr: OcrResult): Promise<void> {
  await callService(config.paymentUrl, `/internal/payments/${qrRef}/ocr`, 'POST', {
    amount: ocr.amount,
    ref: ocr.ref,
    account: ocr.account,
    confidence: ocr.confidence,
    json: ocr.raw,
  });
}

export interface RiskResult {
  score: number;
  band: 'low' | 'medium' | 'high';
}

export async function riskScore(input: {
  amountExpected: number;
  ocrAmount: number;
  accountMatch: boolean;
}): Promise<RiskResult> {
  return callService(config.riskUrl, '/risk/score', 'POST', input) as Promise<RiskResult>;
}

export interface FraudResult {
  state: 'PASS' | 'MANUAL_REVIEW' | 'REJECT';
  reason?: string;
}

export async function fraudEvaluate(input: {
  duplicate: boolean;
  accountMatch: boolean;
  amountExpected: number;
  ocrAmount: number;
  ocrConfidence: number;
  riskScore: number;
  riskBand: 'low' | 'medium' | 'high';
}): Promise<FraudResult> {
  return callService(
    config.fraudUrl,
    '/fraud/evaluate',
    'POST',
    input,
  ) as Promise<FraudResult>;
}

export async function applyDecision(
  qrRef: string,
  state: 'PASS' | 'MANUAL_REVIEW' | 'REJECT',
  reason: string | null,
): Promise<void> {
  await callService(
    config.paymentUrl,
    `/internal/payments/${qrRef}/decision`,
    'POST',
    { state, reason: reason ?? undefined },
  );
}

/** The money movement: post a TOPUP to the ledger (idempotent). */
export async function postLedgerTopup(input: {
  userId: string;
  amount: number;
  refId: string;
  idempotencyKey: string;
}): Promise<void> {
  await callService(
    config.ledgerUrl,
    '/ledger/post',
    'POST',
    {
      userId: input.userId,
      type: 'TOPUP',
      amount: input.amount,
      refType: 'topup',
      refId: input.refId,
    },
    { idempotencyKey: input.idempotencyKey },
  );
}

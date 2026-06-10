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

// ── wash_order activities ────────────────────────────────────────────
export interface OrderDetails {
  id: string;
  userId: string;
  branchId: string;
  machineId: string;
  state: string;
  cycle: string;
  total: number;
}

export async function getOrder(orderId: string): Promise<OrderDetails> {
  const o = (await callService(config.orderUrl, `/orders/${orderId}`, 'GET')) as {
    id: string;
    userId: string;
    branchId: string;
    machineId: string;
    state: string;
    cycle?: string | null;
    total: number;
  };
  return { ...o, cycle: o.cycle ?? 'normal' };
}

export async function walletBalance(userId: string): Promise<number> {
  const w = (await callService(
    config.walletUrl,
    `/wallets/${userId}`,
    'GET',
    undefined,
    { userId },
  )) as { balance: number };
  return w.balance;
}

export async function deductWallet(x: {
  userId: string;
  amount: number;
  orderId: string;
  idempotencyKey: string;
}): Promise<void> {
  await callService(
    config.ledgerUrl,
    '/ledger/post',
    'POST',
    {
      userId: x.userId,
      type: 'DEDUCT',
      amount: -x.amount, // signed kip
      refType: 'order',
      refId: x.orderId,
    },
    { idempotencyKey: x.idempotencyKey },
  );
}

export async function refundWallet(x: {
  userId: string;
  amount: number;
  orderId: string;
  idempotencyKey: string;
}): Promise<void> {
  await callService(
    config.ledgerUrl,
    '/ledger/post',
    'POST',
    {
      userId: x.userId,
      type: 'REFUND_REVERSAL',
      amount: x.amount, // positive credit back
      refType: 'refund',
      refId: x.orderId,
    },
    { idempotencyKey: x.idempotencyKey },
  );
}

export async function orderTransition(
  orderId: string,
  to: string,
  event: string,
): Promise<void> {
  await callService(config.orderUrl, `/orders/${orderId}/transition`, 'POST', {
    to,
    event,
  });
}

export async function machineReserve(machineId: string, orderId: string): Promise<void> {
  await callService(
    config.machineUrl,
    `/internal/machines/${machineId}/reserve`,
    'POST',
    { orderId },
  );
}

export async function machineStart(
  machineId: string,
  orderId: string,
  cycle: string,
): Promise<void> {
  await callService(
    config.machineUrl,
    `/internal/machines/${machineId}/start`,
    'POST',
    { orderId, cycle },
  );
}

export async function machineStop(machineId: string, orderId?: string): Promise<void> {
  await callService(
    config.machineUrl,
    `/internal/machines/${machineId}/stop`,
    'POST',
    { orderId },
  );
}

export async function machineRelease(machineId: string): Promise<void> {
  await callService(
    config.machineUrl,
    `/internal/machines/${machineId}/release`,
    'POST',
    {},
  );
}

export async function machineProgress(machineId: string): Promise<number> {
  const s = (await callService(
    config.machineUrl,
    `/machines/${machineId}/status`,
    'GET',
  )) as { progress: number };
  return s.progress ?? 0;
}

// ── delivery_order activities ────────────────────────────────────────
export interface CreatedDelivery {
  id: string;
  fee: number;
}

export async function createDelivery(
  orderId: string,
  pickup: Record<string, unknown>,
  dropoff: Record<string, unknown>,
): Promise<CreatedDelivery> {
  const d = (await callService(
    config.deliveryUrl,
    '/internal/deliveries',
    'POST',
    { orderId, pickup, dropoff },
  )) as { id: string; fee: number };
  return { id: d.id, fee: d.fee };
}

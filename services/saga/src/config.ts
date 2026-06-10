/** Saga worker configuration (env). Read on the Node side only — never inside
 * the Temporal workflow sandbox. */
function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`required env var ${name} is not set`);
  return v;
}
function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  return v ? Number.parseInt(v, 10) : fallback;
}

export const config = {
  temporalAddress: env('TEMPORAL_ADDRESS', 'localhost:7233'),
  namespace: env('TEMPORAL_NAMESPACE', 'default'),
  taskQueue: 'topup',
  natsUrl: env('NATS_URL', 'nats://localhost:4222'),
  internalToken: requireEnv('INTERNAL_SERVICE_TOKEN'),
  // The bank account the Owner QR pays into; OCR account must match for a topup.
  ownerAccount: env('OWNER_ACCOUNT', 'OWNER-ACC-0001'),
  ocrUrl: env('OCR_URL', 'http://ocr:8001'),
  riskUrl: env('RISK_URL', 'http://risk:8002'),
  fraudUrl: env('FRAUD_URL', 'http://fraud:3008'),
  paymentUrl: env('PAYMENT_URL', 'http://payment:3009'),
  ledgerUrl: env('LEDGER_URL', 'http://ledger:3007'),
  orderUrl: env('ORDER_URL', 'http://order:3003'),
  walletUrl: env('WALLET_URL', 'http://wallet:3006'),
  machineUrl: env('MACHINE_URL', 'http://machine:3011'),
  deliveryUrl: env('DELIVERY_URL', 'http://delivery:3012'),
  staffTimeoutMs: intEnv('STAFF_REVIEW_TIMEOUT_MS', 24 * 60 * 60 * 1000),
  // wash_order: how long to await the device's RUNNING ack, and a finished cycle.
  startAckTimeoutMs: intEnv('WASH_START_ACK_TIMEOUT_MS', 60 * 1000),
  cycleTimeoutMs: intEnv('WASH_CYCLE_TIMEOUT_MS', 2 * 60 * 60 * 1000),
  refundOnError: env('WASH_REFUND_ON_ERROR', 'pro_rata'), // pro_rata | full
  deliveryTimeoutMs: intEnv('DELIVERY_TIMEOUT_MS', 6 * 60 * 60 * 1000),
  port: intEnv('PORT', 3010),
};

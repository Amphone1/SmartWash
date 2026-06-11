/** Pure routing helpers for the topup saga (sandbox-safe, unit-tested). */
export type FraudState = 'PASS' | 'MANUAL_REVIEW' | 'REJECT';
export type RouteAction = 'post_ledger' | 'await_staff' | 'end';

export function ownerMatch(ocrAccount: string, ownerAccount: string): boolean {
  return ocrAccount === ownerAccount;
}

/** What the workflow should do after the fraud gate. */
export function routeAfterFraud(state: FraudState): RouteAction {
  switch (state) {
    case 'PASS':
      return 'post_ledger';
    case 'MANUAL_REVIEW':
      return 'await_staff';
    case 'REJECT':
      return 'end';
  }
}

/** Deterministic idempotency key for a topup's ledger post. */
export function topupLedgerKey(qrRef: string): string {
  return `topup:${qrRef}`;
}

/** Deterministic ledger keys for the wash_order saga (exact-once money moves). */
export function washDeductKey(orderId: string): string {
  return `wash-deduct:${orderId}`;
}
export function washRefundKey(orderId: string): string {
  return `wash-refund:${orderId}`;
}

/**
 * Refund amount when a machine errors mid-cycle. Always integer kip.
 *   full           — refund everything regardless of progress.
 *   grace_pro_rata — failures before the cycle reaches gracePct% refund in
 *                    full (clothes are still wet/soapy — the customer got
 *                    nothing); from gracePct% onward refund the unused portion.
 *   pro_rata       — refund the unused portion based on progress%.
 */
export function refundForError(
  total: number,
  progress: number,
  policy: string,
  gracePct = 20,
): number {
  if (policy === 'full') return total;
  const clamped = Math.max(0, Math.min(100, progress));
  if (policy === 'grace_pro_rata' && clamped < gracePct) return total;
  return Math.round((total * (100 - clamped)) / 100);
}

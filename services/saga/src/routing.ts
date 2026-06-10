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

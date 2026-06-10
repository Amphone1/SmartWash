/**
 * Payment request FSM (pay_req_state). A topup: create QR (PENDING) → user
 * uploads slip (SLIP_UPLOADED) → saga decides APPROVED / REJECTED, or parks it
 * AWAITING_APPROVAL for staff. EXPIRED if the QR lapses before resolution.
 */
export type PayReqState =
  | 'PENDING'
  | 'SLIP_UPLOADED'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED';

const TRANSITIONS: Record<PayReqState, PayReqState[]> = {
  PENDING: ['SLIP_UPLOADED', 'EXPIRED'],
  SLIP_UPLOADED: ['APPROVED', 'REJECTED', 'AWAITING_APPROVAL', 'EXPIRED'],
  AWAITING_APPROVAL: ['APPROVED', 'REJECTED', 'EXPIRED'],
  APPROVED: [],
  REJECTED: [],
  EXPIRED: [],
};

export const TERMINAL: ReadonlySet<PayReqState> = new Set<PayReqState>([
  'APPROVED',
  'REJECTED',
  'EXPIRED',
]);

export function canTransition(from: PayReqState, to: PayReqState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(state: PayReqState): boolean {
  return TERMINAL.has(state);
}

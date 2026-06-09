/**
 * Order FSM (business state machine). Kept separate from the Machine FSM
 * (rule #10) — they sync only via events. This module is pure and fully
 * unit-tested; it owns the legal transition graph and nothing else.
 *
 * Phase 1 exercises CREATED → RESERVED and the cancel paths. Later phases drive
 * PAYMENT_PENDING/PAID/RUNNING/COMPLETED and refund states via the wash_order
 * saga and inbound events — the full graph is encoded here now so those phases
 * reuse the same guard.
 */

export type OrderState =
  | 'CREATED'
  | 'RESERVED'
  | 'PAYMENT_PENDING'
  | 'AWAITING_APPROVAL'
  | 'PAID'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REJECTED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

const TRANSITIONS: Record<OrderState, OrderState[]> = {
  CREATED: ['RESERVED', 'CANCELLED', 'EXPIRED'],
  RESERVED: ['PAYMENT_PENDING', 'PAID', 'CANCELLED', 'EXPIRED'],
  PAYMENT_PENDING: ['AWAITING_APPROVAL', 'PAID', 'CANCELLED', 'EXPIRED', 'REJECTED'],
  AWAITING_APPROVAL: ['PAID', 'REJECTED', 'CANCELLED'],
  PAID: ['RUNNING', 'REFUND_PENDING', 'CANCELLED'],
  RUNNING: ['COMPLETED', 'FAILED', 'REFUND_PENDING'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
  REJECTED: [],
  REFUND_PENDING: ['REFUNDED', 'FAILED'],
  REFUNDED: [],
};

export const TERMINAL_STATES: ReadonlySet<OrderState> = new Set<OrderState>([
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
  'REJECTED',
  'REFUNDED',
]);

/** States from which a customer/system may still cancel. */
export const CANCELLABLE_STATES: ReadonlySet<OrderState> = new Set<OrderState>([
  'CREATED',
  'RESERVED',
  'PAYMENT_PENDING',
  'AWAITING_APPROVAL',
]);

export function canTransition(from: OrderState, to: OrderState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(state: OrderState): boolean {
  return TERMINAL_STATES.has(state);
}

export function isCancellable(state: OrderState): boolean {
  return CANCELLABLE_STATES.has(state);
}

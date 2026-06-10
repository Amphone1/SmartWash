/**
 * Delivery FSM (delivery_state). Drives a pickup→wash→return delivery. Driver
 * acceptance, en-route, pickup, transit, delivered, completed; plus reject/
 * timeout (reassignable), cancel, fail, dispute.
 */
export type DeliveryState =
  | 'CREATED'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'EN_ROUTE_PICKUP'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'FAILED'
  | 'DISPUTED';

const TRANSITIONS: Record<DeliveryState, DeliveryState[]> = {
  CREATED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['ACCEPTED', 'REJECTED', 'TIMEOUT', 'CANCELLED'],
  ACCEPTED: ['EN_ROUTE_PICKUP', 'CANCELLED'],
  EN_ROUTE_PICKUP: ['PICKED_UP', 'FAILED', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT', 'FAILED'],
  IN_TRANSIT: ['DELIVERED', 'FAILED', 'DISPUTED'],
  DELIVERED: ['COMPLETED', 'DISPUTED'],
  COMPLETED: [],
  REJECTED: ['ASSIGNED'], // reassign to another driver
  TIMEOUT: ['ASSIGNED'], // reassign
  CANCELLED: [],
  FAILED: [],
  DISPUTED: ['COMPLETED', 'FAILED'],
};

export const TERMINAL: ReadonlySet<DeliveryState> = new Set<DeliveryState>([
  'COMPLETED',
  'CANCELLED',
  'FAILED',
]);

export function canTransition(from: DeliveryState, to: DeliveryState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(state: DeliveryState): boolean {
  return TERMINAL.has(state);
}

/** A delivery that needs a driver (assignment / reassignment). */
export function needsDriver(state: DeliveryState): boolean {
  return state === 'CREATED' || state === 'REJECTED' || state === 'TIMEOUT';
}

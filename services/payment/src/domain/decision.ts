/**
 * Maps the Fraud service's categorical decision onto the payment FSM target
 * state. PASS → APPROVED, REJECT → REJECTED, MANUAL_REVIEW → AWAITING_APPROVAL.
 */
import type { PayReqState } from './payment-fsm';

export type FraudState = 'PASS' | 'MANUAL_REVIEW' | 'REJECT';

export function targetState(fraud: FraudState): PayReqState {
  switch (fraud) {
    case 'PASS':
      return 'APPROVED';
    case 'REJECT':
      return 'REJECTED';
    case 'MANUAL_REVIEW':
      return 'AWAITING_APPROVAL';
  }
}

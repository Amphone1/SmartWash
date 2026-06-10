import { canTransition, isTerminal } from './payment-fsm';
import { targetState } from './decision';

describe('Payment FSM', () => {
  it('allows the topup happy path', () => {
    expect(canTransition('PENDING', 'SLIP_UPLOADED')).toBe(true);
    expect(canTransition('SLIP_UPLOADED', 'APPROVED')).toBe(true);
    expect(canTransition('SLIP_UPLOADED', 'AWAITING_APPROVAL')).toBe(true);
    expect(canTransition('AWAITING_APPROVAL', 'APPROVED')).toBe(true);
    expect(canTransition('AWAITING_APPROVAL', 'REJECTED')).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(canTransition('PENDING', 'APPROVED')).toBe(false);
    expect(canTransition('APPROVED', 'REJECTED')).toBe(false);
    expect(canTransition('REJECTED', 'APPROVED')).toBe(false);
  });

  it('marks terminal states', () => {
    expect(isTerminal('APPROVED')).toBe(true);
    expect(isTerminal('REJECTED')).toBe(true);
    expect(isTerminal('EXPIRED')).toBe(true);
    expect(isTerminal('SLIP_UPLOADED')).toBe(false);
  });
});

describe('decision → state mapping', () => {
  it('maps fraud decisions to payment states', () => {
    expect(targetState('PASS')).toBe('APPROVED');
    expect(targetState('REJECT')).toBe('REJECTED');
    expect(targetState('MANUAL_REVIEW')).toBe('AWAITING_APPROVAL');
  });
});

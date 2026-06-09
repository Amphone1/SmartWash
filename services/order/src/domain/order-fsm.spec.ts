import {
  canTransition,
  isCancellable,
  isTerminal,
  type OrderState,
} from './order-fsm';

describe('Order FSM', () => {
  it('allows the Phase 1 reserve path', () => {
    expect(canTransition('CREATED', 'RESERVED')).toBe(true);
    expect(canTransition('RESERVED', 'PAYMENT_PENDING')).toBe(true);
    expect(canTransition('RESERVED', 'CANCELLED')).toBe(true);
  });

  it('rejects illegal jumps', () => {
    expect(canTransition('CREATED', 'COMPLETED')).toBe(false);
    expect(canTransition('COMPLETED', 'RUNNING')).toBe(false);
    expect(canTransition('CANCELLED', 'RESERVED')).toBe(false);
  });

  it('marks terminal states', () => {
    const terminals: OrderState[] = [
      'COMPLETED',
      'CANCELLED',
      'EXPIRED',
      'REJECTED',
      'REFUNDED',
      'FAILED',
    ];
    for (const s of terminals) expect(isTerminal(s)).toBe(true);
    expect(isTerminal('RESERVED')).toBe(false);
  });

  it('defines which states are cancellable', () => {
    expect(isCancellable('RESERVED')).toBe(true);
    expect(isCancellable('PAYMENT_PENDING')).toBe(true);
    expect(isCancellable('PAID')).toBe(false);
    expect(isCancellable('RUNNING')).toBe(false);
  });

  it('terminal states have no outgoing transitions', () => {
    expect(canTransition('COMPLETED', 'RUNNING')).toBe(false);
    expect(canTransition('REFUNDED', 'PAID')).toBe(false);
  });
});

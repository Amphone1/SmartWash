import { canTransition, isTerminal, needsDriver } from './delivery-fsm';

describe('Delivery FSM', () => {
  it('drives the happy path', () => {
    const path = [
      ['CREATED', 'ASSIGNED'],
      ['ASSIGNED', 'ACCEPTED'],
      ['ACCEPTED', 'EN_ROUTE_PICKUP'],
      ['EN_ROUTE_PICKUP', 'PICKED_UP'],
      ['PICKED_UP', 'IN_TRANSIT'],
      ['IN_TRANSIT', 'DELIVERED'],
      ['DELIVERED', 'COMPLETED'],
    ] as const;
    for (const [from, to] of path) expect(canTransition(from, to)).toBe(true);
  });

  it('allows reassignment after reject/timeout', () => {
    expect(canTransition('ASSIGNED', 'REJECTED')).toBe(true);
    expect(canTransition('REJECTED', 'ASSIGNED')).toBe(true);
    expect(canTransition('TIMEOUT', 'ASSIGNED')).toBe(true);
    expect(needsDriver('REJECTED')).toBe(true);
    expect(needsDriver('TIMEOUT')).toBe(true);
    expect(needsDriver('CREATED')).toBe(true);
  });

  it('rejects illegal jumps', () => {
    expect(canTransition('CREATED', 'DELIVERED')).toBe(false);
    expect(canTransition('COMPLETED', 'IN_TRANSIT')).toBe(false);
  });

  it('marks terminal states', () => {
    expect(isTerminal('COMPLETED')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
    expect(isTerminal('FAILED')).toBe(true);
    expect(isTerminal('IN_TRANSIT')).toBe(false);
  });
});

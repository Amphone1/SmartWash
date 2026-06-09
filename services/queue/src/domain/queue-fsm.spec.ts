import { canTransition, isActive, isHoldExpired } from './queue-fsm';

describe('Queue FSM', () => {
  it('allows the normal lifecycle', () => {
    expect(canTransition('IN_QUEUE', 'CALLED')).toBe(true);
    expect(canTransition('CALLED', 'RESERVED')).toBe(true);
    expect(canTransition('RESERVED', 'DONE')).toBe(true);
  });

  it('allows leaving and expiring', () => {
    expect(canTransition('IN_QUEUE', 'LEFT')).toBe(true);
    expect(canTransition('CALLED', 'EXPIRED')).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(canTransition('DONE', 'IN_QUEUE')).toBe(false);
    expect(canTransition('IN_QUEUE', 'DONE')).toBe(false);
    expect(canTransition('LEFT', 'CALLED')).toBe(false);
  });

  it('classifies active states', () => {
    expect(isActive('IN_QUEUE')).toBe(true);
    expect(isActive('CALLED')).toBe(true);
    expect(isActive('RESERVED')).toBe(true);
    expect(isActive('LEFT')).toBe(false);
    expect(isActive('DONE')).toBe(false);
  });

  describe('isHoldExpired', () => {
    const now = new Date('2026-06-09T12:00:00Z');
    it('is true for a CALLED entry past its expiry', () => {
      expect(
        isHoldExpired('CALLED', new Date('2026-06-09T11:59:00Z'), now),
      ).toBe(true);
    });
    it('is false before expiry', () => {
      expect(
        isHoldExpired('CALLED', new Date('2026-06-09T12:05:00Z'), now),
      ).toBe(false);
    });
    it('only applies to CALLED entries', () => {
      expect(
        isHoldExpired('IN_QUEUE', new Date('2026-06-09T11:00:00Z'), now),
      ).toBe(false);
      expect(isHoldExpired('CALLED', null, now)).toBe(false);
    });
  });
});

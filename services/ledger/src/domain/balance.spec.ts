import { increasesOnDebit, naturalDelta, violatesOverdraft } from './balance';

describe('naturalDelta', () => {
  it('ASSET / EXPENSE increase on DR, decrease on CR', () => {
    expect(naturalDelta('ASSET', 'DR', 100n)).toBe(100n);
    expect(naturalDelta('ASSET', 'CR', 100n)).toBe(-100n);
    expect(naturalDelta('EXPENSE', 'DR', 100n)).toBe(100n);
  });

  it('LIABILITY / REVENUE / EQUITY increase on CR, decrease on DR', () => {
    expect(naturalDelta('LIABILITY', 'CR', 100n)).toBe(100n);
    expect(naturalDelta('LIABILITY', 'DR', 100n)).toBe(-100n);
    expect(naturalDelta('REVENUE', 'CR', 100n)).toBe(100n);
    expect(naturalDelta('EQUITY', 'CR', 100n)).toBe(100n);
  });

  it('classifies normal sides', () => {
    expect(increasesOnDebit('ASSET')).toBe(true);
    expect(increasesOnDebit('LIABILITY')).toBe(false);
  });

  it('a RESERVE moves a user liability down on DR (available) and up on CR (reserved)', () => {
    // available (LIABILITY) DR → decreases; reserved (LIABILITY) CR → increases
    expect(naturalDelta('LIABILITY', 'DR', 30000n)).toBe(-30000n);
    expect(naturalDelta('LIABILITY', 'CR', 30000n)).toBe(30000n);
  });
});

describe('violatesOverdraft', () => {
  it('flags a negative user wallet balance', () => {
    expect(violatesOverdraft('user', -1n)).toBe(true);
    expect(violatesOverdraft('user', 0n)).toBe(false);
    expect(violatesOverdraft('user', 5n)).toBe(false);
  });

  it('does not constrain non-user accounts', () => {
    expect(violatesOverdraft('branch', -1000n)).toBe(false);
    expect(violatesOverdraft('platform', -1000n)).toBe(false);
    expect(violatesOverdraft('tax', -1000n)).toBe(false);
    expect(violatesOverdraft('staff', -1000n)).toBe(false);
  });
});

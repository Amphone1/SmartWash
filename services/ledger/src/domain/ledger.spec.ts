import { validateSign, nextBalance } from './ledger';

describe('ledger sign rules', () => {
  it('TOPUP must be positive', () => {
    expect(() => validateSign('TOPUP', 20000n)).not.toThrow();
    expect(() => validateSign('TOPUP', -1n)).toThrow();
    expect(() => validateSign('TOPUP', 0n)).toThrow();
  });

  it('DEDUCT must be negative', () => {
    expect(() => validateSign('DEDUCT', -5000n)).not.toThrow();
    expect(() => validateSign('DEDUCT', 5000n)).toThrow();
  });

  it('REFUND_REVERSAL must be positive', () => {
    expect(() => validateSign('REFUND_REVERSAL', 5000n)).not.toThrow();
    expect(() => validateSign('REFUND_REVERSAL', -5000n)).toThrow();
  });

  it('ADJUSTMENT must be non-zero', () => {
    expect(() => validateSign('ADJUSTMENT', 1n)).not.toThrow();
    expect(() => validateSign('ADJUSTMENT', -1n)).not.toThrow();
    expect(() => validateSign('ADJUSTMENT', 0n)).toThrow();
  });
});

describe('nextBalance', () => {
  it('accumulates signed amounts as bigint', () => {
    expect(nextBalance(0n, 20000n)).toBe(20000n);
    expect(nextBalance(20000n, -5000n)).toBe(15000n);
    expect(nextBalance(0n, 9_000_000_000_000_000n)).toBe(9_000_000_000_000_000n);
  });
});

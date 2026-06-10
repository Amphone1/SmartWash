import { driverPayout, platformRevenue, sumKip } from './settlement-math';

describe('settlement math', () => {
  it('platform revenue = bps of gross (integer kip)', () => {
    expect(platformRevenue(1_000_000n, 2000)).toBe(200_000n); // 20%
    expect(platformRevenue(0n, 2000)).toBe(0n);
  });

  it('driver payout = bps of fees earned', () => {
    expect(driverPayout(100_000n, 7000)).toBe(70_000n); // 70%
  });

  it('rounds toward zero, stays bigint', () => {
    const p = platformRevenue(1001n, 2000); // 200.2 → 200
    expect(p).toBe(200n);
    expect(typeof p).toBe('bigint');
  });

  it('sumKip adds a list', () => {
    expect(sumKip([10n, 20n, 30n])).toBe(60n);
    expect(sumKip([])).toBe(0n);
  });
});

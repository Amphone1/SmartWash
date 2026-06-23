import {
  toKip,
  add,
  subtract,
  multiply,
  applyBasisPoints,
  splitVatInclusive,
  canCover,
  formatKip,
  isNegative,
  isNonNegative,
  isZero,
  MoneyError,
  ZERO_KIP,
} from './money';

describe('money (kip / bigint)', () => {
  describe('toKip', () => {
    it('accepts bigint, safe number, and integer string', () => {
      expect(toKip(1500000n)).toBe(1500000n);
      expect(toKip(25000)).toBe(25000n);
      expect(toKip('900000000000000')).toBe(900000000000000n);
      expect(toKip('-5000')).toBe(-5000n);
    });

    it('rejects fractional numbers (kip has no minor unit)', () => {
      expect(() => toKip(1000.5)).toThrow(MoneyError);
    });

    it('rejects NaN / Infinity', () => {
      expect(() => toKip(Number.NaN)).toThrow(MoneyError);
      expect(() => toKip(Number.POSITIVE_INFINITY)).toThrow(MoneyError);
    });

    it('rejects numbers beyond safe-integer range', () => {
      expect(() => toKip(Number.MAX_SAFE_INTEGER + 1)).toThrow(MoneyError);
    });

    it('rejects malformed strings', () => {
      expect(() => toKip('1,500,000')).toThrow(MoneyError);
      expect(() => toKip('10.5')).toThrow(MoneyError);
      expect(() => toKip('abc')).toThrow(MoneyError);
    });

    it('preserves precision past 2^53', () => {
      const huge = '9007199254740993'; // 2^53 + 1, unrepresentable as a JS number
      expect(toKip(huge)).toBe(9007199254740993n);
    });
  });

  describe('arithmetic', () => {
    it('adds and subtracts', () => {
      expect(add(toKip(1000), toKip(500))).toBe(1500n);
      expect(subtract(toKip(1000), toKip(1500))).toBe(-500n);
    });

    it('multiplies by an integer factor', () => {
      expect(multiply(toKip(25000), 3)).toBe(75000n);
    });

    it('applies VAT as basis points, rounding toward zero', () => {
      // 10% VAT on 25,000 kip = 2,500
      expect(applyBasisPoints(toKip(25000), 1000)).toBe(2500n);
      // 7% on 1,001 = 70.07 → 70
      expect(applyBasisPoints(toKip(1001), 700)).toBe(70n);
    });

    it('rejects negative basis points', () => {
      expect(() => applyBasisPoints(toKip(1000), -100)).toThrow(MoneyError);
    });
  });

  describe('splitVatInclusive', () => {
    it('splits a clean VAT-inclusive gross (10% of net)', () => {
      // net 20,000 + 10% VAT 2,000 = 22,000 gross
      expect(splitVatInclusive(toKip(22000), 1000)).toEqual({ net: 20000n, vat: 2000n });
    });

    it('always satisfies net + vat === gross (recon-safe)', () => {
      for (const g of [1n, 7n, 999n, 22001n, 123457n]) {
        const { net, vat } = splitVatInclusive(g, 1000);
        expect(net + vat).toBe(g);
      }
    });

    it('posts the floor remainder to VAT', () => {
      // gross 22,001 @ 10%: net = floor(22001*10000/11000) = floor(20000.9) = 20000;
      // vat = 2,001 (carries the remainder)
      expect(splitVatInclusive(toKip(22001), 1000)).toEqual({ net: 20000n, vat: 2001n });
    });

    it('vatBps = 0 → all net, no VAT', () => {
      expect(splitVatInclusive(toKip(15000), 0)).toEqual({ net: 15000n, vat: 0n });
    });

    it('keeps precision past 2^53', () => {
      const g = 9007199254740993n; // 2^53 + 1
      const { net, vat } = splitVatInclusive(g, 1000);
      expect(net + vat).toBe(g);
    });

    it('rejects a negative gross and negative bps', () => {
      expect(() => splitVatInclusive(-1n, 1000)).toThrow(MoneyError);
      expect(() => splitVatInclusive(toKip(1000), -1)).toThrow(MoneyError);
    });
  });

  describe('predicates', () => {
    it('classifies sign and zero', () => {
      expect(isNegative(-1n)).toBe(true);
      expect(isNonNegative(ZERO_KIP)).toBe(true);
      expect(isZero(ZERO_KIP)).toBe(true);
    });

    it('canCover compares balance to amount', () => {
      expect(canCover(toKip(50000), toKip(25000))).toBe(true);
      expect(canCover(toKip(10000), toKip(25000))).toBe(false);
      expect(canCover(toKip(25000), toKip(25000))).toBe(true);
    });
  });

  describe('formatKip', () => {
    it('inserts thousands separators', () => {
      expect(formatKip(1500000n)).toBe('1,500,000');
      expect(formatKip(0n)).toBe('0');
      expect(formatKip(-25000n)).toBe('-25,000');
    });
  });
});

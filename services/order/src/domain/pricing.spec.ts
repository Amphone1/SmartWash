import { priceOrder } from './pricing';
import { toKip } from '@smartwash/common';

describe('priceOrder', () => {
  it('applies normal cycle (1.0x) with no VAT', () => {
    const p = priceOrder(toKip(20000), 'normal', [], 0);
    expect(p.subtotal).toBe(20000n);
    expect(p.vat).toBe(0n);
    expect(p.total).toBe(20000n);
  });

  it('scales quick (0.8x) and heavy (1.3x)', () => {
    expect(priceOrder(toKip(20000), 'quick', [], 0).subtotal).toBe(16000n);
    expect(priceOrder(toKip(20000), 'heavy', [], 0).subtotal).toBe(26000n);
  });

  it('defaults to normal when cycle is undefined', () => {
    expect(priceOrder(toKip(20000), undefined, [], 0).subtotal).toBe(20000n);
  });

  it('adds addon fees into subtotal', () => {
    const p = priceOrder(toKip(20000), 'normal', [toKip(5000), toKip(2500)], 0);
    expect(p.subtotal).toBe(27500n);
  });

  it('applies VAT as basis points on subtotal', () => {
    // 10% VAT (1000 bps) on 20,000 = 2,000 → total 22,000
    const p = priceOrder(toKip(20000), 'normal', [], 1000);
    expect(p.vat).toBe(2000n);
    expect(p.total).toBe(22000n);
  });

  it('keeps everything as bigint (no floats)', () => {
    const p = priceOrder(toKip(20001), 'heavy', [], 700);
    expect(typeof p.subtotal).toBe('bigint');
    expect(typeof p.vat).toBe('bigint');
    expect(typeof p.total).toBe('bigint');
  });
});

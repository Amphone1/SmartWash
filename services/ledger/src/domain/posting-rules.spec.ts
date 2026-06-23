import {
  buildTopup,
  buildTopupSettle,
  buildReserve,
  buildHold,
  buildCapture,
  buildRelease,
  buildRefundReversal,
  buildAdjustment,
  buildSettlement,
} from './posting-rules';
import { UnbalancedTransactionError, ValidationError, AccountNotFoundError } from '@smartwash/common';

const U = '44444444-4444-4444-8444-444444444444';
const B = '55555555-5555-4555-8555-555555555555';
const S = '66666666-6666-4666-8666-666666666666';

/** Compact view of postings: "DIR accountKey amount". */
const shape = (postings: { direction: string; accountKey: string; amount: bigint }[]) =>
  postings.map((p) => `${p.direction} ${p.accountKey} ${p.amount}`);

describe('TOPUP', () => {
  it('DR clearing:branch / CR wallet:pending', () => {
    const t = buildTopup({ qrRef: 'QR1', userId: U, branchId: B, amount: 50000n });
    expect(t.type).toBe('TOPUP');
    expect(t.idempotencyKey).toBe('topup:QR1');
    expect(shape(t.postings)).toEqual([
      `DR clearing:branch:${B} 50000`,
      `CR pending:user:${U} 50000`,
    ]);
  });
});

describe('TOPUP_SETTLE', () => {
  it('two balanced pairs (bank/clearing + pending/available)', () => {
    const t = buildTopupSettle({ qrRef: 'QR1', userId: U, branchId: B, amount: 50000n });
    expect(t.idempotencyKey).toBe('topup-settle:QR1');
    expect(shape(t.postings)).toEqual([
      `DR bank:branch:${B} 50000`,
      `CR clearing:branch:${B} 50000`,
      `DR pending:user:${U} 50000`,
      `CR available:user:${U} 50000`,
    ]);
  });
});

describe('RESERVE / HOLD / RELEASE', () => {
  it('RESERVE: DR available / CR reserved', () => {
    const t = buildReserve({ orderId: 'o1', userId: U, amount: 22000n });
    expect(t.idempotencyKey).toBe('reserve:o1');
    expect(shape(t.postings)).toEqual([`DR available:user:${U} 22000`, `CR reserved:user:${U} 22000`]);
  });
  it('HOLD: DR available / CR held', () => {
    const t = buildHold({ orderId: 'o1', userId: U, amount: 22000n });
    expect(t.idempotencyKey).toBe('hold:o1');
    expect(shape(t.postings)).toEqual([`DR available:user:${U} 22000`, `CR held:user:${U} 22000`]);
  });
  it('RELEASE from held: DR held / CR available', () => {
    const t = buildRelease({ orderId: 'o1', userId: U, amount: 22000n, source: 'held' });
    expect(t.idempotencyKey).toBe('release:o1');
    expect(shape(t.postings)).toEqual([`DR held:user:${U} 22000`, `CR available:user:${U} 22000`]);
  });
});

describe('CAPTURE', () => {
  it('wash: DR reserved (gross) / CR revenue (net) + CR vat', () => {
    const t = buildCapture({ orderId: 'o1', userId: U, branchId: B, gross: 22000n, vatBps: 1000, channel: 'wash' });
    expect(t.idempotencyKey).toBe('wash-deduct:o1');
    expect(shape(t.postings)).toEqual([
      `DR reserved:user:${U} 22000`,
      `CR revenue:branch:${B} 20000`,
      `CR vat:tax:_ 2000`,
    ]);
  });
  it('delivery: source held, key delivery-deduct', () => {
    const t = buildCapture({ orderId: 'o1', userId: U, branchId: B, gross: 22000n, vatBps: 1000, channel: 'delivery' });
    expect(t.idempotencyKey).toBe('delivery-deduct:o1');
    expect(t.postings[0].accountKey).toBe(`held:user:${U}`);
  });
  it('vatBps=0: no VAT line (2 postings, balanced)', () => {
    const t = buildCapture({ orderId: 'o1', userId: U, branchId: B, gross: 15000n, vatBps: 0, channel: 'wash' });
    expect(t.postings).toHaveLength(2);
    expect(shape(t.postings)).toEqual([`DR reserved:user:${U} 15000`, `CR revenue:branch:${B} 15000`]);
  });
  it('remainder lands in VAT, stays balanced', () => {
    const t = buildCapture({ orderId: 'o1', userId: U, branchId: B, gross: 22001n, vatBps: 1000, channel: 'wash' });
    const cr = t.postings.filter((p) => p.direction === 'CR').reduce((s, p) => s + p.amount, 0n);
    expect(cr).toBe(22001n); // net 20000 + vat 2001
    expect(t.postings.find((p) => p.accountKey === 'vat:tax:_')?.amount).toBe(2001n);
  });
});

describe('REFUND_REVERSAL', () => {
  it('full: DR revenue (net) + DR vat / CR available (gross)', () => {
    const t = buildRefundReversal({ orderId: 'o1', userId: U, branchId: B, gross: 22000n, vatBps: 1000 });
    expect(t.idempotencyKey).toBe('wash-refund:o1');
    expect(shape(t.postings)).toEqual([
      `DR revenue:branch:${B} 20000`,
      `DR vat:tax:_ 2000`,
      `CR available:user:${U} 22000`,
    ]);
  });
  it('partial: key carries :partial:{seq}', () => {
    const t = buildRefundReversal({ orderId: 'o1', userId: U, branchId: B, gross: 11000n, vatBps: 1000, seq: 2 });
    expect(t.idempotencyKey).toBe('wash-refund:o1:partial:2');
  });
});

describe('ADJUSTMENT', () => {
  it('accepts a balanced caller-supplied line set', () => {
    const t = buildAdjustment({
      ref: 'recon-7', seq: 1,
      lines: [
        { account: { ownerType: 'platform', sub: 'suspense' }, direction: 'DR', amount: 500n },
        { account: { ownerType: 'branch', sub: 'bank', ownerId: B }, direction: 'CR', amount: 500n },
      ],
    });
    expect(t.idempotencyKey).toBe('adjust:recon-7:1');
    expect(t.postings).toHaveLength(2);
  });
  it('rejects an unbalanced line set', () => {
    expect(() =>
      buildAdjustment({
        ref: 'recon-7',
        lines: [
          { account: { ownerType: 'platform', sub: 'suspense' }, direction: 'DR', amount: 500n },
          { account: { ownerType: 'branch', sub: 'bank', ownerId: B }, direction: 'CR', amount: 400n },
        ],
      }),
    ).toThrow(UnbalancedTransactionError);
  });
});

describe('SETTLEMENT', () => {
  it('DR payable:staff / CR bank:platform', () => {
    const t = buildSettlement({ branchId: B, period: '2026-06', staffId: S, amount: 80000n });
    expect(t.idempotencyKey).toBe('settle:55555555-5555-4555-8555-555555555555:2026-06');
    expect(shape(t.postings)).toEqual([`DR payable:staff:${S} 80000`, `CR bank:platform:_ 80000`]);
  });
});

describe('guards', () => {
  it('rejects a non-positive amount', () => {
    expect(() => buildReserve({ orderId: 'o1', userId: U, amount: 0n })).toThrow(ValidationError);
    expect(() => buildReserve({ orderId: 'o1', userId: U, amount: -5n })).toThrow(ValidationError);
  });
  it('rejects a vendor account in an adjustment (fail closed)', () => {
    expect(() =>
      buildAdjustment({
        ref: 'x',
        lines: [
          { account: { ownerType: 'vendor' as never, sub: 'available', ownerId: U }, direction: 'DR', amount: 1n },
          { account: { ownerType: 'platform', sub: 'suspense' }, direction: 'CR', amount: 1n },
        ],
      }),
    ).toThrow(AccountNotFoundError);
  });
});

import { type DualWriteContext, flowFor, mapLegacyToIntents } from './dual-write-map';

const U = '44444444-4444-4444-8444-444444444444';
const B = '55555555-5555-4555-8555-555555555555';

const base = (over: Partial<DualWriteContext>): DualWriteContext => ({
  userId: U,
  type: 'TOPUP',
  refType: 'topup',
  refId: 'ref-1',
  amount: 50000n,
  legacyBalanceAfter: 50000n,
  ...over,
});

const keys = (r: ReturnType<typeof mapLegacyToIntents>) =>
  'intents' in r ? r.intents.map((i) => i.idempotencyKey) : r;

describe('flowFor', () => {
  it('maps type/channel to a flow label', () => {
    expect(flowFor(base({ type: 'TOPUP' }))).toBe('topup');
    expect(flowFor(base({ type: 'DEDUCT', channel: 'wash' }))).toBe('wash');
    expect(flowFor(base({ type: 'DEDUCT', channel: 'delivery' }))).toBe('delivery');
    expect(flowFor(base({ type: 'REFUND_REVERSAL' }))).toBe('refund');
    expect(flowFor(base({ type: 'ADJUSTMENT' }))).toBe('adjust');
  });
});

describe('mapLegacyToIntents', () => {
  it('TOPUP → TOPUP + TOPUP_SETTLE in the isolated dual: keyspace', () => {
    const r = mapLegacyToIntents(base({ type: 'TOPUP', branchId: B, amount: 50000n }));
    expect(keys(r)).toEqual(['topup:dual:ref-1', 'topup-settle:dual:ref-1']);
    if (!('intents' in r)) throw new Error('expected intents');
    expect(r.intents[1].type).toBe('TOPUP_SETTLE');
  });

  it('TOPUP without branchId → skip', () => {
    expect(mapLegacyToIntents(base({ type: 'TOPUP', amount: 50000n }))).toEqual({ skip: 'missing_branchId' });
  });

  it('DEDUCT wash → RESERVE + CAPTURE (gross = −amount)', () => {
    const r = mapLegacyToIntents(
      base({ type: 'DEDUCT', refType: 'order', refId: 'o1', amount: -22000n, branchId: B, vatBps: 1000, channel: 'wash' }),
    );
    expect(keys(r)).toEqual(['reserve:dual:o1', 'wash-deduct:dual:o1']);
    if (!('intents' in r)) throw new Error('expected intents');
    const cap = r.intents[1];
    const cr = cap.postings.filter((p) => p.direction === 'CR').reduce((s, p) => s + p.amount, 0n);
    expect(cr).toBe(22000n); // net + vat = gross
  });

  it('DEDUCT delivery → HOLD + CAPTURE(delivery)', () => {
    const r = mapLegacyToIntents(
      base({ type: 'DEDUCT', refType: 'order', refId: 'o1', amount: -22000n, branchId: B, vatBps: 1000, channel: 'delivery' }),
    );
    expect(keys(r)).toEqual(['hold:dual:o1', 'delivery-deduct:dual:o1']);
  });

  it('DEDUCT missing context → skip with the precise reason', () => {
    expect(mapLegacyToIntents(base({ type: 'DEDUCT', amount: -1n, vatBps: 1000, channel: 'wash' }))).toEqual({ skip: 'missing_branchId' });
    expect(mapLegacyToIntents(base({ type: 'DEDUCT', amount: -1n, branchId: B, channel: 'wash' }))).toEqual({ skip: 'missing_vatBps' });
    expect(mapLegacyToIntents(base({ type: 'DEDUCT', amount: -1n, branchId: B, vatBps: 1000 }))).toEqual({ skip: 'missing_channel' });
  });

  it('REFUND_REVERSAL → single REFUND_REVERSAL', () => {
    const r = mapLegacyToIntents(
      base({ type: 'REFUND_REVERSAL', refType: 'refund', refId: 'o1', amount: 22000n, branchId: B, vatBps: 1000 }),
    );
    expect(keys(r)).toEqual(['wash-refund:dual:o1']);
  });

  it('ADJUSTMENT +amount: DR suspense:platform / CR available:user', () => {
    const r = mapLegacyToIntents(base({ type: 'ADJUSTMENT', refType: 'recon', refId: 'r1', amount: 5000n }));
    if (!('intents' in r)) throw new Error('expected intents');
    const shape = r.intents[0].postings.map((p) => `${p.direction} ${p.accountKey} ${p.amount}`);
    expect(shape).toEqual([`DR suspense:platform:_ 5000`, `CR available:user:${U} 5000`]);
  });

  it('ADJUSTMENT −amount: DR available:user / CR suspense:platform', () => {
    const r = mapLegacyToIntents(base({ type: 'ADJUSTMENT', refType: 'recon', refId: 'r1', amount: -5000n }));
    if (!('intents' in r)) throw new Error('expected intents');
    const shape = r.intents[0].postings.map((p) => `${p.direction} ${p.accountKey} ${p.amount}`);
    expect(shape).toEqual([`DR available:user:${U} 5000`, `CR suspense:platform:_ 5000`]);
  });
});

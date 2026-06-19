/**
 * A3 integration suite — exercises every operation through the builder and asserts
 * the cross-cutting invariants hold for all of them at once (posting-rules × A2
 * account layer × money primitives). Pure (no DB); the DB-level acceptance of these
 * shapes is verified by infra/db/init/tests/a3_posting_rules.verify.sql.
 */
import {
  type TransactionIntent,
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
import { parseAccountKey, validateAccountRef } from './accounts';

const U = '44444444-4444-4444-8444-444444444444';
const B = '55555555-5555-4555-8555-555555555555';
const S = '66666666-6666-4666-8666-666666666666';

const ALL: Array<{ name: string; txn: TransactionIntent; keyPattern: RegExp }> = [
  { name: 'TOPUP', txn: buildTopup({ qrRef: 'QR', userId: U, branchId: B, amount: 50000n }), keyPattern: /^topup:/ },
  { name: 'TOPUP_SETTLE', txn: buildTopupSettle({ qrRef: 'QR', userId: U, branchId: B, amount: 50000n }), keyPattern: /^topup-settle:/ },
  { name: 'RESERVE', txn: buildReserve({ orderId: 'o', userId: U, amount: 22000n }), keyPattern: /^reserve:/ },
  { name: 'HOLD', txn: buildHold({ orderId: 'o', userId: U, amount: 22000n }), keyPattern: /^hold:/ },
  { name: 'CAPTURE', txn: buildCapture({ orderId: 'o', userId: U, branchId: B, gross: 22001n, vatBps: 1000, channel: 'wash' }), keyPattern: /^wash-deduct:/ },
  { name: 'RELEASE', txn: buildRelease({ orderId: 'o', userId: U, amount: 22000n, source: 'reserved' }), keyPattern: /^release:/ },
  { name: 'REFUND_REVERSAL', txn: buildRefundReversal({ orderId: 'o', userId: U, branchId: B, gross: 22001n, vatBps: 1000 }), keyPattern: /^wash-refund:/ },
  {
    name: 'ADJUSTMENT',
    txn: buildAdjustment({
      ref: 'r', seq: 1,
      lines: [
        { account: { ownerType: 'platform', sub: 'suspense' }, direction: 'DR', amount: 700n },
        { account: { ownerType: 'branch', sub: 'bank', ownerId: B }, direction: 'CR', amount: 700n },
      ],
    }),
    keyPattern: /^adjust:/,
  },
  { name: 'SETTLEMENT', txn: buildSettlement({ branchId: B, period: '2026-06', staffId: S, amount: 80000n }), keyPattern: /^settle:/ },
];

describe('A3 invariants across all 9 operations', () => {
  it('covers exactly the 9 ledger_txn_type operations', () => {
    expect(new Set(ALL.map((c) => c.txn.type)).size).toBe(9);
  });

  for (const c of ALL) {
    describe(c.name, () => {
      it('is balanced (Σ DR = Σ CR) with ≥2 postings', () => {
        let dr = 0n;
        let cr = 0n;
        for (const p of c.txn.postings) {
          if (p.direction === 'DR') dr += p.amount;
          else cr += p.amount;
        }
        expect(c.txn.postings.length).toBeGreaterThanOrEqual(2);
        expect(dr).toBe(cr);
        expect(dr).toBeGreaterThan(0n);
      });

      it('has a deterministic idempotency key of the right shape', () => {
        expect(c.txn.idempotencyKey).toMatch(c.keyPattern);
      });

      it('every posting has a positive amount and a resolvable account ref', () => {
        for (const p of c.txn.postings) {
          expect(p.amount).toBeGreaterThan(0n);
          // ref validates (fail-closed) and the canonical key round-trips
          const n = validateAccountRef(p.account);
          expect(p.accountKey).toBe(n.accountKey);
          expect(() => parseAccountKey(p.accountKey)).not.toThrow();
        }
      });
    });
  }

  it('CAPTURE and REFUND_REVERSAL keep net + vat === gross', () => {
    const cap = buildCapture({ orderId: 'o', userId: U, branchId: B, gross: 22001n, vatBps: 1000, channel: 'wash' });
    const capCr = cap.postings.filter((p) => p.direction === 'CR').reduce((s, p) => s + p.amount, 0n);
    expect(capCr).toBe(22001n);

    const ref = buildRefundReversal({ orderId: 'o', userId: U, branchId: B, gross: 22001n, vatBps: 1000 });
    const refDr = ref.postings.filter((p) => p.direction === 'DR').reduce((s, p) => s + p.amount, 0n);
    expect(refDr).toBe(22001n);
  });
});

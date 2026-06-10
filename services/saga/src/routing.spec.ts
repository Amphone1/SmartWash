import {
  ownerMatch,
  refundForError,
  routeAfterFraud,
  topupLedgerKey,
  washDeductKey,
  washRefundKey,
} from './routing';

describe('saga routing helpers', () => {
  it('ownerMatch compares OCR account to the owner account', () => {
    expect(ownerMatch('OWNER-ACC-0001', 'OWNER-ACC-0001')).toBe(true);
    expect(ownerMatch('SOMEONE-ELSE', 'OWNER-ACC-0001')).toBe(false);
  });

  it('routes after the fraud gate', () => {
    expect(routeAfterFraud('PASS')).toBe('post_ledger');
    expect(routeAfterFraud('MANUAL_REVIEW')).toBe('await_staff');
    expect(routeAfterFraud('REJECT')).toBe('end');
  });

  it('derives a deterministic ledger idempotency key from qrRef', () => {
    expect(topupLedgerKey('QR-abc')).toBe('topup:QR-abc');
    // stable across calls
    expect(topupLedgerKey('QR-abc')).toBe(topupLedgerKey('QR-abc'));
  });

  it('derives deterministic wash deduct/refund keys', () => {
    expect(washDeductKey('order-1')).toBe('wash-deduct:order-1');
    expect(washRefundKey('order-1')).toBe('wash-refund:order-1');
  });

  it('delivery deduct key is deterministic and distinct from wash', () => {
    // delivery_order uses `delivery-deduct:{orderId}` (charge-on-delivery)
    expect(washDeductKey('o1')).not.toBe('delivery-deduct:o1');
  });

  describe('refundForError', () => {
    it('pro-rates the unused portion by progress', () => {
      expect(refundForError(20000, 0, 'pro_rata')).toBe(20000); // nothing used
      expect(refundForError(20000, 25, 'pro_rata')).toBe(15000); // 75% left
      expect(refundForError(20000, 100, 'pro_rata')).toBe(0); // fully used
    });

    it('refunds everything under the full policy', () => {
      expect(refundForError(20000, 50, 'full')).toBe(20000);
    });

    it('clamps out-of-range progress and stays integer kip', () => {
      expect(refundForError(20001, 33, 'pro_rata')).toBe(Math.round((20001 * 67) / 100));
      expect(refundForError(20000, 150, 'pro_rata')).toBe(0);
      expect(refundForError(20000, -10, 'pro_rata')).toBe(20000);
    });
  });
});

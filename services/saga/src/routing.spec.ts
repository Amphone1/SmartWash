import { ownerMatch, routeAfterFraud, topupLedgerKey } from './routing';

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
});

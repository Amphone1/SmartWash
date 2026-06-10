import { reconcile, type BankLine, type Topup } from './reconcile';

describe('reconcile', () => {
  it('VERIFIES a clean 1:1 amount match', () => {
    const bank: BankLine[] = [{ idx: 0, amount: 20000 }];
    const topups: Topup[] = [{ ledgerId: 1, amount: 20000 }];
    const r = reconcile(bank, topups);
    expect(r.lines[0]).toEqual({ idx: 0, status: 'VERIFIED', matchedLedgerId: 1 });
    expect(r.counts).toMatchObject({ matched: 1, suspicious: 0, orphan: 0, review: 0 });
  });

  it('ORPHANs a bank line with no matching TOPUP', () => {
    const r = reconcile([{ idx: 0, amount: 999 }], [{ ledgerId: 1, amount: 20000 }]);
    expect(r.lines[0].status).toBe('ORPHAN');
    // the unmatched TOPUP is suspicious
    expect(r.suspiciousLedgerIds).toEqual([1]);
    expect(r.counts).toMatchObject({ orphan: 1, suspicious: 1 });
  });

  it('flags a TOPUP with no bank deposit as SUSPICIOUS', () => {
    const r = reconcile([], [{ ledgerId: 7, amount: 50000 }]);
    expect(r.suspiciousLedgerIds).toEqual([7]);
    expect(r.counts.suspicious).toBe(1);
  });

  it('disambiguates equal amounts by ref → VERIFIED', () => {
    const bank: BankLine[] = [{ idx: 0, amount: 20000, ref: 'R2' }];
    const topups: Topup[] = [
      { ledgerId: 1, amount: 20000, ref: 'R1' },
      { ledgerId: 2, amount: 20000, ref: 'R2' },
    ];
    const r = reconcile(bank, topups);
    expect(r.lines[0]).toEqual({ idx: 0, status: 'VERIFIED', matchedLedgerId: 2 });
    expect(r.suspiciousLedgerIds).toEqual([1]); // the other one unmatched
  });

  it('REVIEWs ambiguous equal amounts when ref cannot disambiguate', () => {
    const bank: BankLine[] = [{ idx: 0, amount: 20000 }];
    const topups: Topup[] = [
      { ledgerId: 1, amount: 20000 },
      { ledgerId: 2, amount: 20000 },
    ];
    const r = reconcile(bank, topups);
    expect(r.lines[0].status).toBe('REVIEW');
    expect(r.counts.review).toBe(1);
    // neither consumed → both still suspicious
    expect(r.suspiciousLedgerIds.sort()).toEqual([1, 2]);
  });

  it('does not double-match one TOPUP to two bank lines', () => {
    const bank: BankLine[] = [
      { idx: 0, amount: 20000 },
      { idx: 1, amount: 20000 },
    ];
    const topups: Topup[] = [{ ledgerId: 1, amount: 20000 }];
    const r = reconcile(bank, topups);
    const verified = r.lines.filter((l) => l.status === 'VERIFIED');
    expect(verified).toHaveLength(1);
    expect(r.lines.filter((l) => l.status === 'ORPHAN')).toHaveLength(1);
  });
});

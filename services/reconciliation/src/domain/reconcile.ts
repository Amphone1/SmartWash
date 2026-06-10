/**
 * Bank-statement ↔ ledger-TOPUP matcher (pure). The heart of "No Bank API →
 * reconcile daily". Read-only over the ledger (rule #2 — never mutates entries).
 *
 *   VERIFIED   bank line ↔ exactly one TOPUP (amount; ref disambiguates ties)
 *   REVIEW     amount matches several TOPUPs and ref can't disambiguate
 *   ORPHAN     bank deposit with no TOPUP (money in, wallet not credited)
 *   SUSPICIOUS TOPUP with no bank deposit (wallet credited, no money in) — fraud
 */
export type ReconStatus = 'VERIFIED' | 'REVIEW' | 'SUSPICIOUS' | 'ORPHAN';

export interface BankLine {
  idx: number;
  amount: number; // kip
  ref?: string;
}
export interface Topup {
  ledgerId: number;
  amount: number; // kip
  ref?: string;
}

export interface LineResult {
  idx: number;
  status: 'VERIFIED' | 'REVIEW' | 'ORPHAN';
  matchedLedgerId?: number;
}

export interface ReconResult {
  lines: LineResult[];
  suspiciousLedgerIds: number[];
  counts: { matched: number; review: number; suspicious: number; orphan: number };
}

export function reconcile(bankLines: BankLine[], topups: Topup[]): ReconResult {
  const matched = new Set<number>();
  const lines: LineResult[] = [];

  for (const bl of bankLines) {
    const candidates = topups.filter(
      (t) => t.amount === bl.amount && !matched.has(t.ledgerId),
    );

    if (candidates.length === 0) {
      lines.push({ idx: bl.idx, status: 'ORPHAN' });
      continue;
    }
    if (candidates.length === 1) {
      matched.add(candidates[0].ledgerId);
      lines.push({ idx: bl.idx, status: 'VERIFIED', matchedLedgerId: candidates[0].ledgerId });
      continue;
    }
    // Multiple amount matches → disambiguate by ref.
    const byRef = bl.ref ? candidates.filter((c) => c.ref && c.ref === bl.ref) : [];
    if (byRef.length === 1) {
      matched.add(byRef[0].ledgerId);
      lines.push({ idx: bl.idx, status: 'VERIFIED', matchedLedgerId: byRef[0].ledgerId });
    } else {
      lines.push({ idx: bl.idx, status: 'REVIEW' });
    }
  }

  // TOPUPs nobody matched → suspicious (credited with no bank backing).
  const suspiciousLedgerIds = topups
    .filter((t) => !matched.has(t.ledgerId))
    .map((t) => t.ledgerId);

  return {
    lines,
    suspiciousLedgerIds,
    counts: {
      matched: lines.filter((l) => l.status === 'VERIFIED').length,
      review: lines.filter((l) => l.status === 'REVIEW').length,
      orphan: lines.filter((l) => l.status === 'ORPHAN').length,
      suspicious: suspiciousLedgerIds.length,
    },
  };
}

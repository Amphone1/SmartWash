import type { ReconStatus } from './reconcile';

export interface LedgerTopup {
  ledgerId: number;
  amount: number;
  ref?: string;
}

export interface StatementLine {
  amount: number;
  ref?: string;
  sender?: string;
  txnDate?: string;
}

export interface PersistLine {
  amount: number;
  ref?: string;
  sender?: string;
  txnDate?: string;
  status: ReconStatus;
  matchedLedgerId?: number;
}

export interface ReconRunView {
  id: string;
  branchId: string;
  reconDate: string;
  matched: number;
  review: number;
  suspicious: number;
  orphan: number;
  status: string;
}

export interface ReconciliationRepository {
  /** TOPUP ledger entries for the recon day (read-only). */
  loadTopups(date: string): Promise<LedgerTopup[]>;
  /** Persist the run + its statement lines in one transaction. */
  saveRun(
    branchId: string,
    date: string,
    counts: { matched: number; review: number; suspicious: number; orphan: number },
    lines: PersistLine[],
  ): Promise<ReconRunView>;
  listRuns(branchId: string): Promise<ReconRunView[]>;
  listLines(runId: string): Promise<PersistLine[]>;
}
export const RECON_REPOSITORY = Symbol('RECON_REPOSITORY');

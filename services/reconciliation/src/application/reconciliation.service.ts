import { Inject, Injectable } from '@nestjs/common';
import { reconcile, type BankLine } from '../domain/reconcile';
import {
  RECON_REPOSITORY,
  type PersistLine,
  type ReconRunView,
  type ReconciliationRepository,
  type StatementLine,
} from '../domain/ports';

@Injectable()
export class ReconciliationService {
  constructor(
    @Inject(RECON_REPOSITORY) private readonly repo: ReconciliationRepository,
  ) {}

  async run(
    branchId: string,
    date: string,
    statementLines: StatementLine[],
  ): Promise<ReconRunView> {
    const topups = await this.repo.loadTopups(date);
    const bankLines: BankLine[] = statementLines.map((s, idx) => ({
      idx,
      amount: s.amount,
      ref: s.ref,
    }));

    const result = reconcile(bankLines, topups);

    const persist: PersistLine[] = statementLines.map((s, idx) => {
      const lr = result.lines.find((l) => l.idx === idx)!;
      return {
        amount: s.amount,
        ref: s.ref,
        sender: s.sender,
        txnDate: s.txnDate,
        status: lr.status,
        matchedLedgerId: lr.matchedLedgerId,
      };
    });

    return this.repo.saveRun(branchId, date, result.counts, persist);
  }

  listRuns(branchId: string): Promise<ReconRunView[]> {
    return this.repo.listRuns(branchId);
  }

  listLines(runId: string): Promise<PersistLine[]> {
    return this.repo.listLines(runId);
  }
}

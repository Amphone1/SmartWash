import { ReconciliationService } from './reconciliation.service';
import type {
  LedgerTopup,
  PersistLine,
  ReconRunView,
  ReconciliationRepository,
} from '../domain/ports';

const BRANCH = '11111111-1111-4111-8111-111111111111';
const DATE = '2026-06-10';

class FakeRepo implements ReconciliationRepository {
  saved?: { counts: ReconRunView; lines: PersistLine[] };
  constructor(private readonly topups: LedgerTopup[]) {}
  async loadTopups() {
    return this.topups;
  }
  async saveRun(
    branchId: string,
    date: string,
    counts: { matched: number; review: number; suspicious: number; orphan: number },
    lines: PersistLine[],
  ): Promise<ReconRunView> {
    const view: ReconRunView = {
      id: 'run1',
      branchId,
      reconDate: date,
      ...counts,
      status: 'done',
    };
    this.saved = { counts: view, lines };
    return view;
  }
  async listRuns() {
    return [];
  }
  async listLines() {
    return [];
  }
}

describe('ReconciliationService.run', () => {
  it('verifies matches and flags an unbacked TOPUP as suspicious', async () => {
    const repo = new FakeRepo([
      { ledgerId: 1, amount: 20000 },
      { ledgerId: 2, amount: 50000 }, // no bank line → suspicious
    ]);
    const svc = new ReconciliationService(repo);
    const run = await svc.run(BRANCH, DATE, [
      { amount: 20000 },
      { amount: 999 }, // no topup → orphan
    ]);
    expect(run.matched).toBe(1);
    expect(run.orphan).toBe(1);
    expect(run.suspicious).toBe(1);
    // persisted line statuses
    const statuses = repo.saved?.lines.map((l) => l.status).sort();
    expect(statuses).toEqual(['ORPHAN', 'VERIFIED']);
  });

  it('persists matchedLedgerId on a verified line', async () => {
    const repo = new FakeRepo([{ ledgerId: 9, amount: 30000 }]);
    const svc = new ReconciliationService(repo);
    await svc.run(BRANCH, DATE, [{ amount: 30000, ref: 'X' }]);
    expect(repo.saved?.lines[0]).toMatchObject({
      status: 'VERIFIED',
      matchedLedgerId: 9,
    });
  });
});

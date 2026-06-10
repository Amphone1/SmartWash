import { SettlementService } from './settlement.service';
import type {
  DriverFees,
  SettlementLineInput,
  SettlementRepository,
  SettlementView,
} from '../domain/ports';

const BRANCH = '11111111-1111-4111-8111-111111111111';
const DATE = '2026-06-10';

class FakeRepo implements SettlementRepository {
  saved?: {
    gross: bigint;
    platform: bigint;
    staffPayout: bigint;
    lines: SettlementLineInput[];
  };
  constructor(
    private readonly gross: bigint,
    private readonly fees: DriverFees[],
  ) {}
  async computeGross() {
    return this.gross;
  }
  async driverFees() {
    return this.fees;
  }
  async save(
    branchId: string,
    date: string,
    gross: bigint,
    platformRevenue: bigint,
    staffPayout: bigint,
    lines: SettlementLineInput[],
  ): Promise<SettlementView> {
    this.saved = { gross, platform: platformRevenue, staffPayout, lines };
    return {
      id: 's1',
      branchId,
      periodDate: date,
      gross: Number(gross),
      platformRevenue: Number(platformRevenue),
      staffPayout: Number(staffPayout),
      status: 'open',
      lines: lines.map((l, i) => ({
        id: `l${i}`,
        driverId: l.driverId,
        trips: l.trips,
        amount: Number(l.amount),
        paid: false,
      })),
    };
  }
  async list() {
    return [];
  }
  async markLinePaid() {
    /* noop */
  }
  async close() {
    /* noop */
  }
}

describe('SettlementService.run', () => {
  it('computes platform revenue (20%) and per-driver payout (70% of fees)', async () => {
    const repo = new FakeRepo(1_000_000n, [
      { driverId: 'd1', trips: 3, fees: 60_000n },
      { driverId: 'd2', trips: 1, fees: 20_000n },
    ]);
    const svc = new SettlementService(repo);
    const view = await svc.run(BRANCH, DATE);

    expect(view.platformRevenue).toBe(200_000); // 20% of 1,000,000
    // driver payouts: 70% of fees
    expect(view.lines.find((l) => l.driverId === 'd1')?.amount).toBe(42_000);
    expect(view.lines.find((l) => l.driverId === 'd2')?.amount).toBe(14_000);
    expect(view.staffPayout).toBe(56_000); // 42k + 14k
    expect(repo.saved?.gross).toBe(1_000_000n);
  });

  it('handles a day with no drivers (zero payout)', async () => {
    const repo = new FakeRepo(500_000n, []);
    const svc = new SettlementService(repo);
    const view = await svc.run(BRANCH, DATE);
    expect(view.staffPayout).toBe(0);
    expect(view.platformRevenue).toBe(100_000);
  });
});

/**
 * Settlement use-cases. Computes a branch's daily settlement (record-only) and
 * tracks external payout. Money math lives in the pure domain; this orchestrates
 * the reads + persistence.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  driverPayout,
  platformRevenue,
  sumKip,
} from '../domain/settlement-math';
import {
  SETTLEMENT_REPOSITORY,
  type SettlementLineInput,
  type SettlementRepository,
  type SettlementView,
} from '../domain/ports';

@Injectable()
export class SettlementService {
  private readonly platformBps: number;
  private readonly driverBps: number;

  constructor(
    @Inject(SETTLEMENT_REPOSITORY) private readonly repo: SettlementRepository,
  ) {
    this.platformBps = Number.parseInt(process.env.PLATFORM_BPS ?? '2000', 10);
    this.driverBps = Number.parseInt(process.env.DRIVER_BPS ?? '7000', 10);
  }

  async run(branchId: string, date: string): Promise<SettlementView> {
    const gross = await this.repo.computeGross(branchId, date);
    const platform = platformRevenue(gross, this.platformBps);

    const driverFees = await this.repo.driverFees(branchId, date);
    const lines: SettlementLineInput[] = driverFees.map((d) => ({
      driverId: d.driverId,
      trips: d.trips,
      amount: driverPayout(d.fees, this.driverBps),
    }));
    const staffPayout = sumKip(lines.map((l) => l.amount));

    return this.repo.save(branchId, date, gross, platform, staffPayout, lines);
  }

  list(branchId: string): Promise<SettlementView[]> {
    return this.repo.list(branchId);
  }

  markPaid(lineId: string): Promise<void> {
    return this.repo.markLinePaid(lineId);
  }

  close(settlementId: string): Promise<void> {
    return this.repo.close(settlementId);
  }
}

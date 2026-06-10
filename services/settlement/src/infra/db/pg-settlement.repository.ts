import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '@smartwash/common';
import { Database } from '@smartwash/nestkit';
import type {
  DriverFees,
  SettlementLineInput,
  SettlementRepository,
  SettlementView,
} from '../../domain/ports';

@Injectable()
export class PgSettlementRepository implements SettlementRepository {
  constructor(private readonly db: Database) {}

  async computeGross(branchId: string, date: string): Promise<bigint> {
    const { rows } = await this.db.getPool().query<{ gross: string }>(
      `SELECT COALESCE(SUM(total),0) AS gross FROM orders
        WHERE branch_id = $1 AND state = 'COMPLETED'
          AND created_at::date = $2::date`,
      [branchId, date],
    );
    return BigInt(rows[0]?.gross ?? '0');
  }

  async driverFees(branchId: string, date: string): Promise<DriverFees[]> {
    const { rows } = await this.db.getPool().query<{
      driver_id: string;
      trips: string;
      fees: string;
    }>(
      `SELECT d.driver_id, COUNT(*) AS trips, COALESCE(SUM(d.fee),0) AS fees
         FROM deliveries d
         JOIN drivers dr ON dr.id = d.driver_id
        WHERE dr.branch_id = $1 AND d.state = 'COMPLETED'
          AND d.updated_at::date = $2::date
        GROUP BY d.driver_id`,
      [branchId, date],
    );
    return rows.map((r) => ({
      driverId: r.driver_id,
      trips: Number(r.trips),
      fees: BigInt(r.fees),
    }));
  }

  async save(
    branchId: string,
    date: string,
    gross: bigint,
    platformRevenue: bigint,
    staffPayout: bigint,
    lines: SettlementLineInput[],
  ): Promise<SettlementView> {
    return this.db.withTransaction(async (client) => {
      const existing = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM settlements
          WHERE branch_id = $1 AND period_date = $2::date FOR UPDATE`,
        [branchId, date],
      );
      if (existing.rows[0]?.status === 'closed') {
        throw new ConflictError('settlement period is closed');
      }

      const up = await client.query<{ id: string }>(
        `INSERT INTO settlements
           (branch_id, period_date, gross, platform_revenue, staff_payout, status)
         VALUES ($1,$2::date,$3,$4,$5,'open')
         ON CONFLICT (branch_id, period_date) DO UPDATE
           SET gross = EXCLUDED.gross,
               platform_revenue = EXCLUDED.platform_revenue,
               staff_payout = EXCLUDED.staff_payout
         RETURNING id`,
        [
          branchId,
          date,
          gross.toString(),
          platformRevenue.toString(),
          staffPayout.toString(),
        ],
      );
      const settlementId = up.rows[0].id;

      // Replace lines (re-run while open).
      await client.query(`DELETE FROM settlement_lines WHERE settlement_id = $1`, [
        settlementId,
      ]);
      for (const l of lines) {
        await client.query(
          `INSERT INTO settlement_lines (settlement_id, driver_id, trips, amount, paid)
           VALUES ($1,$2,$3,$4,false)`,
          [settlementId, l.driverId, l.trips, l.amount.toString()],
        );
      }
      return this.view(client, settlementId);
    });
  }

  async list(branchId: string): Promise<SettlementView[]> {
    const { rows } = await this.db
      .getPool()
      .query<{ id: string }>(
        `SELECT id FROM settlements WHERE branch_id = $1 ORDER BY period_date DESC`,
        [branchId],
      );
    const out: SettlementView[] = [];
    for (const r of rows) out.push(await this.view(this.db.getPool(), r.id));
    return out;
  }

  async markLinePaid(lineId: string): Promise<void> {
    const res = await this.db
      .getPool()
      .query(`UPDATE settlement_lines SET paid = true WHERE id = $1`, [lineId]);
    if (res.rowCount === 0) throw new NotFoundError('settlement line not found');
  }

  async close(settlementId: string): Promise<void> {
    const res = await this.db
      .getPool()
      .query(`UPDATE settlements SET status = 'closed' WHERE id = $1`, [
        settlementId,
      ]);
    if (res.rowCount === 0) throw new NotFoundError('settlement not found');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async view(runner: any, id: string): Promise<SettlementView> {
    const s = await runner.query(
      `SELECT id, branch_id, period_date, gross, platform_revenue, staff_payout, status
         FROM settlements WHERE id = $1`,
      [id],
    );
    const lines = await runner.query(
      `SELECT id, driver_id, trips, amount, paid FROM settlement_lines
        WHERE settlement_id = $1 ORDER BY driver_id`,
      [id],
    );
    const r = s.rows[0];
    return {
      id: r.id,
      branchId: r.branch_id,
      periodDate:
        r.period_date instanceof Date
          ? r.period_date.toISOString().slice(0, 10)
          : String(r.period_date),
      gross: Number(r.gross),
      platformRevenue: Number(r.platform_revenue),
      staffPayout: Number(r.staff_payout),
      status: r.status,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lines: lines.rows.map((l: any) => ({
        id: l.id,
        driverId: l.driver_id,
        trips: l.trips,
        amount: Number(l.amount),
        paid: l.paid,
      })),
    };
  }
}

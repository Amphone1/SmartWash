/**
 * Read-only KPI aggregations for the owner/admin dashboards. Pure SELECTs over
 * existing tables — no writes. Money summed as kip and returned as numbers
 * (dashboard magnitudes are safe).
 */
import { Injectable } from '@nestjs/common';
import { Database } from '@smartwash/nestkit';

export interface OwnerSummary {
  branchId: string;
  revenueToday: number;
  ordersToday: number;
  machinesTotal: number;
  machinesActive: number;
}

export interface AdminSummary {
  revenueToday: number;
  activeOrders: number;
  branches: number;
  driversAvailable: number;
  recon: { matched: number; review: number; suspicious: number; orphan: number };
}

export interface ReconRun {
  id: string;
  branchId: string | null;
  reconDate: string;
  matched: number;
  review: number;
  suspicious: number;
  orphan: number;
  status: string;
}

@Injectable()
export class ReportingRepository {
  constructor(private readonly db: Database) {}

  async ownerSummary(branchId: string): Promise<OwnerSummary> {
    const pool = this.db.getPool();
    const [rev, mach] = await Promise.all([
      pool.query<{ revenue: string; orders: string }>(
        `SELECT COALESCE(SUM(total),0) AS revenue, COUNT(*) AS orders
           FROM orders
          WHERE branch_id = $1 AND state = 'COMPLETED'
            AND created_at >= date_trunc('day', now())`,
        [branchId],
      ),
      pool.query<{ total: string; active: string }>(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE state IN ('STARTING','RUNNING','FINISHING','PAUSED','RESERVED')) AS active
           FROM machine_status WHERE branch_id = $1`,
        [branchId],
      ),
    ]);
    return {
      branchId,
      revenueToday: Number(rev.rows[0]?.revenue ?? 0),
      ordersToday: Number(rev.rows[0]?.orders ?? 0),
      machinesTotal: Number(mach.rows[0]?.total ?? 0),
      machinesActive: Number(mach.rows[0]?.active ?? 0),
    };
  }

  async adminSummary(): Promise<AdminSummary> {
    const pool = this.db.getPool();
    const [rev, orders, branches, drivers, recon] = await Promise.all([
      pool.query<{ revenue: string }>(
        `SELECT COALESCE(SUM(total),0) AS revenue FROM orders
          WHERE state = 'COMPLETED' AND created_at >= date_trunc('day', now())`,
      ),
      pool.query<{ active: string }>(
        `SELECT COUNT(*) AS active FROM orders
          WHERE state IN ('RESERVED','PAID','RUNNING','PAYMENT_PENDING')`,
      ),
      pool.query<{ n: string }>(`SELECT COUNT(*) AS n FROM branches`),
      pool.query<{ n: string }>(
        `SELECT COUNT(*) AS n FROM drivers WHERE state = 'AVAILABLE'`,
      ),
      // Sum the most-recent reconciliation run per branch.
      pool.query<{
        matched: string;
        review: string;
        suspicious: string;
        orphan: string;
      }>(
        `SELECT COALESCE(SUM(matched),0) matched, COALESCE(SUM(review),0) review,
                COALESCE(SUM(suspicious),0) suspicious, COALESCE(SUM(orphan),0) orphan
           FROM (
             SELECT DISTINCT ON (branch_id) matched, review, suspicious, orphan
               FROM reconciliation_runs ORDER BY branch_id, recon_date DESC
           ) latest`,
      ),
    ]);
    const r = recon.rows[0];
    return {
      revenueToday: Number(rev.rows[0]?.revenue ?? 0),
      activeOrders: Number(orders.rows[0]?.active ?? 0),
      branches: Number(branches.rows[0]?.n ?? 0),
      driversAvailable: Number(drivers.rows[0]?.n ?? 0),
      recon: {
        matched: Number(r?.matched ?? 0),
        review: Number(r?.review ?? 0),
        suspicious: Number(r?.suspicious ?? 0),
        orphan: Number(r?.orphan ?? 0),
      },
    };
  }

  async reconRuns(limit: number): Promise<ReconRun[]> {
    const { rows } = await this.db.getPool().query(
      `SELECT id, branch_id, recon_date, matched, review, suspicious, orphan, status
         FROM reconciliation_runs ORDER BY created_at DESC LIMIT $1`,
      [Math.min(limit, 100)],
    );
    return rows.map((r) => ({
      id: r.id,
      branchId: r.branch_id,
      reconDate:
        r.recon_date instanceof Date ? r.recon_date.toISOString() : String(r.recon_date),
      matched: r.matched,
      review: r.review,
      suspicious: r.suspicious,
      orphan: r.orphan,
      status: r.status,
    }));
  }
}

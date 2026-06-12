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
  machineUtilPct: number;
  nextSettlementKip: number;
  nextSettlementDate: string;
}

export interface OwnerMachineView {
  id: string;
  code: string;
  type: string;
  capacityKg: number;
  state: string;
  progressPct: number | null;
  minutesLeft: number | null;
  currentOrderId: string | null;
  errorCode: string | null;
}

export interface OwnerOrderView {
  id: string;
  status: string;
  serviceType: string;
  customerName: string;
  weightKg: number;
  createdAt: string;
  pricePaid: number;
  machineCodes: string[];
}

export interface HourlyBucket {
  hour: number;
  ordersCount: number;
}

export interface DriverEarnings {
  todayKip: number;
  weekKip: number;
  monthKip: number;
  tripsToday: number;
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
    const [rev, mach, settlement] = await Promise.all([
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
           FROM machine_status
          WHERE machine_id IN (SELECT id FROM machines WHERE branch_id = $1)`,
        [branchId],
      ),
      pool.query<{ net: string; period_end: string }>(
        `SELECT (gross - platform_revenue) AS net,
                (period_date + INTERVAL '7 days')::DATE AS period_end
           FROM settlements WHERE branch_id = $1 AND status = 'PENDING'
          ORDER BY period_date DESC LIMIT 1`,
        [branchId],
      ),
    ]);
    const total = Number(mach.rows[0]?.total ?? 0);
    const active = Number(mach.rows[0]?.active ?? 0);
    return {
      branchId,
      revenueToday: Number(rev.rows[0]?.revenue ?? 0),
      ordersToday: Number(rev.rows[0]?.orders ?? 0),
      machinesTotal: total,
      machinesActive: active,
      machineUtilPct: total > 0 ? Math.round((active / total) * 100) : 0,
      nextSettlementKip: Number(settlement.rows[0]?.net ?? 0),
      nextSettlementDate: settlement.rows[0]?.period_end ?? '',
    };
  }

  async ownerMachines(branchId: string): Promise<OwnerMachineView[]> {
    const { rows } = await this.db.getPool().query(
      `SELECT m.id, m.code, m.type, m.capacity_kg,
              COALESCE(ms.state, 'OFFLINE') AS state,
              ms.progress, ms.remaining_min, ms.current_order,
              me.payload->>'errorCode' AS error_code
         FROM machines m
         LEFT JOIN machine_status ms ON ms.machine_id = m.id
         LEFT JOIN LATERAL (
           SELECT payload FROM machine_events
            WHERE machine_id = m.id AND event = 'ERROR'
            ORDER BY created_at DESC LIMIT 1
         ) me ON true
        WHERE m.branch_id = $1
        ORDER BY m.code`,
      [branchId],
    );
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      type: r.type,
      capacityKg: r.capacity_kg,
      state: r.state,
      progressPct: r.progress != null ? Number(r.progress) : null,
      minutesLeft: r.remaining_min != null ? Number(r.remaining_min) : null,
      currentOrderId: r.current_order ?? null,
      errorCode: r.error_code ?? null,
    }));
  }

  async ownerOrders(branchId: string, status?: string): Promise<OwnerOrderView[]> {
    const params: unknown[] = [branchId];
    const stateFilter =
      status && status !== 'ALL'
        ? `AND o.state = $${params.push(status)}`
        : '';
    const { rows } = await this.db.getPool().query(
      `SELECT o.id, o.state AS status, o.type AS service_type,
              u.name AS customer_name, o.total AS price_paid,
              o.created_at,
              COALESCE(
                ARRAY_AGG(m.code ORDER BY m.code) FILTER (WHERE m.code IS NOT NULL),
                '{}'
              ) AS machine_codes
         FROM orders o
         JOIN users u ON u.id = o.user_id
         LEFT JOIN machines m ON m.id = o.machine_id
        WHERE o.branch_id = $1 ${stateFilter}
        GROUP BY o.id, u.name
        ORDER BY o.created_at DESC
        LIMIT 200`,
      params,
    );
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      serviceType: r.service_type,
      customerName: r.customer_name,
      weightKg: 0,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      pricePaid: Number(r.price_paid),
      machineCodes: r.machine_codes as string[],
    }));
  }

  async ownerHourlyStats(branchId: string): Promise<HourlyBucket[]> {
    const { rows } = await this.db.getPool().query(
      `SELECT EXTRACT(HOUR FROM created_at)::INT AS hour, COUNT(*) AS cnt
         FROM orders
        WHERE branch_id = $1
          AND created_at >= date_trunc('day', now())
        GROUP BY hour ORDER BY hour`,
      [branchId],
    );
    return rows.map((r) => ({ hour: r.hour as number, ordersCount: Number(r.cnt) }));
  }

  async driverEarnings(driverId: string): Promise<DriverEarnings> {
    const pool = this.db.getPool();
    const [today, week, month] = await Promise.all([
      pool.query<{ kip: string; trips: string }>(
        `SELECT COALESCE(SUM(amount),0) AS kip, COUNT(*) AS trips
           FROM settlement_lines
          WHERE driver_id = $1
            AND created_at >= date_trunc('day', now())`,
        [driverId],
      ),
      pool.query<{ kip: string }>(
        `SELECT COALESCE(SUM(amount),0) AS kip
           FROM settlement_lines WHERE driver_id = $1
            AND created_at >= date_trunc('week', now())`,
        [driverId],
      ),
      pool.query<{ kip: string }>(
        `SELECT COALESCE(SUM(amount),0) AS kip
           FROM settlement_lines WHERE driver_id = $1
            AND created_at >= date_trunc('month', now())`,
        [driverId],
      ),
    ]);
    return {
      todayKip: Number(today.rows[0]?.kip ?? 0),
      weekKip: Number(week.rows[0]?.kip ?? 0),
      monthKip: Number(month.rows[0]?.kip ?? 0),
      tripsToday: Number(today.rows[0]?.trips ?? 0),
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

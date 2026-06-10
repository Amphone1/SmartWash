import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@smartwash/common';
import { Database } from '@smartwash/nestkit';
import type { ReconStatus } from '../../domain/reconcile';
import type {
  LedgerTopup,
  PersistLine,
  ReconRunView,
  ReconciliationRepository,
} from '../../domain/ports';

@Injectable()
export class PgReconciliationRepository implements ReconciliationRepository {
  constructor(private readonly db: Database) {}

  async loadTopups(date: string): Promise<LedgerTopup[]> {
    const { rows } = await this.db.getPool().query<{
      id: string;
      amount: string;
      ref_id: string | null;
    }>(
      `SELECT id, amount, ref_id FROM ledger_entries
        WHERE type = 'TOPUP' AND created_at::date = $1::date`,
      [date],
    );
    return rows.map((r) => ({
      ledgerId: Number(r.id),
      amount: Number(r.amount),
      ref: r.ref_id ?? undefined,
    }));
  }

  async saveRun(
    branchId: string,
    date: string,
    counts: { matched: number; review: number; suspicious: number; orphan: number },
    lines: PersistLine[],
  ): Promise<ReconRunView> {
    return this.db.withTransaction(async (client) => {
      const run = await client.query<{ id: string }>(
        `INSERT INTO reconciliation_runs
           (branch_id, recon_date, matched, review, suspicious, orphan, status)
         VALUES ($1,$2::date,$3,$4,$5,$6,'done') RETURNING id`,
        [branchId, date, counts.matched, counts.review, counts.suspicious, counts.orphan],
      );
      const runId = run.rows[0].id;

      for (const l of lines) {
        await client.query(
          `INSERT INTO bank_statement_lines
             (recon_run_id, txn_date, amount, ref, sender, match_status, matched_ledger_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            runId,
            l.txnDate ?? null,
            l.amount,
            l.ref ?? null,
            l.sender ?? null,
            l.status,
            l.matchedLedgerId ?? null,
          ],
        );
      }

      return {
        id: runId,
        branchId,
        reconDate: date,
        matched: counts.matched,
        review: counts.review,
        suspicious: counts.suspicious,
        orphan: counts.orphan,
        status: 'done',
      };
    });
  }

  async listRuns(branchId: string): Promise<ReconRunView[]> {
    const { rows } = await this.db.getPool().query(
      `SELECT id, branch_id, recon_date, matched, review, suspicious, orphan, status
         FROM reconciliation_runs WHERE branch_id = $1 ORDER BY recon_date DESC`,
      [branchId],
    );
    return rows.map((r) => ({
      id: r.id,
      branchId: r.branch_id,
      reconDate:
        r.recon_date instanceof Date
          ? r.recon_date.toISOString().slice(0, 10)
          : String(r.recon_date),
      matched: r.matched,
      review: r.review,
      suspicious: r.suspicious,
      orphan: r.orphan,
      status: r.status,
    }));
  }

  async listLines(runId: string): Promise<PersistLine[]> {
    const { rows } = await this.db.getPool().query<{
      txn_date: Date | null;
      amount: string;
      ref: string | null;
      sender: string | null;
      match_status: string;
      matched_ledger_id: string | null;
    }>(
      `SELECT txn_date, amount, ref, sender, match_status, matched_ledger_id
         FROM bank_statement_lines WHERE recon_run_id = $1 ORDER BY id`,
      [runId],
    );
    if (rows.length === 0) {
      const exists = await this.db
        .getPool()
        .query(`SELECT 1 FROM reconciliation_runs WHERE id = $1`, [runId]);
      if (exists.rowCount === 0) throw new NotFoundError('recon run not found');
    }
    return rows.map((r) => ({
      txnDate: r.txn_date?.toISOString(),
      amount: Number(r.amount),
      ref: r.ref ?? undefined,
      sender: r.sender ?? undefined,
      status: r.match_status as ReconStatus,
      matchedLedgerId: r.matched_ledger_id ? Number(r.matched_ledger_id) : undefined,
    }));
  }
}

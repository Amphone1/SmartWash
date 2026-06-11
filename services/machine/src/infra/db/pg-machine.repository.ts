/**
 * Postgres adapter for the Machine snapshot + history. State changes append a
 * machine_events row and (when relevant) an outbox event in the same txn so the
 * saga sees MachineRunning/Finished/Error/Offline reliably (rules #4, #10).
 */
import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@smartwash/common';
import { Database, insertOutbox } from '@smartwash/nestkit';
import type { PoolClient } from 'pg';
import type { MachineState } from '../../domain/machine-fsm';
import type {
  MachineRef,
  MachineRepository,
  MachineStatusView,
  StatusUpdate,
} from '../../domain/ports';

interface StatusRow {
  machine_id: string;
  branch_id: string | null;
  state: string;
  progress: number;
  remaining_min: number | null;
  current_order: string | null;
  last_seen: Date | null;
  updated_at: Date;
}

function toView(r: StatusRow): MachineStatusView {
  return {
    machineId: r.machine_id,
    branchId: r.branch_id,
    state: r.state as MachineState,
    progress: r.progress ?? 0,
    remainingMin: r.remaining_min,
    currentOrder: r.current_order,
    lastSeen: r.last_seen?.toISOString() ?? null,
    updatedAt: r.updated_at.toISOString(),
  };
}

const EVENT_TYPE: Record<string, string> = {
  MachineRunning: 'smartwash.machine.running.v1',
  MachineFinished: 'smartwash.machine.finished.v1',
  MachineError: 'smartwash.machine.error.v1',
  MachineOffline: 'smartwash.machine.offline.v1',
};

@Injectable()
export class PgMachineRepository implements MachineRepository {
  constructor(private readonly db: Database) {}

  async findById(machineId: string): Promise<MachineRef | null> {
    const { rows } = await this.db
      .getPool()
      .query<{ id: string; branch_id: string; code: string }>(
        `SELECT id, branch_id, code FROM machines WHERE id = $1`,
        [machineId],
      );
    const r = rows[0];
    return r ? { id: r.id, branchId: r.branch_id, code: r.code } : null;
  }

  async getStatus(machineId: string): Promise<MachineStatusView | null> {
    const { rows } = await this.db
      .getPool()
      .query<StatusRow>(`SELECT * FROM machine_status WHERE machine_id = $1`, [
        machineId,
      ]);
    return rows[0] ? toView(rows[0]) : null;
  }

  async listByBranch(branchId: string): Promise<MachineStatusView[]> {
    const { rows } = await this.db
      .getPool()
      .query<StatusRow>(
        `SELECT * FROM machine_status WHERE branch_id = $1 ORDER BY machine_id`,
        [branchId],
      );
    return rows.map(toView);
  }

  async touch(
    machineId: string,
    progress: number | undefined,
    remainingMin: number | undefined,
  ): Promise<void> {
    await this.db.getPool().query(
      `INSERT INTO machine_status (machine_id, progress, remaining_min, last_seen)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (machine_id) DO UPDATE
         SET progress = COALESCE($2, machine_status.progress),
             remaining_min = COALESCE($3, machine_status.remaining_min),
             last_seen = now(), updated_at = now()`,
      [machineId, progress ?? null, remainingMin ?? null],
    );
  }

  async applyTransition(u: StatusUpdate): Promise<MachineStatusView> {
    return this.db.withTransaction(async (client) => {
      const prev = await client.query<StatusRow>(
        `SELECT * FROM machine_status WHERE machine_id = $1 FOR UPDATE`,
        [u.machineId],
      );
      const currentOrder = prev.rows[0]?.current_order ?? null;

      const { rows } = await client.query<StatusRow>(
        `INSERT INTO machine_status
           (machine_id, branch_id, state, progress, remaining_min, last_seen, current_order)
         VALUES ($1,$2,$3,$4,$5,now(),$6)
         ON CONFLICT (machine_id) DO UPDATE
           SET branch_id = EXCLUDED.branch_id, state = EXCLUDED.state,
               progress = COALESCE(EXCLUDED.progress, machine_status.progress),
               remaining_min = EXCLUDED.remaining_min, last_seen = now(),
               current_order = CASE WHEN $7 THEN NULL ELSE machine_status.current_order END,
               updated_at = now()
         RETURNING *`,
        [
          u.machineId,
          u.branchId,
          u.state,
          // NULL (not 0) so the COALESCE keeps the stored progress on updates
          // without telemetry — e.g. LWT/sweep OFFLINE must not wipe progress,
          // the saga reads it for the pro-rata refund.
          u.progress ?? null,
          u.remainingMin ?? null,
          u.clearOrder ? null : currentOrder,
          u.clearOrder ?? false,
        ],
      );

      await this.appendEvent(client, u.machineId, u.state, {
        progress: u.progress,
        errorCode: u.errorCode,
      });

      if (u.emit) {
        await insertOutbox(client, {
          aggregateType: 'machine',
          aggregateId: u.machineId,
          eventType: EVENT_TYPE[u.emit],
          payload: {
            machineId: u.machineId,
            orderId: currentOrder ?? undefined,
            errorCode: u.errorCode,
          },
        });
      }
      return toView(rows[0]);
    });
  }

  async reserve(machineId: string, orderId: string): Promise<MachineStatusView> {
    const { rows } = await this.db.getPool().query<StatusRow>(
      `INSERT INTO machine_status (machine_id, state, current_order)
       VALUES ($1, 'RESERVED', $2)
       ON CONFLICT (machine_id) DO UPDATE
         SET state = 'RESERVED', current_order = $2, updated_at = now()
       RETURNING *`,
      [machineId, orderId],
    );
    return toView(rows[0]);
  }

  async release(machineId: string): Promise<MachineStatusView> {
    const { rows } = await this.db.getPool().query<StatusRow>(
      `UPDATE machine_status SET state = 'IDLE', current_order = NULL, updated_at = now()
        WHERE machine_id = $1 RETURNING *`,
      [machineId],
    );
    if (!rows[0]) throw new NotFoundError('machine status not found');
    return toView(rows[0]);
  }

  async setCurrentOrder(machineId: string, orderId: string): Promise<void> {
    await this.db
      .getPool()
      .query(
        `UPDATE machine_status SET current_order = $2, updated_at = now() WHERE machine_id = $1`,
        [machineId, orderId],
      );
  }

  async findStale(cutoff: Date): Promise<MachineStatusView[]> {
    const { rows } = await this.db.getPool().query<StatusRow>(
      `SELECT * FROM machine_status
        WHERE state <> 'OFFLINE' AND last_seen IS NOT NULL AND last_seen < $1`,
      [cutoff],
    );
    return rows.map(toView);
  }

  private async appendEvent(
    client: PoolClient,
    machineId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await client.query(
      `INSERT INTO machine_events (machine_id, event, payload) VALUES ($1,$2,$3)`,
      [machineId, event, JSON.stringify(payload)],
    );
  }
}

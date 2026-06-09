/**
 * Postgres adapter for QueueRepository. Position assignment and call-next pick
 * the row inside a transaction (with row locking) to avoid two joiners racing
 * onto the same position.
 */
import { Injectable } from '@nestjs/common';
import { ConflictError } from '@smartwash/common';
import { Database } from '@smartwash/nestkit';
import type { QueueState } from '../../domain/queue-fsm';
import type { QueueEntry, QueueRepository } from '../../domain/ports';

interface Row {
  id: string;
  machine_id: string;
  user_id: string;
  position: number;
  status: string;
  called_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
}

function toEntry(r: Row): QueueEntry {
  return {
    id: r.id,
    machineId: r.machine_id,
    userId: r.user_id,
    position: r.position,
    status: r.status as QueueState,
    calledAt: r.called_at?.toISOString() ?? null,
    expiresAt: r.expires_at?.toISOString() ?? null,
    createdAt: r.created_at.toISOString(),
  };
}

const ACTIVE = `('IN_QUEUE','CALLED','RESERVED')`;

@Injectable()
export class PgQueueRepository implements QueueRepository {
  constructor(private readonly db: Database) {}

  async findActive(machineId: string, userId: string): Promise<QueueEntry | null> {
    const { rows } = await this.db.getPool().query<Row>(
      `SELECT * FROM queue_entries
        WHERE machine_id = $1 AND user_id = $2 AND status IN ${ACTIVE}
        ORDER BY created_at DESC LIMIT 1`,
      [machineId, userId],
    );
    return rows[0] ? toEntry(rows[0]) : null;
  }

  async join(machineId: string, userId: string): Promise<QueueEntry> {
    return this.db.withTransaction(async (client) => {
      // Lock the machine's rows so concurrent joins serialize on position.
      const { rows: posRows } = await client.query<{ next: number }>(
        `SELECT COALESCE(MAX(position), 0) + 1 AS next
           FROM queue_entries WHERE machine_id = $1 FOR UPDATE`,
        [machineId],
      );
      const next = posRows[0]?.next ?? 1;
      const { rows } = await client.query<Row>(
        `INSERT INTO queue_entries (machine_id, user_id, position, status)
         VALUES ($1, $2, $3, 'IN_QUEUE') RETURNING *`,
        [machineId, userId, next],
      );
      return toEntry(rows[0]);
    });
  }

  async findById(id: string): Promise<QueueEntry | null> {
    const { rows } = await this.db
      .getPool()
      .query<Row>(`SELECT * FROM queue_entries WHERE id = $1`, [id]);
    return rows[0] ? toEntry(rows[0]) : null;
  }

  async listActive(machineId: string): Promise<QueueEntry[]> {
    const { rows } = await this.db.getPool().query<Row>(
      `SELECT * FROM queue_entries
        WHERE machine_id = $1 AND status IN ${ACTIVE}
        ORDER BY position ASC`,
      [machineId],
    );
    return rows.map(toEntry);
  }

  async setStatus(
    id: string,
    from: QueueState,
    to: QueueState,
    holdSeconds?: number,
  ): Promise<QueueEntry> {
    const called = to === 'CALLED';
    const { rows, rowCount } = await this.db.getPool().query<Row>(
      `UPDATE queue_entries
          SET status = $2,
              called_at = CASE WHEN $4 THEN now() ELSE called_at END,
              expires_at = CASE WHEN $4 THEN now() + ($5 || ' seconds')::interval
                                ELSE expires_at END
        WHERE id = $1 AND status = $3
      RETURNING *`,
      [id, to, from, called, String(holdSeconds ?? 0)],
    );
    if (rowCount === 0) {
      throw new ConflictError('queue entry changed concurrently');
    }
    return toEntry(rows[0]);
  }

  async callNext(machineId: string, holdSeconds: number): Promise<QueueEntry | null> {
    return this.db.withTransaction(async (client) => {
      const { rows: front } = await client.query<Row>(
        `SELECT * FROM queue_entries
          WHERE machine_id = $1 AND status = 'IN_QUEUE'
          ORDER BY position ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [machineId],
      );
      if (front.length === 0) return null;
      const { rows } = await client.query<Row>(
        `UPDATE queue_entries
            SET status = 'CALLED', called_at = now(),
                expires_at = now() + ($2 || ' seconds')::interval
          WHERE id = $1 RETURNING *`,
        [front[0].id, String(holdSeconds)],
      );
      return toEntry(rows[0]);
    });
  }
}

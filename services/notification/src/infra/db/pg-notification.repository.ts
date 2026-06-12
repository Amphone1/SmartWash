import { Injectable } from '@nestjs/common';
import { Database } from '@smartwash/nestkit';
import type { NotificationDraft } from '../../domain/mapping';

export interface NotificationView {
  id: string;
  userId: string;
  channel: string;
  type: string;
  payload: Record<string, unknown> | null;
  status: string;
  readAt: string | null;
  createdAt: string;
}

@Injectable()
export class PgNotificationRepository {
  constructor(private readonly db: Database) {}

  async record(draft: NotificationDraft): Promise<void> {
    await this.db.getPool().query(
      `INSERT INTO notifications (user_id, channel, type, payload, status)
       VALUES ($1, $2, $3, $4, 'queued')`,
      [draft.userId, draft.channel, draft.type, JSON.stringify(draft.payload)],
    );
  }

  async listForUser(userId: string, limit: number): Promise<NotificationView[]> {
    const { rows } = await this.db.getPool().query(
      `SELECT id, user_id, channel, type, payload, status, read_at, created_at
         FROM notifications WHERE user_id = $1
        ORDER BY created_at DESC LIMIT $2`,
      [userId, Math.min(limit, 100)],
    );
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      channel: r.channel,
      type: r.type,
      payload: r.payload,
      status: r.status,
      readAt: r.read_at ? r.read_at.toISOString() : null,
      createdAt: r.created_at.toISOString(),
    }));
  }

  /** Mark every unread notification read; returns how many were flipped. */
  async markAllRead(userId: string): Promise<number> {
    const res = await this.db.getPool().query(
      `UPDATE notifications SET read_at = now()
        WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );
    return res.rowCount ?? 0;
  }
}

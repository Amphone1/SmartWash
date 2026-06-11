import { Injectable } from '@nestjs/common';
import { Database } from '@smartwash/nestkit';
import type { AuditDraft } from '../../domain/mapping';

export interface AuditEntry {
  id: number;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

@Injectable()
export class PgAuditRepository {
  constructor(private readonly db: Database) {}

  /** Append-only — audit rows are never updated or deleted. */
  async append(draft: AuditDraft): Promise<void> {
    await this.db.getPool().query(
      `INSERT INTO audit_log (actor_id, actor_role, action, entity_type, entity_id, after)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        draft.actorId,
        draft.actorRole,
        draft.action,
        draft.entityType,
        draft.entityId,
        draft.after ? JSON.stringify(draft.after) : null,
      ],
    );
  }

  async list(entityId: string | null, limit: number): Promise<AuditEntry[]> {
    const params: unknown[] = [];
    let where = '';
    if (entityId) {
      params.push(entityId);
      where = `WHERE entity_id = $1`;
    }
    params.push(Math.min(limit, 200));
    const { rows } = await this.db.getPool().query(
      `SELECT id, actor_id, actor_role, action, entity_type, entity_id, after, created_at
         FROM audit_log ${where} ORDER BY id DESC LIMIT $${params.length}`,
      params,
    );
    return rows.map((r) => ({
      id: Number(r.id),
      actorId: r.actor_id,
      actorRole: r.actor_role,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      after: r.after,
      createdAt: r.created_at.toISOString(),
    }));
  }
}

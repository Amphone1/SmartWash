/**
 * Event → audit row mapping (pure). Every domain event becomes an append-only
 * audit_log row (actor = system); explicit actor actions (staff approve, admin
 * refund, …) come through the internal POST instead.
 */
export interface AuditDraft {
  actorId: string | null;
  actorRole: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  after: Record<string, unknown> | null;
}

interface Envelope {
  type?: string;
  source?: string;
  data?: Record<string, unknown>;
  [k: string]: unknown;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function mapEventToAudit(envelope: Envelope): AuditDraft | null {
  const type = envelope.type;
  if (!type || !type.startsWith('smartwash.')) return null;
  const data = (envelope.data ?? {}) as Record<string, unknown>;

  // smartwash.<aggregate>.<event>.v1 → entityType = aggregate
  const entityType = type.split('.')[1] ?? null;
  const entityId =
    pickUuid(data.orderId) ??
    pickUuid(data.deliveryId) ??
    pickUuid(data.machineId) ??
    pickUuid(data.slipId) ??
    pickUuid(data.userId);

  return {
    actorId: null,
    actorRole: 'system',
    action: type,
    entityType,
    entityId,
    after: data,
  };
}

function pickUuid(v: unknown): string | null {
  return typeof v === 'string' && UUID_RE.test(v) ? v : null;
}

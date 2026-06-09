/**
 * Idempotency helpers (rule #3). Every state-changing POST carries an
 * `Idempotency-Key` (UUID v4) persisted in `idempotency_keys`. We also hash the
 * request payload so a replayed key with a *different* body can be rejected
 * rather than silently returning a stale response.
 */
import { createHash } from 'node:crypto';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV4(value: string): boolean {
  return UUID_V4.test(value);
}

/**
 * Stable SHA-256 of a request payload. Object keys are sorted so logically
 * equal bodies hash identically regardless of key order. `bigint` is
 * serialized as a decimal string (JSON cannot represent it natively).
 */
export function hashRequest(payload: unknown): string {
  return createHash('sha256').update(canonicalize(payload)).digest('hex');
}

function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'bigint') return `"${value.toString()}"`;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`)
      .join(',')}}`;
  }
  // undefined / function / symbol — not part of a request payload
  return 'null';
}

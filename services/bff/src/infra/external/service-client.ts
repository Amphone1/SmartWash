/**
 * Thin HTTP client for service-to-service calls. Attaches the internal shared
 * secret + the current correlation-id, and maps non-2xx responses back into our
 * DomainError taxonomy so the gateway returns consistent errors.
 */
import { DomainError } from '@smartwash/common';
import {
  CORRELATION_HEADER,
  getCorrelationId,
  INTERNAL_TOKEN_HEADER,
} from '@smartwash/nestkit';

export interface CallOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  idempotencyKey?: string;
  /** Forwarded as X-User-Id so downstream money services can re-check RBAC. */
  userId?: string;
}

export async function callService(
  baseUrl: string,
  path: string,
  internalToken: string,
  opts: CallOptions = {},
): Promise<unknown> {
  const headers: Record<string, string> = {
    [INTERNAL_TOKEN_HEADER]: internalToken,
  };
  const cid = getCorrelationId();
  if (cid) headers[CORRELATION_HEADER] = cid;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey;
  if (opts.userId) headers['x-user-id'] = opts.userId;

  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  const parsed = text ? safeJson(text) : null;

  if (!res.ok) {
    const code =
      (parsed as { code?: string } | null)?.code ?? 'upstream_error';
    const message =
      (parsed as { message?: string } | null)?.message ??
      `upstream ${res.status}`;
    throw new DomainError(code, message, res.status);
  }
  return parsed;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

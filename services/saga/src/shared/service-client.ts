/** Minimal internal HTTP client used by saga activities. Attaches the shared
 * internal token; optionally an Idempotency-Key for the ledger post. */
import { config } from '../config';

export async function callService(
  baseUrl: string,
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
  opts: { idempotencyKey?: string } = {},
): Promise<unknown> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-internal-token': config.internalToken,
  };
  if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${baseUrl}${path} → ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

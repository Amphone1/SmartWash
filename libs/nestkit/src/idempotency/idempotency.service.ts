/**
 * Idempotency (rule #3). Wraps a state-changing operation keyed by the caller's
 * `Idempotency-Key` (UUID v4), persisted in `idempotency_keys`.
 *
 *   - First time a key is seen: run the operation, store its JSON response.
 *   - Same key + same request body: return the stored response (replay), do NOT
 *     run the operation again.
 *   - Same key + different request body: reject (IdempotencyConflictError).
 *   - Key seen but operation still in flight (no stored response yet): reject
 *     with a conflict so the caller retries.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import {
  hashRequest,
  isUuidV4,
  IdempotencyConflictError,
  ValidationError,
  ConflictError,
} from '@smartwash/common';
import { PG_POOL } from '../db/pg';

export interface IdempotentResult<T> {
  result: T;
  replayed: boolean;
}

@Injectable()
export class IdempotencyService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async execute<T>(
    key: string,
    scope: string,
    requestPayload: unknown,
    operation: () => Promise<T>,
  ): Promise<IdempotentResult<T>> {
    if (!isUuidV4(key)) {
      throw new ValidationError('Idempotency-Key must be a UUID v4');
    }
    const requestHash = hashRequest(requestPayload);

    const inserted = await this.pool.query(
      `INSERT INTO idempotency_keys (key, scope, request_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO NOTHING
       RETURNING key`,
      [key, scope, requestHash],
    );

    if (inserted.rowCount === 0) {
      return this.replay<T>(key, scope, requestHash);
    }

    // We own this key — run the operation and persist its response.
    const result = await operation();
    await this.pool.query(
      `UPDATE idempotency_keys SET response = $2 WHERE key = $1`,
      [key, JSON.stringify(result ?? null)],
    );
    return { result, replayed: false };
  }

  private async replay<T>(
    key: string,
    scope: string,
    requestHash: string,
  ): Promise<IdempotentResult<T>> {
    const { rows } = await this.pool.query<{
      scope: string;
      request_hash: string;
      response: T | null;
    }>(
      `SELECT scope, request_hash, response FROM idempotency_keys WHERE key = $1`,
      [key],
    );
    const existing = rows[0];
    if (!existing) {
      // Lost a race and the row vanished — treat as transient conflict.
      throw new ConflictError('idempotency key state unavailable, retry');
    }
    if (existing.scope !== scope || existing.request_hash !== requestHash) {
      throw new IdempotencyConflictError();
    }
    if (existing.response === null) {
      throw new ConflictError('original request still in progress, retry');
    }
    return { result: existing.response, replayed: true };
  }
}

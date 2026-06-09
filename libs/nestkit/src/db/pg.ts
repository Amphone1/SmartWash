/**
 * Postgres access. Provides a shared `pg.Pool` (PG_POOL) built from
 * DATABASE_URL, plus a `withTransaction` helper used by the outbox pattern so
 * a domain write and its outbox row commit atomically (rule #4).
 */
import {
  Global,
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';
import { requireEnv } from '../config/env';
import type { ReadinessCheck } from '../health/health';

export const PG_POOL = Symbol('PG_POOL');

@Injectable()
export class Database implements OnModuleDestroy, ReadinessCheck {
  readonly name = 'postgres';

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  getPool(): Pool {
    return this.pool;
  }

  async check(): Promise<boolean> {
    const { rows } = await this.pool.query('SELECT 1 AS ok');
    return rows[0]?.ok === 1;
  }

  /** Run `fn` inside a single transaction; commit on success, rollback on throw. */
  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () => new Pool({ connectionString: requireEnv('DATABASE_URL') }),
    },
    Database,
  ],
  exports: [Database, PG_POOL],
})
export class DatabaseModule {}

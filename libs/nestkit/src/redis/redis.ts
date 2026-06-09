/**
 * Redis access + reservation locks (rule #6). `RedisLock.acquire` uses
 * `SET key token NX EX ttl` so only one holder wins; `release` uses a
 * compare-and-delete Lua script so a holder only deletes its own lock
 * (never someone else's after a TTL handover).
 */
import {
  Global,
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { optionalEnv } from '../config/env';
import type { ReadinessCheck } from '../health/health';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/** Default machine reservation TTL — 15 minutes per rule #6. */
export const RESERVATION_TTL_SECONDS = 15 * 60;

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

export interface Lock {
  key: string;
  token: string;
}

@Injectable()
export class RedisLock implements OnModuleDestroy, ReadinessCheck {
  readonly name = 'redis';

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  getClient(): Redis {
    return this.redis;
  }

  async check(): Promise<boolean> {
    return (await this.redis.ping()) === 'PONG';
  }

  /**
   * Returns a Lock if acquired, or null if the key is already held.
   * `token` identifies the owner; pass a stable value (e.g. an order id) when
   * the holder must be able to release later from a different request.
   */
  async acquire(
    key: string,
    ttlSeconds = RESERVATION_TTL_SECONDS,
    token: string = randomUUID(),
  ): Promise<Lock | null> {
    const ok = await this.redis.set(key, token, 'EX', ttlSeconds, 'NX');
    return ok === 'OK' ? { key, token } : null;
  }

  /** Release only if we still own the lock. Returns true if we deleted it. */
  async release(lock: Lock): Promise<boolean> {
    const deleted = (await this.redis.eval(
      RELEASE_SCRIPT,
      1,
      lock.key,
      lock.token,
    )) as number;
    return deleted === 1;
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () =>
        new Redis(optionalEnv('REDIS_URL', 'redis://localhost:6379'), {
          maxRetriesPerRequest: 3,
          lazyConnect: false,
        }),
    },
    RedisLock,
  ],
  exports: [RedisLock, REDIS_CLIENT],
})
export class RedisModule {}

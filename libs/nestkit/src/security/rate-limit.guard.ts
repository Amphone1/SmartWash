/**
 * Per-route rate limiting (defense in depth behind Traefik's coarse limit).
 * Redis fixed-window counter keyed by route + caller (IP or forwarded user).
 * Routes opt in with @RateLimit(); unannotated routes are unlimited.
 */
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type Redis from 'ioredis';
import { TooManyRequestsError } from '@smartwash/common';
import { REDIS_CLIENT } from '../redis/redis';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions {
  limit: number;
  windowSec: number;
  by: 'ip' | 'user';
}

export const RateLimit = (
  limit: number,
  windowSec = 60,
  by: 'ip' | 'user' = 'ip',
) => SetMetadata(RATE_LIMIT_KEY, { limit, windowSec, by });

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const cfg = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!cfg) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const caller =
      cfg.by === 'user'
        ? (req.header('x-user-id') ?? req.ip ?? 'anon')
        : (req.ip ?? 'anon');
    const route = (req.route?.path as string | undefined) ?? req.path ?? 'route';
    const key = `rl:${route}:${caller}`;

    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, cfg.windowSec);
    if (count > cfg.limit) {
      throw new TooManyRequestsError(
        `rate limit exceeded: ${cfg.limit}/${cfg.windowSec}s`,
      );
    }
    return true;
  }
}

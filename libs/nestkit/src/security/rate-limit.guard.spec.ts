import { RateLimitGuard, type RateLimitOptions } from './rate-limit.guard';
import { Reflector } from '@nestjs/core';

class FakeRedis {
  counts = new Map<string, number>();
  async incr(key: string): Promise<number> {
    const n = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, n);
    return n;
  }
  async expire(): Promise<number> {
    return 1;
  }
}

function ctx(req: unknown) {
  return {
    getHandler: () => 'h',
    getClass: () => 'c',
    switchToHttp: () => ({ getRequest: () => req }),
  } as never;
}

function reflectorWith(cfg?: RateLimitOptions): Reflector {
  return { getAllAndOverride: () => cfg } as unknown as Reflector;
}

describe('RateLimitGuard', () => {
  it('allows routes with no @RateLimit', async () => {
    const g = new RateLimitGuard(reflectorWith(undefined), new FakeRedis() as never);
    await expect(g.canActivate(ctx({ ip: '1.1.1.1' }))).resolves.toBe(true);
  });

  it('allows up to the limit then throws 429', async () => {
    const g = new RateLimitGuard(
      reflectorWith({ limit: 2, windowSec: 60, by: 'ip' }),
      new FakeRedis() as never,
    );
    const req = { ip: '1.1.1.1', path: '/x' };
    await expect(g.canActivate(ctx(req))).resolves.toBe(true); // 1
    await expect(g.canActivate(ctx(req))).resolves.toBe(true); // 2
    await expect(g.canActivate(ctx(req))).rejects.toMatchObject({ status: 429 }); // 3
  });

  it('keys per user when by=user, isolating callers', async () => {
    const redis = new FakeRedis();
    const g = new RateLimitGuard(
      reflectorWith({ limit: 1, windowSec: 60, by: 'user' }),
      redis as never,
    );
    const reqA = { header: (h: string) => (h === 'x-user-id' ? 'userA' : undefined), path: '/p' };
    const reqB = { header: (h: string) => (h === 'x-user-id' ? 'userB' : undefined), path: '/p' };
    await expect(g.canActivate(ctx(reqA))).resolves.toBe(true);
    await expect(g.canActivate(ctx(reqB))).resolves.toBe(true); // different user, own bucket
    await expect(g.canActivate(ctx(reqA))).rejects.toMatchObject({ status: 429 });
  });
});

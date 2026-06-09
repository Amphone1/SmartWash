import { RedisLock, RESERVATION_TTL_SECONDS } from './redis';

// Minimal in-memory fake of the ioredis surface we use.
class FakeRedis {
  store = new Map<string, string>();
  async set(
    key: string,
    val: string,
    _ex: 'EX',
    _ttl: number,
    _nx: 'NX',
  ): Promise<'OK' | null> {
    if (this.store.has(key)) return null;
    this.store.set(key, val);
    return 'OK';
  }
  async eval(_script: string, _n: number, key: string, token: string): Promise<number> {
    if (this.store.get(key) === token) {
      this.store.delete(key);
      return 1;
    }
    return 0;
  }
  async ping(): Promise<string> {
    return 'PONG';
  }
}

describe('RedisLock', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const make = () => new RedisLock(new FakeRedis() as any);

  it('uses a 15-minute default TTL', () => {
    expect(RESERVATION_TTL_SECONDS).toBe(900);
  });

  it('acquires a free key and blocks a second acquirer', async () => {
    const lock = make();
    const first = await lock.acquire('machine:123');
    const second = await lock.acquire('machine:123');
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it('release deletes only when the token matches', async () => {
    const lock = make();
    const held = await lock.acquire('machine:123');
    expect(held).not.toBeNull();
    const wrong = await lock.release({ key: 'machine:123', token: 'someone-else' });
    expect(wrong).toBe(false);
    const right = await lock.release(held!);
    expect(right).toBe(true);
    // now re-acquirable
    expect(await lock.acquire('machine:123')).not.toBeNull();
  });
});

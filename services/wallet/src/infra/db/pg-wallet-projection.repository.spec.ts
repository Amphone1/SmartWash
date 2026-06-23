import type { Database } from '@smartwash/nestkit';
import { PgWalletProjectionRepository } from './pg-wallet-projection.repository';

/** Fake Database: getPool().query returns canned rows — exercises the real
 *  getProjected parse/sum without a Postgres. */
function fakeDb(rows: unknown[]): Database {
  return {
    getPool: () => ({ query: async () => ({ rows }) }),
  } as unknown as Database;
}

const U = '44444444-4444-4444-8444-444444444444';

describe('PgWalletProjectionRepository.getProjected (money-safe, no DB)', () => {
  it('sums subs into current (W1) as bigint', async () => {
    const repo = new PgWalletProjectionRepository(
      fakeDb([{ available: '100', reserved: '20', held: '5', pending: '3' }]),
    );
    const p = await repo.getProjected(U);
    expect(p).toEqual({
      available: 100n,
      reserved: 20n,
      held: 5n,
      pending: 3n,
      current: 128n, // 100 + 20 + 5 + 3
    });
  });

  it('returns all-zero bigints for a not-yet-projected user (no row)', async () => {
    const repo = new PgWalletProjectionRepository(fakeDb([]));
    const p = await repo.getProjected(U);
    expect(p).toEqual({
      available: 0n,
      reserved: 0n,
      held: 0n,
      pending: 0n,
      current: 0n,
    });
  });

  it('stays exact for kip beyond 2^53 (no float — bigint throughout)', async () => {
    const repo = new PgWalletProjectionRepository(
      fakeDb([
        {
          available: '9007199254740993', // 2^53 + 1, loses precision as a JS number
          reserved: '0',
          held: '0',
          pending: '0',
        },
      ]),
    );
    const p = await repo.getProjected(U);
    expect(p.available).toBe(9007199254740993n);
    expect(p.current).toBe(9007199254740993n);
  });
});

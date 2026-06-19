import { PgAccountRepository } from './pg-account.repository';
import {
  AccountInactiveError,
  AccountNotFoundError,
  CurrencyMismatchError,
  ValidationError,
} from '@smartwash/common';

const USER = '44444444-4444-4444-8444-444444444444'; // valid v4

interface QResult {
  rows: Array<Record<string, unknown>>;
  rowCount: number;
}

/**
 * Minimal fake PoolClient: routes the owner-existence SELECT and the accounts
 * upsert to canned results, and records every call so we can assert SQL/params.
 */
class FakeClient {
  calls: Array<{ sql: string; params?: unknown[] }> = [];
  constructor(
    private readonly opts: { ownerExists?: boolean; upsert?: QResult } = {},
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query(sql: string, params?: unknown[]): Promise<any> {
    this.calls.push({ sql, params });
    if (/SELECT 1 FROM (users|branches)/i.test(sql)) {
      const ok = this.opts.ownerExists ?? true;
      return { rows: ok ? [{ ok: 1 }] : [], rowCount: ok ? 1 : 0 };
    }
    if (/INSERT INTO accounts/i.test(sql)) {
      return (
        this.opts.upsert ?? {
          rows: [{ id: '1001', acct_type: 'LIABILITY', status: 'active' }],
          rowCount: 1,
        }
      );
    }
    throw new Error(`unexpected query: ${sql}`);
  }
}

const repo = new PgAccountRepository();

describe('PgAccountRepository.resolve', () => {
  it('resolves a valid entity account (existence check + upsert)', async () => {
    const client = new FakeClient({ ownerExists: true });
    const r = await repo.resolve(client as never, {
      ownerType: 'user',
      sub: 'available',
      ownerId: USER,
    });
    expect(r).toEqual({ id: 1001n, acctType: 'LIABILITY', accountKey: `available:user:${USER}` });
    expect(client.calls).toHaveLength(2);
    expect(client.calls[0].sql).toMatch(/SELECT 1 FROM users/i);
    expect(client.calls[1].sql).toMatch(/ON CONFLICT ON CONSTRAINT accounts_natural_key/i);
    expect(client.calls[1].params).toEqual(['LIABILITY', 'user', USER, 'available', 'LAK']);
  });

  it('resolves a singleton without an existence check (single query)', async () => {
    const client = new FakeClient({
      upsert: { rows: [{ id: '7', acct_type: 'LIABILITY', status: 'active' }], rowCount: 1 },
    });
    const r = await repo.resolve(client as never, { ownerType: 'tax', sub: 'vat' });
    expect(r).toEqual({ id: 7n, acctType: 'LIABILITY', accountKey: 'vat:tax:_' });
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].params).toEqual(['LIABILITY', 'tax', null, 'vat', 'LAK']);
  });

  it('throws AccountNotFound when the owner entity does not exist', async () => {
    const client = new FakeClient({ ownerExists: false });
    await expect(
      repo.resolve(client as never, { ownerType: 'branch', sub: 'bank', ownerId: USER }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(client.calls).toHaveLength(1); // existence check only; no upsert
  });

  it('throws AccountInactive when the resolved account is not active', async () => {
    const client = new FakeClient({
      ownerExists: true,
      upsert: { rows: [{ id: '9', acct_type: 'LIABILITY', status: 'closed' }], rowCount: 1 },
    });
    await expect(
      repo.resolve(client as never, { ownerType: 'user', sub: 'available', ownerId: USER }),
    ).rejects.toBeInstanceOf(AccountInactiveError);
  });

  it('rejects vendor/franchise before touching the DB (fail closed)', async () => {
    const client = new FakeClient();
    await expect(
      repo.resolve(client as never, { ownerType: 'vendor' as never, sub: 'available', ownerId: USER }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(client.calls).toHaveLength(0);
  });

  it('rejects a non-LAK currency before touching the DB', async () => {
    const client = new FakeClient();
    await expect(
      repo.resolve(client as never, { ownerType: 'tax', sub: 'vat', currency: 'USD' }),
    ).rejects.toBeInstanceOf(CurrencyMismatchError);
    expect(client.calls).toHaveLength(0);
  });

  it('rejects an entity account missing its ownerId before touching the DB', async () => {
    const client = new FakeClient();
    await expect(
      repo.resolve(client as never, { ownerType: 'user', sub: 'available' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(client.calls).toHaveLength(0);
  });
});

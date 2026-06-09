import { LedgerService } from './ledger.service';
import type { LedgerRepository, PostResult } from '../domain/ports';
import type { PostInput, LedgerEntryView } from '../domain/ledger';
import { IdempotencyConflictError, InsufficientFundsError } from '@smartwash/common';

const USER = '44444444-4444-4444-8444-444444444444';
const REF = '55555555-5555-4555-8555-555555555555';

/**
 * In-memory ledger that mirrors the real invariants: idempotency_key dedup,
 * append-only running balance, overdraft rejection. Lets us test the service +
 * domain wiring without Postgres.
 */
class FakeRepo implements LedgerRepository {
  entries: LedgerEntryView[] = [];
  byKey = new Map<string, LedgerEntryView>();

  async postAtomic(input: PostInput): Promise<PostResult> {
    const existing = this.byKey.get(input.idempotencyKey);
    if (existing) {
      if (existing.type !== input.type || BigInt(existing.amount) !== input.amount) {
        throw new IdempotencyConflictError();
      }
      return { entry: existing, replayed: true };
    }
    const prev = this.entries.length
      ? BigInt(this.entries[this.entries.length - 1].balanceAfter)
      : 0n;
    const balanceAfter = prev + input.amount;
    if (balanceAfter < 0n) throw new InsufficientFundsError();
    const entry: LedgerEntryView = {
      id: this.entries.length + 1,
      userId: input.userId,
      type: input.type,
      amount: Number(input.amount),
      balanceAfter: Number(balanceAfter),
      refType: input.refType,
      refId: input.refId,
      createdAt: new Date().toISOString(),
    };
    this.entries.push(entry);
    this.byKey.set(input.idempotencyKey, entry);
    return { entry, replayed: false };
  }

  async listEntries(): Promise<LedgerEntryView[]> {
    return [...this.entries].reverse();
  }
}

function svc() {
  const repo = new FakeRepo();
  return { repo, service: new LedgerService(repo) };
}

describe('LedgerService.post', () => {
  const base = {
    userId: USER,
    refType: 'topup' as const,
    refId: REF,
  };

  it('posts a TOPUP and accumulates balance_after', async () => {
    const { service } = svc();
    const a = await service.post({ ...base, type: 'TOPUP', amount: 20000n, idempotencyKey: 'k1' });
    const b = await service.post({ ...base, type: 'TOPUP', amount: 5000n, idempotencyKey: 'k2' });
    expect(a.entry.balanceAfter).toBe(20000);
    expect(b.entry.balanceAfter).toBe(25000);
    expect(a.replayed).toBe(false);
  });

  it('rejects a wrong sign before touching the repo', async () => {
    const { service, repo } = svc();
    await expect(
      service.post({ ...base, type: 'TOPUP', amount: -1n, idempotencyKey: 'k' }),
    ).rejects.toMatchObject({ code: 'validation_error' });
    expect(repo.entries).toHaveLength(0);
  });

  it('replays the same idempotency key without double-posting', async () => {
    const { service, repo } = svc();
    await service.post({ ...base, type: 'TOPUP', amount: 20000n, idempotencyKey: 'dup' });
    const replay = await service.post({
      ...base,
      type: 'TOPUP',
      amount: 20000n,
      idempotencyKey: 'dup',
    });
    expect(replay.replayed).toBe(true);
    expect(repo.entries).toHaveLength(1);
  });

  it('conflicts when the same key is reused with a different amount', async () => {
    const { service } = svc();
    await service.post({ ...base, type: 'TOPUP', amount: 20000n, idempotencyKey: 'dup' });
    await expect(
      service.post({ ...base, type: 'TOPUP', amount: 99999n, idempotencyKey: 'dup' }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it('rejects a DEDUCT that would overdraw', async () => {
    const { service } = svc();
    await service.post({ ...base, type: 'TOPUP', amount: 10000n, idempotencyKey: 'k1' });
    await expect(
      service.post({
        ...base,
        type: 'DEDUCT',
        amount: -15000n,
        refType: 'order',
        idempotencyKey: 'k2',
      }),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
  });

  it('allows a DEDUCT within balance', async () => {
    const { service } = svc();
    await service.post({ ...base, type: 'TOPUP', amount: 20000n, idempotencyKey: 'k1' });
    const d = await service.post({
      ...base,
      type: 'DEDUCT',
      amount: -5000n,
      refType: 'order',
      idempotencyKey: 'k2',
    });
    expect(d.entry.balanceAfter).toBe(15000);
  });
});

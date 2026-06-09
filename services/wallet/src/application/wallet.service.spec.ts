import { WalletService } from './wallet.service';
import type { LedgerPosted, WalletRepository, WalletView } from '../domain/ports';

const USER = '44444444-4444-4444-8444-444444444444';

class FakeRepo implements WalletRepository {
  wallets = new Map<string, WalletView>();
  async get(userId: string): Promise<WalletView | null> {
    return this.wallets.get(userId) ?? null;
  }
  async applyBalance(userId: string, balanceAfter: number): Promise<void> {
    this.wallets.set(userId, {
      userId,
      balance: balanceAfter,
      currency: 'LAK',
      updatedAt: new Date().toISOString(),
    });
  }
}

function posted(overrides: Partial<LedgerPosted> = {}): LedgerPosted {
  return {
    ledgerId: 1,
    userId: USER,
    type: 'TOPUP',
    amount: 20000,
    balanceAfter: 20000,
    ...overrides,
  };
}

describe('WalletService', () => {
  it('returns an implicit zero balance for an unknown user', async () => {
    const svc = new WalletService(new FakeRepo());
    const w = await svc.getBalance(USER);
    expect(w.balance).toBe(0);
    expect(w.currency).toBe('LAK');
  });

  it('applies LedgerPosted to the cached balance', async () => {
    const repo = new FakeRepo();
    const svc = new WalletService(repo);
    await svc.onLedgerPosted(posted({ balanceAfter: 20000 }));
    expect((await svc.getBalance(USER)).balance).toBe(20000);
  });

  it('reflects the latest balance_after (last-write-wins)', async () => {
    const repo = new FakeRepo();
    const svc = new WalletService(repo);
    await svc.onLedgerPosted(posted({ ledgerId: 1, balanceAfter: 20000 }));
    await svc.onLedgerPosted(
      posted({ ledgerId: 2, type: 'DEDUCT', amount: -5000, balanceAfter: 15000 }),
    );
    expect((await svc.getBalance(USER)).balance).toBe(15000);
  });

  it('rejects an invalid event payload', async () => {
    const svc = new WalletService(new FakeRepo());
    await expect(
      svc.onLedgerPosted({ userId: '' } as never),
    ).rejects.toBeDefined();
  });
});

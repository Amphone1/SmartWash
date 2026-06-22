import { Logger } from '@nestjs/common';
import { WalletService } from './wallet.service';
import type { PgWalletProjectionRepository } from '../infra/db/pg-wallet-projection.repository';
import {
  walletReadDriftKip,
  walletReadDriftTotal,
} from '../infra/metrics/projection.metrics';
import type { LedgerPosted, WalletRepository, WalletView } from '../domain/ports';

const USER = '44444444-4444-4444-8444-444444444444';
const FLAG = 'WALLET_READ_V2_TOPUP';

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

type Split = { available: bigint; reserved: bigint; held: bigint; pending: bigint };

class FakeProjection {
  splits = new Map<string, Split>();
  calls = 0;
  err?: Error;
  async getProjected(userId: string): Promise<Split & { current: bigint }> {
    this.calls++;
    if (this.err) throw this.err;
    const s = this.splits.get(userId) ?? { available: 0n, reserved: 0n, held: 0n, pending: 0n };
    return { ...s, current: s.available + s.reserved + s.held + s.pending };
  }
  set(userId: string, available: bigint): void {
    this.splits.set(userId, { available, reserved: 0n, held: 0n, pending: 0n });
  }
}

function make(): { svc: WalletService; repo: FakeRepo; proj: FakeProjection } {
  const repo = new FakeRepo();
  const proj = new FakeProjection();
  const svc = new WalletService(repo, proj as unknown as PgWalletProjectionRepository);
  return { svc, repo, proj };
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
  afterEach(() => {
    delete process.env[FLAG];
    jest.restoreAllMocks();
  });

  // --- existing behavior (unchanged) ---
  it('returns an implicit zero balance for an unknown user', async () => {
    const { svc } = make();
    const w = await svc.getBalance(USER);
    expect(w.balance).toBe(0);
    expect(w.currency).toBe('LAK');
  });

  it('applies LedgerPosted to the cached balance', async () => {
    const { svc } = make();
    await svc.onLedgerPosted(posted({ balanceAfter: 20000 }));
    expect((await svc.getBalance(USER)).balance).toBe(20000);
  });

  it('reflects the latest balance_after (last-write-wins)', async () => {
    const { svc } = make();
    await svc.onLedgerPosted(posted({ ledgerId: 1, balanceAfter: 20000 }));
    await svc.onLedgerPosted(
      posted({ ledgerId: 2, type: 'DEDUCT', amount: -5000, balanceAfter: 15000 }),
    );
    expect((await svc.getBalance(USER)).balance).toBe(15000);
  });

  it('rejects an invalid event payload', async () => {
    const { svc } = make();
    await expect(svc.onLedgerPosted({ userId: '' } as never)).rejects.toBeDefined();
  });

  // --- A8a shadow read (flag WALLET_READ_V2_TOPUP) ---
  describe('A8a shadow read', () => {
    it('flag off (default): projection is not consulted, nothing recorded', async () => {
      const { svc, repo, proj } = make();
      repo.wallets.set(USER, { userId: USER, balance: 20000, currency: 'LAK', updatedAt: 't' });
      proj.set(USER, 999n); // would drift if consulted
      const incSpy = jest.spyOn(walletReadDriftTotal, 'inc');

      const w = await svc.getBalance(USER);

      expect(proj.calls).toBe(0);
      expect(incSpy).not.toHaveBeenCalled();
      expect(w.balance).toBe(20000);
    });

    it('the served WalletView is identical with flag off vs shadow', async () => {
      const view: WalletView = { userId: USER, balance: 20000, currency: 'LAK', updatedAt: 't' };

      const off = make();
      off.repo.wallets.set(USER, { ...view });
      off.proj.set(USER, 12345n); // drift present but must not change served value
      const served = await off.svc.getBalance(USER);

      const shadow = make();
      shadow.repo.wallets.set(USER, { ...view });
      shadow.proj.set(USER, 12345n);
      process.env[FLAG] = 'shadow';
      const servedShadow = await shadow.svc.getBalance(USER);

      expect(servedShadow).toEqual(served);
      expect(servedShadow).toEqual(view);
    });

    it('shadow + equal: serves legacy, records no drift', async () => {
      const { svc, repo, proj } = make();
      repo.wallets.set(USER, { userId: USER, balance: 20000, currency: 'LAK', updatedAt: 't' });
      proj.set(USER, 20000n);
      const incSpy = jest.spyOn(walletReadDriftTotal, 'inc');
      process.env[FLAG] = 'shadow';

      const w = await svc.getBalance(USER);

      expect(proj.calls).toBe(1);
      expect(incSpy).not.toHaveBeenCalled();
      expect(w.balance).toBe(20000);
    });

    it('shadow + v2 > legacy: records POSITIVE drift, still serves legacy', async () => {
      const { svc, repo, proj } = make();
      repo.wallets.set(USER, { userId: USER, balance: 20000, currency: 'LAK', updatedAt: 't' });
      proj.set(USER, 25000n); // drift = +5000
      const incSpy = jest.spyOn(walletReadDriftTotal, 'inc');
      const obsSpy = jest.spyOn(walletReadDriftKip, 'observe');
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      process.env[FLAG] = 'shadow';

      const w = await svc.getBalance(USER);

      expect(w.balance).toBe(20000); // served value unchanged
      expect(incSpy).toHaveBeenCalledWith({ flow: 'topup' });
      expect(obsSpy).toHaveBeenCalledWith({ flow: 'topup' }, 5000); // magnitude
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('drift=5000'));
    });

    it('shadow + v2 < legacy: records NEGATIVE drift', async () => {
      const { svc, repo, proj } = make();
      repo.wallets.set(USER, { userId: USER, balance: 20000, currency: 'LAK', updatedAt: 't' });
      proj.set(USER, 18000n); // drift = -2000
      const obsSpy = jest.spyOn(walletReadDriftKip, 'observe');
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      process.env[FLAG] = 'shadow';

      await svc.getBalance(USER);

      expect(obsSpy).toHaveBeenCalledWith({ flow: 'topup' }, 2000); // abs magnitude
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('drift=-2000'));
    });

    it('serve: warns once and behaves as shadow (compare only, serves legacy)', async () => {
      const { svc, repo, proj } = make();
      repo.wallets.set(USER, { userId: USER, balance: 20000, currency: 'LAK', updatedAt: 't' });
      proj.set(USER, 25000n);
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      const incSpy = jest.spyOn(walletReadDriftTotal, 'inc');
      process.env[FLAG] = 'serve';

      const w1 = await svc.getBalance(USER);
      const w2 = await svc.getBalance(USER);

      expect(w1.balance).toBe(20000); // never serves v2
      expect(w2.balance).toBe(20000);
      expect(proj.calls).toBe(2); // compared both times
      expect(incSpy).toHaveBeenCalledTimes(2); // drift recorded both times
      // exactly one "serve not implemented" warning across the two calls
      const serveWarnings = warnSpy.mock.calls.filter((c) =>
        String(c[0]).includes('serve not implemented'),
      );
      expect(serveWarnings).toHaveLength(1);
    });

    it('shadow read failure never affects the served balance', async () => {
      const { svc, repo, proj } = make();
      repo.wallets.set(USER, { userId: USER, balance: 20000, currency: 'LAK', updatedAt: 't' });
      proj.err = new Error('db down');
      process.env[FLAG] = 'shadow';

      const w = await svc.getBalance(USER);

      expect(w.balance).toBe(20000);
      expect(proj.calls).toBe(1);
    });
  });
});

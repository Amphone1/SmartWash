/**
 * A8a integration tests for the shadow read. Seeds legacy `wallets` + the A7
 * `wallet_balances` projection for a user and asserts getBalance ALWAYS serves
 * the legacy WalletView (Stage-1 SHADOW) while recording drift. Requires a real
 * Postgres with the schema applied; self-skips when DATABASE_URL is unset (so
 * `nx test wallet` stays green locally). Random UUIDs isolate committed rows.
 */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { Database } from '@smartwash/nestkit';
import { WalletService } from './wallet.service';
import { PgWalletProjectionRepository } from '../infra/db/pg-wallet-projection.repository';
import { PgWalletRepository } from '../infra/db/pg-wallet.repository';
import {
  walletReadDriftKip,
  walletReadDriftTotal,
} from '../infra/metrics/projection.metrics';
import type { WalletView } from '../domain/ports';

const DBURL = process.env.DATABASE_URL;
const suite = DBURL ? describe : describe.skip;
const FLAG = 'WALLET_READ_V2_TOPUP';

suite('A8a wallet shadow read [requires DATABASE_URL]', () => {
  let pool: Pool;
  let svc: WalletService;
  let projection: PgWalletProjectionRepository;

  beforeAll(() => {
    pool = new Pool({ connectionString: DBURL });
    const db = new Database(pool);
    projection = new PgWalletProjectionRepository(db);
    svc = new WalletService(new PgWalletRepository(db), projection);
  });
  afterAll(async () => {
    await pool.end();
  });
  afterEach(() => {
    delete process.env[FLAG];
    jest.restoreAllMocks();
  });

  async function seedUser(u: string): Promise<void> {
    await pool.query(`INSERT INTO users (id, phone, name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [
      u,
      `+85620${u.replace(/-/g, '').slice(0, 9)}`,
      `it-${u.slice(0, 8)}`,
    ]);
  }
  async function seedLegacy(u: string, balance: bigint): Promise<void> {
    await pool.query(
      `INSERT INTO wallets (user_id, balance) VALUES ($1,$2)
       ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance`,
      [u, balance.toString()],
    );
  }
  async function seedProjection(
    u: string,
    p: { available: bigint; reserved: bigint; held: bigint; pending: bigint },
  ): Promise<void> {
    await pool.query(
      `INSERT INTO wallet_balances (user_id, available, reserved, held, pending) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id) DO UPDATE SET
         available = EXCLUDED.available, reserved = EXCLUDED.reserved,
         held = EXCLUDED.held, pending = EXCLUDED.pending`,
      [u, p.available.toString(), p.reserved.toString(), p.held.toString(), p.pending.toString()],
    );
  }
  const splitZero = (available: bigint) => ({ available, reserved: 0n, held: 0n, pending: 0n });

  it('getProjected returns zeros for an unseeded user', async () => {
    const p = await projection.getProjected(randomUUID());
    expect(p).toEqual({ available: 0n, reserved: 0n, held: 0n, pending: 0n, current: 0n });
  });

  it('shadow + equal: serves legacy WalletView, records no drift', async () => {
    const u = randomUUID();
    await seedUser(u);
    await seedLegacy(u, 50000n);
    await seedProjection(u, splitZero(50000n)); // current == legacy
    const incSpy = jest.spyOn(walletReadDriftTotal, 'inc');
    process.env[FLAG] = 'shadow';

    const w = await svc.getBalance(u);

    expect(w).toMatchObject<Partial<WalletView>>({ userId: u, balance: 50000, currency: 'LAK' });
    expect(incSpy).not.toHaveBeenCalled();
  });

  it('shadow + drift: serves the LEGACY value but records drift', async () => {
    const u = randomUUID();
    await seedUser(u);
    await seedLegacy(u, 50000n);
    await seedProjection(u, splitZero(55000n)); // current=55000, drift=+5000
    const incSpy = jest.spyOn(walletReadDriftTotal, 'inc');
    const obsSpy = jest.spyOn(walletReadDriftKip, 'observe');
    process.env[FLAG] = 'shadow';

    const w = await svc.getBalance(u);

    expect(w.balance).toBe(50000); // legacy served, NOT v2's 55000
    expect(incSpy).toHaveBeenCalledWith({ flow: 'topup' });
    expect(obsSpy).toHaveBeenCalledWith({ flow: 'topup' }, 5000);
  });

  it('flag off: served value identical to shadow, projection not consulted', async () => {
    const u = randomUUID();
    await seedUser(u);
    await seedLegacy(u, 50000n);
    await seedProjection(u, splitZero(55000n)); // drift present
    const getSpy = jest.spyOn(projection, 'getProjected');
    const incSpy = jest.spyOn(walletReadDriftTotal, 'inc');

    // off (default — flag unset)
    const off = await svc.getBalance(u);
    expect(getSpy).not.toHaveBeenCalled();
    expect(incSpy).not.toHaveBeenCalled();

    // shadow serves the same value
    process.env[FLAG] = 'shadow';
    const shadow = await svc.getBalance(u);
    expect(shadow).toEqual(off);
    expect(shadow.balance).toBe(50000);
  });
});

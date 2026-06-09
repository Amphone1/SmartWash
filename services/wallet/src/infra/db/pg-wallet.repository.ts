import { Injectable } from '@nestjs/common';
import { Database } from '@smartwash/nestkit';
import type { WalletRepository, WalletView } from '../../domain/ports';

interface Row {
  user_id: string;
  balance: string;
  currency: string;
  updated_at: Date;
}

@Injectable()
export class PgWalletRepository implements WalletRepository {
  constructor(private readonly db: Database) {}

  async get(userId: string): Promise<WalletView | null> {
    const { rows } = await this.db
      .getPool()
      .query<Row>(
        `SELECT user_id, balance, currency, updated_at FROM wallets WHERE user_id = $1`,
        [userId],
      );
    const r = rows[0];
    if (!r) return null;
    return {
      userId: r.user_id,
      balance: Number(r.balance),
      currency: r.currency,
      updatedAt: r.updated_at.toISOString(),
    };
  }

  /**
   * Cache update only — the source of truth is ledger_entries. We store the
   * ledger's authoritative balance_after. JetStream delivers per-subject in
   * order, so last-write-wins is correct here.
   */
  async applyBalance(userId: string, balanceAfter: number): Promise<void> {
    await this.db.getPool().query(
      `INSERT INTO wallets (user_id, balance) VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET balance = EXCLUDED.balance, updated_at = now()`,
      [userId, balanceAfter.toString()],
    );
  }
}

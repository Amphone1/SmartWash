import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@smartwash/common';
import {
  WALLET_REPOSITORY,
  type LedgerPosted,
  type WalletRepository,
  type WalletView,
} from '../domain/ports';

@Injectable()
export class WalletService {
  constructor(
    @Inject(WALLET_REPOSITORY) private readonly repo: WalletRepository,
  ) {}

  async getBalance(userId: string): Promise<WalletView> {
    const wallet = await this.repo.get(userId);
    // A user with no ledger activity yet has an implicit zero balance.
    return (
      wallet ?? {
        userId,
        balance: 0,
        currency: 'LAK',
        updatedAt: new Date(0).toISOString(),
      }
    );
  }

  /** Apply a LedgerPosted event to the cached balance. */
  async onLedgerPosted(event: LedgerPosted): Promise<void> {
    if (!event?.userId || typeof event.balanceAfter !== 'number') {
      throw new NotFoundError('invalid LedgerPosted payload');
    }
    await this.repo.applyBalance(event.userId, event.balanceAfter);
  }
}

export interface WalletView {
  userId: string;
  balance: number; // kip
  currency: string;
  updatedAt: string;
}

/** LedgerPosted event payload (contracts/events.schema.json → LedgerPosted). */
export interface LedgerPosted {
  ledgerId: number;
  userId: string;
  type: 'TOPUP' | 'DEDUCT' | 'REFUND_REVERSAL' | 'ADJUSTMENT';
  amount: number;
  balanceAfter: number;
}

export interface WalletRepository {
  get(userId: string): Promise<WalletView | null>;
  /** Upsert the cached balance to the ledger's authoritative balance_after. */
  applyBalance(userId: string, balanceAfter: number): Promise<void>;
}
export const WALLET_REPOSITORY = Symbol('WALLET_REPOSITORY');

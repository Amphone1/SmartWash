import type { PoolClient } from 'pg';
import type { LedgerEntryView, PostInput } from './ledger';
import type { AccountRef, AcctType } from './accounts';
import type { TransactionIntent, Direction } from './posting-rules';

export interface PostResult {
  entry: LedgerEntryView;
  replayed: boolean;
}

export interface RefundInput {
  userId: string;
  orderId: string;
  amount: bigint; // positive kip (credited back)
  type: 'FULL' | 'PARTIAL';
  reason?: string;
  idempotencyKey: string;
}

export interface RefundResult {
  entry: LedgerEntryView;
  refundId: string;
  replayed: boolean;
}

export interface LedgerRepository {
  /** Atomic: serialize per user, dedup on idempotency_key, append entry + outbox. */
  postAtomic(input: PostInput): Promise<PostResult>;
  /** Atomic refund: REFUND_REVERSAL entry + refunds row + outbox, idempotent. */
  postRefund(input: RefundInput): Promise<RefundResult>;
  listEntries(
    userId: string,
    limit: number,
    cursor: number | null,
  ): Promise<LedgerEntryView[]>;
}
export const LEDGER_REPOSITORY = Symbol('LEDGER_REPOSITORY');

/** Result of resolving (get-or-create) a chart-of-accounts account (A2). */
export interface ResolvedAccount {
  id: bigint;
  acctType: AcctType;
  accountKey: string;
}

export interface AccountResolver {
  /**
   * Get-or-create the account for `ref` inside the caller's transaction and
   * return its surrogate id + canonical key. Idempotent (find-or-create); MUST
   * run on the caller's client so create is atomic with the posting it serves.
   */
  resolve(client: PoolClient, ref: AccountRef): Promise<ResolvedAccount>;
}
export const ACCOUNT_RESOLVER = Symbol('ACCOUNT_RESOLVER');

/** One persisted posting line (A4 `postTransaction` result / `posted.v2`). */
export interface PostedPosting {
  accountId: bigint;
  accountKey: string;
  ownerType: string;
  ownerId: string | null;
  direction: Direction;
  amount: bigint;
  balanceAfter: bigint;
}

export interface PostTransactionResult {
  txnId: bigint;
  type: string;
  postings: PostedPosting[];
  replayed: boolean;
}

export interface TransactionRepository {
  /**
   * Persist a balanced double-entry transaction (A3 intent) atomically: resolve
   * accounts, advisory-lock them, compute `balance_after`, guard overdraft, write
   * `ledger_transactions` + `ledger_postings` + a `posted.v2` outbox row in one
   * transaction. Idempotent on `intent.idempotencyKey` (replay-safe).
   */
  post(intent: TransactionIntent): Promise<PostTransactionResult>;
}
export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');

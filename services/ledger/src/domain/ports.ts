import type { LedgerEntryView, PostInput } from './ledger';

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

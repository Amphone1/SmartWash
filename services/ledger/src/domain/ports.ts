import type { LedgerEntryView, PostInput } from './ledger';

export interface PostResult {
  entry: LedgerEntryView;
  replayed: boolean;
}

export interface LedgerRepository {
  /** Atomic: serialize per user, dedup on idempotency_key, append entry + outbox. */
  postAtomic(input: PostInput): Promise<PostResult>;
  listEntries(
    userId: string,
    limit: number,
    cursor: number | null,
  ): Promise<LedgerEntryView[]>;
}
export const LEDGER_REPOSITORY = Symbol('LEDGER_REPOSITORY');

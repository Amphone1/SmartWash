import { Inject, Injectable } from '@nestjs/common';
import {
  validateSign,
  type LedgerEntryView,
  type PostInput,
} from '../domain/ledger';
import {
  LEDGER_REPOSITORY,
  type LedgerRepository,
  type PostResult,
} from '../domain/ports';

@Injectable()
export class LedgerService {
  constructor(
    @Inject(LEDGER_REPOSITORY) private readonly repo: LedgerRepository,
  ) {}

  /** Post a ledger entry (TOPUP/DEDUCT/REFUND_REVERSAL/ADJUSTMENT). */
  async post(input: PostInput): Promise<PostResult> {
    validateSign(input.type, input.amount);
    return this.repo.postAtomic(input);
  }

  listEntries(
    userId: string,
    limit: number,
    cursor: number | null,
  ): Promise<LedgerEntryView[]> {
    return this.repo.listEntries(userId, Math.min(limit, 200), cursor);
  }
}

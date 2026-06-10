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
  type RefundInput,
  type RefundResult,
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

  /** Refund: REFUND_REVERSAL entry + refunds row, atomic & idempotent. */
  async refund(input: RefundInput): Promise<RefundResult> {
    validateSign('REFUND_REVERSAL', input.amount); // enforces amount > 0
    return this.repo.postRefund(input);
  }

  listEntries(
    userId: string,
    limit: number,
    cursor: number | null,
  ): Promise<LedgerEntryView[]> {
    return this.repo.listEntries(userId, Math.min(limit, 200), cursor);
  }
}

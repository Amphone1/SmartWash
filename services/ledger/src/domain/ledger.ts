/**
 * Ledger domain — append-only money movements (rules #1, #2).
 * Pure sign rules + running-balance math; no I/O.
 */
import { ValidationError } from '@smartwash/common';

export type LedgerType = 'TOPUP' | 'DEDUCT' | 'REFUND_REVERSAL' | 'ADJUSTMENT';

export interface PostInput {
  userId: string;
  type: LedgerType;
  amount: bigint; // signed kip
  refType: string; // order | topup | refund | recon
  refId: string;
  idempotencyKey: string;
  // A5 dual-write context (additive, optional). Used only to build the shadow
  // double-entry mirror; absent → that flow's mirror is skipped. No effect on the
  // authoritative legacy write.
  branchId?: string;
  vatBps?: number;
  channel?: 'wash' | 'delivery';
}

export interface LedgerEntryView {
  id: number;
  userId: string;
  type: LedgerType;
  amount: bigint;
  balanceAfter: bigint;
  refType: string | null;
  refId: string | null;
  createdAt: string;
}

/** Enforce the sign convention per entry type. */
export function validateSign(type: LedgerType, amount: bigint): void {
  switch (type) {
    case 'TOPUP':
      if (amount <= 0n) throw new ValidationError('TOPUP amount must be positive');
      break;
    case 'DEDUCT':
      if (amount >= 0n) throw new ValidationError('DEDUCT amount must be negative');
      break;
    case 'REFUND_REVERSAL':
      if (amount <= 0n)
        throw new ValidationError('REFUND_REVERSAL must be positive (credit back)');
      break;
    case 'ADJUSTMENT':
      if (amount === 0n) throw new ValidationError('ADJUSTMENT must be non-zero');
      break;
  }
}

/** New running balance after applying a signed amount. */
export function nextBalance(prev: bigint, amount: bigint): bigint {
  return prev + amount;
}

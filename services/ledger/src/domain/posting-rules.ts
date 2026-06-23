/**
 * Posting rules + transaction builder (EPIC A · A3).
 *
 * PURE domain: maps each of the 9 ledger operations to a **balanced** double-entry
 * transaction intent (Σ DR = Σ CR), referencing chart-of-accounts *refs* (A2) — NOT
 * DB ids. No DB, no outbox, no side effects. A4 resolves each ref via
 * `resolveAccount()` and persists; A3 only computes the shape.
 *
 * Posting rules mirror FINANCIAL_CONTRACT.md §4 + MONEY_MODEL_PROPOSED.md §3.
 * VAT split for CAPTURE/REFUND uses `splitVatInclusive` (floor net, remainder→VAT;
 * rate-consistent with order pricing) — FINANCIAL_CONTRACT §1.
 */
import {
  type Kip,
  UnbalancedTransactionError,
  ValidationError,
  splitVatInclusive,
} from '@smartwash/common';
import { type AccountRef, buildAccountKey, validateAccountRef } from './accounts';

/** The 9 double-entry operations (mirrors the `ledger_txn_type` DB enum). */
export type LedgerTxnType =
  | 'TOPUP'
  | 'TOPUP_SETTLE'
  | 'RESERVE'
  | 'RELEASE'
  | 'HOLD'
  | 'CAPTURE'
  | 'REFUND_REVERSAL'
  | 'ADJUSTMENT'
  | 'SETTLEMENT';

export type Direction = 'DR' | 'CR';

export interface PostingIntent {
  account: AccountRef;
  accountKey: string;
  direction: Direction;
  amount: Kip;
}

export interface TransactionIntent {
  type: LedgerTxnType;
  idempotencyKey: string;
  correlationId?: string;
  postings: PostingIntent[];
}

// ── account-ref helpers (all subs exist in the A2 catalog) ──────────────────
const userAcct = (sub: string, userId: string): AccountRef => ({ ownerType: 'user', sub, ownerId: userId });
const branchAcct = (sub: string, branchId: string): AccountRef => ({ ownerType: 'branch', sub, ownerId: branchId });
const vatAcct = (): AccountRef => ({ ownerType: 'tax', sub: 'vat' });
const platformBank = (): AccountRef => ({ ownerType: 'platform', sub: 'bank' });
const staffPayable = (staffId: string): AccountRef => ({ ownerType: 'staff', sub: 'payable', ownerId: staffId });

/** One posting line. Validates the account ref (pure) and that amount is positive. */
function line(direction: Direction, ref: AccountRef, amount: Kip): PostingIntent {
  if (amount <= 0n) {
    throw new ValidationError(`posting amount must be positive, got ${amount}`);
  }
  const n = validateAccountRef(ref); // fail-closed: vendor/franchise/unknown/bad owner
  return { account: ref, accountKey: n.accountKey, direction, amount };
}

/** Assemble + assert the transaction is balanced (Σ DR = Σ CR, ≥2 postings). */
function build(
  type: LedgerTxnType,
  idempotencyKey: string,
  postings: PostingIntent[],
  correlationId?: string,
): TransactionIntent {
  let dr = 0n;
  let cr = 0n;
  for (const p of postings) {
    if (p.direction === 'DR') dr += p.amount;
    else cr += p.amount;
  }
  if (postings.length < 2) {
    throw new UnbalancedTransactionError(`${type} ${idempotencyKey}: needs ≥2 postings`);
  }
  if (dr !== cr) {
    throw new UnbalancedTransactionError(`${type} ${idempotencyKey}: Σ DR ${dr} ≠ Σ CR ${cr}`);
  }
  return { type, idempotencyKey, correlationId, postings };
}

// ── the 9 operations ─────────────────────────────────────────────────────────

export interface TopupInput { qrRef: string; userId: string; branchId: string; amount: Kip; correlationId?: string; }
/** 4.1 TOPUP — provisional credit on slip approval. DR clearing:branch / CR wallet:pending. */
export function buildTopup(i: TopupInput): TransactionIntent {
  return build('TOPUP', `topup:${i.qrRef}`, [
    line('DR', branchAcct('clearing', i.branchId), i.amount),
    line('CR', userAcct('pending', i.userId), i.amount),
  ], i.correlationId);
}

export interface TopupSettleInput { qrRef: string; userId: string; branchId: string; amount: Kip; correlationId?: string; }
/** 4.2 TOPUP_SETTLE — bank matched → funds spendable. Two balanced pairs in one txn. */
export function buildTopupSettle(i: TopupSettleInput): TransactionIntent {
  return build('TOPUP_SETTLE', `topup-settle:${i.qrRef}`, [
    line('DR', branchAcct('bank', i.branchId), i.amount),
    line('CR', branchAcct('clearing', i.branchId), i.amount),
    line('DR', userAcct('pending', i.userId), i.amount),
    line('CR', userAcct('available', i.userId), i.amount),
  ], i.correlationId);
}

export interface ReserveInput { orderId: string; userId: string; amount: Kip; correlationId?: string; }
/** 4.3 RESERVE — commit funds to an in-flight wash. DR available / CR reserved. */
export function buildReserve(i: ReserveInput): TransactionIntent {
  return build('RESERVE', `reserve:${i.orderId}`, [
    line('DR', userAcct('available', i.userId), i.amount),
    line('CR', userAcct('reserved', i.userId), i.amount),
  ], i.correlationId);
}

export interface HoldInput { orderId: string; userId: string; amount: Kip; correlationId?: string; }
/** 4.4 HOLD — authorization hold (charge-on-delivery). DR available / CR held. */
export function buildHold(i: HoldInput): TransactionIntent {
  return build('HOLD', `hold:${i.orderId}`, [
    line('DR', userAcct('available', i.userId), i.amount),
    line('CR', userAcct('held', i.userId), i.amount),
  ], i.correlationId);
}

export interface CaptureInput {
  orderId: string; userId: string; branchId: string;
  gross: Kip; vatBps: number;
  channel: 'wash' | 'delivery';
  correlationId?: string;
}
/**
 * 4.5 CAPTURE / DEDUCT — recognize revenue. DR wallet:reserved|held (gross) →
 * CR revenue:branch (net) + CR tax:vat (vat). Split via splitVatInclusive so
 * net + vat === gross (remainder → VAT). VAT line omitted when vat == 0.
 */
export function buildCapture(i: CaptureInput): TransactionIntent {
  const { net, vat } = splitVatInclusive(i.gross, i.vatBps);
  const source = i.channel === 'wash' ? 'reserved' : 'held';
  const key = i.channel === 'wash' ? `wash-deduct:${i.orderId}` : `delivery-deduct:${i.orderId}`;
  const postings: PostingIntent[] = [
    line('DR', userAcct(source, i.userId), i.gross),
    line('CR', branchAcct('revenue', i.branchId), net),
  ];
  if (vat > 0n) postings.push(line('CR', vatAcct(), vat));
  return build('CAPTURE', key, postings, i.correlationId);
}

export interface ReleaseInput { orderId: string; userId: string; amount: Kip; source: 'reserved' | 'held'; correlationId?: string; }
/** 4.6 RELEASE — un-commit reserved/held funds. DR reserved|held / CR available. */
export function buildRelease(i: ReleaseInput): TransactionIntent {
  return build('RELEASE', `release:${i.orderId}`, [
    line('DR', userAcct(i.source, i.userId), i.amount),
    line('CR', userAcct('available', i.userId), i.amount),
  ], i.correlationId);
}

export interface RefundReversalInput {
  orderId: string; userId: string; branchId: string;
  gross: Kip; vatBps: number;
  seq?: number; // present → partial pro-rata refund
  correlationId?: string;
}
/**
 * 4.7 REFUND_REVERSAL — reverse recognized revenue back to the wallet.
 * DR revenue:branch (net) + DR tax:vat (vat) → CR wallet:available (gross).
 */
export function buildRefundReversal(i: RefundReversalInput): TransactionIntent {
  const { net, vat } = splitVatInclusive(i.gross, i.vatBps);
  const key = i.seq === undefined
    ? `wash-refund:${i.orderId}`
    : `wash-refund:${i.orderId}:partial:${i.seq}`;
  const postings: PostingIntent[] = [line('DR', branchAcct('revenue', i.branchId), net)];
  if (vat > 0n) postings.push(line('DR', vatAcct(), vat));
  postings.push(line('CR', userAcct('available', i.userId), i.gross));
  return build('REFUND_REVERSAL', key, postings, i.correlationId);
}

export interface AdjustmentLine { account: AccountRef; direction: Direction; amount: Kip; }
export interface AdjustmentInput { ref: string; seq?: number; lines: AdjustmentLine[]; correlationId?: string; }
/**
 * 4.8 ADJUSTMENT — recon correction. Caller supplies the balanced line set; the
 * builder validates each line and enforces Σ DR = Σ CR. Never edits a prior row.
 */
export function buildAdjustment(i: AdjustmentInput): TransactionIntent {
  const key = i.seq === undefined ? `adjust:${i.ref}` : `adjust:${i.ref}:${i.seq}`;
  const postings = i.lines.map((l) => line(l.direction, l.account, l.amount));
  return build('ADJUSTMENT', key, postings, i.correlationId);
}

export interface SettlementInput { branchId: string; period: string; staffId: string; amount: Kip; correlationId?: string; }
/** 4.9 SETTLEMENT — payout to staff/driver. DR payable:staff / CR bank:platform. */
export function buildSettlement(i: SettlementInput): TransactionIntent {
  return build('SETTLEMENT', `settle:${i.branchId}:${i.period}`, [
    line('DR', staffPayable(i.staffId), i.amount),
    line('CR', platformBank(), i.amount),
  ], i.correlationId);
}

/** Convenience: the canonical key for a posting (re-exported for events/logging). */
export { buildAccountKey };

/**
 * A5 dual-write mapping (PURE). Translates one authoritative legacy single-entry
 * operation into the equivalent new double-entry A3 intent(s), so the new ledger's
 * `current(user)` tracks the legacy wallet balance.
 *
 * Mirror intents use an isolated `dual:{refId}` keyspace (keys like
 * `topup:dual:{refId}`) so they never collide with real saga keys before cutover.
 * Returns `{ skip }` when required context is missing (the caller skips the mirror
 * and records a coverage gap — never fails the authoritative write).
 */
import { type LedgerType } from './ledger';
import {
  type TransactionIntent,
  buildTopup,
  buildTopupSettle,
  buildReserve,
  buildHold,
  buildCapture,
  buildRefundReversal,
  buildAdjustment,
} from './posting-rules';

export interface DualWriteContext {
  userId: string;
  type: LedgerType;
  refType: string; // order | topup | refund | recon
  refId: string;
  amount: bigint; // signed kip (legacy convention)
  legacyBalanceAfter: bigint;
  branchId?: string;
  vatBps?: number;
  channel?: 'wash' | 'delivery';
  correlationId?: string;
}

/** Logical flow used for per-flow flag gating + metric labels. */
export type DualWriteFlow = 'topup' | 'wash' | 'delivery' | 'refund' | 'adjust';

export function flowFor(ctx: DualWriteContext): DualWriteFlow {
  switch (ctx.type) {
    case 'TOPUP':
      return 'topup';
    case 'DEDUCT':
      return ctx.channel === 'delivery' ? 'delivery' : 'wash';
    case 'REFUND_REVERSAL':
      return 'refund';
    case 'ADJUSTMENT':
      return 'adjust';
  }
}

export type MappedIntents =
  | { intents: TransactionIntent[] }
  | { skip: string };

/**
 * Map a legacy op → new intent(s). The `dual:` ref namespace keeps mirror keys
 * isolated. Decisions (approved): TOPUP → TOPUP + TOPUP_SETTLE (funds to available,
 * matching the legacy spendable balance); DEDUCT → RESERVE/HOLD + CAPTURE;
 * REFUND_REVERSAL → REFUND_REVERSAL; ADJUSTMENT → balanced pair vs suspense:platform.
 */
export function mapLegacyToIntents(ctx: DualWriteContext): MappedIntents {
  const dref = `dual:${ctx.refId}`;
  const cid = ctx.correlationId;

  switch (ctx.type) {
    case 'TOPUP': {
      if (!ctx.branchId) return { skip: 'missing_branchId' };
      const amount = ctx.amount; // positive
      return {
        intents: [
          buildTopup({ qrRef: dref, userId: ctx.userId, branchId: ctx.branchId, amount, correlationId: cid }),
          buildTopupSettle({ qrRef: dref, userId: ctx.userId, branchId: ctx.branchId, amount, correlationId: cid }),
        ],
      };
    }
    case 'DEDUCT': {
      if (!ctx.branchId) return { skip: 'missing_branchId' };
      if (ctx.vatBps === undefined) return { skip: 'missing_vatBps' };
      if (ctx.channel === undefined) return { skip: 'missing_channel' };
      const gross = -ctx.amount; // legacy DEDUCT is negative
      const reserve =
        ctx.channel === 'wash'
          ? buildReserve({ orderId: dref, userId: ctx.userId, amount: gross, correlationId: cid })
          : buildHold({ orderId: dref, userId: ctx.userId, amount: gross, correlationId: cid });
      const capture = buildCapture({
        orderId: dref,
        userId: ctx.userId,
        branchId: ctx.branchId,
        gross,
        vatBps: ctx.vatBps,
        channel: ctx.channel,
        correlationId: cid,
      });
      return { intents: [reserve, capture] };
    }
    case 'REFUND_REVERSAL': {
      if (!ctx.branchId) return { skip: 'missing_branchId' };
      if (ctx.vatBps === undefined) return { skip: 'missing_vatBps' };
      return {
        intents: [
          buildRefundReversal({
            orderId: dref,
            userId: ctx.userId,
            branchId: ctx.branchId,
            gross: ctx.amount, // positive
            vatBps: ctx.vatBps,
            correlationId: cid,
          }),
        ],
      };
    }
    case 'ADJUSTMENT': {
      // Legacy per-user ±amount has no counter-party → pair against suspense:platform
      // (existing chart account). +amount credits the user; −amount debits the user.
      const mag = ctx.amount < 0n ? -ctx.amount : ctx.amount;
      const userAvailable = { ownerType: 'user' as const, sub: 'available', ownerId: ctx.userId };
      const suspense = { ownerType: 'platform' as const, sub: 'suspense' };
      const lines =
        ctx.amount > 0n
          ? [
              { account: suspense, direction: 'DR' as const, amount: mag },
              { account: userAvailable, direction: 'CR' as const, amount: mag },
            ]
          : [
              { account: userAvailable, direction: 'DR' as const, amount: mag },
              { account: suspense, direction: 'CR' as const, amount: mag },
            ];
      return { intents: [buildAdjustment({ ref: dref, lines, correlationId: cid })] };
    }
  }
}

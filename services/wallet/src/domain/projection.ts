/**
 * Wallet four-balance projection (EPIC A · A7) — PURE.
 *
 * Computes the per-sub DELTA a `posted.v2` transaction applies to a user's wallet.
 * Delta-apply (not set-to-balanceAfter) → order-independent; exactly-once is
 * guaranteed by the A6 inbox. User wallet accounts are LIABILITY (credit-positive),
 * so a CR adds and a DR subtracts.
 */
export type WalletSub = 'available' | 'reserved' | 'held' | 'pending';
const SUBS: readonly WalletSub[] = ['available', 'reserved', 'held', 'pending'];

export interface V2Posting {
  accountKey: string; // e.g. "available:user:<uuid>"
  ownerType: string;
  ownerId: string | null;
  direction: 'DR' | 'CR';
  amount: string; // kip as decimal string (BIGINT precision)
  balanceAfter: string;
}

export interface V2Payload {
  txnId: string;
  type: string;
  userId: string | null;
  postings: V2Posting[];
}

export interface WalletDeltas {
  available: bigint;
  reserved: bigint;
  held: bigint;
  pending: bigint;
}

export const ZERO_DELTAS: WalletDeltas = { available: 0n, reserved: 0n, held: 0n, pending: 0n };

/** Unwrap the v2 payload from the relay Envelope (data) or accept a bare payload. */
export function extractV2(envelope: Record<string, unknown>): V2Payload {
  return (envelope.data ?? envelope) as V2Payload;
}

/** Per-sub delta this transaction applies to `userId`'s wallet (LIABILITY sign). */
export function computeWalletDeltas(postings: V2Posting[], userId: string): WalletDeltas {
  const d: WalletDeltas = { ...ZERO_DELTAS };
  for (const p of postings) {
    if (p.ownerType !== 'user' || p.ownerId !== userId) continue;
    const sub = p.accountKey.split(':')[0] as WalletSub;
    if (!SUBS.includes(sub)) continue;
    const amount = BigInt(p.amount);
    d[sub] += p.direction === 'CR' ? amount : -amount;
  }
  return d;
}

export function sumDeltas(d: WalletDeltas): bigint {
  return d.available + d.reserved + d.held + d.pending;
}

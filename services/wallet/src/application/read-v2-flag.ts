/**
 * A8a wallet-read cutover flag resolver (pure, no side effects).
 *
 * `WALLET_READ_V2_<FLOW>` is a tri-state string `off | shadow | serve` (default
 * `off`). A8a Stage-1 implements **shadow only** — it NEVER serves v2:
 *  - `shadow` → read both, compare, serve legacy.
 *  - `serve`  → NOT implemented in A8a. We must not behave as serve; instead warn
 *               once and fall back to compare-only (`serveRequested` flags this so
 *               the caller can log the one-time warning). Served value stays legacy.
 *  - anything else (`off`, unknown, empty) → fail safe: no shadow behavior.
 */
export type WalletReadV2Mode = 'off' | 'shadow';

export interface WalletReadV2Resolution {
  /** Effective behavior in A8a: 'off' (no compare) or 'shadow' (compare, serve legacy). */
  mode: WalletReadV2Mode;
  /** True only when the raw flag asked for `serve` (unimplemented in A8a → warn, treat as shadow). */
  serveRequested: boolean;
}

export function resolveWalletReadV2(raw: string): WalletReadV2Resolution {
  switch (raw) {
    case 'shadow':
      return { mode: 'shadow', serveRequested: false };
    case 'serve':
      // Stage-2 serve is a later, separately-gated increment. Compare only here.
      return { mode: 'shadow', serveRequested: true };
    default:
      return { mode: 'off', serveRequested: false };
  }
}

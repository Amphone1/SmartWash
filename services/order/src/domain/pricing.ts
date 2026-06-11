/**
 * Order pricing — all kip, all bigint (rule #1). Phase 1 keeps it simple:
 * base = the machine's price, optionally scaled by cycle, plus per-addon fees,
 * then VAT applied as basis points. No floats anywhere.
 */
import { type Kip, add, applyBasisPoints, toKip } from '@smartwash/common';

export type Cycle = 'quick' | 'normal' | 'heavy';

/** Cycle scaling in basis points of the base price (10000 = 1.0x). */
const CYCLE_BPS: Record<Cycle, number> = {
  quick: 8000, // 0.8x
  normal: 10000, // 1.0x
  heavy: 13000, // 1.3x
};

export interface PriceBreakdown {
  subtotal: Kip;
  vat: Kip;
  total: Kip;
}

export function priceOrder(
  machinePrice: Kip,
  cycle: Cycle | undefined,
  addonFees: Kip[],
  vatBps: number,
): PriceBreakdown {
  const base = applyBasisPoints(machinePrice, CYCLE_BPS[cycle ?? 'normal']);
  const addons = addonFees.reduce<Kip>((acc, fee) => add(acc, fee), toKip(0));
  const subtotal = add(base, addons);
  const vat = applyBasisPoints(subtotal, vatBps);
  const total = add(subtotal, vat);
  return { subtotal, vat, total };
}
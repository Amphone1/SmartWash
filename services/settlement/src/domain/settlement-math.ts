/**
 * Settlement finance math (pure, kip/bigint — rule #1). Record-only: these
 * figures are reported and paid out via external bank transfer, not posted to
 * the customer ledger.
 */
import { applyBasisPoints, type Kip } from '@smartwash/common';

/** Platform's cut of gross revenue (basis points: 2000 = 20%). */
export function platformRevenue(gross: Kip, platformBps: number): Kip {
  return applyBasisPoints(gross, platformBps);
}

/** A driver's payout = their share of the delivery fees they completed. */
export function driverPayout(feesEarned: Kip, driverBps: number): Kip {
  return applyBasisPoints(feesEarned, driverBps);
}

export function sumKip(values: Kip[]): Kip {
  return values.reduce<Kip>((acc, v) => acc + v, 0n);
}

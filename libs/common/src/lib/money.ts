/**
 * Money — kip (LAK) as integer `bigint`.
 *
 * Rule #1: money is BIGINT in kip; never floats, anywhere. The Lao kip has no
 * minor unit, so every amount is a whole number of kip. We model it as `bigint`
 * (not `number`) so values map 1:1 onto Postgres `BIGINT` and never lose
 * precision above 2^53.
 *
 * All arithmetic here is closed over `Kip` and rejects fractional / non-integer
 * input at the boundary, so a bad value can never enter a ledger calculation.
 */

/** A whole number of kip. Always an integer; may be negative (signed ledger). */
export type Kip = bigint;

export const ZERO_KIP: Kip = 0n;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

/**
 * Coerce a trusted integer-ish value into `Kip`.
 *
 * Accepts: `bigint`, a safe-integer `number`, or a base-10 integer string.
 * Rejects: fractions, NaN/Infinity, non-safe-integer numbers, malformed strings.
 */
export function toKip(value: bigint | number | string): Kip {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new MoneyError(`kip must be a finite number, got ${value}`);
    }
    if (!Number.isInteger(value)) {
      throw new MoneyError(`kip has no minor unit; ${value} is fractional`);
    }
    if (!Number.isSafeInteger(value)) {
      throw new MoneyError(
        `kip ${value} exceeds safe-integer range; pass a bigint or string instead`,
      );
    }
    return BigInt(value);
  }
  // string
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new MoneyError(`kip string must be a base-10 integer, got "${value}"`);
  }
  return BigInt(trimmed);
}

export function add(a: Kip, b: Kip): Kip {
  return a + b;
}

export function subtract(a: Kip, b: Kip): Kip {
  return a - b;
}

/** Multiply a kip amount by an integer factor (e.g. quantity). */
export function multiply(amount: Kip, factor: bigint | number): Kip {
  return amount * toKip(factor);
}

/**
 * Apply a percentage that is itself expressed in basis points (1/100 of a
 * percent) so VAT/fees stay integer. 10% VAT → 1000 bps. Rounds toward zero.
 */
export function applyBasisPoints(amount: Kip, bps: number): Kip {
  if (!Number.isInteger(bps) || bps < 0) {
    throw new MoneyError(`basis points must be a non-negative integer, got ${bps}`);
  }
  return (amount * BigInt(bps)) / 10000n;
}

export function isNegative(amount: Kip): boolean {
  return amount < 0n;
}

export function isNonNegative(amount: Kip): boolean {
  return amount >= 0n;
}

export function isZero(amount: Kip): boolean {
  return amount === 0n;
}

/** True when `balance` can cover `amount` (both kip). */
export function canCover(balance: Kip, amount: Kip): boolean {
  return balance >= amount;
}

/**
 * Format kip for display with thousands separators, e.g. `1500000n` → "1,500,000".
 * Presentation only — never feed a formatted string back into arithmetic.
 */
export function formatKip(amount: Kip): string {
  const negative = amount < 0n;
  const digits = (negative ? -amount : amount).toString();
  const withSeparators = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return negative ? `-${withSeparators}` : withSeparators;
}

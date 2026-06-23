/**
 * Natural-sign balance math (EPIC A · A4) — PURE.
 *
 * `ledger_postings.balance_after` stores each account's NATURAL-sign running
 * balance: ASSET/EXPENSE are debit-positive; LIABILITY/REVENUE/EQUITY are
 * credit-positive. This lets the wallet projection (A7) read a user's liability
 * sub-accounts directly as non-negative balances.
 */
import { type Kip } from '@smartwash/common';
import { type AcctType, type OwnerType } from './accounts';
import { type Direction } from './posting-rules';

/** Accounts whose natural balance increases on the DEBIT side. */
export function increasesOnDebit(acctType: AcctType): boolean {
  return acctType === 'ASSET' || acctType === 'EXPENSE';
}

/**
 * Signed change to an account's natural-sign balance for one posting.
 *   ASSET/EXPENSE:            +amount on DR, −amount on CR
 *   LIABILITY/REVENUE/EQUITY: +amount on CR, −amount on DR
 */
export function naturalDelta(acctType: AcctType, direction: Direction, amount: Kip): Kip {
  const isDebit = direction === 'DR';
  const increases = increasesOnDebit(acctType) === isDebit;
  return increases ? amount : -amount;
}

/**
 * Overdraft guard: a user's wallet sub-accounts (available/reserved/held/pending —
 * liabilities owed to the user) must never go negative. Other account classes
 * (branch/platform/tax/staff) are unconstrained here.
 */
export function violatesOverdraft(ownerType: OwnerType, naturalBalanceAfter: Kip): boolean {
  return ownerType === 'user' && naturalBalanceAfter < 0n;
}

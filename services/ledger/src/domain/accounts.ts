/**
 * Chart-of-accounts resolution primitives (EPIC A · A2).
 *
 * Pure & side-effect-free: the canonical account-key grammar, the in-code mirror
 * of the `account_kinds` catalog (infra/db/init/09_accounts_chart.sql), and
 * validation/normalization of an AccountRef. The DB get-or-create lives in
 * infra/db/pg-account.repository.ts.
 *
 * Canonical account key: `{sub}:{owner_type}:{owner_id|"_"}` (currency pinned LAK).
 * Implements docs/design/A2_ACCOUNTS_DESIGN.md (resolves A2_REVIEW F1–F13).
 */
import {
  AccountNotFoundError,
  CurrencyMismatchError,
  ValidationError,
  isUuidV4,
} from '@smartwash/common';

export type AcctType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

/** Owner types A2 resolves. `vendor`/`franchise` are reserved (ADR-0006) and rejected. */
export type OwnerType = 'user' | 'branch' | 'platform' | 'staff' | 'tax';

export const DEFAULT_CURRENCY = 'LAK';

export interface AccountKind {
  ownerType: OwnerType;
  sub: string;
  acctType: AcctType;
  /** true → owner_id MUST be null (platform/tax singleton); false → owner_id required. */
  singleton: boolean;
}

/**
 * In-code mirror of `account_kinds`. The DB is the source of truth; this lets the
 * app fail fast before a round-trip and keeps the resolver total/explicit.
 * MUST stay in sync with 09_accounts_chart.sql.
 */
export const ACCOUNT_KINDS: readonly AccountKind[] = [
  { ownerType: 'platform', sub: 'bank', acctType: 'ASSET', singleton: true },
  { ownerType: 'platform', sub: 'suspense', acctType: 'ASSET', singleton: true },
  { ownerType: 'tax', sub: 'vat', acctType: 'LIABILITY', singleton: true },
  { ownerType: 'user', sub: 'available', acctType: 'LIABILITY', singleton: false },
  { ownerType: 'user', sub: 'reserved', acctType: 'LIABILITY', singleton: false },
  { ownerType: 'user', sub: 'held', acctType: 'LIABILITY', singleton: false },
  { ownerType: 'user', sub: 'pending', acctType: 'LIABILITY', singleton: false },
  { ownerType: 'branch', sub: 'bank', acctType: 'ASSET', singleton: false },
  { ownerType: 'branch', sub: 'clearing', acctType: 'ASSET', singleton: false },
  { ownerType: 'branch', sub: 'revenue', acctType: 'REVENUE', singleton: false },
  { ownerType: 'staff', sub: 'payable', acctType: 'LIABILITY', singleton: false },
];

const KIND_INDEX: ReadonlyMap<string, AccountKind> = new Map(
  ACCOUNT_KINDS.map((k) => [`${k.ownerType}:${k.sub}`, k]),
);

export interface AccountRef {
  ownerType: OwnerType;
  sub: string;
  ownerId?: string | null; // required iff the kind is non-singleton
  currency?: string; // default LAK
}

export interface NormalizedAccountRef {
  ownerType: OwnerType;
  sub: string;
  ownerId: string | null;
  currency: string;
  acctType: AcctType;
  singleton: boolean;
  accountKey: string;
}

/** Build the canonical account-key string. A null/absent ownerId renders as "_". */
export function buildAccountKey(
  sub: string,
  ownerType: OwnerType,
  ownerId?: string | null,
): string {
  return `${sub}:${ownerType}:${ownerId ?? '_'}`;
}

/** Parse a canonical account-key string into its parts (inverse of buildAccountKey). */
export function parseAccountKey(key: string): {
  sub: string;
  ownerType: string;
  ownerId: string | null;
} {
  const parts = key.split(':');
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) {
    throw new ValidationError(`malformed account key: ${key}`);
  }
  const [sub, ownerType, rawOwner] = parts;
  return { sub, ownerType, ownerId: rawOwner === '_' ? null : rawOwner };
}

/**
 * Validate + normalize an AccountRef against the catalog. Pure: throws on any
 * violation, otherwise returns the fully-resolved descriptor (acctType, key, …).
 * Fails closed on vendor/franchise/unknown owner types and uncatalogued subs.
 *
 * - non-LAK currency        → CurrencyMismatchError
 * - unknown kind            → AccountNotFoundError (incl. vendor/franchise)
 * - singleton with ownerId  → ValidationError
 * - entity without ownerId  → ValidationError
 * - entity ownerId not UUID → ValidationError
 */
export function validateAccountRef(ref: AccountRef): NormalizedAccountRef {
  const currency = ref.currency ?? DEFAULT_CURRENCY;
  if (currency !== DEFAULT_CURRENCY) {
    throw new CurrencyMismatchError(
      `unsupported currency ${currency}; only ${DEFAULT_CURRENCY} is supported`,
    );
  }

  const kind = KIND_INDEX.get(`${ref.ownerType}:${ref.sub}`);
  if (!kind) {
    throw new AccountNotFoundError(
      `no account kind for ${ref.ownerType}:${ref.sub}`,
    );
  }

  const ownerId = ref.ownerId ?? null;
  if (kind.singleton) {
    if (ownerId !== null) {
      throw new ValidationError(
        `singleton account ${ref.ownerType}:${ref.sub} must not carry an owner_id`,
      );
    }
  } else {
    if (ownerId === null) {
      throw new ValidationError(
        `account ${ref.ownerType}:${ref.sub} requires an owner_id`,
      );
    }
    if (!isUuidV4(ownerId)) {
      throw new ValidationError(`owner_id is not a valid UUID: ${ownerId}`);
    }
  }

  return {
    ownerType: ref.ownerType,
    sub: ref.sub,
    ownerId,
    currency,
    acctType: kind.acctType,
    singleton: kind.singleton,
    accountKey: buildAccountKey(ref.sub, ref.ownerType, ownerId),
  };
}

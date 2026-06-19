import {
  ACCOUNT_KINDS,
  buildAccountKey,
  parseAccountKey,
  validateAccountRef,
} from './accounts';
import {
  AccountNotFoundError,
  CurrencyMismatchError,
  ValidationError,
} from '@smartwash/common';

const USER = '44444444-4444-4444-8444-444444444444'; // valid v4

describe('account-key grammar', () => {
  it('builds entity and singleton keys', () => {
    expect(buildAccountKey('available', 'user', USER)).toBe(`available:user:${USER}`);
    expect(buildAccountKey('vat', 'tax', null)).toBe('vat:tax:_');
    expect(buildAccountKey('vat', 'tax')).toBe('vat:tax:_');
  });

  it('round-trips through parseAccountKey', () => {
    expect(parseAccountKey(`available:user:${USER}`)).toEqual({
      sub: 'available',
      ownerType: 'user',
      ownerId: USER,
    });
    expect(parseAccountKey('vat:tax:_')).toEqual({
      sub: 'vat',
      ownerType: 'tax',
      ownerId: null,
    });
  });

  it('rejects malformed keys', () => {
    expect(() => parseAccountKey('available:user')).toThrow(ValidationError);
    expect(() => parseAccountKey('a:b:c:d')).toThrow(ValidationError);
    expect(() => parseAccountKey('available::x')).toThrow(ValidationError);
  });
});

describe('validateAccountRef', () => {
  it('accepts a valid entity account and resolves acctType + key', () => {
    const n = validateAccountRef({ ownerType: 'user', sub: 'available', ownerId: USER });
    expect(n).toMatchObject({
      ownerType: 'user',
      sub: 'available',
      ownerId: USER,
      currency: 'LAK',
      acctType: 'LIABILITY',
      singleton: false,
      accountKey: `available:user:${USER}`,
    });
  });

  it('accepts a valid singleton (no ownerId)', () => {
    const n = validateAccountRef({ ownerType: 'tax', sub: 'vat' });
    expect(n).toMatchObject({
      ownerId: null,
      acctType: 'LIABILITY',
      singleton: true,
      accountKey: 'vat:tax:_',
    });
  });

  it('maps branch revenue to REVENUE and platform bank to ASSET', () => {
    expect(validateAccountRef({ ownerType: 'branch', sub: 'revenue', ownerId: USER }).acctType).toBe('REVENUE');
    expect(validateAccountRef({ ownerType: 'platform', sub: 'bank' }).acctType).toBe('ASSET');
  });

  it('rejects vendor/franchise (reserved, ADR-0006) — fail closed', () => {
    expect(() =>
      validateAccountRef({ ownerType: 'vendor' as never, sub: 'available', ownerId: USER }),
    ).toThrow(AccountNotFoundError);
    expect(() =>
      validateAccountRef({ ownerType: 'franchise' as never, sub: 'revenue', ownerId: USER }),
    ).toThrow(AccountNotFoundError);
  });

  it('rejects an unknown owner type and an uncatalogued sub', () => {
    expect(() =>
      validateAccountRef({ ownerType: 'robot' as never, sub: 'available', ownerId: USER }),
    ).toThrow(AccountNotFoundError);
    expect(() =>
      validateAccountRef({ ownerType: 'user', sub: 'bogus', ownerId: USER }),
    ).toThrow(AccountNotFoundError);
  });

  it('rejects a non-LAK currency', () => {
    expect(() =>
      validateAccountRef({ ownerType: 'user', sub: 'available', ownerId: USER, currency: 'USD' }),
    ).toThrow(CurrencyMismatchError);
  });

  it('rejects a singleton carrying an ownerId', () => {
    expect(() =>
      validateAccountRef({ ownerType: 'tax', sub: 'vat', ownerId: USER }),
    ).toThrow(ValidationError);
  });

  it('rejects an entity account with no ownerId or a non-UUID ownerId', () => {
    expect(() => validateAccountRef({ ownerType: 'user', sub: 'available' })).toThrow(ValidationError);
    expect(() =>
      validateAccountRef({ ownerType: 'user', sub: 'available', ownerId: 'not-a-uuid' }),
    ).toThrow(ValidationError);
  });
});

describe('ACCOUNT_KINDS catalog', () => {
  it('has unique (ownerType, sub) keys and no vendor/franchise rows', () => {
    const keys = ACCOUNT_KINDS.map((k) => `${k.ownerType}:${k.sub}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(ACCOUNT_KINDS.some((k) => (k.ownerType as string) === 'vendor')).toBe(false);
    expect(ACCOUNT_KINDS.some((k) => (k.ownerType as string) === 'franchise')).toBe(false);
  });

  it('marks platform/tax kinds as singletons and entity kinds as non-singleton', () => {
    for (const k of ACCOUNT_KINDS) {
      const expectedSingleton = k.ownerType === 'platform' || k.ownerType === 'tax';
      expect(k.singleton).toBe(expectedSingleton);
    }
  });
});

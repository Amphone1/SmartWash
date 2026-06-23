import {
  type V2Posting,
  computeWalletDeltas,
  extractV2,
  sumDeltas,
} from './projection';

const U = '44444444-4444-4444-8444-444444444444';
const B = '55555555-5555-4555-8555-555555555555';

const p = (
  sub: string,
  ownerType: string,
  ownerId: string | null,
  direction: 'DR' | 'CR',
  amount: string,
): V2Posting => ({
  accountKey: `${sub}:${ownerType}:${ownerId ?? '_'}`,
  ownerType,
  ownerId,
  direction,
  amount,
  balanceAfter: '0',
});

describe('computeWalletDeltas (delta-apply, LIABILITY sign)', () => {
  it('TOPUP: pending += amount', () => {
    const d = computeWalletDeltas([p('clearing', 'branch', B, 'DR', '50000'), p('pending', 'user', U, 'CR', '50000')], U);
    expect(d).toEqual({ available: 0n, reserved: 0n, held: 0n, pending: 50000n });
  });

  it('TOPUP_SETTLE: pending −= amount, available += amount', () => {
    const d = computeWalletDeltas(
      [
        p('bank', 'branch', B, 'DR', '50000'),
        p('clearing', 'branch', B, 'CR', '50000'),
        p('pending', 'user', U, 'DR', '50000'),
        p('available', 'user', U, 'CR', '50000'),
      ],
      U,
    );
    expect(d).toEqual({ available: 50000n, reserved: 0n, held: 0n, pending: -50000n });
    expect(sumDeltas(d)).toBe(0n); // net wallet change zero (pending→available)
  });

  it('RESERVE: available −= amount, reserved += amount', () => {
    const d = computeWalletDeltas([p('available', 'user', U, 'DR', '22000'), p('reserved', 'user', U, 'CR', '22000')], U);
    expect(d).toEqual({ available: -22000n, reserved: 22000n, held: 0n, pending: 0n });
  });

  it('CAPTURE: reserved −= gross (branch/tax legs ignored)', () => {
    const d = computeWalletDeltas(
      [
        p('reserved', 'user', U, 'DR', '22000'),
        p('revenue', 'branch', B, 'CR', '20000'),
        p('vat', 'tax', null, 'CR', '2000'),
      ],
      U,
    );
    expect(d).toEqual({ available: 0n, reserved: -22000n, held: 0n, pending: 0n });
  });

  it('REFUND_REVERSAL: available += gross', () => {
    const d = computeWalletDeltas(
      [
        p('revenue', 'branch', B, 'DR', '20000'),
        p('vat', 'tax', null, 'DR', '2000'),
        p('available', 'user', U, 'CR', '22000'),
      ],
      U,
    );
    expect(d).toEqual({ available: 22000n, reserved: 0n, held: 0n, pending: 0n });
  });

  it('ignores other users and non-wallet subs', () => {
    const other = '99999999-9999-4999-8999-999999999999';
    const d = computeWalletDeltas(
      [p('available', 'user', other, 'CR', '999'), p('revenue', 'branch', B, 'CR', '5'), p('available', 'user', U, 'CR', '10')],
      U,
    );
    expect(d).toEqual({ available: 10n, reserved: 0n, held: 0n, pending: 0n });
  });
});

describe('extractV2', () => {
  it('unwraps the relay envelope data', () => {
    const payload = { txnId: '1', type: 'TOPUP', userId: U, postings: [] };
    expect(extractV2({ id: 'e', type: 'x', data: payload })).toBe(payload);
    expect(extractV2(payload as unknown as Record<string, unknown>)).toBe(payload);
  });
});

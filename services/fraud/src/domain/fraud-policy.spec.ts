import { decide, type FraudInput } from './fraud-policy';

function clean(): FraudInput {
  return {
    duplicate: false,
    accountMatch: true,
    amountExpected: 20000n,
    ocrAmount: 20000n,
    ocrConfidence: 0.95,
    riskScore: 0,
    riskBand: 'low',
  };
}

describe('fraud decide', () => {
  it('passes a clean slip', () => {
    expect(decide(clean())).toEqual({ state: 'PASS' });
  });

  it('rejects a duplicate first (highest priority)', () => {
    expect(decide({ ...clean(), duplicate: true, accountMatch: false })).toEqual({
      state: 'REJECT',
      reason: 'duplicate',
    });
  });

  it('rejects a wrong account', () => {
    expect(decide({ ...clean(), accountMatch: false })).toEqual({
      state: 'REJECT',
      reason: 'wrong_account',
    });
  });

  it('rejects any amount mismatch (exact match required)', () => {
    expect(decide({ ...clean(), ocrAmount: 19999n })).toEqual({
      state: 'REJECT',
      reason: 'amount_mismatch',
    });
  });

  it('rejects high risk', () => {
    expect(decide({ ...clean(), riskBand: 'high' }).state).toBe('REJECT');
    expect(decide({ ...clean(), riskScore: 70 }).reason).toBe('high_risk');
  });

  it('sends low-confidence to manual review', () => {
    expect(decide({ ...clean(), ocrConfidence: 0.84 })).toEqual({
      state: 'MANUAL_REVIEW',
    });
  });

  it('sends medium risk to manual review', () => {
    expect(decide({ ...clean(), riskBand: 'medium' })).toEqual({
      state: 'MANUAL_REVIEW',
    });
  });

  it('reject precedence: wrong_account beats amount/risk', () => {
    const d = decide({
      ...clean(),
      accountMatch: false,
      ocrAmount: 1n,
      riskBand: 'high',
    });
    expect(d.reason).toBe('wrong_account');
  });
});

import { resolveWalletReadV2 } from './read-v2-flag';

describe('resolveWalletReadV2 (A8a tri-state flag, pure)', () => {
  it('shadow → compare, serve legacy', () => {
    expect(resolveWalletReadV2('shadow')).toEqual({
      mode: 'shadow',
      serveRequested: false,
    });
  });

  it('serve → compare-only (not implemented in A8a), flags serveRequested for the one-time warning', () => {
    // serve must NOT serve v2 in A8a: it resolves to shadow behavior.
    expect(resolveWalletReadV2('serve')).toEqual({
      mode: 'shadow',
      serveRequested: true,
    });
  });

  it('off → no shadow behavior', () => {
    expect(resolveWalletReadV2('off')).toEqual({
      mode: 'off',
      serveRequested: false,
    });
  });

  it('unknown / empty values fail safe to off', () => {
    for (const raw of ['', 'on', 'true', 'SHADOW', 'Serve', 'v2', 'yes']) {
      expect(resolveWalletReadV2(raw)).toEqual({
        mode: 'off',
        serveRequested: false,
      });
    }
  });
});

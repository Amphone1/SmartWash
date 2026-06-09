import { isUuidV4, hashRequest } from './idempotency';

describe('idempotency', () => {
  describe('isUuidV4', () => {
    it('accepts a valid v4 UUID', () => {
      expect(isUuidV4('9b2e4f7a-1c3d-4e5f-8a9b-0c1d2e3f4a5b')).toBe(true);
    });

    it('rejects non-v4 and malformed values', () => {
      expect(isUuidV4('not-a-uuid')).toBe(false);
      // v1 UUID (version nibble = 1)
      expect(isUuidV4('9b2e4f7a-1c3d-1e5f-8a9b-0c1d2e3f4a5b')).toBe(false);
      expect(isUuidV4('')).toBe(false);
    });
  });

  describe('hashRequest', () => {
    it('is stable regardless of key order', () => {
      const a = hashRequest({ userId: 'u1', amount: 25000, type: 'topup' });
      const b = hashRequest({ type: 'topup', amount: 25000, userId: 'u1' });
      expect(a).toBe(b);
    });

    it('differs when a value changes', () => {
      const a = hashRequest({ userId: 'u1', amount: 25000 });
      const b = hashRequest({ userId: 'u1', amount: 25001 });
      expect(a).not.toBe(b);
    });

    it('serializes bigint without throwing', () => {
      expect(() => hashRequest({ amount: 900000000000000n })).not.toThrow();
      expect(hashRequest({ amount: 5n })).toBe(hashRequest({ amount: 5n }));
    });

    it('ignores undefined fields', () => {
      expect(hashRequest({ a: 1, b: undefined })).toBe(hashRequest({ a: 1 }));
    });
  });
});

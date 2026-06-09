import { extractBearer } from './jwt-auth.guard';

describe('extractBearer', () => {
  it('extracts a bearer token case-insensitively', () => {
    expect(extractBearer('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(extractBearer('bearer xyz')).toBe('xyz');
  });

  it('returns null for missing or malformed headers', () => {
    expect(extractBearer(undefined)).toBeNull();
    expect(extractBearer('')).toBeNull();
    expect(extractBearer('Basic abc')).toBeNull();
    expect(extractBearer('Bearer')).toBeNull();
  });
});

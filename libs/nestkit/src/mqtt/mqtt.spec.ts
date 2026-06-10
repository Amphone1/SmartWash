import { filterToRegex } from './mqtt';

describe('filterToRegex (MQTT wildcards)', () => {
  it('matches a single-level + wildcard', () => {
    const re = filterToRegex('smartwash/+/+/status');
    expect(re.test('smartwash/branch1/W001/status')).toBe(true);
    expect(re.test('smartwash/branch1/W001/cmd')).toBe(false);
    // + is exactly one level
    expect(re.test('smartwash/branch1/sub/W001/status')).toBe(false);
  });

  it('matches a multi-level # wildcard', () => {
    const re = filterToRegex('smartwash/#');
    expect(re.test('smartwash/b/m/status')).toBe(true);
    expect(re.test('smartwash/b')).toBe(true);
    expect(re.test('other/b')).toBe(false);
  });

  it('matches an exact topic', () => {
    const re = filterToRegex('smartwash/b1/W001/lwt');
    expect(re.test('smartwash/b1/W001/lwt')).toBe(true);
    expect(re.test('smartwash/b1/W002/lwt')).toBe(false);
  });
});

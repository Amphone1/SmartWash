import { pickNearestDriver } from './assignment';
import type { DriverInfo } from './ports';

const pickup = { lat: 17.96, lng: 102.6 };

function d(id: string, lat: number | null, lng: number | null): DriverInfo {
  return {
    id,
    userId: `u-${id}`,
    branchId: null,
    state: 'AVAILABLE',
    location: lat !== null && lng !== null ? { lat, lng } : null,
  };
}

describe('pickNearestDriver', () => {
  it('returns the closest located driver', () => {
    const drivers = [d('far', 18.5, 103.2), d('near', 17.97, 102.61)];
    expect(pickNearestDriver(drivers, pickup)?.id).toBe('near');
  });

  it('excludes given driver ids (reassignment)', () => {
    const drivers = [d('near', 17.97, 102.61), d('next', 17.99, 102.64)];
    expect(pickNearestDriver(drivers, pickup, ['near'])?.id).toBe('next');
  });

  it('falls back to any driver when none have locations', () => {
    const drivers = [d('a', null, null), d('b', null, null)];
    expect(pickNearestDriver(drivers, pickup)?.id).toBe('a');
  });

  it('returns null when the pool is empty', () => {
    expect(pickNearestDriver([], pickup)).toBeNull();
    expect(pickNearestDriver([d('a', 1, 1)], pickup, ['a'])).toBeNull();
  });
});

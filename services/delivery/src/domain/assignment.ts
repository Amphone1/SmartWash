/** Driver assignment (pure). Picks the nearest available driver to the pickup;
 * drivers without a known location are eligible only if no located driver is. */
import { haversineKm, type LatLng } from './geo';
import type { DriverInfo } from './ports';

export function pickNearestDriver(
  drivers: DriverInfo[],
  pickup: LatLng,
  excludeIds: string[] = [],
): DriverInfo | null {
  const pool = drivers.filter((d) => !excludeIds.includes(d.id));
  const located = pool.filter((d) => d.location !== null);
  if (located.length === 0) return pool[0] ?? null;

  let best: DriverInfo | null = null;
  let bestKm = Infinity;
  for (const d of located) {
    const km = haversineKm(d.location as LatLng, pickup);
    if (km < bestKm) {
      bestKm = km;
      best = d;
    }
  }
  return best;
}

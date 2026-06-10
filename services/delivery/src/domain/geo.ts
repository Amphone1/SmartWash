/**
 * Geo + fee math (pure). Distance via haversine (used as the fallback when the
 * Google Maps API key isn't configured). Fee is integer kip (rule #1).
 */
export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export interface FeeConfig {
  baseFeeKip: number;
  perKmKip: number;
  minFeeKip: number;
}

/** Delivery fee = max(min, base + perKm * km), rounded to whole kip. */
export function deliveryFee(distanceKm: number, cfg: FeeConfig): number {
  const raw = cfg.baseFeeKip + Math.round(cfg.perKmKip * distanceKm);
  return Math.max(cfg.minFeeKip, raw);
}

/** Naive ETA minutes from distance at an assumed average speed. */
export function etaMinutes(distanceKm: number, avgSpeedKmh = 25): number {
  if (avgSpeedKmh <= 0) return 0;
  return Math.ceil((distanceKm / avgSpeedKmh) * 60);
}

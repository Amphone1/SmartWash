/**
 * Google Maps Distance Matrix client. Returns road distance in km; falls back to
 * the haversine great-circle distance when GOOGLE_MAPS_API_KEY is unset or the
 * API call fails (so dev/tests work without a key).
 */
import { Injectable, Logger } from '@nestjs/common';
import { optionalEnv } from '@smartwash/nestkit';
import { haversineKm, type LatLng } from '../../domain/geo';
import type { DistanceProvider } from '../../domain/ports';

@Injectable()
export class GoogleMapsClient implements DistanceProvider {
  private readonly logger = new Logger('GoogleMapsClient');
  private readonly apiKey = optionalEnv('GOOGLE_MAPS_API_KEY', '');

  async distanceKm(origin: LatLng, dest: LatLng): Promise<number> {
    if (!this.apiKey) return haversineKm(origin, dest);
    try {
      const url = new URL(
        'https://maps.googleapis.com/maps/api/distancematrix/json',
      );
      url.searchParams.set('origins', `${origin.lat},${origin.lng}`);
      url.searchParams.set('destinations', `${dest.lat},${dest.lng}`);
      url.searchParams.set('key', this.apiKey);

      const res = await fetch(url);
      const body = (await res.json()) as {
        rows?: { elements?: { status?: string; distance?: { value?: number } }[] }[];
      };
      const el = body.rows?.[0]?.elements?.[0];
      if (el?.status === 'OK' && typeof el.distance?.value === 'number') {
        return el.distance.value / 1000; // metres → km
      }
      this.logger.warn('Maps API returned no distance; using haversine');
    } catch (err) {
      this.logger.warn(`Maps API failed (${String(err)}); using haversine`);
    }
    return haversineKm(origin, dest);
  }
}

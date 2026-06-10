/**
 * driver_locations is a high-volume table (TimescaleDB hypertable candidate —
 * conversion is a Phase 6 migration). Phase 4 does plain inserts + a last-known
 * read.
 */
import { Injectable } from '@nestjs/common';
import { Database } from '@smartwash/nestkit';
import type { GpsRepository, LastLocation, Ping } from '../../domain/ports';

interface Row {
  driver_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: string | null;
  recorded_at: Date;
}

@Injectable()
export class PgGpsRepository implements GpsRepository {
  constructor(private readonly db: Database) {}

  async record(p: Ping): Promise<void> {
    await this.db.getPool().query(
      `INSERT INTO driver_locations (driver_id, lat, lng, heading, speed)
       VALUES ($1, $2, $3, $4, $5)`,
      [p.driverId, p.lat, p.lng, p.heading ?? null, p.speed ?? null],
    );
  }

  async last(driverId: string): Promise<LastLocation | null> {
    const { rows } = await this.db.getPool().query<Row>(
      `SELECT driver_id, lat, lng, heading, speed, recorded_at
         FROM driver_locations
        WHERE driver_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [driverId],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      driverId: r.driver_id,
      lat: r.lat,
      lng: r.lng,
      heading: r.heading,
      speed: r.speed !== null ? Number(r.speed) : null,
      recordedAt: r.recorded_at.toISOString(),
    };
  }
}

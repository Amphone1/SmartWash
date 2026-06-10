import { Injectable } from '@nestjs/common';
import { Database } from '@smartwash/nestkit';
import type { DriverInfo, DriverRepository } from '../../domain/ports';

interface Row {
  id: string;
  user_id: string;
  branch_id: string | null;
  state: string;
  lat: number | null;
  lng: number | null;
}

function toInfo(r: Row): DriverInfo {
  return {
    id: r.id,
    userId: r.user_id,
    branchId: r.branch_id,
    state: r.state,
    location: r.lat !== null && r.lng !== null ? { lat: r.lat, lng: r.lng } : null,
  };
}

@Injectable()
export class PgDriverRepository implements DriverRepository {
  constructor(private readonly db: Database) {}

  async findById(driverId: string): Promise<DriverInfo | null> {
    const { rows } = await this.db
      .getPool()
      .query<Row>(
        `SELECT id, user_id, branch_id, state, NULL::float8 AS lat, NULL::float8 AS lng
           FROM drivers WHERE id = $1`,
        [driverId],
      );
    return rows[0] ? toInfo(rows[0]) : null;
  }

  async findAvailable(): Promise<DriverInfo[]> {
    // Join each driver's most recent location (if any) via LATERAL.
    const { rows } = await this.db.getPool().query<Row>(
      `SELECT d.id, d.user_id, d.branch_id, d.state, loc.lat, loc.lng
         FROM drivers d
         LEFT JOIN LATERAL (
           SELECT lat, lng FROM driver_locations
            WHERE driver_id = d.id ORDER BY recorded_at DESC LIMIT 1
         ) loc ON true
        WHERE d.state = 'AVAILABLE'`,
    );
    return rows.map(toInfo);
  }

  async setState(driverId: string, state: string): Promise<void> {
    await this.db
      .getPool()
      .query(`UPDATE drivers SET state = $2 WHERE id = $1`, [driverId, state]);
  }

  async incrementTrips(driverId: string): Promise<void> {
    await this.db
      .getPool()
      .query(`UPDATE drivers SET trips = trips + 1 WHERE id = $1`, [driverId]);
  }
}

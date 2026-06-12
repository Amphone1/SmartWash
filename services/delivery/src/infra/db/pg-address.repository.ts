/** user_addresses CRUD — saved pickup/dropoff addresses, max 10 per user. */
import { Injectable } from '@nestjs/common';
import { ValidationError } from '@smartwash/common';
import { Database } from '@smartwash/nestkit';

export const MAX_ADDRESSES_PER_USER = 10;

export interface AddressView {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  isDefault: boolean;
  createdAt: string;
}

export interface CreateAddressData {
  label: string;
  address: string;
  lat: number;
  lng: number;
  isDefault: boolean;
}

interface Row {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  is_default: boolean;
  created_at: Date;
}

function toView(r: Row): AddressView {
  return {
    id: r.id,
    label: r.label,
    address: r.address,
    lat: Number(r.lat),
    lng: Number(r.lng),
    isDefault: r.is_default,
    createdAt: r.created_at.toISOString(),
  };
}

@Injectable()
export class PgAddressRepository {
  constructor(private readonly db: Database) {}

  async listForUser(userId: string): Promise<AddressView[]> {
    const { rows } = await this.db.getPool().query<Row>(
      `SELECT id, label, address, lat, lng, is_default, created_at
         FROM user_addresses WHERE user_id = $1
        ORDER BY is_default DESC, created_at`,
      [userId],
    );
    return rows.map(toView);
  }

  async create(userId: string, data: CreateAddressData): Promise<AddressView> {
    return this.db.withTransaction(async (client) => {
      const { rows: countRows } = await client.query<{ n: string }>(
        `SELECT count(*) AS n FROM user_addresses WHERE user_id = $1 FOR UPDATE`,
        [userId],
      );
      if (Number(countRows[0].n) >= MAX_ADDRESSES_PER_USER) {
        throw new ValidationError(
          `at most ${MAX_ADDRESSES_PER_USER} saved addresses per user`,
        );
      }
      if (data.isDefault) {
        await client.query(
          `UPDATE user_addresses SET is_default = false
            WHERE user_id = $1 AND is_default`,
          [userId],
        );
      }
      const { rows } = await client.query<Row>(
        `INSERT INTO user_addresses (user_id, label, address, lat, lng, is_default)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [userId, data.label, data.address, data.lat, data.lng, data.isDefault],
      );
      return toView(rows[0]);
    });
  }

  /** Returns false when the address does not exist (or is someone else's). */
  async remove(userId: string, id: string): Promise<boolean> {
    const res = await this.db.getPool().query(
      `DELETE FROM user_addresses WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (res.rowCount ?? 0) > 0;
  }
}

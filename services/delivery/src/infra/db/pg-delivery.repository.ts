import { Injectable } from '@nestjs/common';
import { ConflictError } from '@smartwash/common';
import { Database, insertOutbox } from '@smartwash/nestkit';
import type { DeliveryState } from '../../domain/delivery-fsm';
import { canTransition } from '../../domain/delivery-fsm';
import type {
  CreateDeliveryData,
  DeliveryRecord,
  DeliveryRepository,
} from '../../domain/ports';

interface Row {
  id: string;
  order_id: string;
  driver_id: string | null;
  state: string;
  pickup_addr: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_addr: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  fee: string;
  created_at: Date;
  updated_at: Date;
}

function toRecord(r: Row): DeliveryRecord {
  return {
    id: r.id,
    orderId: r.order_id,
    driverId: r.driver_id,
    state: r.state as DeliveryState,
    pickup: { addr: r.pickup_addr, lat: r.pickup_lat ?? 0, lng: r.pickup_lng ?? 0 },
    dropoff: { addr: r.dropoff_addr, lat: r.dropoff_lat ?? 0, lng: r.dropoff_lng ?? 0 },
    fee: Number(r.fee),
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

@Injectable()
export class PgDeliveryRepository implements DeliveryRepository {
  constructor(private readonly db: Database) {}

  async findByOrderId(orderId: string): Promise<DeliveryRecord | null> {
    const { rows } = await this.db
      .getPool()
      .query<Row>(`SELECT * FROM deliveries WHERE order_id = $1`, [orderId]);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async findById(id: string): Promise<DeliveryRecord | null> {
    const { rows } = await this.db
      .getPool()
      .query<Row>(`SELECT * FROM deliveries WHERE id = $1`, [id]);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async create(data: CreateDeliveryData): Promise<DeliveryRecord> {
    return this.db.withTransaction(async (client) => {
      const { rows } = await client.query<Row>(
        `INSERT INTO deliveries
           (id, order_id, state, pickup_addr, pickup_lat, pickup_lng,
            dropoff_addr, dropoff_lat, dropoff_lng, fee)
         VALUES ($1,$2,'CREATED',$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          data.id,
          data.orderId,
          data.pickup.addr,
          data.pickup.lat,
          data.pickup.lng,
          data.dropoff.addr,
          data.dropoff.lat,
          data.dropoff.lng,
          data.fee.toString(),
        ],
      );
      await insertOutbox(client, {
        aggregateType: 'delivery',
        aggregateId: data.id,
        eventType: 'smartwash.delivery.created.v1',
        payload: { deliveryId: data.id, orderId: data.orderId, fee: data.fee },
      });
      return toRecord(rows[0]);
    });
  }

  async transition(
    id: string,
    from: DeliveryState,
    to: DeliveryState,
    _event: string,
    driverId: string | null,
    outbox: { eventType: string; payload: Record<string, unknown> },
  ): Promise<DeliveryRecord> {
    if (!canTransition(from, to)) {
      throw new ConflictError(`illegal delivery transition ${from} → ${to}`);
    }
    return this.db.withTransaction(async (client) => {
      const { rows, rowCount } = await client.query<Row>(
        `UPDATE deliveries
            SET state = $2, updated_at = now(),
                driver_id = COALESCE($3, driver_id)
          WHERE id = $1 AND state = $4
         RETURNING *`,
        [id, to, driverId, from],
      );
      if (rowCount === 0) {
        throw new ConflictError('delivery state changed concurrently');
      }
      await insertOutbox(client, {
        aggregateType: 'delivery',
        aggregateId: id,
        eventType: outbox.eventType,
        payload: outbox.payload,
      });
      return toRecord(rows[0]);
    });
  }

  async listForDriver(
    driverId: string,
    activeOnly: boolean,
  ): Promise<DeliveryRecord[]> {
    const { rows } = await this.db.getPool().query<Row>(
      `SELECT * FROM deliveries
        WHERE driver_id = $1
          ${activeOnly ? `AND state NOT IN ('COMPLETED','CANCELLED','FAILED')` : ''}
        ORDER BY created_at DESC`,
      [driverId],
    );
    return rows.map(toRecord);
  }
}

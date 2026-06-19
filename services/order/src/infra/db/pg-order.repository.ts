/**
 * Postgres adapter for OrderRepository. Every write goes through
 * Database.withTransaction so the orders row, the order_events audit row, and
 * the outbox row commit atomically (rule #4). order_events is append-only.
 */
import { Injectable } from '@nestjs/common';
import { ConflictError } from '@smartwash/common';
import { Database, insertOutbox } from '@smartwash/nestkit';
import type { PoolClient } from 'pg';
import type { OrderState } from '../../domain/order-fsm';
import type {
  CreateOrderData,
  OrderRecord,
  OrderRepository,
} from '../../domain/ports';

interface Row {
  id: string;
  user_id: string;
  branch_id: string;
  machine_id: string;
  type: string;
  state: string;
  cycle: string | null;
  subtotal: string;
  vat: string;
  total: string;
  created_at: Date;
}

function toRecord(r: Row): OrderRecord {
  return {
    id: r.id,
    userId: r.user_id,
    branchId: r.branch_id,
    machineId: r.machine_id,
    type: r.type as OrderRecord['type'],
    state: r.state as OrderState,
    cycle: r.cycle,
    subtotal: BigInt(r.subtotal),
    vat: BigInt(r.vat),
    total: BigInt(r.total),
    createdAt: r.created_at.toISOString(),
  };
}

@Injectable()
export class PgOrderRepository implements OrderRepository {
  constructor(private readonly db: Database) {}

  async create(data: CreateOrderData): Promise<OrderRecord> {
    return this.db.withTransaction(async (client) => {
      const { rows } = await client.query<Row>(
        `INSERT INTO orders
           (id, user_id, branch_id, machine_id, type, state, cycle, addons,
            subtotal, vat, total)
         VALUES ($1,$2,$3,$4,$5,'RESERVED',$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          data.id,
          data.userId,
          data.branchId,
          data.machineId,
          data.type,
          data.cycle ?? null,
          JSON.stringify(data.addons ?? []),
          data.subtotal.toString(),
          data.vat.toString(),
          data.total.toString(),
        ],
      );
      const order = rows[0];

      await this.appendEvent(client, order.id, null, 'CREATED', 'create');
      await this.appendEvent(client, order.id, 'CREATED', 'RESERVED', 'reserve');

      await insertOutbox(client, {
        aggregateType: 'order',
        aggregateId: order.id,
        eventType: 'smartwash.order.created.v1',
        payload: {
          orderId: order.id,
          userId: order.user_id,
          machineId: order.machine_id,
          type: order.type,
          total: Number(order.total),
        },
      });

      return toRecord(order);
    });
  }

  async findById(id: string): Promise<OrderRecord | null> {
    const { rows } = await this.db
      .getPool()
      .query<Row>(`SELECT * FROM orders WHERE id = $1`, [id]);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async listForUser(userId: string): Promise<OrderRecord[]> {
    const { rows } = await this.db
      .getPool()
      .query<Row>(
        `SELECT * FROM orders WHERE user_id = $1
          ORDER BY created_at DESC LIMIT 100`,
        [userId],
      );
    return rows.map(toRecord);
  }

  async transition(
    id: string,
    from: OrderState,
    to: OrderState,
    event: string,
    outbox: { eventType: string; payload: Record<string, unknown> },
  ): Promise<OrderRecord> {
    return this.db.withTransaction(async (client) => {
      // Optimistic guard: only move if still in the expected state.
      const { rows, rowCount } = await client.query<Row>(
        `UPDATE orders SET state = $2, updated_at = now()
          WHERE id = $1 AND state = $3
         RETURNING *`,
        [id, to, from],
      );
      if (rowCount === 0) {
        throw new ConflictError('order state changed concurrently');
      }
      const order = rows[0];
      await this.appendEvent(client, id, from, to, event);
      await insertOutbox(client, {
        aggregateType: 'order',
        aggregateId: id,
        eventType: outbox.eventType,
        payload: outbox.payload,
      });
      return toRecord(order);
    });
  }

  async emitOutbox(
    orderId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.db.withTransaction(async (client) => {
      await insertOutbox(client, {
        aggregateType: 'order',
        aggregateId: orderId,
        eventType,
        payload,
      });
    });
  }

  private async appendEvent(
    client: PoolClient,
    orderId: string,
    from: OrderState | null,
    to: OrderState,
    event: string,
  ): Promise<void> {
    await client.query(
      `INSERT INTO order_events (order_id, from_state, to_state, event)
       VALUES ($1, $2, $3, $4)`,
      [orderId, from, to, event],
    );
  }
}

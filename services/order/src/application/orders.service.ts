/**
 * Order use-cases. Owns the reserve/cancel flow:
 *   • createOrder — acquire the machine reservation lock (Redis SETNX, 15m,
 *     token = orderId so cancel can release it), price the order, then persist
 *     order + order_events + outbox atomically. Idempotent per Idempotency-Key.
 *   • cancelOrder — guard the FSM, transition to CANCELLED, release the lock.
 */
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@smartwash/common';
import {
  IdempotencyService,
  RedisLock,
  RESERVATION_TTL_SECONDS,
} from '@smartwash/nestkit';
import { canTransition, isCancellable, type OrderState } from '../domain/order-fsm';
import { priceOrder, type Cycle } from '../domain/pricing';
import {
  MACHINE_LOOKUP,
  ORDER_REPOSITORY,
  type MachineLookup,
  type OrderRecord,
  type OrderRepository,
  type OrderType,
} from '../domain/ports';

export interface CreateOrderInput {
  userId: string;
  branchId: string;
  machineId: string;
  type: OrderType;
  cycle?: Cycle;
  addons?: string[];
}

export interface OrderView {
  id: string;
  userId: string;
  branchId: string;
  machineId: string;
  type: OrderType;
  state: OrderState;
  cycle: string | null;
  subtotal: number;
  vat: number;
  total: number;
  createdAt: string;
}

function machineLockKey(machineId: string): string {
  return `lock:machine:${machineId}`;
}

@Injectable()
export class OrdersService {
  private readonly vatBps: number;

  constructor(
    @Inject(MACHINE_LOOKUP) private readonly machines: MachineLookup,
    @Inject(ORDER_REPOSITORY) private readonly repo: OrderRepository,
    private readonly locks: RedisLock,
    private readonly idempotency: IdempotencyService,
  ) {
    this.vatBps = Number.parseInt(process.env.VAT_BPS ?? '0', 10);
  }

  async createOrder(
    idempotencyKey: string,
    input: CreateOrderInput,
  ): Promise<OrderView> {
    const { result } = await this.idempotency.execute(
      idempotencyKey,
      'order.create',
      input,
      async () => {
        const machine = await this.machines.findById(input.machineId);
        if (!machine) {
          throw new NotFoundError('machine not found');
        }
        if (machine.branchId !== input.branchId) {
          throw new ValidationError('machine does not belong to branch');
        }

        const orderId = randomUUID();
        const lock = await this.locks.acquire(
          machineLockKey(input.machineId),
          RESERVATION_TTL_SECONDS,
          orderId, // token = orderId so cancel can release it
        );
        if (!lock) {
          throw new ConflictError('machine already reserved');
        }

        try {
          const price = priceOrder(machine.price, input.cycle, [], this.vatBps);
          const order = await this.repo.create({
            id: orderId,
            userId: input.userId,
            branchId: input.branchId,
            machineId: input.machineId,
            type: input.type,
            cycle: input.cycle,
            addons: input.addons,
            ...price,
          });
          return toView(order);
        } catch (err) {
          // Reservation must not outlive a failed create.
          await this.locks.release(lock);
          throw err;
        }
      },
    );
    return result;
  }

  async getOrder(id: string): Promise<OrderView> {
    const order = await this.repo.findById(id);
    if (!order) throw new NotFoundError('order not found');
    return toView(order);
  }

  /**
   * Explicit "start wash" — the user confirms; emits wash_requested so the
   * wash_order saga begins (which deducts the wallet). Money never moves before
   * this point. Only valid from RESERVED.
   */
  async requestWash(id: string): Promise<{ orderId: string; status: string }> {
    const order = await this.repo.findById(id);
    if (!order) throw new NotFoundError('order not found');
    if (order.state !== 'RESERVED') {
      throw new ConflictError(`wash can only start from RESERVED, not ${order.state}`);
    }
    await this.repo.emitOutbox(id, 'smartwash.order.wash_requested.v1', {
      orderId: id,
      userId: order.userId,
      machineId: order.machineId,
      total: Number(order.total),
    });
    return { orderId: id, status: 'wash_requested' };
  }

  /**
   * Explicit "request delivery" for a pickup/delivery order — emits
   * delivery_requested (with pickup/dropoff) so the delivery_order saga begins.
   * Charging happens on successful delivery (saga), not here.
   */
  async requestDelivery(
    id: string,
    pickup: Record<string, unknown>,
    dropoff: Record<string, unknown>,
  ): Promise<{ orderId: string; status: string }> {
    const order = await this.repo.findById(id);
    if (!order) throw new NotFoundError('order not found');
    if (order.type === 'self_service') {
      throw new ConflictError('not a pickup/delivery order');
    }
    if (order.state !== 'RESERVED') {
      throw new ConflictError(`delivery can only start from RESERVED, not ${order.state}`);
    }
    await this.repo.emitOutbox(id, 'smartwash.order.delivery_requested.v1', {
      orderId: id,
      userId: order.userId,
      pickup,
      dropoff,
    });
    return { orderId: id, status: 'delivery_requested' };
  }

  /**
   * Release this order's machine reservation lock (saga finalize/compensation).
   * Token = orderId, so it can only ever release its own lock; a no-op if the
   * lock already expired or was taken over by a newer order.
   */
  async releaseReservation(id: string): Promise<{ released: boolean }> {
    const order = await this.repo.findById(id);
    if (!order) throw new NotFoundError('order not found');
    const released = await this.locks.release({
      key: machineLockKey(order.machineId),
      token: id,
    });
    return { released };
  }

  /**
   * Saga-driven FSM transition (e.g. RESERVED→PAID→RUNNING→COMPLETED, or refund
   * states). Guarded by the Order FSM; records order_events + outbox in one txn.
   */
  async transitionTo(
    id: string,
    to: OrderState,
    event: string,
  ): Promise<OrderView> {
    const order = await this.repo.findById(id);
    if (!order) throw new NotFoundError('order not found');
    if (!canTransition(order.state, to)) {
      throw new ConflictError(`cannot move ${order.state} → ${to}`);
    }
    const updated = await this.repo.transition(id, order.state, to, event, {
      eventType: `smartwash.order.${to.toLowerCase()}.v1`,
      payload: { orderId: id, userId: order.userId, state: to },
    });
    return toView(updated);
  }

  async cancelOrder(idempotencyKey: string, id: string): Promise<OrderView> {
    const { result } = await this.idempotency.execute(
      idempotencyKey,
      'order.cancel',
      { id },
      async () => {
        const order = await this.repo.findById(id);
        if (!order) throw new NotFoundError('order not found');
        if (!isCancellable(order.state)) {
          throw new ConflictError(`order not cancellable in state ${order.state}`);
        }

        const updated = await this.repo.transition(
          id,
          order.state,
          'CANCELLED',
          'cancel',
          {
            eventType: 'smartwash.order.cancelled.v1',
            payload: { orderId: id, userId: order.userId, previousState: order.state },
          },
        );

        // Release the reservation (token = orderId). No-op if it already expired
        // or was taken over by another order.
        await this.locks.release({
          key: machineLockKey(order.machineId),
          token: id,
        });

        return toView(updated);
      },
    );
    return result;
  }
}

function toView(o: OrderRecord): OrderView {
  return {
    id: o.id,
    userId: o.userId,
    branchId: o.branchId,
    machineId: o.machineId,
    type: o.type,
    state: o.state,
    cycle: o.cycle,
    // kip magnitudes for an order fit safely in a JS number.
    subtotal: Number(o.subtotal),
    vat: Number(o.vat),
    total: Number(o.total),
    createdAt: o.createdAt,
  };
}

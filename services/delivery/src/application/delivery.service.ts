/**
 * Delivery use-cases: create + price (Maps) + assign nearest driver, then the
 * driver-driven progression (accept/reject/advance/complete). Each delivery
 * transition is FSM-guarded and emits an outbox event; driver.state is updated
 * alongside. No customer money moves here (that's the gated delivery_order saga).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError } from '@smartwash/common';
import { pickNearestDriver } from '../domain/assignment';
import { deliveryFee, type FeeConfig } from '../domain/geo';
import type { DeliveryState } from '../domain/delivery-fsm';
import {
  DELIVERY_REPOSITORY,
  DISTANCE_PROVIDER,
  DRIVER_REPOSITORY,
  type DeliveryRecord,
  type DeliveryRepository,
  type DistanceProvider,
  type DriverRepository,
  type Place,
} from '../domain/ports';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger('DeliveryService');
  private readonly fee: FeeConfig;

  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepository,
    @Inject(DRIVER_REPOSITORY) private readonly drivers: DriverRepository,
    @Inject(DISTANCE_PROVIDER) private readonly distance: DistanceProvider,
  ) {
    this.fee = {
      baseFeeKip: Number.parseInt(process.env.DELIVERY_BASE_FEE ?? '10000', 10),
      perKmKip: Number.parseInt(process.env.DELIVERY_PER_KM ?? '3000', 10),
      minFeeKip: Number.parseInt(process.env.DELIVERY_MIN_FEE ?? '10000', 10),
    };
  }

  /** Create a delivery for an order (idempotent per orderId), price it, assign. */
  async createForOrder(
    orderId: string,
    pickup: Place,
    dropoff: Place,
  ): Promise<DeliveryRecord> {
    const existing = await this.deliveries.findByOrderId(orderId);
    if (existing) return existing;

    const km = await this.distance.distanceKm(pickup, dropoff);
    const fee = deliveryFee(km, this.fee);
    const created = await this.deliveries.create({
      id: randomUUID(),
      orderId,
      pickup,
      dropoff,
      fee,
    });
    await this.assign(created.id).catch((e) =>
      this.logger.warn(`assign failed for ${created.id}: ${String(e)}`),
    );
    return (await this.deliveries.findById(created.id)) ?? created;
  }

  /** Assign (or reassign) the nearest available driver. */
  async assign(deliveryId: string, excludeDriverIds: string[] = []): Promise<DeliveryRecord> {
    const delivery = await this.getOrThrow(deliveryId);
    const available = await this.drivers.findAvailable();
    const chosen = pickNearestDriver(available, delivery.pickup, excludeDriverIds);
    if (!chosen) {
      throw new ConflictError('no available driver');
    }
    const updated = await this.deliveries.transition(
      deliveryId,
      delivery.state,
      'ASSIGNED',
      'assigned',
      chosen.id,
      {
        eventType: 'smartwash.delivery.assigned.v1',
        payload: { deliveryId, driverId: chosen.id, orderId: delivery.orderId },
      },
    );
    await this.drivers.setState(chosen.id, 'ASSIGNED');
    return updated;
  }

  async accept(deliveryId: string, driverId: string): Promise<DeliveryRecord> {
    await this.assertDriver(deliveryId, driverId);
    return this.deliveries.transition(deliveryId, 'ASSIGNED', 'ACCEPTED', 'accepted', driverId, {
      eventType: 'smartwash.delivery.accepted.v1',
      payload: { deliveryId, driverId },
    });
  }

  async reject(deliveryId: string, driverId: string): Promise<DeliveryRecord> {
    await this.assertDriver(deliveryId, driverId);
    const rejected = await this.deliveries.transition(
      deliveryId,
      'ASSIGNED',
      'REJECTED',
      'rejected',
      driverId,
      { eventType: 'smartwash.delivery.rejected.v1', payload: { deliveryId, driverId } },
    );
    await this.drivers.setState(driverId, 'AVAILABLE');
    // Try to reassign to someone else; leave REJECTED if nobody is free.
    try {
      return await this.assign(deliveryId, [driverId]);
    } catch {
      return rejected;
    }
  }

  /** Driver advances the delivery (EN_ROUTE_PICKUP → PICKED_UP → IN_TRANSIT → DELIVERED). */
  async advance(
    deliveryId: string,
    to: DeliveryState,
    driverId: string,
  ): Promise<DeliveryRecord> {
    await this.assertDriver(deliveryId, driverId);
    const current = await this.getOrThrow(deliveryId);
    const updated = await this.deliveries.transition(
      deliveryId,
      current.state,
      to,
      `advance_${to.toLowerCase()}`,
      driverId,
      { eventType: `smartwash.delivery.${to.toLowerCase()}.v1`, payload: { deliveryId, driverId } },
    );
    await this.drivers.setState(driverId, driverStateFor(to));
    return updated;
  }

  async complete(deliveryId: string): Promise<DeliveryRecord> {
    const current = await this.getOrThrow(deliveryId);
    const updated = await this.deliveries.transition(
      deliveryId,
      'DELIVERED',
      'COMPLETED',
      'completed',
      current.driverId,
      { eventType: 'smartwash.delivery.completed.v1', payload: { deliveryId, orderId: current.orderId } },
    );
    if (current.driverId) {
      await this.drivers.setState(current.driverId, 'AVAILABLE');
      await this.drivers.incrementTrips(current.driverId);
    }
    return updated;
  }

  getDelivery(id: string): Promise<DeliveryRecord> {
    return this.getOrThrow(id);
  }
  listForDriver(driverId: string, activeOnly: boolean): Promise<DeliveryRecord[]> {
    return this.deliveries.listForDriver(driverId, activeOnly);
  }

  private async getOrThrow(id: string): Promise<DeliveryRecord> {
    const d = await this.deliveries.findById(id);
    if (!d) throw new NotFoundError('delivery not found');
    return d;
  }
  private async assertDriver(deliveryId: string, driverId: string): Promise<void> {
    const d = await this.getOrThrow(deliveryId);
    if (d.driverId !== driverId) {
      throw new ConflictError('delivery is not assigned to this driver');
    }
  }
}

/** Map a delivery state to the driver's status. */
function driverStateFor(to: DeliveryState): string {
  switch (to) {
    case 'EN_ROUTE_PICKUP':
      return 'EN_ROUTE_PICKUP';
    case 'PICKED_UP':
      return 'PICKED_UP';
    case 'IN_TRANSIT':
      return 'EN_ROUTE_DELIVERY';
    case 'DELIVERED':
      return 'DELIVERED';
    default:
      return 'ASSIGNED';
  }
}

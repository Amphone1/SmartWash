import type { DeliveryState } from './delivery-fsm';
import type { LatLng } from './geo';

export interface Place {
  addr: string | null;
  lat: number;
  lng: number;
}

export interface DeliveryRecord {
  id: string;
  orderId: string;
  driverId: string | null;
  state: DeliveryState;
  pickup: Place;
  dropoff: Place;
  fee: number; // kip
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeliveryData {
  id: string;
  orderId: string;
  pickup: Place;
  dropoff: Place;
  fee: number;
}

export interface DriverInfo {
  id: string;
  userId: string;
  branchId: string | null;
  state: string;
  location: LatLng | null;
}

export interface DeliveryRepository {
  findByOrderId(orderId: string): Promise<DeliveryRecord | null>;
  findById(id: string): Promise<DeliveryRecord | null>;
  create(data: CreateDeliveryData): Promise<DeliveryRecord>;
  transition(
    id: string,
    from: DeliveryState,
    to: DeliveryState,
    event: string,
    driverId: string | null,
    outbox: { eventType: string; payload: Record<string, unknown> },
  ): Promise<DeliveryRecord>;
  listForDriver(driverId: string, activeOnly: boolean): Promise<DeliveryRecord[]>;
}
export const DELIVERY_REPOSITORY = Symbol('DELIVERY_REPOSITORY');

export interface DriverRepository {
  findById(driverId: string): Promise<DriverInfo | null>;
  /** AVAILABLE drivers with their last known location (for assignment). */
  findAvailable(): Promise<DriverInfo[]>;
  setState(driverId: string, state: string): Promise<void>;
  incrementTrips(driverId: string): Promise<void>;
}
export const DRIVER_REPOSITORY = Symbol('DRIVER_REPOSITORY');

/** Distance provider (Google Maps, haversine fallback). */
export interface DistanceProvider {
  distanceKm(origin: LatLng, dest: LatLng): Promise<number>;
}
export const DISTANCE_PROVIDER = Symbol('DISTANCE_PROVIDER');

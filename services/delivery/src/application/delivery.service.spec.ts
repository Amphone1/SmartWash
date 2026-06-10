import { randomUUID } from 'node:crypto';
import { DeliveryService } from './delivery.service';
import type { DeliveryState } from '../domain/delivery-fsm';
import { canTransition } from '../domain/delivery-fsm';
import type {
  CreateDeliveryData,
  DeliveryRecord,
  DeliveryRepository,
  DistanceProvider,
  DriverInfo,
  DriverRepository,
  Place,
} from '../domain/ports';

const PICKUP: Place = { addr: 'A', lat: 17.96, lng: 102.6 };
const DROPOFF: Place = { addr: 'B', lat: 17.98, lng: 102.63 };

class FakeDeliveryRepo implements DeliveryRepository {
  rows = new Map<string, DeliveryRecord>();
  byOrder = new Map<string, string>();
  async findByOrderId(orderId: string) {
    const id = this.byOrder.get(orderId);
    return id ? (this.rows.get(id) ?? null) : null;
  }
  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async create(data: CreateDeliveryData): Promise<DeliveryRecord> {
    const rec: DeliveryRecord = {
      id: data.id,
      orderId: data.orderId,
      driverId: null,
      state: 'CREATED',
      pickup: data.pickup,
      dropoff: data.dropoff,
      fee: data.fee,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.rows.set(rec.id, rec);
    this.byOrder.set(rec.orderId, rec.id);
    return rec;
  }
  async transition(
    id: string,
    from: DeliveryState,
    to: DeliveryState,
    _e: string,
    driverId: string | null,
  ): Promise<DeliveryRecord> {
    const rec = this.rows.get(id)!;
    if (rec.state !== from || !canTransition(from, to)) throw new Error('conflict');
    rec.state = to;
    if (driverId) rec.driverId = driverId;
    return rec;
  }
  async listForDriver() {
    return [...this.rows.values()];
  }
}

class FakeDriverRepo implements DriverRepository {
  drivers: DriverInfo[];
  states = new Map<string, string>();
  trips = new Map<string, number>();
  constructor(drivers: DriverInfo[]) {
    this.drivers = drivers;
  }
  async findById(id: string) {
    return this.drivers.find((d) => d.id === id) ?? null;
  }
  async findAvailable() {
    return this.drivers.filter((d) => (this.states.get(d.id) ?? d.state) === 'AVAILABLE');
  }
  async setState(driverId: string, state: string) {
    this.states.set(driverId, state);
    const d = this.drivers.find((x) => x.id === driverId);
    if (d) d.state = state;
  }
  async incrementTrips(driverId: string) {
    this.trips.set(driverId, (this.trips.get(driverId) ?? 0) + 1);
  }
}

const fakeDistance: DistanceProvider = { distanceKm: async () => 4 };

function make(drivers: DriverInfo[]) {
  const dRepo = new FakeDeliveryRepo();
  const drvRepo = new FakeDriverRepo(drivers);
  const svc = new DeliveryService(dRepo, drvRepo, fakeDistance);
  return { svc, dRepo, drvRepo };
}

function driver(id: string, lat: number, lng: number): DriverInfo {
  return { id, userId: `u-${id}`, branchId: null, state: 'AVAILABLE', location: { lat, lng } };
}

describe('DeliveryService', () => {
  it('creates, prices (fee), and assigns the nearest driver', async () => {
    const { svc } = make([driver('far', 18.5, 103.2), driver('near', 17.97, 102.61)]);
    const d = await svc.createForOrder(randomUUID(), PICKUP, DROPOFF);
    expect(d.fee).toBe(22000); // base 10k + 3k*4km
    expect(d.state).toBe('ASSIGNED');
    expect(d.driverId).toBe('near');
  });

  it('is idempotent per orderId', async () => {
    const { svc } = make([driver('near', 17.97, 102.61)]);
    const orderId = randomUUID();
    const a = await svc.createForOrder(orderId, PICKUP, DROPOFF);
    const b = await svc.createForOrder(orderId, PICKUP, DROPOFF);
    expect(a.id).toBe(b.id);
  });

  it('accept moves ASSIGNED → ACCEPTED', async () => {
    const { svc } = make([driver('near', 17.97, 102.61)]);
    const d = await svc.createForOrder(randomUUID(), PICKUP, DROPOFF);
    const accepted = await svc.accept(d.id, 'near');
    expect(accepted.state).toBe('ACCEPTED');
  });

  it('reject reassigns to another driver', async () => {
    const { svc, drvRepo } = make([
      driver('near', 17.97, 102.61),
      driver('next', 17.99, 102.64),
    ]);
    const d = await svc.createForOrder(randomUUID(), PICKUP, DROPOFF);
    expect(d.driverId).toBe('near');
    const reassigned = await svc.reject(d.id, 'near');
    expect(reassigned.state).toBe('ASSIGNED');
    expect(reassigned.driverId).toBe('next');
    expect(drvRepo.states.get('near')).toBe('AVAILABLE');
  });

  it('completes a delivered job and frees the driver', async () => {
    const { svc, drvRepo } = make([driver('near', 17.97, 102.61)]);
    const d = await svc.createForOrder(randomUUID(), PICKUP, DROPOFF);
    await svc.accept(d.id, 'near');
    await svc.advance(d.id, 'EN_ROUTE_PICKUP', 'near');
    await svc.advance(d.id, 'PICKED_UP', 'near');
    await svc.advance(d.id, 'IN_TRANSIT', 'near');
    await svc.advance(d.id, 'DELIVERED', 'near');
    const done = await svc.complete(d.id);
    expect(done.state).toBe('COMPLETED');
    expect(drvRepo.states.get('near')).toBe('AVAILABLE');
    expect(drvRepo.trips.get('near')).toBe(1);
  });

  it('rejects a driver acting on a delivery not theirs', async () => {
    const { svc } = make([driver('near', 17.97, 102.61)]);
    const d = await svc.createForOrder(randomUUID(), PICKUP, DROPOFF);
    await expect(svc.accept(d.id, 'someone-else')).rejects.toMatchObject({
      status: 409,
    });
  });
});

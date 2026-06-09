import { randomUUID } from 'node:crypto';
import { OrdersService } from './orders.service';
import type {
  CreateOrderData,
  MachineInfo,
  MachineLookup,
  OrderRecord,
  OrderRepository,
} from '../domain/ports';
import type { OrderState } from '../domain/order-fsm';

const BRANCH = '11111111-1111-4111-8111-111111111111';
const OTHER_BRANCH = '22222222-2222-4222-8222-222222222222';
const MACHINE = '33333333-3333-4333-8333-333333333333';
const USER = '44444444-4444-4444-8444-444444444444';

class FakeMachines implements MachineLookup {
  constructor(private readonly machine: MachineInfo | null) {}
  async findById(): Promise<MachineInfo | null> {
    return this.machine;
  }
}

class FakeRepo implements OrderRepository {
  orders = new Map<string, OrderRecord>();
  createCalls = 0;

  async create(data: CreateOrderData): Promise<OrderRecord> {
    this.createCalls += 1;
    const rec: OrderRecord = {
      id: data.id,
      userId: data.userId,
      branchId: data.branchId,
      machineId: data.machineId,
      type: data.type,
      state: 'RESERVED',
      subtotal: data.subtotal,
      vat: data.vat,
      total: data.total,
      createdAt: new Date().toISOString(),
    };
    this.orders.set(rec.id, rec);
    return rec;
  }
  async findById(id: string): Promise<OrderRecord | null> {
    return this.orders.get(id) ?? null;
  }
  async transition(
    id: string,
    from: OrderState,
    to: OrderState,
  ): Promise<OrderRecord> {
    const rec = this.orders.get(id)!;
    if (rec.state !== from) throw new Error('conflict');
    rec.state = to;
    return rec;
  }
}

class FakeLocks {
  held = new Map<string, string>();
  async acquire(key: string, _ttl: number, token: string) {
    if (this.held.has(key)) return null;
    this.held.set(key, token);
    return { key, token };
  }
  async release(lock: { key: string; token: string }) {
    if (this.held.get(lock.key) === lock.token) {
      this.held.delete(lock.key);
      return true;
    }
    return false;
  }
}

class FakeIdem {
  store = new Map<string, unknown>();
  async execute<T>(key: string, _s: string, _p: unknown, op: () => Promise<T>) {
    if (this.store.has(key)) {
      return { result: this.store.get(key) as T, replayed: true };
    }
    const result = await op();
    this.store.set(key, result);
    return { result, replayed: false };
  }
}

function machine(overrides: Partial<MachineInfo> = {}): MachineInfo {
  return {
    id: MACHINE,
    branchId: BRANCH,
    code: 'W001',
    type: 'washer',
    price: 20000n,
    ...overrides,
  };
}

function makeService(machineInfo: MachineInfo | null = machine()) {
  const repo = new FakeRepo();
  const locks = new FakeLocks();
  const idem = new FakeIdem();
  const svc = new OrdersService(
    new FakeMachines(machineInfo),
    repo,
    locks as never,
    idem as never,
  );
  return { svc, repo, locks, idem };
}

const input = {
  userId: USER,
  branchId: BRANCH,
  machineId: MACHINE,
  type: 'self_service' as const,
  cycle: 'normal' as const,
};

describe('OrdersService.createOrder', () => {
  it('reserves a machine and returns a RESERVED order', async () => {
    const { svc, repo, locks } = makeService();
    const order = await svc.createOrder(randomUUID(), input);
    expect(order.state).toBe('RESERVED');
    expect(order.total).toBe(20000);
    expect(repo.createCalls).toBe(1);
    expect(locks.held.get(`lock:machine:${MACHINE}`)).toBe(order.id);
  });

  it('404s when the machine does not exist', async () => {
    const { svc } = makeService(null);
    await expect(svc.createOrder(randomUUID(), input)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('rejects a machine that is not in the branch', async () => {
    const { svc } = makeService(machine({ branchId: OTHER_BRANCH }));
    await expect(svc.createOrder(randomUUID(), input)).rejects.toMatchObject({
      code: 'validation_error',
    });
  });

  it('409s when the machine is already reserved', async () => {
    const { svc, locks } = makeService();
    locks.held.set(`lock:machine:${MACHINE}`, 'someone-else');
    await expect(svc.createOrder(randomUUID(), input)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('replays the same Idempotency-Key without creating twice', async () => {
    const { svc, repo } = makeService();
    const key = randomUUID();
    const a = await svc.createOrder(key, input);
    const b = await svc.createOrder(key, input);
    expect(a.id).toBe(b.id);
    expect(repo.createCalls).toBe(1);
  });

  it('releases the reservation if persistence fails', async () => {
    const { svc, repo, locks } = makeService();
    jest.spyOn(repo, 'create').mockRejectedValueOnce(new Error('db down'));
    await expect(svc.createOrder(randomUUID(), input)).rejects.toThrow('db down');
    expect(locks.held.size).toBe(0);
  });
});

describe('OrdersService.cancelOrder', () => {
  it('cancels a reserved order and releases the lock', async () => {
    const { svc, locks } = makeService();
    const order = await svc.createOrder(randomUUID(), input);
    const cancelled = await svc.cancelOrder(randomUUID(), order.id);
    expect(cancelled.state).toBe('CANCELLED');
    expect(locks.held.size).toBe(0);
  });

  it('404s for an unknown order', async () => {
    const { svc } = makeService();
    await expect(
      svc.cancelOrder(randomUUID(), randomUUID()),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('409s when the order is not cancellable', async () => {
    const { svc, repo } = makeService();
    const order = await svc.createOrder(randomUUID(), input);
    repo.orders.get(order.id)!.state = 'RUNNING';
    await expect(
      svc.cancelOrder(randomUUID(), order.id),
    ).rejects.toMatchObject({ status: 409 });
  });
});

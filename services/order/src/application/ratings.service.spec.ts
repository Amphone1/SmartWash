import { RatingsService } from './ratings.service';
import type { OrderRecord, OrderRepository } from '../domain/ports';
import type {
  InsertRatingData,
  RatingView,
} from '../infra/db/pg-rating.repository';
import { ConflictError } from '@smartwash/common';

const ORDER = '11111111-1111-4111-8111-111111111111';
const USER = '44444444-4444-4444-8444-444444444444';
const OTHER = '55555555-5555-4555-8555-555555555555';

function orderRecord(state: OrderRecord['state']): OrderRecord {
  return {
    id: ORDER,
    userId: USER,
    branchId: 'b',
    machineId: 'm',
    type: 'delivery',
    state,
    cycle: 'normal',
    subtotal: 20000n as unknown as bigint,
    vat: 0n as unknown as bigint,
    total: 20000n as unknown as bigint,
    createdAt: new Date().toISOString(),
  } as unknown as OrderRecord;
}

class FakeOrders {
  constructor(private readonly rec: OrderRecord | null) {}
  async findById(): Promise<OrderRecord | null> {
    return this.rec;
  }
}

class FakeRatings {
  inserted: InsertRatingData[] = [];
  async insert(data: InsertRatingData): Promise<RatingView> {
    if (this.inserted.some((r) => r.orderId === data.orderId && r.userId === data.userId)) {
      throw new ConflictError('order already rated');
    }
    this.inserted.push(data);
    return {
      id: 'r1',
      orderId: data.orderId,
      userId: data.userId,
      rating: data.rating,
      tags: data.tags,
      comment: data.comment,
      createdAt: new Date().toISOString(),
    };
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

function build(rec: OrderRecord | null) {
  const ratings = new FakeRatings();
  const svc = new RatingsService(
    new FakeOrders(rec) as unknown as OrderRepository,
    ratings as never,
    new FakeIdem() as never,
  );
  return { svc, ratings };
}

const INPUT = { orderId: ORDER, rating: 5, tags: ['fast'], comment: 'ດີຫຼາຍ' };

describe('RatingsService', () => {
  it('records a rating for the caller on a COMPLETED order', async () => {
    const { svc, ratings } = build(orderRecord('COMPLETED'));
    const view = await svc.submit('k1', USER, INPUT);
    expect(view).toMatchObject({ orderId: ORDER, userId: USER, rating: 5 });
    expect(ratings.inserted).toHaveLength(1);
  });

  it('replays on the same Idempotency-Key without a second insert', async () => {
    const { svc, ratings } = build(orderRecord('COMPLETED'));
    await svc.submit('k1', USER, INPUT);
    await svc.submit('k1', USER, INPUT);
    expect(ratings.inserted).toHaveLength(1);
  });

  it('rejects rating someone else’s order', async () => {
    const { svc } = build(orderRecord('COMPLETED'));
    await expect(svc.submit('k1', OTHER, INPUT)).rejects.toThrow(
      'can only rate your own order',
    );
  });

  it('rejects orders that are not COMPLETED', async () => {
    const { svc } = build(orderRecord('RUNNING'));
    await expect(svc.submit('k1', USER, INPUT)).rejects.toThrow(
      'only completed orders can be rated',
    );
  });

  it('404s an unknown order', async () => {
    const { svc } = build(null);
    await expect(svc.submit('k1', USER, INPUT)).rejects.toThrow('order not found');
  });
});

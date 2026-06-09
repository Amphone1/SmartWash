import { OutboxRelay } from './outbox-relay';
import type { EventBus } from './nats';

interface FakeRow {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  state: string;
}

/** Minimal fake of Database.getPool() that the relay uses. */
function makeDb(rows: FakeRow[]) {
  const pool = {
    query: jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('SELECT')) {
        return { rows: rows.filter((r) => r.state === 'PENDING') };
      }
      if (sql.includes("'PUBLISHED'")) {
        const r = rows.find((x) => x.id === params[0]);
        if (r) r.state = 'PUBLISHED';
        return { rows: [] };
      }
      if (sql.includes("'FAILED'")) {
        const r = rows.find((x) => x.id === params[0]);
        if (r) r.state = 'FAILED';
        return { rows: [] };
      }
      return { rows: [] };
    }),
  };
  return { getPool: () => pool, _pool: pool };
}

function row(id: string, overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    id,
    aggregate_type: 'ledger',
    aggregate_id: 'agg-1',
    event_type: 'smartwash.ledger.posted.v1',
    payload: { ledgerId: 1, correlationId: 'cid-1' },
    state: 'PENDING',
    ...overrides,
  };
}

describe('OutboxRelay.relayBatch', () => {
  it('publishes pending rows in an envelope and marks them PUBLISHED', async () => {
    const rows = [row('1'), row('2')];
    const db = makeDb(rows);
    const published: { subject: string; payload: Record<string, unknown>; dedupId?: string }[] =
      [];
    const bus: EventBus = {
      publish: async (subject, payload, opts) => {
        published.push({ subject, payload, dedupId: opts?.dedupId });
      },
      subscribe: async () => undefined,
      jetstream: () => ({}) as never,
    };

    const relay = new OutboxRelay(db as never, bus);
    const count = await relay.relayBatch();

    expect(count).toBe(2);
    expect(published).toHaveLength(2);
    // subject equals the event type; dedup id equals the outbox row id
    expect(published[0].subject).toBe('smartwash.ledger.posted.v1');
    expect(published[0].dedupId).toBe('1');
    // envelope shape
    expect(published[0].payload).toMatchObject({
      type: 'smartwash.ledger.posted.v1',
      correlationId: 'cid-1',
      data: { ledgerId: 1 },
    });
    expect(rows.every((r) => r.state === 'PUBLISHED')).toBe(true);
  });

  it('marks a row FAILED when publishing throws, and continues', async () => {
    const rows = [row('1'), row('2')];
    const db = makeDb(rows);
    let calls = 0;
    const bus: EventBus = {
      publish: async () => {
        calls += 1;
        if (calls === 1) throw new Error('nats down');
      },
      subscribe: async () => undefined,
      jetstream: () => ({}) as never,
    };

    const relay = new OutboxRelay(db as never, bus);
    const count = await relay.relayBatch();

    expect(count).toBe(1); // only the second succeeded
    expect(rows.find((r) => r.id === '1')?.state).toBe('FAILED');
    expect(rows.find((r) => r.id === '2')?.state).toBe('PUBLISHED');
  });
});

import type { PoolClient } from 'pg';
import {
  consumeOnce,
  handleInboxDelivery,
  redrive,
  dlqSubjectFor,
  originalSubjectOf,
  type InboxDeps,
  type InboxMessage,
} from './inbox';

const fakeClient = (rowCount: number): PoolClient =>
  ({ query: async () => ({ rowCount, rows: [] }) }) as unknown as PoolClient;

const deps = (rowCount: number): InboxDeps & { publishDlq: jest.Mock } => ({
  runInTx: <T>(fn: (c: PoolClient) => Promise<T>) => fn(fakeClient(rowCount)),
  publishDlq: jest.fn().mockResolvedValue(undefined),
});

const msg = (over: Partial<InboxMessage> = {}): InboxMessage => ({
  eventId: '1',
  deliveryCount: 1,
  subject: 'smartwash.ledger.transaction.posted.v2',
  payload: { hello: 'world' },
  ...over,
});

describe('consumeOnce (dedup)', () => {
  it('runs the handler on first delivery', async () => {
    const process = jest.fn().mockResolvedValue(undefined);
    expect(await consumeOnce(fakeClient(1), 'c', 'e1', process)).toBe(true);
    expect(process).toHaveBeenCalledTimes(1);
  });

  it('skips the handler on a duplicate (PK conflict → rowCount 0)', async () => {
    const process = jest.fn().mockResolvedValue(undefined);
    expect(await consumeOnce(fakeClient(0), 'c', 'e1', process)).toBe(false);
    expect(process).not.toHaveBeenCalled();
  });
});

describe('handleInboxDelivery', () => {
  it('ack + process on success', async () => {
    const d = deps(1);
    const handler = jest.fn().mockResolvedValue(undefined);
    expect(await handleInboxDelivery(d, 'c', 5, handler, msg())).toBe('ack');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(d.publishDlq).not.toHaveBeenCalled();
  });

  it('ack + skip on duplicate', async () => {
    const d = deps(0);
    const handler = jest.fn().mockResolvedValue(undefined);
    expect(await handleInboxDelivery(d, 'c', 5, handler, msg())).toBe('ack');
    expect(handler).not.toHaveBeenCalled();
  });

  it('retry on a transient failure (attempt < maxDeliver)', async () => {
    const d = deps(1);
    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    expect(await handleInboxDelivery(d, 'c', 5, handler, msg({ deliveryCount: 2 }))).toBe('retry');
    expect(d.publishDlq).not.toHaveBeenCalled();
  });

  it('routes a poison message to the DLQ on the final attempt (never dropped)', async () => {
    const d = deps(1);
    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    const out = await handleInboxDelivery(d, 'c', 5, handler, msg({ deliveryCount: 5 }));
    expect(out).toBe('dlq');
    expect(d.publishDlq).toHaveBeenCalledWith(
      'smartwash.ledger.transaction.posted.v2.dlq',
      expect.objectContaining({
        originalSubject: 'smartwash.ledger.transaction.posted.v2',
        eventId: '1',
        error: 'boom',
        payload: { hello: 'world' },
      }),
    );
  });
});

describe('redrive', () => {
  it('republishes a DLQ message to its original subject', async () => {
    const bus = { publish: jest.fn().mockResolvedValue(undefined) };
    await redrive(bus, { originalSubject: 'smartwash.x', payload: { a: 1 } });
    expect(bus.publish).toHaveBeenCalledWith('smartwash.x', { a: 1 });
  });

  it('throws when originalSubject is missing', async () => {
    const bus = { publish: jest.fn() };
    await expect(redrive(bus, { payload: {} })).rejects.toThrow();
  });
});

describe('subject helpers', () => {
  it('round-trips dlq subjects', () => {
    expect(dlqSubjectFor('smartwash.ledger.posted.v2')).toBe('smartwash.ledger.posted.v2.dlq');
    expect(originalSubjectOf('smartwash.ledger.posted.v2.dlq')).toBe('smartwash.ledger.posted.v2');
  });
});

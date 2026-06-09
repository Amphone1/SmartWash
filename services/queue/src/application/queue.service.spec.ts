import { randomUUID } from 'node:crypto';
import { QueueService } from './queue.service';
import type { QueueEntry, QueueRepository } from '../domain/ports';
import type { QueueState } from '../domain/queue-fsm';

const MACHINE = '33333333-3333-4333-8333-333333333333';
const USER = '44444444-4444-4444-8444-444444444444';

class FakeRepo implements QueueRepository {
  entries: QueueEntry[] = [];
  joinCalls = 0;

  async findActive(machineId: string, userId: string) {
    return (
      this.entries.find(
        (e) =>
          e.machineId === machineId &&
          e.userId === userId &&
          ['IN_QUEUE', 'CALLED', 'RESERVED'].includes(e.status),
      ) ?? null
    );
  }
  async join(machineId: string, userId: string) {
    this.joinCalls += 1;
    const position = this.entries.length + 1;
    const entry: QueueEntry = {
      id: randomUUID(),
      machineId,
      userId,
      position,
      status: 'IN_QUEUE',
      calledAt: null,
      expiresAt: null,
      createdAt: new Date().toISOString(),
    };
    this.entries.push(entry);
    return entry;
  }
  async findById(id: string) {
    return this.entries.find((e) => e.id === id) ?? null;
  }
  async listActive(machineId: string) {
    return this.entries
      .filter(
        (e) =>
          e.machineId === machineId &&
          ['IN_QUEUE', 'CALLED', 'RESERVED'].includes(e.status),
      )
      .sort((a, b) => a.position - b.position);
  }
  async setStatus(id: string, _from: QueueState, to: QueueState) {
    const e = this.entries.find((x) => x.id === id)!;
    e.status = to;
    return e;
  }
  async callNext(machineId: string) {
    const front = (await this.listActive(machineId)).find(
      (e) => e.status === 'IN_QUEUE',
    );
    if (!front) return null;
    front.status = 'CALLED';
    return front;
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

function make() {
  const repo = new FakeRepo();
  const svc = new QueueService(repo, new FakeIdem() as never);
  return { svc, repo };
}

describe('QueueService', () => {
  it('joins once and dedups a re-join to the same active slot', async () => {
    const { svc, repo } = make();
    const first = await svc.join(randomUUID(), MACHINE, USER);
    const again = await svc.join(randomUUID(), MACHINE, USER);
    expect(first.id).toBe(again.id);
    expect(repo.joinCalls).toBe(1);
    expect(first.status).toBe('IN_QUEUE');
  });

  it('reports position with people ahead', async () => {
    const { svc } = make();
    await svc.join(randomUUID(), MACHINE, randomUUID());
    await svc.join(randomUUID(), MACHINE, USER);
    const pos = await svc.position(MACHINE, USER);
    expect(pos.ahead).toBe(1);
    expect(pos.entry.position).toBe(2);
  });

  it('leave 404s for unknown entry and conflicts on terminal', async () => {
    const { svc, repo } = make();
    await expect(
      svc.leave(randomUUID(), randomUUID()),
    ).rejects.toMatchObject({ status: 404 });

    const e = await svc.join(randomUUID(), MACHINE, USER);
    repo.entries[0].status = 'DONE';
    await expect(svc.leave(randomUUID(), e.id)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('call-next returns the front entry as CALLED, null when empty', async () => {
    const { svc } = make();
    expect(await svc.callNext(randomUUID(), MACHINE)).toBeNull();
    await svc.join(randomUUID(), MACHINE, USER);
    const called = await svc.callNext(randomUUID(), MACHINE);
    expect(called?.status).toBe('CALLED');
  });
});

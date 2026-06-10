import { MachineService } from './machine.service';
import type {
  MachineRef,
  MachineRepository,
  MachineStatusView,
  StatusUpdate,
} from '../domain/ports';

const MACHINE = '33333333-3333-4333-8333-333333333333';
const BRANCH = '11111111-1111-4111-8111-111111111111';

class FakeRepo implements MachineRepository {
  snap: MachineStatusView | null = null;
  ref: MachineRef | null = { id: MACHINE, branchId: BRANCH, code: 'W001' };
  touched: { progress?: number }[] = [];
  transitions: StatusUpdate[] = [];

  async findById() {
    return this.ref;
  }
  async getStatus() {
    return this.snap;
  }
  async listByBranch() {
    return this.snap ? [this.snap] : [];
  }
  async touch(_id: string, progress?: number) {
    this.touched.push({ progress });
  }
  async applyTransition(u: StatusUpdate): Promise<MachineStatusView> {
    this.transitions.push(u);
    this.snap = {
      machineId: u.machineId,
      branchId: u.branchId,
      state: u.state,
      progress: u.progress ?? 0,
      remainingMin: u.remainingMin ?? null,
      currentOrder: u.clearOrder ? null : (this.snap?.currentOrder ?? null),
      lastSeen: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return this.snap;
  }
  async reserve(machineId: string, orderId: string): Promise<MachineStatusView> {
    this.snap = {
      machineId,
      branchId: BRANCH,
      state: 'RESERVED',
      progress: 0,
      remainingMin: null,
      currentOrder: orderId,
      lastSeen: null,
      updatedAt: new Date().toISOString(),
    };
    return this.snap;
  }
  async release(machineId: string): Promise<MachineStatusView> {
    this.snap = {
      machineId,
      branchId: BRANCH,
      state: 'IDLE',
      progress: 0,
      remainingMin: null,
      currentOrder: null,
      lastSeen: null,
      updatedAt: new Date().toISOString(),
    };
    return this.snap;
  }
  async setCurrentOrder() {
    /* noop */
  }
  async findStale() {
    return this.snap && this.snap.state !== 'OFFLINE' ? [this.snap] : [];
  }
}

class FakeMqtt {
  published: { topic: string; body: Record<string, unknown>; qos: number }[] = [];
  publish(topic: string, body: Record<string, unknown>, qos: number) {
    this.published.push({ topic, body, qos });
  }
}
class FakeGateway {
  emits: MachineStatusView[] = [];
  emitStatus(_b: string | null, v: MachineStatusView) {
    this.emits.push(v);
  }
}

function make() {
  const repo = new FakeRepo();
  const mqtt = new FakeMqtt();
  const gw = new FakeGateway();
  const svc = new MachineService(repo, mqtt as never, gw as never);
  return { repo, mqtt, gw, svc };
}

describe('MachineService', () => {
  it('applies a forward device status as a transition + emits MachineRunning', async () => {
    const { repo, svc, gw } = make();
    repo.snap = {
      machineId: MACHINE,
      branchId: BRANCH,
      state: 'STARTING',
      progress: 0,
      remainingMin: null,
      currentOrder: 'order-1',
      lastSeen: null,
      updatedAt: new Date().toISOString(),
    };
    await svc.onStatus({ machineId: MACHINE, branchId: BRANCH, status: 'RUNNING' });
    expect(repo.transitions[0]).toMatchObject({ state: 'RUNNING', emit: 'MachineRunning' });
    expect(gw.emits.at(-1)?.state).toBe('RUNNING');
  });

  it('treats a RESERVED machine reporting IDLE as telemetry-only', async () => {
    const { repo, svc } = make();
    repo.snap = {
      machineId: MACHINE,
      branchId: BRANCH,
      state: 'RESERVED',
      progress: 0,
      remainingMin: null,
      currentOrder: 'order-1',
      lastSeen: null,
      updatedAt: new Date().toISOString(),
    };
    await svc.onStatus({
      machineId: MACHINE,
      branchId: BRANCH,
      status: 'IDLE',
      progress: 5,
    });
    expect(repo.transitions).toHaveLength(0);
    expect(repo.touched).toHaveLength(1);
  });

  it('clears current_order on return to IDLE after finishing', async () => {
    const { repo, svc } = make();
    repo.snap = {
      machineId: MACHINE,
      branchId: BRANCH,
      state: 'FINISHING',
      progress: 100,
      remainingMin: 0,
      currentOrder: 'order-1',
      lastSeen: null,
      updatedAt: new Date().toISOString(),
    };
    await svc.onStatus({ machineId: MACHINE, branchId: BRANCH, status: 'IDLE' });
    expect(repo.transitions[0]).toMatchObject({ state: 'IDLE', clearOrder: true });
  });

  it('start publishes a START command at QoS 2', async () => {
    const { repo, svc, mqtt } = make();
    await repo.reserve(MACHINE, 'order-1'); // machine reserved before start
    await svc.start(MACHINE, 'order-1', 'normal');
    const cmd = mqtt.published[0];
    expect(cmd.topic).toBe(`smartwash/${BRANCH}/W001/cmd`);
    expect(cmd.body).toMatchObject({ cmd: 'START', orderId: 'order-1', cycle: 'normal' });
    expect(cmd.qos).toBe(2);
  });

  it('sweepStale flips a silent machine OFFLINE', async () => {
    const { repo, svc } = make();
    repo.snap = {
      machineId: MACHINE,
      branchId: BRANCH,
      state: 'RUNNING',
      progress: 50,
      remainingMin: 10,
      currentOrder: 'order-1',
      lastSeen: new Date(Date.now() - 60_000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const n = await svc.sweepStale(30);
    expect(n).toBe(1);
    expect(repo.transitions.at(-1)).toMatchObject({ state: 'OFFLINE', emit: 'MachineOffline' });
  });
});

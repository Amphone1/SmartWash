/**
 * Machine application service. Bridges device MQTT status/lwt into the snapshot
 * + history + domain events, drives commands (reserve/start/stop/release) out to
 * the device, and pushes live status over Socket.IO. The Machine FSM never
 * encodes payment/order state (rule #10).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotFoundError } from '@smartwash/common';
import { MqttBus } from '@smartwash/nestkit';
import {
  applyDeviceStatus,
  eventForTransition,
  type DeviceStatus,
  type MachineState,
} from '../domain/machine-fsm';
import {
  MACHINE_REPOSITORY,
  type MachineRepository,
  type MachineStatusView,
} from '../domain/ports';
import { MachineGateway } from '../infra/ws/machine.gateway';

interface StatusPayload {
  machineId: string;
  branchId: string;
  status: DeviceStatus;
  progress?: number;
  remaining?: number;
  errorCode?: string;
}

interface LwtPayload {
  machineId: string;
  online: boolean;
}

@Injectable()
export class MachineService {
  private readonly logger = new Logger('MachineService');

  constructor(
    @Inject(MACHINE_REPOSITORY) private readonly repo: MachineRepository,
    private readonly mqtt: MqttBus,
    private readonly gateway: MachineGateway,
  ) {}

  /** Handle a device status uplink. */
  async onStatus(p: StatusPayload): Promise<void> {
    if (!p?.machineId || !p?.status) return;
    const snap = await this.repo.getStatus(p.machineId);
    const current: MachineState = snap?.state ?? 'OFFLINE';
    const next = applyDeviceStatus(current, p.status);

    if (next === null) {
      await this.repo.touch(p.machineId, p.progress, p.remaining);
      const v = await this.repo.getStatus(p.machineId);
      if (v) this.gateway.emitStatus(v.branchId, v);
      return;
    }

    const view = await this.repo.applyTransition({
      machineId: p.machineId,
      branchId: p.branchId,
      state: next,
      progress: p.progress,
      remainingMin: p.remaining,
      errorCode: p.errorCode,
      emit: eventForTransition(current, next) ?? undefined,
      clearOrder: next === 'IDLE',
    });
    this.gateway.emitStatus(view.branchId, view);
  }

  /** Handle a Last-Will (device disconnected). */
  async onLwt(p: LwtPayload): Promise<void> {
    if (!p?.machineId || p.online) return; // online recovery handled by next status
    const ref = await this.repo.findById(p.machineId);
    if (!ref) return;
    const view = await this.repo.applyTransition({
      machineId: p.machineId,
      branchId: ref.branchId,
      state: 'OFFLINE',
      emit: 'MachineOffline',
    });
    this.gateway.emitStatus(view.branchId, view);
  }

  /** Heartbeat sweep: machines silent past the cutoff → OFFLINE. */
  async sweepStale(timeoutSeconds: number): Promise<number> {
    const cutoff = new Date(Date.now() - timeoutSeconds * 1000);
    const stale = await this.repo.findStale(cutoff);
    for (const m of stale) {
      const view = await this.repo.applyTransition({
        machineId: m.machineId,
        branchId: m.branchId ?? '',
        state: 'OFFLINE',
        emit: 'MachineOffline',
      });
      this.gateway.emitStatus(view.branchId, view);
    }
    return stale.length;
  }

  // ── reads ──────────────────────────────────────────────────────────
  async getStatus(machineId: string): Promise<MachineStatusView> {
    const v = await this.repo.getStatus(machineId);
    if (!v) throw new NotFoundError('machine status not found');
    return v;
  }
  listByBranch(branchId: string): Promise<MachineStatusView[]> {
    return this.repo.listByBranch(branchId);
  }

  // ── commands (saga) ────────────────────────────────────────────────
  async reserve(machineId: string, orderId: string): Promise<MachineStatusView> {
    const view = await this.repo.reserve(machineId, orderId);
    this.gateway.emitStatus(view.branchId, view);
    return view;
  }

  async start(
    machineId: string,
    orderId: string,
    cycle: string,
  ): Promise<MachineStatusView> {
    const ref = await this.repo.findById(machineId);
    if (!ref) throw new NotFoundError('machine not found');
    await this.repo.setCurrentOrder(machineId, orderId);
    this.publishCmd(ref.branchId, ref.code, { cmd: 'START', orderId, cycle });
    return this.getStatus(machineId);
  }

  async stop(machineId: string, orderId?: string): Promise<void> {
    const ref = await this.repo.findById(machineId);
    if (!ref) throw new NotFoundError('machine not found');
    this.publishCmd(ref.branchId, ref.code, { cmd: 'STOP', orderId });
  }

  async release(machineId: string): Promise<MachineStatusView> {
    const view = await this.repo.release(machineId);
    this.gateway.emitStatus(view.branchId, view);
    return view;
  }

  private publishCmd(
    branchId: string,
    code: string,
    body: Record<string, unknown>,
  ): void {
    const topic = `smartwash/${branchId}/${code}/cmd`;
    this.mqtt.publish(topic, { ...body, ts: new Date().toISOString() }, 2);
    this.logger.debug(`cmd → ${topic}: ${JSON.stringify(body)}`);
  }
}

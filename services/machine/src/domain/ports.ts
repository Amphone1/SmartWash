import type { MachineState } from './machine-fsm';

export interface MachineRef {
  id: string;
  branchId: string;
  code: string;
}

export interface MachineStatusView {
  machineId: string;
  branchId: string | null;
  state: MachineState;
  progress: number;
  remainingMin: number | null;
  currentOrder: string | null;
  lastSeen: string | null;
  updatedAt: string;
}

export interface StatusUpdate {
  machineId: string;
  branchId: string;
  state: MachineState;
  progress?: number;
  remainingMin?: number;
  errorCode?: string;
  /** Domain event to emit (with current_order) in the same txn, if any. */
  emit?: 'MachineRunning' | 'MachineFinished' | 'MachineError' | 'MachineOffline';
  /** Clear current_order (e.g. on return to IDLE after a cycle). */
  clearOrder?: boolean;
}

export interface MachineRepository {
  findById(machineId: string): Promise<MachineRef | null>;
  getStatus(machineId: string): Promise<MachineStatusView | null>;
  listByBranch(branchId: string): Promise<MachineStatusView[]>;
  /** Telemetry-only: bump progress/last_seen without a state change. */
  touch(
    machineId: string,
    progress: number | undefined,
    remainingMin: number | undefined,
  ): Promise<void>;
  /** State change + machine_events append + optional outbox event (one txn). */
  applyTransition(update: StatusUpdate): Promise<MachineStatusView>;
  /** Backend-driven: set RESERVED + current_order. */
  reserve(machineId: string, orderId: string): Promise<MachineStatusView>;
  /** Backend-driven: set IDLE + clear current_order. */
  release(machineId: string): Promise<MachineStatusView>;
  /** Machines whose last_seen is older than the cutoff and not already OFFLINE. */
  findStale(cutoff: Date): Promise<MachineStatusView[]>;
  setCurrentOrder(machineId: string, orderId: string): Promise<void>;
}
export const MACHINE_REPOSITORY = Symbol('MACHINE_REPOSITORY');

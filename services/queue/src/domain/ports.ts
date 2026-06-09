import type { QueueState } from './queue-fsm';

export interface QueueEntry {
  id: string;
  machineId: string;
  userId: string;
  position: number;
  status: QueueState;
  calledAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface QueueRepository {
  /** The user's current non-terminal entry for a machine, if any. */
  findActive(machineId: string, userId: string): Promise<QueueEntry | null>;
  /** Append a new IN_QUEUE entry at the next position (atomic). */
  join(machineId: string, userId: string): Promise<QueueEntry>;
  findById(id: string): Promise<QueueEntry | null>;
  /** Active entries for a machine, ordered by position. */
  listActive(machineId: string): Promise<QueueEntry[]>;
  /** Guarded status change (only if currently `from`). */
  setStatus(
    id: string,
    from: QueueState,
    to: QueueState,
    holdSeconds?: number,
  ): Promise<QueueEntry>;
  /** Move the front IN_QUEUE entry to CALLED with a hold; null if queue empty. */
  callNext(machineId: string, holdSeconds: number): Promise<QueueEntry | null>;
}
export const QUEUE_REPOSITORY = Symbol('QUEUE_REPOSITORY');

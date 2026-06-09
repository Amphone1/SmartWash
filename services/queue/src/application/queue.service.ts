/**
 * Queue use-cases. Join is idempotent (a user can hold only one active slot per
 * machine); call-next promotes the front of the line with a reservation hold.
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '@smartwash/common';
import { IdempotencyService } from '@smartwash/nestkit';
import { isActive } from '../domain/queue-fsm';
import {
  QUEUE_REPOSITORY,
  type QueueEntry,
  type QueueRepository,
} from '../domain/ports';

export interface PositionView {
  entry: QueueEntry;
  ahead: number; // people still IN_QUEUE in front of this entry
}

@Injectable()
export class QueueService {
  private readonly holdSeconds: number;

  constructor(
    @Inject(QUEUE_REPOSITORY) private readonly repo: QueueRepository,
    private readonly idempotency: IdempotencyService,
  ) {
    this.holdSeconds = Number.parseInt(
      process.env.QUEUE_HOLD_SECONDS ?? '300',
      10,
    );
  }

  async join(
    idempotencyKey: string,
    machineId: string,
    userId: string,
  ): Promise<QueueEntry> {
    const { result } = await this.idempotency.execute(
      idempotencyKey,
      'queue.join',
      { machineId, userId },
      async () => {
        const existing = await this.repo.findActive(machineId, userId);
        if (existing) return existing; // already queued — return current slot
        return this.repo.join(machineId, userId);
      },
    );
    return result;
  }

  async leave(idempotencyKey: string, entryId: string): Promise<QueueEntry> {
    const { result } = await this.idempotency.execute(
      idempotencyKey,
      'queue.leave',
      { entryId },
      async () => {
        const entry = await this.repo.findById(entryId);
        if (!entry) throw new NotFoundError('queue entry not found');
        if (!isActive(entry.status)) {
          throw new ConflictError(`cannot leave from state ${entry.status}`);
        }
        return this.repo.setStatus(entry.id, entry.status, 'LEFT');
      },
    );
    return result;
  }

  async callNext(
    idempotencyKey: string,
    machineId: string,
  ): Promise<QueueEntry | null> {
    const { result } = await this.idempotency.execute(
      idempotencyKey,
      'queue.callNext',
      { machineId },
      () => this.repo.callNext(machineId, this.holdSeconds),
    );
    return result;
  }

  list(machineId: string): Promise<QueueEntry[]> {
    return this.repo.listActive(machineId);
  }

  async position(machineId: string, userId: string): Promise<PositionView> {
    const entry = await this.repo.findActive(machineId, userId);
    if (!entry) throw new NotFoundError('not in queue');
    const active = await this.repo.listActive(machineId);
    const ahead = active.filter(
      (e) => e.status === 'IN_QUEUE' && e.position < entry.position,
    ).length;
    return { entry, ahead };
  }
}

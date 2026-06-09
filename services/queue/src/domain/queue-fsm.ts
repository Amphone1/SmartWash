/**
 * Queue entry FSM. A customer joins a machine queue (IN_QUEUE); the system/staff
 * calls the front of the line (CALLED) with a hold TTL; if they claim it the
 * entry becomes RESERVED then DONE, otherwise it EXPIRES and the next is called.
 */

export type QueueState =
  | 'IN_QUEUE'
  | 'CALLED'
  | 'RESERVED'
  | 'SKIPPED'
  | 'EXPIRED'
  | 'LEFT'
  | 'DONE';

const TRANSITIONS: Record<QueueState, QueueState[]> = {
  IN_QUEUE: ['CALLED', 'LEFT', 'SKIPPED', 'EXPIRED'],
  CALLED: ['RESERVED', 'EXPIRED', 'LEFT', 'SKIPPED'],
  RESERVED: ['DONE', 'EXPIRED', 'LEFT'],
  SKIPPED: ['IN_QUEUE'],
  EXPIRED: [],
  LEFT: [],
  DONE: [],
};

/** Non-terminal states — an entry in one of these occupies a queue slot. */
export const ACTIVE_STATES: ReadonlySet<QueueState> = new Set<QueueState>([
  'IN_QUEUE',
  'CALLED',
  'RESERVED',
]);

export function canTransition(from: QueueState, to: QueueState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isActive(state: QueueState): boolean {
  return ACTIVE_STATES.has(state);
}

/** A CALLED entry whose hold has elapsed should be expired. */
export function isHoldExpired(
  state: QueueState,
  expiresAt: Date | null,
  now: Date,
): boolean {
  return state === 'CALLED' && expiresAt !== null && expiresAt.getTime() <= now.getTime();
}

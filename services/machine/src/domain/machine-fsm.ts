/**
 * Machine (device) FSM — rule #10: kept entirely separate from the Order FSM,
 * synced only via events. Pure logic.
 *
 * Two transition sources:
 *   • DEVICE  — driven by MQTT status uplinks (STARTING/RUNNING/FINISHING/PAUSED/
 *     ERROR/IDLE). A status that isn't a valid device transition is treated as a
 *     telemetry-only update (progress/last_seen) and does NOT change state — so a
 *     device IDLE heartbeat never clobbers a backend RESERVED.
 *   • COMMAND — backend-driven (RESERVED, MAINTENANCE) + LWT/heartbeat (OFFLINE).
 */
export type MachineState =
  | 'OFFLINE'
  | 'IDLE'
  | 'RESERVED'
  | 'STARTING'
  | 'RUNNING'
  | 'FINISHING'
  | 'PAUSED'
  | 'ERROR'
  | 'MAINTENANCE';

export type DeviceStatus =
  | 'IDLE'
  | 'STARTING'
  | 'RUNNING'
  | 'FINISHING'
  | 'PAUSED'
  | 'ERROR';

/** Which target states a DEVICE status uplink may drive, per current state. */
const DEVICE_TRANSITIONS: Record<MachineState, MachineState[]> = {
  OFFLINE: ['IDLE', 'STARTING', 'RUNNING', 'FINISHING', 'PAUSED', 'ERROR'],
  IDLE: ['STARTING', 'RUNNING', 'ERROR'],
  RESERVED: ['STARTING', 'RUNNING', 'ERROR'], // not IDLE — release is backend-driven
  STARTING: ['RUNNING', 'ERROR', 'IDLE'],
  RUNNING: ['FINISHING', 'PAUSED', 'ERROR', 'IDLE'],
  FINISHING: ['IDLE', 'ERROR'],
  PAUSED: ['RUNNING', 'FINISHING', 'ERROR'],
  ERROR: ['IDLE'],
  MAINTENANCE: [],
};

export function deviceCanDrive(from: MachineState, to: MachineState): boolean {
  return DEVICE_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Apply a device status: returns the new state, or null for telemetry-only. */
export function applyDeviceStatus(
  current: MachineState,
  status: DeviceStatus,
): MachineState | null {
  if (current === status) return null; // no change
  return deviceCanDrive(current, status) ? status : null;
}

export const RUNNING_STATES: ReadonlySet<MachineState> = new Set<MachineState>([
  'STARTING',
  'RUNNING',
  'FINISHING',
  'PAUSED',
]);

export function isBusy(state: MachineState): boolean {
  return RUNNING_STATES.has(state) || state === 'RESERVED';
}

export type DomainEvent =
  | 'MachineRunning'
  | 'MachineFinished'
  | 'MachineError'
  | 'MachineOffline';

/** Which domain event (if any) a state transition should publish to the saga. */
export function eventForTransition(
  from: MachineState,
  to: MachineState,
): DomainEvent | null {
  if (to === from) return null;
  if (to === 'RUNNING') return 'MachineRunning';
  if (to === 'FINISHING') return 'MachineFinished';
  if (to === 'ERROR') return 'MachineError';
  if (to === 'OFFLINE') return 'MachineOffline';
  return null;
}


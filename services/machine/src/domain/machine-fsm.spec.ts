import {
  applyDeviceStatus,
  deviceCanDrive,
  eventForTransition,
  isBusy,
} from './machine-fsm';

describe('Machine FSM (device-driven)', () => {
  it('drives the normal wash lifecycle', () => {
    expect(applyDeviceStatus('RESERVED', 'STARTING')).toBe('STARTING');
    expect(applyDeviceStatus('STARTING', 'RUNNING')).toBe('RUNNING');
    expect(applyDeviceStatus('RUNNING', 'FINISHING')).toBe('FINISHING');
    expect(applyDeviceStatus('FINISHING', 'IDLE')).toBe('IDLE');
  });

  it('does NOT let a device IDLE heartbeat clobber RESERVED (rule #10 nuance)', () => {
    // device reports IDLE while backend reserved it → telemetry-only (null)
    expect(applyDeviceStatus('RESERVED', 'IDLE')).toBeNull();
  });

  it('returns null when status is unchanged', () => {
    expect(applyDeviceStatus('RUNNING', 'RUNNING')).toBeNull();
  });

  it('recovers from OFFLINE on any device status', () => {
    expect(applyDeviceStatus('OFFLINE', 'RUNNING')).toBe('RUNNING');
    expect(deviceCanDrive('OFFLINE', 'IDLE')).toBe(true);
  });

  it('allows ERROR from running states', () => {
    expect(applyDeviceStatus('RUNNING', 'ERROR')).toBe('ERROR');
    expect(applyDeviceStatus('STARTING', 'ERROR')).toBe('ERROR');
  });

  it('maps transitions to domain events', () => {
    expect(eventForTransition('STARTING', 'RUNNING')).toBe('MachineRunning');
    expect(eventForTransition('RUNNING', 'FINISHING')).toBe('MachineFinished');
    expect(eventForTransition('RUNNING', 'ERROR')).toBe('MachineError');
    expect(eventForTransition('RUNNING', 'OFFLINE')).toBe('MachineOffline');
    expect(eventForTransition('FINISHING', 'IDLE')).toBeNull();
  });

  it('classifies busy states', () => {
    expect(isBusy('RUNNING')).toBe(true);
    expect(isBusy('RESERVED')).toBe(true);
    expect(isBusy('IDLE')).toBe(false);
    expect(isBusy('OFFLINE')).toBe(false);
  });
});

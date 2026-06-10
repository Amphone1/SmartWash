/** Device simulator config. SIM_DEVICES is a JSON array describing the machines
 * to emulate; each must match a real row in the DB (machineId + branchId + code)
 * so the Machine service can correlate status uplinks. */
export interface SimDevice {
  machineId: string;
  branchId: string;
  code: string;
}

function parseDevices(): SimDevice[] {
  const raw = process.env.SIM_DEVICES;
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SimDevice[];
  } catch {
    throw new Error('SIM_DEVICES must be valid JSON');
  }
}

export const config = {
  mqttUrl: process.env.MQTT_URL ?? 'mqtt://localhost:1883',
  username: process.env.MQTT_USERNAME ?? 'device',
  password: process.env.MQTT_PASSWORD ?? '',
  devices: parseDevices(),
  heartbeatMs: Number.parseInt(process.env.SIM_HEARTBEAT_MS ?? '10000', 10),
  stepMs: Number.parseInt(process.env.SIM_STEP_MS ?? '2000', 10),
  totalMinutes: Number.parseInt(process.env.SIM_CYCLE_MINUTES ?? '30', 10),
};

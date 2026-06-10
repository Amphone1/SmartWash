import { config } from './config';
import { SimulatedDevice } from './device';

const devices = config.devices.map((d) => new SimulatedDevice(d));
devices.forEach((d) => d.start());
console.log(`[device-sim] emulating ${devices.length} machine(s)`);

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.once(sig, () => {
    devices.forEach((d) => d.stop());
    process.exit(0);
  });
}

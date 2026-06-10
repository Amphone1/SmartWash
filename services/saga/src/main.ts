import { startHealthServer } from './health';
import { startTrigger } from './trigger';
import { startWorker } from './worker';

async function main(): Promise<void> {
  startHealthServer();
  await startTrigger();
  await startWorker(); // blocks until the worker shuts down
}

main().catch((err) => {
  console.error('[saga] fatal:', err);
  process.exit(1);
});

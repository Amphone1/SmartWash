/** Temporal worker: runs the topup workflow + activities on the `topup` queue. */
import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';
import { config } from './config';

export async function startWorker(): Promise<void> {
  const connection = await NativeConnection.connect({
    address: config.temporalAddress,
  });
  const worker = await Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue: config.taskQueue,
    workflowsPath: require.resolve('./workflows'),
    activities,
  });
  await worker.run();
}

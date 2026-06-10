/**
 * NATS → Temporal bridge.
 *   • SlipUploaded            → start topupWorkflow (workflowId = topup:{qrRef})
 *   • PaymentApproved/Rejected → signal a parked manual-review workflow
 */
import {
  connect,
  consumerOpts,
  createInbox,
  JSONCodec,
  type NatsConnection,
} from 'nats';
import { Client, Connection } from '@temporalio/client';
import { config } from './config';
import { staffDecisionSignal, topupWorkflow, type StaffDecision } from './workflows';

const codec = JSONCodec();

interface Envelope {
  data?: Record<string, unknown>;
  [k: string]: unknown;
}

export async function startTrigger(): Promise<void> {
  const nc = await connect({ servers: config.natsUrl });
  const connection = await Connection.connect({ address: config.temporalAddress });
  const client = new Client({ connection, namespace: config.namespace });

  await subscribe(nc, 'smartwash.payment.slip_uploaded.v1', 'saga-slip', async (e) => {
    const d = (e.data ?? e) as Record<string, unknown>;
    await startTopup(client, d);
  });
  await subscribe(nc, 'smartwash.payment.approved.v1', 'saga-approved', async (e) => {
    const d = (e.data ?? e) as Record<string, unknown>;
    await signalStaff(client, String(d.qrRef), 'approve');
  });
  await subscribe(nc, 'smartwash.payment.rejected.v1', 'saga-rejected', async (e) => {
    const d = (e.data ?? e) as Record<string, unknown>;
    await signalStaff(client, String(d.qrRef), 'reject');
  });
}

async function startTopup(
  client: Client,
  d: Record<string, unknown>,
): Promise<void> {
  try {
    await client.workflow.start(topupWorkflow, {
      taskQueue: config.taskQueue,
      workflowId: `topup:${String(d.qrRef)}`,
      args: [
        {
          qrRef: String(d.qrRef),
          slipId: String(d.slipId),
          userId: String(d.userId),
          slipHash: String(d.slipHash),
          imageObjectKey: String(d.imageObjectKey ?? ''),
          amountExpected: Number(d.amountExpected ?? 0),
          ownerAccount: config.ownerAccount,
          staffTimeoutMs: config.staffTimeoutMs,
        },
      ],
    });
  } catch (err) {
    // Duplicate SlipUploaded delivery → workflow already started; ignore.
    if (String(err).includes('AlreadyStarted')) return;
    throw err;
  }
}

async function signalStaff(
  client: Client,
  qrRef: string,
  decision: StaffDecision,
): Promise<void> {
  try {
    const handle = client.workflow.getHandle(`topup:${qrRef}`);
    await handle.signal(staffDecisionSignal, decision);
  } catch {
    // Workflow not running / not in manual review — nothing to signal.
  }
}

async function subscribe(
  nc: NatsConnection,
  subject: string,
  durable: string,
  handler: (e: Envelope) => Promise<void>,
): Promise<void> {
  const js = nc.jetstream();
  const opts = consumerOpts();
  opts.durable(durable);
  opts.manualAck();
  opts.ackExplicit();
  opts.deliverTo(createInbox());
  const sub = await js.subscribe(subject, opts);
  void (async () => {
    for await (const m of sub) {
      try {
        await handler(codec.decode(m.data) as Envelope);
        m.ack();
      } catch {
        m.nak();
      }
    }
  })();
}

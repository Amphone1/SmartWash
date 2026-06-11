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
import {
  deliveryEventSignal,
  deliveryOrderWorkflow,
  machineEventSignal,
  staffDecisionSignal,
  topupWorkflow,
  washOrderWorkflow,
  type MachineEventType,
  type StaffDecision,
} from './workflows';

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

  // wash_order: explicit start → workflow; machine events → signal.
  await subscribe(nc, 'smartwash.order.wash_requested.v1', 'saga-wash', async (e) => {
    const d = (e.data ?? e) as Record<string, unknown>;
    await startWash(client, String(d.orderId));
  });
  const machineEvents: Record<string, MachineEventType> = {
    'smartwash.machine.running.v1': 'running',
    'smartwash.machine.finished.v1': 'finished',
    'smartwash.machine.error.v1': 'error',
    'smartwash.machine.offline.v1': 'offline',
  };
  for (const [subject, type] of Object.entries(machineEvents)) {
    await subscribe(nc, subject, `saga-machine-${type}`, async (e) => {
      const d = (e.data ?? e) as Record<string, unknown>;
      if (d.orderId) {
        await signalMachine(client, String(d.orderId), type, d.errorCode as string);
      }
    });
  }

  // delivery_order: explicit request → workflow; delivery completion → signal.
  await subscribe(nc, 'smartwash.order.delivery_requested.v1', 'saga-delivery-req', async (e) => {
    const d = (e.data ?? e) as Record<string, unknown>;
    await startDeliveryOrder(client, d);
  });
  await subscribe(nc, 'smartwash.delivery.completed.v1', 'saga-delivery-done', async (e) => {
    const d = (e.data ?? e) as Record<string, unknown>;
    if (d.orderId) await signalDelivery(client, String(d.orderId));
  });
}

async function startDeliveryOrder(
  client: Client,
  d: Record<string, unknown>,
): Promise<void> {
  try {
    await client.workflow.start(deliveryOrderWorkflow, {
      taskQueue: config.taskQueue,
      workflowId: `delivery:${String(d.orderId)}`,
      args: [
        {
          orderId: String(d.orderId),
          pickup: (d.pickup ?? {}) as Record<string, unknown>,
          dropoff: (d.dropoff ?? {}) as Record<string, unknown>,
          deliveryTimeoutMs: config.deliveryTimeoutMs,
        },
      ],
    });
  } catch (err) {
    if (String(err).includes('AlreadyStarted')) return;
    throw err;
  }
}

async function signalDelivery(client: Client, orderId: string): Promise<void> {
  try {
    const handle = client.workflow.getHandle(`delivery:${orderId}`);
    await handle.signal(deliveryEventSignal, { type: 'completed' });
  } catch {
    // no running delivery_order workflow for this order — ignore
  }
}

async function startWash(client: Client, orderId: string): Promise<void> {
  try {
    await client.workflow.start(washOrderWorkflow, {
      taskQueue: config.taskQueue,
      workflowId: `wash:${orderId}`,
      args: [
        {
          orderId,
          startAckTimeoutMs: config.startAckTimeoutMs,
          cycleTimeoutMs: config.cycleTimeoutMs,
          refundPolicy: config.refundOnError,
        },
      ],
    });
  } catch (err) {
    if (String(err).includes('AlreadyStarted')) return;
    throw err;
  }
}

async function signalMachine(
  client: Client,
  orderId: string,
  type: MachineEventType,
  errorCode?: string,
): Promise<void> {
  try {
    const handle = client.workflow.getHandle(`wash:${orderId}`);
    await handle.signal(machineEventSignal, { type, errorCode });
  } catch {
    // no running wash workflow for this order — ignore
  }
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

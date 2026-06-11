/**
 * Event → notification mapping (pure). Only user-addressable events become
 * notifications; everything else returns null. Phase scope: record-only
 * (channel stubs) — real FCM/SMS/SMTP senders plug in behind the repo later.
 */
export interface NotificationDraft {
  userId: string;
  channel: 'push';
  type: string;
  payload: Record<string, unknown>;
}

interface Envelope {
  type?: string;
  data?: Record<string, unknown>;
  [k: string]: unknown;
}

export function mapEvent(envelope: Envelope): NotificationDraft | null {
  const data = (envelope.data ?? envelope) as Record<string, unknown>;
  const userId = typeof data.userId === 'string' ? data.userId : null;
  if (!userId) return null;

  switch (envelope.type) {
    case 'smartwash.payment.approved.v1':
      return draft(userId, 'topup_approved', {
        amount: data.amount,
        qrRef: data.qrRef,
      });
    case 'smartwash.payment.rejected.v1':
      return draft(userId, 'topup_rejected', {
        reason: data.reason,
        qrRef: data.qrRef,
      });
    case 'smartwash.order.completed.v1':
      return draft(userId, 'order_completed', { orderId: data.orderId });
    case 'smartwash.order.refunded.v1':
      return draft(userId, 'order_refunded', { orderId: data.orderId });
    case 'smartwash.delivery.assigned.v1':
      // customer-facing "driver assigned" needs the order's user — only emit
      // when the event already carries it.
      return draft(userId, 'delivery_assigned', {
        deliveryId: data.deliveryId,
        orderId: data.orderId,
      });
    default:
      return null;
  }
}

function draft(
  userId: string,
  type: string,
  payload: Record<string, unknown>,
): NotificationDraft {
  return { userId, channel: 'push', type, payload };
}

/** Subjects this service consumes (one durable consumer each). */
export const SUBSCRIBED_SUBJECTS = [
  'smartwash.payment.approved.v1',
  'smartwash.payment.rejected.v1',
  'smartwash.order.completed.v1',
  'smartwash.order.refunded.v1',
  'smartwash.delivery.assigned.v1',
] as const;

import { mapEvent } from './mapping';

const USER = '44444444-4444-4444-8444-444444444444';

function env(type: string, data: Record<string, unknown>) {
  return { type, data };
}

describe('notification mapEvent', () => {
  it('maps payment approved/rejected', () => {
    expect(
      mapEvent(env('smartwash.payment.approved.v1', { userId: USER, amount: 50000, qrRef: 'QR-1' })),
    ).toEqual({
      userId: USER,
      channel: 'push',
      type: 'topup_approved',
      payload: { amount: 50000, qrRef: 'QR-1' },
    });
    expect(
      mapEvent(env('smartwash.payment.rejected.v1', { userId: USER, reason: 'duplicate', qrRef: 'QR-1' }))?.type,
    ).toBe('topup_rejected');
  });

  it('maps order completed/refunded', () => {
    expect(mapEvent(env('smartwash.order.completed.v1', { userId: USER, orderId: 'o1' }))?.type).toBe('order_completed');
    expect(mapEvent(env('smartwash.order.refunded.v1', { userId: USER, orderId: 'o1' }))?.type).toBe('order_refunded');
  });

  it('ignores events without a userId', () => {
    expect(mapEvent(env('smartwash.payment.approved.v1', { amount: 1 }))).toBeNull();
  });

  it('ignores unmapped event types', () => {
    expect(mapEvent(env('smartwash.machine.running.v1', { userId: USER }))).toBeNull();
  });
});

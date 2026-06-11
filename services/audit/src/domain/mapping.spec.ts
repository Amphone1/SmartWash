import { mapEventToAudit } from './mapping';

const ORDER = '11111111-1111-4111-8111-111111111111';
const USER = '44444444-4444-4444-8444-444444444444';

describe('audit mapEventToAudit', () => {
  it('maps a domain event to a system audit row', () => {
    const row = mapEventToAudit({
      type: 'smartwash.order.completed.v1',
      data: { orderId: ORDER, userId: USER, state: 'COMPLETED' },
    });
    expect(row).toMatchObject({
      actorId: null,
      actorRole: 'system',
      action: 'smartwash.order.completed.v1',
      entityType: 'order',
      entityId: ORDER,
    });
  });

  it('prefers orderId, falls back through delivery/machine/user ids', () => {
    expect(
      mapEventToAudit({ type: 'smartwash.ledger.posted.v1', data: { userId: USER } })?.entityId,
    ).toBe(USER);
    expect(
      mapEventToAudit({ type: 'smartwash.machine.offline.v1', data: { machineId: ORDER } })?.entityId,
    ).toBe(ORDER);
  });

  it('ignores non-smartwash and untyped envelopes', () => {
    expect(mapEventToAudit({ type: 'other.event', data: {} })).toBeNull();
    expect(mapEventToAudit({ data: {} })).toBeNull();
  });

  it('non-UUID ids (e.g. qrRef) are not used as entity_id', () => {
    const row = mapEventToAudit({
      type: 'smartwash.payment.approved.v1',
      data: { qrRef: 'QR-abc', userId: USER },
    });
    expect(row?.entityId).toBe(USER);
  });
});

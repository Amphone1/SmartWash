import { Injectable } from '@nestjs/common';
import { ServicesConfig } from '../../config/services.config';
import { callService } from './service-client';

export interface Principal {
  userId: string;
  phone: string;
  name: string;
  roles: { role: string; branchId: string | null }[];
}

@Injectable()
export class AuthClient {
  constructor(private readonly cfg: ServicesConfig) {}
  introspect(token: string): Promise<Principal> {
    return callService(this.cfg.authUrl, '/auth/introspect', this.cfg.internalToken, {
      method: 'POST',
      body: { token },
    }) as Promise<Principal>;
  }
}

@Injectable()
export class RbacClient {
  constructor(private readonly cfg: ServicesConfig) {}
  async check(
    userId: string,
    permission: string,
    branchId: string | null,
  ): Promise<boolean> {
    const res = (await callService(
      this.cfg.rbacUrl,
      '/rbac/check',
      this.cfg.internalToken,
      { method: 'POST', body: { userId, permission, branchId: branchId ?? undefined } },
    )) as { allowed: boolean };
    return res.allowed;
  }
}

@Injectable()
export class OrderClient {
  constructor(private readonly cfg: ServicesConfig) {}
  create(idempotencyKey: string, body: unknown): Promise<unknown> {
    return callService(this.cfg.orderUrl, '/orders', this.cfg.internalToken, {
      method: 'POST',
      body,
      idempotencyKey,
    });
  }
  get(id: string): Promise<unknown> {
    return callService(this.cfg.orderUrl, `/orders/${id}`, this.cfg.internalToken);
  }
  listForUser(userId: string): Promise<unknown> {
    return callService(
      this.cfg.orderUrl,
      '/orders',
      this.cfg.internalToken,
      { userId },
    );
  }
  /** Explicit start-wash (triggers the wash_order saga). */
  requestWash(userId: string, id: string): Promise<unknown> {
    return callService(
      this.cfg.orderUrl,
      `/orders/${id}/request-wash`,
      this.cfg.internalToken,
      { method: 'POST', userId },
    );
  }
  /** Explicit request-delivery (triggers the delivery_order saga). */
  requestDelivery(userId: string, id: string, body: unknown): Promise<unknown> {
    return callService(
      this.cfg.orderUrl,
      `/orders/${id}/request-delivery`,
      this.cfg.internalToken,
      { method: 'POST', body, userId },
    );
  }
}

@Injectable()
export class QueueClient {
  constructor(private readonly cfg: ServicesConfig) {}
  join(idempotencyKey: string, machineId: string, userId: string): Promise<unknown> {
    return callService(
      this.cfg.queueUrl,
      `/queues/${machineId}/join`,
      this.cfg.internalToken,
      { method: 'POST', body: { userId }, idempotencyKey },
    );
  }
}

@Injectable()
export class PaymentClient {
  constructor(private readonly cfg: ServicesConfig) {}
  create(idempotencyKey: string, userId: string, body: unknown): Promise<unknown> {
    return callService(this.cfg.paymentUrl, '/payments', this.cfg.internalToken, {
      method: 'POST',
      body,
      idempotencyKey,
      userId,
    });
  }
  uploadSlip(
    idempotencyKey: string,
    userId: string,
    qrRef: string,
    body: unknown,
  ): Promise<unknown> {
    return callService(
      this.cfg.paymentUrl,
      `/payments/${qrRef}/slip`,
      this.cfg.internalToken,
      { method: 'POST', body, idempotencyKey, userId },
    );
  }
  getStatus(userId: string, qrRef: string): Promise<unknown> {
    return callService(
      this.cfg.paymentUrl,
      `/payments/${qrRef}`,
      this.cfg.internalToken,
      { userId },
    );
  }
  listSlips(userId: string, branchId: string, status?: string): Promise<unknown> {
    const qs = new URLSearchParams({ branchId, ...(status ? { status } : {}) });
    return callService(
      this.cfg.paymentUrl,
      `/internal/slips?${qs.toString()}`,
      this.cfg.internalToken,
      { userId },
    );
  }
  /** Admin-global review queue: no branchId → all branches incl. topup slips. */
  listSlipsAll(userId: string, status?: string): Promise<unknown> {
    const qs = status ? `?${new URLSearchParams({ status }).toString()}` : '';
    return callService(
      this.cfg.paymentUrl,
      `/internal/slips${qs}`,
      this.cfg.internalToken,
      { userId },
    );
  }
  // Manual review reuses the existing saga-wired endpoint, keyed by qrRef:
  // staff-decision → payment.approved/rejected event → topup saga → ledger TOPUP.
  approveSlip(idempotencyKey: string, userId: string, qrRef: string): Promise<unknown> {
    return callService(
      this.cfg.paymentUrl,
      `/internal/payments/${encodeURIComponent(qrRef)}/staff-decision`,
      this.cfg.internalToken,
      { method: 'POST', body: { decision: 'approve' }, idempotencyKey, userId },
    );
  }
  rejectSlip(
    idempotencyKey: string,
    userId: string,
    qrRef: string,
    _reason: string,
  ): Promise<unknown> {
    return callService(
      this.cfg.paymentUrl,
      `/internal/payments/${encodeURIComponent(qrRef)}/staff-decision`,
      this.cfg.internalToken,
      { method: 'POST', body: { decision: 'reject' }, idempotencyKey, userId },
    );
  }
}

@Injectable()
export class WalletClient {
  constructor(private readonly cfg: ServicesConfig) {}
  get(userId: string): Promise<unknown> {
    return callService(
      this.cfg.walletUrl,
      `/wallets/${userId}`,
      this.cfg.internalToken,
      { userId },
    );
  }
}

@Injectable()
export class DeliveryClient {
  constructor(private readonly cfg: ServicesConfig) {}
  get(id: string): Promise<unknown> {
    return callService(this.cfg.deliveryUrl, `/deliveries/${id}`, this.cfg.internalToken);
  }
  listForDriver(userId: string, driverId: string): Promise<unknown> {
    return callService(
      this.cfg.deliveryUrl,
      `/drivers/${driverId}/deliveries`,
      this.cfg.internalToken,
      { userId },
    );
  }
  accept(userId: string, id: string, driverId: string): Promise<unknown> {
    return this.action(userId, id, 'accept', { driverId });
  }
  reject(userId: string, id: string, driverId: string): Promise<unknown> {
    return this.action(userId, id, 'reject', { driverId });
  }
  advance(userId: string, id: string, driverId: string, to: string): Promise<unknown> {
    return this.action(userId, id, 'advance', { driverId, to });
  }
  complete(userId: string, id: string): Promise<unknown> {
    return callService(
      this.cfg.deliveryUrl,
      `/deliveries/${id}/complete`,
      this.cfg.internalToken,
      { method: 'POST', userId },
    );
  }
  getDetail(id: string): Promise<unknown> {
    return callService(this.cfg.deliveryUrl, `/deliveries/${id}`, this.cfg.internalToken);
  }
  private action(userId: string, id: string, verb: string, body: unknown): Promise<unknown> {
    return callService(
      this.cfg.deliveryUrl,
      `/deliveries/${id}/${verb}`,
      this.cfg.internalToken,
      { method: 'POST', body, userId },
    );
  }
}

@Injectable()
export class GpsClient {
  constructor(private readonly cfg: ServicesConfig) {}
  report(userId: string, driverId: string, lat: number, lng: number): Promise<unknown> {
    return callService(this.cfg.gpsUrl, '/gps/locations', this.cfg.internalToken, {
      method: 'POST',
      body: { driverId, lat, lng },
      userId,
    });
  }
  last(driverId: string): Promise<unknown> {
    return callService(
      this.cfg.gpsUrl,
      `/gps/drivers/${driverId}/last`,
      this.cfg.internalToken,
    );
  }
}

@Injectable()
export class NotificationClient {
  constructor(private readonly cfg: ServicesConfig) {}
  listForUser(userId: string, limit?: number): Promise<unknown> {
    const qs = limit != null ? `?limit=${limit}` : '';
    return callService(
      this.cfg.notificationUrl,
      `/notifications/users/${userId}${qs}`,
      this.cfg.internalToken,
      { userId },
    );
  }
  markAllRead(userId: string): Promise<unknown> {
    return callService(
      this.cfg.notificationUrl,
      `/notifications/users/${userId}/read-all`,
      this.cfg.internalToken,
      { method: 'POST', userId },
    );
  }
}

@Injectable()
export class AuditClient {
  constructor(private readonly cfg: ServicesConfig) {}
  list(userId: string, entityId?: string, limit?: number): Promise<unknown> {
    const params = new URLSearchParams();
    if (entityId != null) params.set('entityId', entityId);
    if (limit != null) params.set('limit', String(limit));
    const qs = params.size > 0 ? `?${params.toString()}` : '';
    return callService(this.cfg.auditUrl, `/audit${qs}`, this.cfg.internalToken, {
      userId,
    });
  }
}

@Injectable()
export class SettlementClient {
  constructor(private readonly cfg: ServicesConfig) {}
  run(userId: string, branchId: string, date: string): Promise<unknown> {
    return callService(
      this.cfg.settlementUrl,
      '/internal/settlements/run',
      this.cfg.internalToken,
      { method: 'POST', body: { branchId, date }, userId },
    );
  }
  list(userId: string, branchId: string): Promise<unknown> {
    return callService(
      this.cfg.settlementUrl,
      `/settlements?branchId=${encodeURIComponent(branchId)}`,
      this.cfg.internalToken,
      { userId },
    );
  }
}

@Injectable()
export class AddressesClient {
  constructor(private readonly cfg: ServicesConfig) {}
  list(userId: string): Promise<unknown> {
    return callService(
      this.cfg.deliveryUrl,
      `/users/${userId}/addresses`,
      this.cfg.internalToken,
      { userId },
    );
  }
  create(userId: string, body: unknown): Promise<unknown> {
    return callService(
      this.cfg.deliveryUrl,
      `/users/${userId}/addresses`,
      this.cfg.internalToken,
      { method: 'POST', body, userId },
    );
  }
  remove(userId: string, id: string): Promise<unknown> {
    return callService(
      this.cfg.deliveryUrl,
      `/users/${userId}/addresses/${id}`,
      this.cfg.internalToken,
      { method: 'DELETE', userId },
    );
  }
}

@Injectable()
export class RatingsClient {
  constructor(private readonly cfg: ServicesConfig) {}
  submit(idempotencyKey: string, userId: string, body: unknown): Promise<unknown> {
    return callService(this.cfg.orderUrl, '/ratings', this.cfg.internalToken, {
      method: 'POST',
      body,
      idempotencyKey,
      userId,
    });
  }
}

@Injectable()
export class ReconciliationClient {
  constructor(private readonly cfg: ServicesConfig) {}
  run(userId: string, body: unknown): Promise<unknown> {
    return callService(
      this.cfg.reconciliationUrl,
      '/internal/reconciliation/run',
      this.cfg.internalToken,
      { method: 'POST', body, userId },
    );
  }
}

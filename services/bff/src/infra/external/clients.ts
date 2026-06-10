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
  /** Explicit start-wash (triggers the wash_order saga). */
  requestWash(userId: string, id: string): Promise<unknown> {
    return callService(
      this.cfg.orderUrl,
      `/orders/${id}/request-wash`,
      this.cfg.internalToken,
      { method: 'POST', userId },
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

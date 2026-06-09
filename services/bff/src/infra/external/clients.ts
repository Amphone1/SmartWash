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

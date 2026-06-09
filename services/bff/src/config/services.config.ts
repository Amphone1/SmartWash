import { Injectable } from '@nestjs/common';
import { optionalEnv, requireEnv } from '@smartwash/nestkit';

/** Downstream service base URLs + the shared internal token. */
@Injectable()
export class ServicesConfig {
  readonly authUrl = optionalEnv('AUTH_URL', 'http://auth:3001');
  readonly rbacUrl = optionalEnv('RBAC_URL', 'http://rbac:3002');
  readonly orderUrl = optionalEnv('ORDER_URL', 'http://order:3003');
  readonly queueUrl = optionalEnv('QUEUE_URL', 'http://queue:3004');

  /** Fail fast if the internal token is missing — downstream calls need it. */
  get internalToken(): string {
    return requireEnv('INTERNAL_SERVICE_TOKEN');
  }
}

import { Injectable } from '@nestjs/common';
import { optionalEnv, requireEnv } from '@smartwash/nestkit';

/** Downstream service base URLs + the shared internal token. */
@Injectable()
export class ServicesConfig {
  readonly authUrl = optionalEnv('AUTH_URL', 'http://auth:3001');
  readonly rbacUrl = optionalEnv('RBAC_URL', 'http://rbac:3002');
  readonly orderUrl = optionalEnv('ORDER_URL', 'http://order:3003');
  readonly queueUrl = optionalEnv('QUEUE_URL', 'http://queue:3004');
  readonly walletUrl = optionalEnv('WALLET_URL', 'http://wallet:3006');
  readonly ledgerUrl = optionalEnv('LEDGER_URL', 'http://ledger:3007');
  readonly paymentUrl = optionalEnv('PAYMENT_URL', 'http://payment:3009');
  readonly deliveryUrl = optionalEnv('DELIVERY_URL', 'http://delivery:3012');
  readonly gpsUrl = optionalEnv('GPS_URL', 'http://gps:3013');
  readonly settlementUrl = optionalEnv('SETTLEMENT_URL', 'http://settlement:3014');
  readonly reconciliationUrl = optionalEnv(
    'RECONCILIATION_URL',
    'http://reconciliation:3015',
  );

  /** Fail fast if the internal token is missing — downstream calls need it. */
  get internalToken(): string {
    return requireEnv('INTERNAL_SERVICE_TOKEN');
  }
}

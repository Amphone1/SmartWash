/**
 * A7 wallet-projection metrics on the shared nestkit registry.
 */
import { Counter, Gauge, Histogram } from 'prom-client';
import { registry } from '@smartwash/nestkit';

export const walletProjectionAppliedTotal = new Counter({
  name: 'wallet_projection_applied_total',
  help: 'posted.v2 transactions applied to wallet_balances',
  registers: [registry],
});

export const walletL1DriftTotal = new Counter({
  name: 'wallet_l1_drift_total',
  help: 'Wallet L1 reconcile mismatches',
  labelNames: ['kind'] as const, // internal (vs ledger postings) | legacy (vs legacy wallet)
  registers: [registry],
});

export const walletL1DriftKip = new Histogram({
  name: 'wallet_l1_drift_kip',
  help: 'Magnitude of wallet L1 drift (absolute kip)',
  labelNames: ['kind'] as const,
  buckets: [1, 10, 100, 1000, 10000, 100000, 1000000],
  registers: [registry],
});

export const walletReconcileUsers = new Gauge({
  name: 'wallet_reconcile_users',
  help: 'Users checked in the last L1 reconcile run',
  registers: [registry],
});

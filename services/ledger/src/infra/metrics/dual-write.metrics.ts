/**
 * A5 dual-write / shadow-reconcile Prometheus metrics, on the shared nestkit
 * registry (scraped at /metrics). Alert rules: infra/observability/alerts/ledger-dual-write.rules.yml.
 */
import { Counter, Histogram } from 'prom-client';
import { registry } from '@smartwash/nestkit';

export const dualWriteTotal = new Counter({
  name: 'ledger_dual_write_total',
  help: 'Dual-write mirror attempts',
  labelNames: ['flow', 'result'] as const,
  registers: [registry],
});

export const dualWriteErrorTotal = new Counter({
  name: 'ledger_dual_write_error_total',
  help: 'Dual-write mirror errors (fail-open skips; never affects the legacy write)',
  labelNames: ['flow', 'reason'] as const,
  registers: [registry],
});

export const shadowDriftTotal = new Counter({
  name: 'ledger_shadow_drift_total',
  help: 'Shadow reconcile balance mismatches (new current != legacy balance)',
  labelNames: ['flow'] as const,
  registers: [registry],
});

export const shadowDriftKip = new Histogram({
  name: 'ledger_shadow_drift_kip',
  help: 'Magnitude of shadow drift (absolute kip)',
  labelNames: ['flow'] as const,
  buckets: [1, 10, 100, 1000, 10000, 100000, 1000000],
  registers: [registry],
});

export const dualWriteLatency = new Histogram({
  name: 'ledger_dual_write_latency_seconds',
  help: 'Added latency of the dual-write mirror',
  labelNames: ['flow'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [registry],
});

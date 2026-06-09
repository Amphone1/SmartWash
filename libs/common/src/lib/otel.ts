/**
 * OpenTelemetry bootstrap (rule #7). Each service calls `startTelemetry()` once
 * at process start (before importing instrumented libs) to export traces over
 * OTLP/HTTP to Tempo. `correlation-id` is propagated via standard W3C trace
 * context headers, which the auto-instrumentations attach to every outgoing
 * HTTP / NATS / pg call.
 *
 * Kept lazy and defensive: if the OTLP endpoint is unset we still start with a
 * no-op exporter so nothing crashes in tests or local runs without Tempo.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

export interface TelemetryHandle {
  shutdown(): Promise<void>;
}

let started: NodeSDK | undefined;

export function startTelemetry(
  serviceName: string,
  serviceVersion = '0.0.0',
): TelemetryHandle {
  if (started) {
    return { shutdown: () => started!.shutdown() };
  }

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
    }),
    traceExporter: endpoint
      ? new OTLPTraceExporter({ url: `${endpoint}/v1/traces` })
      : undefined,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
  started = sdk;

  const shutdown = async (): Promise<void> => {
    await started?.shutdown();
    started = undefined;
  };

  process.once('SIGTERM', () => void shutdown());
  return { shutdown };
}

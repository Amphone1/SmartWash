/**
 * Correlation-id propagation (rule #7). A per-request id flows through every
 * hop and is attached to logs and outbound calls. Stored in AsyncLocalStorage
 * so any layer can read it without threading it through signatures.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_HEADER = 'correlation-id';

interface Store {
  correlationId: string;
}

const als = new AsyncLocalStorage<Store>();

export function getCorrelationId(): string | undefined {
  return als.getStore()?.correlationId;
}

export function runWithCorrelation<T>(correlationId: string, fn: () => T): T {
  return als.run({ correlationId }, fn);
}

/** Express middleware: reuse an incoming correlation-id or mint a new one. */
export function correlationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.header(CORRELATION_HEADER);
  const correlationId = incoming && incoming.length > 0 ? incoming : randomUUID();
  res.setHeader(CORRELATION_HEADER, correlationId);
  runWithCorrelation(correlationId, () => next());
}

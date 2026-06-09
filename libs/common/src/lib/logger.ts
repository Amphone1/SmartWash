/**
 * Minimal structured (JSON) logger. Dependency-free so every service and CLI
 * script can use it without pulling a logging framework. Emits one JSON object
 * per line (Loki-friendly) and always carries `correlationId` when present so a
 * request can be traced across hops (rule #7).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LogContext {
  correlationId?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, ctx?: LogContext): void;
  info(message: string, ctx?: LogContext): void;
  warn(message: string, ctx?: LogContext): void;
  error(message: string, ctx?: LogContext): void;
  child(bindings: LogContext): Logger;
}

function envLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return (['debug', 'info', 'warn', 'error'] as const).includes(raw as LogLevel)
    ? (raw as LogLevel)
    : 'info';
}

export function createLogger(
  service: string,
  base: LogContext = {},
): Logger {
  const threshold = LEVEL_ORDER[envLevel()];

  function emit(level: LogLevel, message: string, ctx?: LogContext): void {
    if (LEVEL_ORDER[level] < threshold) return;
    const line = {
      ts: new Date().toISOString(),
      level,
      service,
      msg: message,
      ...base,
      ...ctx,
    };
    const sink = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
    sink.write(`${JSON.stringify(serializeBigints(line))}\n`);
  }

  return {
    debug: (m, c) => emit('debug', m, c),
    info: (m, c) => emit('info', m, c),
    warn: (m, c) => emit('warn', m, c),
    error: (m, c) => emit('error', m, c),
    child: (bindings) => createLogger(service, { ...base, ...bindings }),
  };
}

function serializeBigints(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'bigint' ? v.toString() : v;
  }
  return out;
}

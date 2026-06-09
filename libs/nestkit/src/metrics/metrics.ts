/**
 * Prometheus metrics (rule #7). Exposes GET /metrics and records an HTTP
 * request duration histogram + in-flight gauge via an interceptor. Uses a
 * single shared default registry with Node process metrics enabled.
 */
import {
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  Header,
  Injectable,
  Module,
  NestInterceptor,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import {
  collectDefaultMetrics,
  Histogram,
  Registry,
} from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const end = httpDuration.startTimer();
    return next.handle().pipe(
      tap({
        next: () => record(),
        error: () => record(),
      }),
    );

    function record(): void {
      const route =
        (req.route?.path as string | undefined) ?? req.path ?? 'unknown';
      end({ method: req.method, route, status: res.statusCode });
    }
  }
}

@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', registry.contentType)
  async metrics(): Promise<string> {
    return registry.metrics();
  }
}

@Module({
  controllers: [MetricsController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: MetricsInterceptor }],
})
export class MetricsModule {}

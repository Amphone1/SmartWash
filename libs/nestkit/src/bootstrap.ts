/**
 * Shared service bootstrap. Every NestJS service calls `bootstrapService` from
 * its main.ts to get identical wiring: OTel started first (rule #7), correlation
 * middleware, strict DTO validation, the domain-error filter, and a listen port.
 */
import 'reflect-metadata';
import { INestApplication, ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { startTelemetry } from '@smartwash/common';
import { correlationMiddleware } from './correlation/correlation';
import { DomainExceptionFilter } from './errors/domain-exception.filter';
import { intEnv } from './config/env';

export interface BootstrapOptions {
  serviceName: string;
  defaultPort: number;
  version?: string;
}

export async function bootstrapService(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appModule: any,
  options: BootstrapOptions,
): Promise<INestApplication> {
  startTelemetry(options.serviceName, options.version ?? '0.0.0');

  const app = await NestFactory.create(appModule, { bufferLogs: false });
  app.use(correlationMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new DomainExceptionFilter());
  app.enableShutdownHooks();

  const port = intEnv('PORT', options.defaultPort);
  await app.listen(port);
  new Logger(options.serviceName).log(`listening on :${port}`);
  return app;
}

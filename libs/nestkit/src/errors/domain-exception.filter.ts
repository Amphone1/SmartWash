/**
 * Maps our DomainError taxonomy (and unexpected errors) to clean HTTP
 * responses, tagging each with the current correlation-id (rule #7).
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { isDomainError } from '@smartwash/common';
import { getCorrelationId } from '../correlation/correlation';

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('DomainExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const correlationId = getCorrelationId() ?? null;

    if (isDomainError(exception)) {
      res.status(exception.status).json({
        code: exception.code,
        message: exception.message,
        details: exception.details ?? undefined,
        correlationId,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json(
        typeof body === 'string'
          ? { code: 'http_error', message: body, correlationId }
          : { ...(body as object), correlationId },
      );
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.stack ?? exception.message : exception,
    );
    res.status(500).json({
      code: 'internal_error',
      message: 'internal server error',
      correlationId,
    });
  }
}

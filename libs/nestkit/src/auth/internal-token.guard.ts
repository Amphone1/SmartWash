/**
 * Guards internal-only endpoints (e.g. /auth/introspect, /rbac/check) with a
 * shared secret in addition to network isolation. The caller must send
 *   X-Internal-Token: <INTERNAL_SERVICE_TOKEN>
 * Comparison is constant-time. Fails CLOSED: if the secret is not configured,
 * every request is rejected (never accidentally open).
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { UnauthorizedError } from '@smartwash/common';

export const INTERNAL_TOKEN_HEADER = 'x-internal-token';

@Injectable()
export class InternalTokenGuard implements CanActivate {
  private readonly logger = new Logger('InternalTokenGuard');

  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.INTERNAL_SERVICE_TOKEN;
    if (!expected) {
      this.logger.error('INTERNAL_SERVICE_TOKEN not configured — denying');
      throw new UnauthorizedError('internal auth not configured');
    }
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.header(INTERNAL_TOKEN_HEADER) ?? '';
    if (!constantTimeEqual(provided, expected)) {
      throw new UnauthorizedError('invalid internal token');
    }
    return true;
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

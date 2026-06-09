/**
 * Authenticates a request from its `Authorization: Bearer <token>` header and
 * attaches the resolved principal to `req.user`. Used by the Auth service's own
 * protected routes (e.g. /auth/me).
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { UnauthorizedError } from '@smartwash/common';
import { AuthService } from '../application/auth.service';
import type { AuthenticatedUser } from '../domain/identity';

export interface AuthedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = extractBearer(req.header('authorization'));
    if (!token) {
      throw new UnauthorizedError('missing bearer token');
    }
    req.user = await this.auth.authenticate(token);
    return true;
  }
}

export function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim();
}

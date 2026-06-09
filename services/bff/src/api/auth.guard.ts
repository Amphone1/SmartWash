/**
 * Public-edge authentication. Extracts the bearer token and resolves it to a
 * principal via the Auth service (/auth/introspect). Attaches req.principal.
 */
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { UnauthorizedError } from '@smartwash/common';
import { AuthClient, type Principal } from '../infra/external/clients';

export interface AuthedRequest extends Request {
  principal?: Principal;
}

@Injectable()
export class BffAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = extractBearer(req.header('authorization'));
    if (!token) throw new UnauthorizedError('missing bearer token');
    req.principal = await this.auth.introspect(token);
    return true;
  }
}

export function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim();
}

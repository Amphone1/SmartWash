/**
 * Independent RBAC re-check for internal services (rule #8 — defense in depth).
 * The BFF forwards the authenticated user id as `X-User-Id`; the service then
 * asks the RBAC service itself whether that user holds the required permission.
 * It never trusts a permission decision made upstream.
 *
 * Use alongside InternalTokenGuard (network trust) on money-touching routes.
 */
import {
  CanActivate,
  ExecutionContext,
  Global,
  Injectable,
  Module,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError, UnauthorizedError } from '@smartwash/common';
import type { Request } from 'express';
import { optionalEnv, requireEnv } from '../config/env';
import {
  CORRELATION_HEADER,
  getCorrelationId,
} from '../correlation/correlation';
import { INTERNAL_TOKEN_HEADER } from './internal-token.guard';

export const USER_ID_HEADER = 'x-user-id';
export const PERMISSION_KEY = 'required_permission';
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);

@Injectable()
export class RbacClient {
  private readonly rbacUrl = optionalEnv('RBAC_URL', 'http://rbac:3002');

  async check(
    userId: string,
    permission: string,
    branchId: string | null,
  ): Promise<boolean> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      [INTERNAL_TOKEN_HEADER]: requireEnv('INTERNAL_SERVICE_TOKEN'),
    };
    const cid = getCorrelationId();
    if (cid) headers[CORRELATION_HEADER] = cid;

    const res = await fetch(`${this.rbacUrl}/rbac/check`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, permission, branchId: branchId ?? undefined }),
    });
    if (!res.ok) throw new ForbiddenError('rbac check failed');
    const body = (await res.json()) as { allowed: boolean };
    return body.allowed;
  }
}

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<string | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const userId = req.header(USER_ID_HEADER);
    if (!userId) throw new UnauthorizedError('missing user identity');

    const branchId = resolveBranchId(req);
    const allowed = await this.rbac.check(userId, permission, branchId);
    if (!allowed) throw new ForbiddenError(`missing permission ${permission}`);
    return true;
  }
}

function resolveBranchId(req: Request): string | null {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return (
    (body.branchId as string | undefined) ??
    (req.params?.branchId as string | undefined) ??
    (req.query?.branchId as string | undefined) ??
    null
  );
}

@Global()
@Module({
  providers: [RbacClient, RbacGuard],
  exports: [RbacClient, RbacGuard],
})
export class RbacModule {}

/**
 * Gateway-side RBAC enforcement (rule #8 — services re-check too). Reads the
 * @RequirePermission metadata, resolves the branch context from the request,
 * and asks the RBAC service. Must run after BffAuthGuard (needs req.principal).
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError, UnauthorizedError } from '@smartwash/common';
import { RbacClient } from '../infra/external/clients';
import type { AuthedRequest } from './auth.guard';

export const PERMISSION_KEY = 'required_permission';
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<string | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) return true; // no permission required

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const principal = req.principal;
    if (!principal) throw new UnauthorizedError('not authenticated');

    const branchId = resolveBranchId(req);
    const allowed = await this.rbac.check(principal.userId, permission, branchId);
    if (!allowed) {
      throw new ForbiddenError(`missing permission ${permission}`);
    }
    return true;
  }
}

/** Best-effort branch context from body, params, or query. */
function resolveBranchId(req: AuthedRequest): string | null {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return (
    (body.branchId as string | undefined) ??
    (req.params?.branchId as string | undefined) ??
    (req.query?.branchId as string | undefined) ??
    null
  );
}

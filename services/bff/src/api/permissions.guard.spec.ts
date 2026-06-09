import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { extractBearer } from './auth.guard';

function ctx(_handlerMeta: string | undefined, req: unknown) {
  return {
    getHandler: () => 'h',
    getClass: () => 'c',
    switchToHttp: () => ({ getRequest: () => req }),
  } as never;
}

describe('extractBearer', () => {
  it('parses bearer tokens and rejects junk', () => {
    expect(extractBearer('Bearer t.o.k')).toBe('t.o.k');
    expect(extractBearer('Basic x')).toBeNull();
    expect(extractBearer(undefined)).toBeNull();
  });
});

describe('PermissionsGuard', () => {
  function makeGuard(meta: string | undefined, allowed: boolean) {
    const reflector = {
      getAllAndOverride: () => meta,
    } as unknown as Reflector;
    const rbac = { check: jest.fn(async () => allowed) };
    const guard = new PermissionsGuard(reflector, rbac as never);
    return { guard, rbac };
  }

  it('allows when no permission metadata is set', async () => {
    const { guard } = makeGuard(undefined, false);
    await expect(guard.canActivate(ctx(undefined, {}))).resolves.toBe(true);
  });

  it('401s when authenticated principal is missing', async () => {
    const { guard } = makeGuard('order.create', true);
    await expect(
      guard.canActivate(ctx('order.create', { body: {} })),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('allows when RBAC grants the permission (with branch context)', async () => {
    const { guard, rbac } = makeGuard('order.create', true);
    const req = { principal: { userId: 'u1' }, body: { branchId: 'b1' } };
    await expect(guard.canActivate(ctx('order.create', req))).resolves.toBe(true);
    expect(rbac.check).toHaveBeenCalledWith('u1', 'order.create', 'b1');
  });

  it('403s when RBAC denies', async () => {
    const { guard } = makeGuard('order.create', false);
    const req = { principal: { userId: 'u1' }, body: {} };
    await expect(
      guard.canActivate(ctx('order.create', req)),
    ).rejects.toMatchObject({ status: 403 });
  });
});

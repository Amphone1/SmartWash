import { AuthService } from './auth.service';
import type { TokenVerifier, UserDirectory, DirectoryUser } from '../domain/ports';
import type { VerifiedToken } from '../domain/identity';

const verified: VerifiedToken = {
  subject: 'kc-sub-1',
  phone: '+8562012345678',
  name: 'Somchai',
  realmRoles: ['customer'],
};

const activeUser: DirectoryUser = {
  id: 'user-uuid-1',
  phone: '+8562012345678',
  name: 'Somchai',
  status: 'active',
  roles: [{ role: 'customer', branchId: null }],
};

function makeService(opts: {
  verify?: () => Promise<VerifiedToken>;
  find?: () => Promise<DirectoryUser | null>;
}): AuthService {
  const verifier: TokenVerifier = {
    verify: opts.verify ?? (async () => verified),
  };
  const directory: UserDirectory = {
    findByPhone: opts.find ?? (async () => activeUser),
  };
  return new AuthService(verifier, directory);
}

describe('AuthService.authenticate', () => {
  it('returns the principal with DB roles for a valid token', async () => {
    const svc = makeService({});
    const user = await svc.authenticate('good.token');
    expect(user).toEqual({
      userId: 'user-uuid-1',
      phone: '+8562012345678',
      name: 'Somchai',
      roles: [{ role: 'customer', branchId: null }],
    });
  });

  it('rejects when token verification fails (401)', async () => {
    const svc = makeService({
      verify: async () => {
        throw new Error('bad signature');
      },
    });
    await expect(svc.authenticate('bad')).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    });
  });

  it('rejects when no local account exists (401)', async () => {
    const svc = makeService({ find: async () => null });
    await expect(svc.authenticate('good')).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    });
  });

  it('forbids a suspended account (403)', async () => {
    const svc = makeService({
      find: async () => ({ ...activeUser, status: 'suspended' }),
    });
    await expect(svc.authenticate('good')).rejects.toMatchObject({
      code: 'forbidden',
      status: 403,
    });
  });

  it('does not trust realm roles for authorization (uses DB roles)', async () => {
    // Token claims admin, but DB only grants customer — principal must reflect DB.
    const svc = makeService({
      verify: async () => ({ ...verified, realmRoles: ['admin'] }),
    });
    const user = await svc.authenticate('good');
    expect(user.roles).toEqual([{ role: 'customer', branchId: null }]);
  });
});

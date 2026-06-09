import { decide, effectivePermissions, type RoleAssignment } from './policy';

const BRANCH_A = '11111111-1111-4111-8111-111111111111';
const BRANCH_B = '22222222-2222-4222-8222-222222222222';

const customerGlobal: RoleAssignment = {
  role: 'customer',
  branchId: null,
  permissions: ['order.create', 'wallet.view'],
};
const staffBranchA: RoleAssignment = {
  role: 'staff',
  branchId: BRANCH_A,
  permissions: ['slip.approve', 'machine.maintenance'],
};
const adminGlobal: RoleAssignment = {
  role: 'admin',
  branchId: null,
  permissions: ['order.refund', 'slip.approve', 'machine.maintenance'],
};

describe('RBAC decision logic', () => {
  it('denies when the user has no roles', () => {
    expect(decide([], 'order.create', null)).toEqual({
      allowed: false,
      reason: 'user has no roles',
    });
  });

  it('grants a global permission regardless of branch context', () => {
    expect(decide([customerGlobal], 'order.create', BRANCH_A).allowed).toBe(true);
    expect(decide([customerGlobal], 'order.create', null).allowed).toBe(true);
  });

  it('grants a branch-scoped permission only in the matching branch', () => {
    expect(decide([staffBranchA], 'slip.approve', BRANCH_A).allowed).toBe(true);
    expect(decide([staffBranchA], 'slip.approve', BRANCH_B).allowed).toBe(false);
  });

  it('does not grant a branch-scoped permission without a branch context', () => {
    expect(decide([staffBranchA], 'slip.approve', null).allowed).toBe(false);
  });

  it('admin (global) is allowed across branches for granted permissions', () => {
    expect(decide([adminGlobal], 'order.refund', BRANCH_B).allowed).toBe(true);
  });

  it('unions permissions from applicable assignments only', () => {
    const eff = effectivePermissions([customerGlobal, staffBranchA], BRANCH_B);
    // staffBranchA does not apply in branch B; only the global customer perms do.
    expect([...eff].sort()).toEqual(['order.create', 'wallet.view']);
  });

  it('includes scoped perms when the branch matches', () => {
    const eff = effectivePermissions([customerGlobal, staffBranchA], BRANCH_A);
    expect([...eff].sort()).toEqual([
      'machine.maintenance',
      'order.create',
      'slip.approve',
      'wallet.view',
    ]);
  });
});

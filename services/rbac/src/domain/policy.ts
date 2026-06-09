/**
 * RBAC domain — pure authorization logic (no I/O, fully unit-testable).
 *
 * A user holds role assignments. Each assignment is either:
 *   • GLOBAL  (branchId === null) — applies everywhere (e.g. admin), OR
 *   • SCOPED  (branchId === '<uuid>') — applies only to that branch.
 *
 * When checking a permission for a branch context:
 *   • global assignments always contribute their permissions;
 *   • scoped assignments contribute only if their branch matches the context.
 *
 * If no branch context is given, only global assignments contribute (a
 * branch-scoped permission cannot be granted without naming the branch).
 */

export interface RoleAssignment {
  role: string;
  branchId: string | null;
  permissions: string[];
}

export interface Decision {
  allowed: boolean;
  reason: string;
}

/** Permissions effective for the given branch context (null = global only). */
export function effectivePermissions(
  assignments: RoleAssignment[],
  branchId: string | null,
): Set<string> {
  const out = new Set<string>();
  for (const a of assignments) {
    const applies = a.branchId === null || a.branchId === branchId;
    if (applies) {
      for (const p of a.permissions) out.add(p);
    }
  }
  return out;
}

export function decide(
  assignments: RoleAssignment[],
  permission: string,
  branchId: string | null,
): Decision {
  if (assignments.length === 0) {
    return { allowed: false, reason: 'user has no roles' };
  }
  const effective = effectivePermissions(assignments, branchId);
  if (effective.has(permission)) {
    return { allowed: true, reason: 'granted' };
  }
  return {
    allowed: false,
    reason: branchId
      ? `permission ${permission} not granted for branch ${branchId}`
      : `permission ${permission} not granted globally`,
  };
}

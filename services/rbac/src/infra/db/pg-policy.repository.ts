/**
 * Postgres adapter for PolicyRepository. Joins user_roles → role_permissions →
 * permissions and groups the rows into one assignment per (role, branch).
 */
import { Injectable } from '@nestjs/common';
import { Database } from '@smartwash/nestkit';
import type { PolicyRepository } from '../../domain/ports';
import type { RoleAssignment } from '../../domain/policy';

interface Row {
  role: string;
  branch_id: string | null;
  permission: string | null;
}

@Injectable()
export class PgPolicyRepository implements PolicyRepository {
  constructor(private readonly db: Database) {}

  async getAssignments(userId: string): Promise<RoleAssignment[]> {
    const { rows } = await this.db.getPool().query<Row>(
      `SELECT r.name AS role, ur.branch_id, p.code AS permission
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         LEFT JOIN role_permissions rp ON rp.role_id = ur.role_id
         LEFT JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = $1`,
      [userId],
    );

    // Group by role + branch (branch null distinguished by the literal "global").
    const byKey = new Map<string, RoleAssignment>();
    for (const row of rows) {
      const key = `${row.role}::${row.branch_id ?? 'global'}`;
      let assignment = byKey.get(key);
      if (!assignment) {
        assignment = { role: row.role, branchId: row.branch_id, permissions: [] };
        byKey.set(key, assignment);
      }
      if (row.permission) assignment.permissions.push(row.permission);
    }
    return [...byKey.values()];
  }
}

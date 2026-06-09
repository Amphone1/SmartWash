/**
 * Postgres adapter for UserDirectory. Resolves a user by phone and loads their
 * branch-scoped roles from user_roles → roles.
 */
import { Injectable } from '@nestjs/common';
import { Database } from '@smartwash/nestkit';
import type { DirectoryUser, UserDirectory } from '../../domain/ports';
import type { RoleAssignment } from '../../domain/identity';

interface Row {
  id: string;
  phone: string;
  name: string;
  status: string;
  role: string | null;
  branch_id: string | null;
}

@Injectable()
export class PgUserDirectory implements UserDirectory {
  constructor(private readonly db: Database) {}

  async findByPhone(phone: string): Promise<DirectoryUser | null> {
    const { rows } = await this.db.getPool().query<Row>(
      `SELECT u.id, u.phone, u.name, u.status, r.name AS role, ur.branch_id
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r       ON r.id = ur.role_id
        WHERE u.phone = $1`,
      [phone],
    );
    if (rows.length === 0) return null;

    const first = rows[0];
    const roles: RoleAssignment[] = rows
      .filter((r) => r.role !== null)
      .map((r) => ({ role: r.role as string, branchId: r.branch_id }));

    return {
      id: first.id,
      phone: first.phone,
      name: first.name,
      status: first.status,
      roles,
    };
  }
}

import type { RoleAssignment } from './policy';

/** Loads a user's role assignments with the permissions each role grants. */
export interface PolicyRepository {
  getAssignments(userId: string): Promise<RoleAssignment[]>;
}
export const POLICY_REPOSITORY = Symbol('POLICY_REPOSITORY');

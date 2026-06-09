/**
 * RBAC use-cases. Resolves a user's role assignments (from the repository) and
 * applies the pure decision logic. Re-checked in services for defense in depth
 * (rule #8), in addition to gateway enforcement.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  decide,
  effectivePermissions,
  type Decision,
} from '../domain/policy';
import { POLICY_REPOSITORY, type PolicyRepository } from '../domain/ports';

@Injectable()
export class RbacService {
  constructor(
    @Inject(POLICY_REPOSITORY) private readonly repo: PolicyRepository,
  ) {}

  async check(
    userId: string,
    permission: string,
    branchId: string | null,
  ): Promise<Decision> {
    const assignments = await this.repo.getAssignments(userId);
    return decide(assignments, permission, branchId);
  }

  async listPermissions(
    userId: string,
    branchId: string | null,
  ): Promise<string[]> {
    const assignments = await this.repo.getAssignments(userId);
    return [...effectivePermissions(assignments, branchId)].sort();
  }
}

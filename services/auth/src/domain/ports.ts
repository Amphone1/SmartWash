/** Hexagonal ports for the Auth service. Adapters live in infra/. */
import type { RoleAssignment, VerifiedToken } from './identity';

/** Verifies a bearer token's signature/claims and returns the identity. */
export interface TokenVerifier {
  verify(token: string): Promise<VerifiedToken>;
}
export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

/** A user as known to our system, with branch-scoped roles. */
export interface DirectoryUser {
  id: string;
  phone: string;
  name: string;
  status: string; // active | suspended | banned
  roles: RoleAssignment[];
}

/** Looks up local user + roles. */
export interface UserDirectory {
  findByPhone(phone: string): Promise<DirectoryUser | null>;
}
export const USER_DIRECTORY = Symbol('USER_DIRECTORY');

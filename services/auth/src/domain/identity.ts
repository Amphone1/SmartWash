/**
 * Auth domain types.
 *
 * Design split (to be confirmed in review):
 *   • IDENTITY comes from Keycloak — the verified JWT proves *who* the caller is
 *     (subject + phone). Keycloak is the IdP / credential store.
 *   • AUTHORIZATION (roles) comes from OUR database — roles are branch-scoped
 *     (`user_roles`), which Keycloak realm roles cannot express cleanly. So the
 *     authenticated principal's roles are loaded from `user_roles`, not from the
 *     token's realm_access. This keeps RBAC decisions on data we control.
 */

/** A role the user holds, optionally scoped to a branch (NULL = global/admin). */
export interface RoleAssignment {
  role: string;
  branchId: string | null;
}

/** The principal other services act on behalf of. */
export interface AuthenticatedUser {
  userId: string; // users.id (our UUID)
  phone: string;
  name: string;
  roles: RoleAssignment[];
}

/** Result of verifying a Keycloak token (identity only). */
export interface VerifiedToken {
  subject: string; // Keycloak `sub`
  phone: string; // Keycloak `preferred_username`
  name?: string;
  realmRoles: string[]; // informational only; not used for authorization
}

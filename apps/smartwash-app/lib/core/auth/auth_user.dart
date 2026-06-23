import 'app_role.dart';

/// Decoded claims from the Keycloak JWT access token.
class AuthUser {
  const AuthUser({
    required this.sub,
    required this.name,
    required this.username,
    required this.roles,
    this.branchId,
  });

  final String sub;
  final String name;
  final String username;

  /// Mobile-relevant roles extracted from `realm_access.roles`.
  final Set<AppRole> roles;

  /// Populated for `owner` and `staff` roles (branch-scoped users).
  final String? branchId;

  bool get hasMultipleRoles => roles.length > 1;

  factory AuthUser.fromJwtClaims(Map<String, dynamic> claims) {
    final realmRoles =
        ((claims['realm_access'] as Map<String, dynamic>?)?['roles'] as List?)
                ?.cast<String>() ??
            [];

    final roles = realmRoles
        .map(AppRole.fromKeycloak)
        .whereType<AppRole>()
        .toSet();

    return AuthUser(
      sub: claims['sub'] as String? ?? '',
      name: claims['name'] as String? ??
          claims['preferred_username'] as String? ??
          '',
      username: claims['preferred_username'] as String? ?? '',
      roles: roles,
      branchId: (claims['branch_id'] ?? claims['branch-id']) as String?,
    );
  }
}

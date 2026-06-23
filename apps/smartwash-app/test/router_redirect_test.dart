import 'package:flutter_test/flutter_test.dart';
import 'package:smartwash_app/core/auth/app_role.dart';
import 'package:smartwash_app/core/auth/auth_user.dart';
import 'package:smartwash_app/providers/auth_provider.dart';
import 'package:smartwash_app/router/app_router.dart';

/// Unit tests for the router's RBAC/role redirect rules (FIX 1).
void main() {
  AuthState authed(Set<AppRole> roles) => AuthState(
        token: 'tok',
        user: AuthUser(
          sub: 'u1',
          name: 'Test',
          username: 'test',
          roles: roles,
        ),
      );

  final multiRole =
      authed({AppRole.customer, AppRole.driver, AppRole.staff});

  group('resolveRedirect', () {
    test('multi-role user can reach RoleSelectScreen after deselect', () {
      // Bug it fixes: while a role is active, /select-role used to bounce back
      // to the active shell, so the picker was unreachable.
      expect(
        resolveRedirect(
            auth: multiRole, role: AppRole.customer, path: '/select-role'),
        '/customer',
      );
      // After deselect() drops the active role, the picker is reachable.
      expect(
        resolveRedirect(auth: multiRole, role: null, path: '/select-role'),
        isNull,
      );
    });

    test('customer-active user is blocked from /staff -> /customer', () {
      expect(
        resolveRedirect(
            auth: multiRole, role: AppRole.customer, path: '/staff/machines'),
        '/customer',
      );
    });

    test('driver-active user is blocked from /customer -> /driver', () {
      expect(
        resolveRedirect(
            auth: multiRole, role: AppRole.driver, path: '/customer/home'),
        '/driver',
      );
    });

    test('staying within the active shell is allowed', () {
      expect(
        resolveRedirect(
            auth: multiRole, role: AppRole.customer, path: '/customer/orders'),
        isNull,
      );
    });

    test('unauthenticated user is sent to /login', () {
      expect(
        resolveRedirect(
            auth: const AuthState(), role: null, path: '/customer/home'),
        '/login',
      );
    });
  });
}

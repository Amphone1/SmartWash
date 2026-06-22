import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/auth/app_role.dart';
import '../providers/auth_provider.dart';
import '../providers/role_provider.dart';

import '../features/auth/login_screen.dart';
import '../features/auth/role_select_screen.dart';

import '../features/customer/customer_shell.dart';
import '../features/customer/home/home_screen.dart';
import '../features/customer/notifications/notifications_screen.dart';
import '../features/customer/orders/orders_screen.dart';
import '../features/customer/orders/order_detail_screen.dart';
import '../features/customer/orders/rating_screen.dart';
import '../features/customer/scan/scan_screen.dart';
import '../features/customer/scan/scan_result_screen.dart';
import '../features/customer/profile/profile_screen.dart';
import '../features/customer/profile/addresses_screen.dart';
import '../features/customer/topup/topup_screen.dart';
import '../features/customer/delivery/delivery_track_screen.dart';
import '../features/customer/delivery/delivery_request_screen.dart';
import '../features/customer/order_wizard/branch_picker_screen.dart';
import '../features/customer/order_wizard/machine_picker_screen.dart';
import '../features/customer/order_wizard/cycle_picker_screen.dart';
import '../features/customer/order_wizard/order_confirm_screen.dart';
import '../features/customer/topup/slip_upload_screen.dart';

import '../features/driver/driver_shell.dart';
import '../features/driver/tasks/tasks_screen.dart';
import '../features/driver/map/map_screen.dart';
import '../features/driver/earnings/earnings_screen.dart';
import '../features/driver/profile/driver_profile_screen.dart';
import '../features/driver/tasks/task_detail_screen.dart';

import '../features/staff/staff_shell.dart';
import '../features/staff/machines/machines_screen.dart';
import '../features/staff/orders/staff_orders_screen.dart';
import '../features/staff/slips/slips_screen.dart';
import '../features/staff/profile/staff_profile_screen.dart';

/// Pure redirect decision for the app router, extracted so the role/RBAC rules
/// can be unit-tested without pumping the full widget tree. Returns the path to
/// redirect to, or null to stay. Behaviour is identical to the inline guards
/// the [routerProvider] redirect delegates to.
String? resolveRedirect({
  required AuthState auth,
  required AppRole? role,
  required String path,
}) {
  if (auth.isLoading) return null;

  if (!auth.isAuthenticated) {
    return path == '/login' ? null : '/login';
  }

  final user = auth.user!;
  if (user.roles.isEmpty) return '/login';

  if (user.hasMultipleRoles && role == null) {
    return path == '/select-role' ? null : '/select-role';
  }

  final activeRole = role ?? user.roles.first;
  final home = switch (activeRole) {
    AppRole.customer => '/customer',
    AppRole.driver => '/driver',
    AppRole.staff => '/staff',
  };

  if (path.startsWith('/customer') && activeRole == AppRole.customer) return null;
  if (path.startsWith('/driver') && activeRole == AppRole.driver) return null;
  if (path.startsWith('/staff') && activeRole == AppRole.staff) return null;

  // post-login / post-pick landing, OR a cross-role shell path -> active shell
  if (path == '/login' || path == '/select-role' || path == '/' ||
      path.startsWith('/customer') ||
      path.startsWith('/driver') ||
      path.startsWith('/staff')) {
    return home;
  }

  return null;
}

final routerProvider = Provider<GoRouter>((ref) {
  final authListenable = ValueNotifier<AuthState>(ref.read(authProvider));
  final roleListenable = ValueNotifier<AppRole?>(ref.read(activeRoleProvider));

  ref.listen<AuthState>(authProvider, (_, next) {
    authListenable.value = next;
  });
  ref.listen<AppRole?>(activeRoleProvider, (_, next) {
    roleListenable.value = next;
  });

  final listenable = Listenable.merge([authListenable, roleListenable]);

  return GoRouter(
    refreshListenable: listenable,
    redirect: (context, state) => resolveRedirect(
      auth: authListenable.value,
      role: roleListenable.value,
      path: state.matchedLocation,
    ),
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/select-role', builder: (_, __) => const RoleSelectScreen()),

      // ── Customer shell (bottom tabs) ─────────────────────────────────────
      ShellRoute(
        builder: (context, state, child) => CustomerShell(child: child),
        routes: [
          GoRoute(
            path: '/customer',
            redirect: (_, __) => '/customer/home',
          ),
          GoRoute(
            path: '/customer/home',
            builder: (_, __) => const HomeScreen(),
          ),
          GoRoute(
            path: '/customer/orders',
            builder: (_, __) => const OrdersScreen(),
          ),
          GoRoute(
            path: '/customer/scan',
            builder: (_, __) => const ScanScreen(),
          ),
          GoRoute(
            path: '/customer/profile',
            builder: (_, __) => const CustomerProfileScreen(),
          ),
        ],
      ),

      // Customer modal/push routes (no bottom bar)
      GoRoute(
        path: '/customer/notifications',
        builder: (_, __) => const NotificationsScreen(),
      ),
      GoRoute(path: '/customer/topup', builder: (_, __) => const TopupScreen()),
      GoRoute(
        path: '/customer/addresses',
        builder: (_, __) => const CustomerAddressesScreen(),
      ),
      GoRoute(
        path: '/customer/topup/slip/:qrRef',
        builder: (_, s) =>
            SlipUploadScreen(qrRef: s.pathParameters['qrRef']!),
      ),
      GoRoute(
        path: '/customer/delivery/request/:orderId',
        builder: (_, s) =>
            DeliveryRequestScreen(orderId: s.pathParameters['orderId']!),
      ),
      GoRoute(
        path: '/customer/delivery/:id/track',
        builder: (_, s) =>
            DeliveryTrackScreen(deliveryId: s.pathParameters['id']!),
      ),

      // Order wizard — static paths first so they win over /order/:id
      GoRoute(
        path: '/customer/order/branch',
        builder: (_, __) => const BranchPickerScreen(),
      ),
      GoRoute(
        path: '/customer/order/machine',
        builder: (_, s) {
          final extra = s.extra as Map<String, dynamic>? ?? {};
          return MachinePickerScreen(
            branchId: extra['branchId'] as String? ?? '',
            branchName: extra['branchName'] as String? ?? '',
          );
        },
      ),
      GoRoute(
        path: '/customer/order/scan-result',
        builder: (_, s) => ScanResultScreen(
          wizardState: s.extra as Map<String, dynamic>? ?? {},
        ),
      ),
      GoRoute(
        path: '/customer/order/cycle',
        builder: (_, s) => CyclePickerScreen(
          wizardState: s.extra as Map<String, dynamic>? ?? {},
        ),
      ),
      GoRoute(
        path: '/customer/order/confirm',
        builder: (_, s) => OrderConfirmScreen(
          wizardState: s.extra as Map<String, dynamic>? ?? {},
        ),
      ),

      // Order detail + rating — parameterized, placed after static wizard paths
      GoRoute(
        path: '/customer/order/:id',
        builder: (_, s) =>
            OrderDetailScreen(orderId: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/customer/order/:id/rate',
        builder: (_, s) =>
            RatingScreen(orderId: s.pathParameters['id']!),
      ),

      // ── Driver shell ─────────────────────────────────────────────────────
      ShellRoute(
        builder: (context, state, child) => DriverShell(child: child),
        routes: [
          GoRoute(
            path: '/driver',
            redirect: (_, __) => '/driver/tasks',
          ),
          GoRoute(
            path: '/driver/tasks',
            builder: (_, __) => const TasksScreen(),
          ),
          GoRoute(
            path: '/driver/map',
            builder: (_, __) => const MapScreen(),
          ),
          GoRoute(
            path: '/driver/earnings',
            builder: (_, __) => const EarningsScreen(),
          ),
          GoRoute(
            path: '/driver/profile',
            builder: (_, __) => const DriverProfileScreen(),
          ),
        ],
      ),
      GoRoute(
        path: '/driver/task/:id',
        builder: (_, s) => TaskDetailScreen(taskId: s.pathParameters['id']!),
      ),

      // ── Staff shell ──────────────────────────────────────────────────────
      ShellRoute(
        builder: (context, state, child) => StaffShell(child: child),
        routes: [
          GoRoute(
            path: '/staff',
            redirect: (_, __) => '/staff/machines',
          ),
          GoRoute(
            path: '/staff/machines',
            builder: (_, __) => const MachinesScreen(),
          ),
          GoRoute(
            path: '/staff/orders',
            builder: (_, __) => const StaffOrdersScreen(),
          ),
          GoRoute(
            path: '/staff/slips',
            builder: (_, __) => const SlipsScreen(),
          ),
          GoRoute(
            path: '/staff/profile',
            builder: (_, __) => const StaffProfileScreen(),
          ),
        ],
      ),
    ],
  );
});

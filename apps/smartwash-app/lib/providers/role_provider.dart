import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/auth/app_role.dart';
import '../core/auth/auth_user.dart';
import '../core/auth/token_store.dart';
import 'auth_provider.dart';

/// The currently active role the user is operating in.
/// null = not logged in or no role selected yet.
class ActiveRoleNotifier extends StateNotifier<AppRole?> {
  ActiveRoleNotifier(this._store) : super(null);

  final TokenStore _store;

  /// On login/restore: restore last persisted role if valid; otherwise
  /// auto-select if only one role or default to customer; leave null for picker.
  Future<void> init(AuthUser user, {String? lastRoleName}) async {
    if (user.roles.isEmpty) {
      state = null;
      return;
    }

    if (lastRoleName != null) {
      final last = AppRole.fromKeycloak(lastRoleName);
      if (last != null && user.roles.contains(last)) {
        state = last;
        return;
      }
    }

    if (user.roles.length == 1) {
      state = user.roles.first;
    } else {
      state = user.roles.contains(AppRole.customer) ? AppRole.customer : null;
    }
  }

  void select(AppRole role) {
    state = role;
    _store.writeLastRole(role.name);
  }

  void clear() {
    state = null;
    _store.clear();
  }
}

final activeRoleProvider =
    StateNotifierProvider<ActiveRoleNotifier, AppRole?>((ref) {
  return ActiveRoleNotifier(ref.read(tokenStoreProvider));
});

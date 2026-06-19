import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../core/auth/auth_service.dart';
import '../core/auth/auth_user.dart';
import '../core/auth/token_store.dart';
import '../core/config/app_config.dart';
import '../core/api/api_client.dart';
import 'role_provider.dart';

// ─── Infrastructure providers ───────────────────────────────────────────────

final tokenStoreProvider = Provider<TokenStore>(
  (ref) => TokenStore(const FlutterSecureStorage()),
);

final appConfigProvider = Provider<AppConfig>(
  (_) => AppConfig.instance,
);

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(
    store: ref.read(tokenStoreProvider),
    config: ref.read(appConfigProvider),
  );
});

final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient(ref.read(appConfigProvider));
  // Wire AuthService for 401 auto-refresh without circular dependency.
  client.setAuthService(ref.read(authServiceProvider));
  return client;
});

// ─── Auth state ─────────────────────────────────────────────────────────────

class AuthState {
  const AuthState({
    this.token,
    this.user,
    this.isLoading = false,
    this.error,
  });

  final String? token;
  final AuthUser? user;
  final bool isLoading;
  final String? error;

  bool get isAuthenticated => token != null && user != null;

  AuthState copyWith({
    String? token,
    AuthUser? user,
    bool? isLoading,
    String? error,
    bool clearToken = false,
    bool clearUser = false,
    bool clearError = false,
  }) =>
      AuthState(
        token: clearToken ? null : (token ?? this.token),
        user: clearUser ? null : (user ?? this.user),
        isLoading: isLoading ?? this.isLoading,
        error: clearError ? null : (error ?? this.error),
      );
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(this._auth, this._store, this._api, this._roleNotifier)
      : super(const AuthState(isLoading: true));

  final AuthService _auth;
  final TokenStore _store;
  final ApiClient _api;
  final ActiveRoleNotifier _roleNotifier;

  /// Called once on app startup to restore a previous session.
  ///
  /// Checks token expiry and tries a silent refresh before accepting the
  /// session. Also restores the last active role from secure storage so
  /// multi-role users land directly in their previous mode (Fast Startup).
  Future<void> restore() async {
    String? token = await _auth.restoreToken();
    if (token == null) {
      state = const AuthState();
      return;
    }

    if (_auth.isTokenExpired(token)) {
      final refreshed = await _auth.refresh();
      if (refreshed == null) {
        await _auth.logout();
        state = const AuthState();
        return;
      }
      token = refreshed;
    }

    final lastRoleName = await _store.readLastRole();
    final user = _auth.decodeUser(token);
    _api.setToken(token);
    await _roleNotifier.init(user, lastRoleName: lastRoleName);
    state = AuthState(token: token, user: user);
  }

  Future<void> login(String username, String password) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final result = await _auth.login(username: username, password: password);
      final user = _auth.decodeUser(result.accessToken);
      _api.setToken(result.accessToken);
      // Fresh login: no previously stored role preference.
      await _roleNotifier.init(user);
      state = AuthState(token: result.accessToken, user: user);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString().replaceFirst('Exception: ', ''),
      );
      rethrow;
    }
  }

  Future<void> logout() async {
    await _auth.logout();
    _api.setToken(null);
    _roleNotifier.clear();
    state = const AuthState();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(
    ref.read(authServiceProvider),
    ref.read(tokenStoreProvider),
    ref.read(apiClientProvider),
    ref.read(activeRoleProvider.notifier),
  );
});

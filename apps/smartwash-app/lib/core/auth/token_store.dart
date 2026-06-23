import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _kTokenKey = 'sw_token';
const _kRefreshKey = 'sw_refresh_token';
const _kLastRoleKey = 'sw_last_role';

/// Wraps [FlutterSecureStorage] with typed accessors for the auth tokens.
/// Single storage key for all roles — the super app holds one session.
class TokenStore {
  const TokenStore(this._storage);

  final FlutterSecureStorage _storage;

  Future<String?> readAccessToken() => _storage.read(key: _kTokenKey);
  Future<String?> readRefreshToken() => _storage.read(key: _kRefreshKey);
  Future<String?> readLastRole() => _storage.read(key: _kLastRoleKey);

  Future<void> write({
    required String accessToken,
    String? refreshToken,
  }) async {
    await _storage.write(key: _kTokenKey, value: accessToken);
    if (refreshToken != null) {
      await _storage.write(key: _kRefreshKey, value: refreshToken);
    }
  }

  Future<void> writeLastRole(String roleName) =>
      _storage.write(key: _kLastRoleKey, value: roleName);

  Future<void> clear() async {
    await _storage.delete(key: _kTokenKey);
    await _storage.delete(key: _kRefreshKey);
    await _storage.delete(key: _kLastRoleKey);
  }
}

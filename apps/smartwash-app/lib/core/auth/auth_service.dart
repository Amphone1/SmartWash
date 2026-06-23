import 'package:dart_jsonwebtoken/dart_jsonwebtoken.dart';
import '../config/app_config.dart';
import 'auth_user.dart';
import 'token_store.dart';
import 'package:dio/dio.dart';

/// Handles Keycloak OIDC authentication (resource-owner password grant).
///
/// The super app uses a single Keycloak client — `smartwash-app` — that has
/// access to all mobile roles. This removes the need for per-role client IDs.
/// The JWT `realm_access.roles` still determines which mode(s) the user can
/// access.
class AuthService {
  AuthService({required this.store, required this.config});

  final TokenStore store;
  final AppConfig config;

  late final Dio _http = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
  ));

  /// Returns the stored access token if one exists (cold-start restore).
  Future<String?> restoreToken() => store.readAccessToken();

  /// Returns true if [token] is expired or will expire within [bufferSeconds].
  bool isTokenExpired(String token, {int bufferSeconds = 60}) {
    try {
      final jwt = JWT.decode(token);
      final claims = jwt.payload as Map<String, dynamic>;
      final exp = claims['exp'];
      if (exp == null) return false;
      final expiry = DateTime.fromMillisecondsSinceEpoch((exp as int) * 1000);
      return DateTime.now().isAfter(expiry.subtract(Duration(seconds: bufferSeconds)));
    } catch (_) {
      return true;
    }
  }

  /// Exchanges username/password for a Keycloak access token.
  ///
  /// Uses the unified `smartwash-app` client ID so all mobile roles can log in
  /// from a single login screen, regardless of which roles the account holds.
  Future<({String accessToken, String? refreshToken})> login({
    required String username,
    required String password,
  }) async {
    final url =
        '${config.keycloakUrl}/realms/smartwash/protocol/openid-connect/token';

    try {
      final res = await _http.post<Map<String, dynamic>>(
        url,
        data: {
          'grant_type': 'password',
          'client_id': 'smartwash-app',
          'username': username,
          'password': password,
        },
        options: Options(
          contentType: 'application/x-www-form-urlencoded',
        ),
      );

      final body = res.data!;
      final accessToken = body['access_token'] as String? ?? '';
      final refreshToken = body['refresh_token'] as String?;

      if (accessToken.isEmpty) throw Exception('No access token received');

      final user = decodeUser(accessToken);
      if (user.roles.isEmpty) {
        throw Exception(
          'This account does not have any mobile role (customer, driver, or staff).',
        );
      }

      await store.write(
        accessToken: accessToken,
        refreshToken: refreshToken,
      );

      return (accessToken: accessToken, refreshToken: refreshToken);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        throw Exception('Invalid username or password.');
      }
      throw Exception('Login failed. Please check your connection.');
    }
  }

  /// Refreshes the access token using the stored refresh token.
  /// Returns the new access token, or null if refresh fails (triggers logout).
  Future<String?> refresh() async {
    final refreshToken = await store.readRefreshToken();
    if (refreshToken == null) return null;

    final url =
        '${config.keycloakUrl}/realms/smartwash/protocol/openid-connect/token';

    try {
      final res = await _http.post<Map<String, dynamic>>(
        url,
        data: {
          'grant_type': 'refresh_token',
          'client_id': 'smartwash-app',
          'refresh_token': refreshToken,
        },
        options: Options(
          contentType: 'application/x-www-form-urlencoded',
        ),
      );

      final newAccessToken = res.data?['access_token'] as String?;
      final newRefreshToken = res.data?['refresh_token'] as String?;

      if (newAccessToken != null) {
        await store.write(
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        );
        return newAccessToken;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<void> logout() => store.clear();

  /// Decodes JWT payload to [AuthUser] without signature verification.
  /// Signature validation happens server-side on every API call.
  AuthUser decodeUser(String accessToken) {
    try {
      final jwt = JWT.decode(accessToken);
      final claims = jwt.payload as Map<String, dynamic>;
      return AuthUser.fromJwtClaims(claims);
    } catch (_) {
      return const AuthUser(
        sub: '',
        name: '',
        username: '',
        roles: {},
      );
    }
  }
}

/// Runtime configuration sourced from compile-time `--dart-define` flags.
///
/// Usage:
///   flutter run \
///     --dart-define=API_BASE_URL=http://192.168.1.10:8088/api \
///     --dart-define=KEYCLOAK_URL=http://192.168.1.10:8080
class AppConfig {
  const AppConfig._();

  static const AppConfig instance = AppConfig._();

  String get apiBaseUrl =>
      const String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'http://localhost:8088/api',
      );

  String get keycloakUrl =>
      const String.fromEnvironment(
        'KEYCLOAK_URL',
        defaultValue: 'http://localhost:8080',
      );

  String get googleMapsApiKey =>
      const String.fromEnvironment('GOOGLE_MAPS_KEY', defaultValue: '');
}

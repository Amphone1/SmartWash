/// Roles that exist in the Keycloak realm and are relevant to the mobile app.
/// `owner` and `admin` are web-portal roles; mobile never routes to them.
enum AppRole {
  customer,
  driver,
  staff;

  /// Parse a Keycloak role string into an [AppRole], or null if not a mobile role.
  static AppRole? fromKeycloak(String raw) => switch (raw) {
        'customer' => AppRole.customer,
        'driver' => AppRole.driver,
        'staff' => AppRole.staff,
        _ => null,
      };

  String get displayName => switch (this) {
        AppRole.customer => 'Customer',
        AppRole.driver => 'Driver',
        AppRole.staff => 'Staff',
      };
}

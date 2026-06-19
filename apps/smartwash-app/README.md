# SmartWash Super App

One Flutter app for three roles: **Customer · Driver · Staff**.

## Prerequisites

- Flutter SDK 3.27+ / Dart 3.5+ ([install](https://docs.flutter.dev/get-started/install))
- Android Studio or Xcode for device simulators
- Docker Compose stack running (see `infra/docker/`)

## Setup

```bash
cd apps/smartwash-app
flutter pub get
```

## Run

### Android emulator
```bash
flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:8088/api \
  --dart-define=KEYCLOAK_URL=http://10.0.2.2:8080
```

### iOS simulator
```bash
flutter run \
  --dart-define=API_BASE_URL=http://127.0.0.1:8088/api \
  --dart-define=KEYCLOAK_URL=http://127.0.0.1:8080
```

### Physical device (LAN)
Set `LAN_IP` in `docker-compose.lan.yml`, then:
```bash
flutter run \
  --dart-define=API_BASE_URL=http://<LAN_IP>:8088/api \
  --dart-define=KEYCLOAK_URL=http://<LAN_IP>:8080
```

## Google Maps (driver mode)

The driver map screen requires a Google Maps API key with **Maps SDK for Android** enabled.

**Setup:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an API key with **Maps SDK for Android** restriction
3. Pass the key as a `--dart-define` flag at build/run time:

```bash
flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:8088/api \
  --dart-define=KEYCLOAK_URL=http://10.0.2.2:8080 \
  --dart-define=GOOGLE_MAPS_KEY=YOUR_API_KEY_HERE
```

The key is injected into `AndroidManifest.xml` at build time via a Gradle placeholder
(`android/app/build.gradle.kts`). **Never commit the raw API key to source control.**

Without a key the driver map screen shows a placeholder tile — all other app features work normally.

## Keycloak client

Create a new Keycloak client in the `smartwash` realm:

- **Client ID**: `smartwash-app`
- **Client protocol**: openid-connect
- **Access type**: public
- **Direct access grants**: enabled (resource owner password grant)

The app authenticates using this single client regardless of role.
After login, `realm_access.roles` in the JWT determines which mode(s) the user
can access (customer · driver · staff).

## Architecture

```
lib/
├── main.dart              # Entry point
├── app.dart               # Root widget + router bootstrap
├── core/
│   ├── auth/              # AuthService, JWT decode, TokenStore (SecureStorage)
│   ├── api/               # Dio client + all BFF models
│   ├── config/            # AppConfig (--dart-define values)
│   └── utils/             # formatKip, errorMapper
├── design_system/         # SwColors, SwTypography, SwButton, SwBadge, SwCard
├── router/                # go_router with role-based shell routing
├── providers/             # Riverpod: authProvider, activeRoleProvider
└── features/
    ├── auth/              # LoginScreen, RoleSelectScreen
    ├── customer/          # Home, Orders, Scan, Topup, Delivery, Profile
    ├── driver/            # Tasks, Map, Earnings, Profile
    └── staff/             # Machines, Slips, Profile
```

## Role routing

```
Login → JWT decode → realm_access.roles

Single role  → direct to that mode's shell (no picker)
Multi-role   → RoleSelectScreen → user picks → route to shell
Profile      → "Switch Mode" → RoleSelectScreen
```

## Nx commands

```bash
npx nx serve smartwash-app     # flutter run
npx nx build smartwash-app     # flutter build apk
npx nx test smartwash-app      # flutter test
npx nx lint smartwash-app      # flutter analyze
```

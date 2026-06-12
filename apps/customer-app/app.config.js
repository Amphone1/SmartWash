// Allows real-device (Expo Go) testing without editing app.json:
//   $env:SMARTWASH_API_URL = "http://<LAN_IP>:8088/api"
//   $env:SMARTWASH_KEYCLOAK_URL = "http://<LAN_IP>:8080"
//   npx expo start
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    apiBaseUrl: process.env.SMARTWASH_API_URL ?? config.extra.apiBaseUrl,
    keycloakUrl: process.env.SMARTWASH_KEYCLOAK_URL ?? config.extra.keycloakUrl,
  },
});

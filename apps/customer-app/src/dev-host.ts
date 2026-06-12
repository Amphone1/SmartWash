import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Dev convenience: on a real device "localhost"/"keycloak" don't resolve —
 * swap the hostname for the Metro host (this PC's LAN IP, taken from the
 * exp://<host>:<port> the app was loaded from). No-op on web, where the
 * hosts-file entry / localhost work as configured.
 */
export function resolveDevUrl(url: string): string {
  if (Platform.OS === 'web') return url;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (!host) return url;
  return url
    .replace('://localhost', `://${host}`)
    .replace('://keycloak', `://${host}`);
}

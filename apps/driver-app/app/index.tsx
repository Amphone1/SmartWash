import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth';

/**
 * Root route. expo-router has no implicit "/" target when every screen lives in
 * a route group ((auth)/(tabs)), so opening the app at "/" rendered an
 * "Unmatched Route" page (web) / dead-ended before the layout redirect (device).
 * Redirect explicitly based on auth state.
 */
export default function Index() {
  const { token, isLoading } = useAuth();
  if (isLoading) return null;
  return <Redirect href={token ? '/(tabs)/tasks' : '/(auth)/login'} />;
}

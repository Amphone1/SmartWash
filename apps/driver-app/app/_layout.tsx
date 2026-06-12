import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../src/auth';
import { setAuthToken } from '../src/api';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutNav() {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  useEffect(() => {
    if (isLoading) return;
    SplashScreen.hideAsync().catch(() => {});

    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)/tasks');
    }
  }, [token, isLoading, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="delivery/[id]"
        options={{ headerShown: false, presentation: 'card' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

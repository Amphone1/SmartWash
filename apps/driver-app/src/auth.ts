import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const STORE_KEY = 'sw_driver_token';
const KEYCLOAK_URL: string =
  (Constants.expoConfig?.extra?.keycloakUrl as string | undefined) ??
  'http://localhost:8080';

interface AuthContextValue {
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const payload = parts[1];
  const padded = payload + '=='.slice(0, (4 - (payload.length % 4)) % 4);
  const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(decoded) as Record<string, unknown>;
}

function hasDriverRole(jwt: string): boolean {
  try {
    const payload = decodeJwtPayload(jwt);
    const roles =
      (payload.realm_access as { roles?: string[] } | undefined)?.roles ?? [];
    return roles.includes('driver');
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY)
      .then((stored) => {
        if (stored) setToken(stored);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: 'smartwash-driver-app',
      username,
      password,
    });

    const res = await fetch(
      `${KEYCLOAK_URL}/realms/smartwash/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Authentication failed (${res.status})`);
    }

    const data = (await res.json()) as { access_token?: string };
    const accessToken = data.access_token;
    if (!accessToken) throw new Error('No access token received');

    if (!hasDriverRole(accessToken)) {
      throw new Error('This account does not have driver access.');
    }

    await SecureStore.setItemAsync(STORE_KEY, accessToken);
    setToken(accessToken);
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(STORE_KEY).catch(() => {});
    setToken(null);
  }, []);

  return React.createElement(
    AuthContext.Provider,
    { value: { token, isLoading, login, logout } },
    children,
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

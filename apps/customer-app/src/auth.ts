import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const TOKEN_KEY = 'sw_token';

const KEYCLOAK_URL: string =
  (Constants.expoConfig?.extra?.keycloakUrl as string | undefined) ??
  'http://localhost:8080';

interface AuthContextValue {
  token: string | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

function decodeJwt(jwt: string): Record<string, unknown> {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return {};
    const payload = parts[1];
    const padded = payload + '=='.slice((payload.length % 4 || 4) - 4 + 2);
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function hasCustomerRole(jwt: string): boolean {
  const payload = decodeJwt(jwt);
  const realmAccess = payload['realm_access'] as { roles?: string[] } | undefined;
  return realmAccess?.roles?.includes('customer') ?? false;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (stored) setToken(stored);
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function login(phone: string, password: string): Promise<void> {
    const url = `${KEYCLOAK_URL}/realms/smartwash/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: 'smartwash-customer-app',
      username: phone,
      password,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401) throw new Error('Invalid phone number or password.');
      throw new Error(text || 'Login failed. Please try again.');
    }

    const data = (await res.json()) as { access_token: string };
    const accessToken = data.access_token;

    if (!hasCustomerRole(accessToken)) {
      throw new Error('This account does not have customer access.');
    }

    await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
    setToken(accessToken);
  }

  async function logout(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
  }

  return React.createElement(
    AuthContext.Provider,
    { value: { token, isLoading, login, logout } },
    children,
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

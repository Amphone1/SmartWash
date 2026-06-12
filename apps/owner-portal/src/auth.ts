import { createContext, useContext, useEffect, useState, type ReactNode, createElement } from 'react';

const KEYCLOAK_URL =
  (import.meta.env.VITE_KEYCLOAK_URL as string | undefined) ?? 'http://localhost:8080';

const TOKEN_KEY = 'sw_owner_token';

export interface AuthUser {
  name: string;
  branchId: string;
}

export interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractUser(token: string): AuthUser | null {
  const payload = decodeJwt(token);
  if (!payload) return null;

  const roles = (payload.realm_access as { roles?: string[] })?.roles ?? [];
  if (!roles.includes('owner')) return null;

  const name =
    (payload.name as string | undefined) ??
    (payload.preferred_username as string | undefined) ??
    'Owner';

  const branchId =
    (payload.branch_id as string | undefined) ??
    ((payload as Record<string, unknown>)['branch-id'] as string | undefined) ??
    'branch-001';

  return { name, branchId };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      if (stored === 'demo-owner') {
        setToken(stored);
        setUser({ name: 'ທ. ສຸດາ', branchId: 'branch-001' });
      } else {
        const extracted = extractUser(stored);
        if (extracted) {
          setToken(stored);
          setUser(extracted);
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
      }
    }
    setIsLoading(false);
  }, []);

  async function login(username: string, password: string): Promise<void> {
    // Demo shortcut
    if (username === 'demo-owner' || password === 'demo-owner') {
      const demoToken = 'demo-owner';
      localStorage.setItem(TOKEN_KEY, demoToken);
      setToken(demoToken);
      setUser({ name: 'ທ. ສຸດາ', branchId: 'branch-001' });
      return;
    }

    try {
      const body = new URLSearchParams({
        grant_type: 'password',
        client_id: 'smartwash-owner-portal',
        username,
        password,
      });

      const res = await fetch(
        `${KEYCLOAK_URL}/realms/smartwash/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        },
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Login failed (${res.status})`);
      }

      const data = (await res.json()) as { access_token: string };
      const accessToken = data.access_token;
      const extracted = extractUser(accessToken);

      if (!extracted) {
        throw new Error('ບັນຊີນີ້ບໍ່ມີສິດ owner');
      }

      localStorage.setItem(TOKEN_KEY, accessToken);
      setToken(accessToken);
      setUser(extracted);
    } catch (e) {
      // If Keycloak is unavailable, fall back to demo if credentials match
      if (e instanceof TypeError && e.message.includes('fetch')) {
        throw new Error('ບໍ່ສາມາດເຊື່ອມຕໍ່ Keycloak — ໃຊ້ demo-owner ສຳລັບທົດສອບ');
      }
      throw e;
    }
  }

  function logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  const value: AuthContextValue = { token, user, isLoading, login, logout };

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

import { createContext, useContext, useState, type ReactNode, createElement } from 'react';

const KEYCLOAK_URL =
  (import.meta.env.VITE_KEYCLOAK_URL as string | undefined) ?? 'http://localhost:8080';
const TOKEN_KEY = 'sw_admin_token';

export interface AuthUser { name: string; }

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
    return JSON.parse(atob(payload + '='.repeat((4 - (payload.length % 4)) % 4))) as Record<string, unknown>;
  } catch { return null; }
}

function extractUser(token: string): AuthUser | null {
  const payload = decodeJwt(token);
  if (!payload) return null;
  const roles = (payload.realm_access as { roles?: string[] })?.roles ?? [];
  if (!roles.includes('admin')) return null;
  const name =
    (payload.name as string | undefined) ??
    (payload.preferred_username as string | undefined) ??
    'Admin';
  return { name };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    return t ? extractUser(t) : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  const login = async (username: string, password: string) => {
    // Demo shortcut
    if (username === 'demo-admin') {
      const fakeToken = 'demo.' + btoa(JSON.stringify({ name: 'Admin Demo', preferred_username: 'demo-admin', realm_access: { roles: ['admin'] } })) + '.sig';
      localStorage.setItem(TOKEN_KEY, fakeToken);
      setToken(fakeToken);
      setUser({ name: 'Admin Demo' });
      return;
    }
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ grant_type: 'password', client_id: 'smartwash-admin-portal', username, password });
      const res = await fetch(`${KEYCLOAK_URL}/realms/smartwash/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      if (!res.ok) throw new Error(`Authentication failed (${res.status})`);
      const data = (await res.json()) as { access_token?: string };
      if (!data.access_token) throw new Error('No access token');
      const u = extractUser(data.access_token);
      if (!u) throw new Error('Account does not have admin access.');
      localStorage.setItem(TOKEN_KEY, data.access_token);
      setToken(data.access_token);
      setUser(u);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  return createElement(AuthContext.Provider, { value: { token, user, isLoading, login, logout } }, children);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

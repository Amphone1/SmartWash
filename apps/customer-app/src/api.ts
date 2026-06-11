/**
 * Minimal BFF client. All calls go through the Traefik gateway (/api/bff/...).
 * A bearer token (Keycloak-issued) is required; for this Phase 1 demo the token
 * is supplied on the first screen rather than via a full login flow.
 */
import Constants from 'expo-constants';

const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  'http://localhost:8088/api';

export interface Branch {
  id: string;
  name: string;
  nameLao: string | null;
  lat: number;
  lng: number;
  status: string;
}

export interface Machine {
  id: string;
  code: string;
  type: string;
  capacityKg: number;
  price: number;
  state: string;
}

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export const api = {
  listBranches: (token: string) => get<Branch[]>('/bff/branches', token),
  listMachines: (token: string, branchId: string) =>
    get<Machine[]>(`/bff/branches/${branchId}/machines`, token),
};

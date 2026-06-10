const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:8088/api';

export interface AdminSummary {
  revenueToday: number;
  activeOrders: number;
  branches: number;
  driversAvailable: number;
  recon: { matched: number; review: number; suspicious: number; orphan: number };
}

export interface ReconRun {
  id: string;
  branchId: string | null;
  reconDate: string;
  matched: number;
  review: number;
  suspicious: number;
  orphan: number;
  status: string;
}

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

export const api = {
  summary: (token: string) => get<AdminSummary>('/bff/admin/summary', token),
  reconciliation: (token: string) =>
    get<ReconRun[]>('/bff/admin/reconciliation', token),
};

const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:8088/api';

export interface OwnerSummary {
  branchId: string;
  revenueToday: number;
  ordersToday: number;
  machinesTotal: number;
  machinesActive: number;
}

export async function fetchOwnerSummary(
  token: string,
  branchId: string,
): Promise<OwnerSummary> {
  const res = await fetch(
    `${BASE_URL}/bff/owner/summary?branchId=${encodeURIComponent(branchId)}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

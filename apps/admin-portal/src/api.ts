const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8088/api';

// ─── Interfaces ──────────────────────────────────────────────────────────────

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

export interface AdminOrder {
  id: string;
  status: string;
  serviceType: string;
  customerName: string;
  branchName: string;
  weightKg: number;
  pricePaid: number;
  createdAt: string;
}

export interface Payment {
  id: string;
  type: 'topup' | 'payout';
  amount: number;
  status: string;
  customerName: string;
  bank: string;
  ocrConfidence?: number;
  submittedAt: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  status: 'ONLINE' | 'OFFLINE';
  rating: number;
  tripsTotal: number;
  branchName: string;
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  machineCount: number;
  activeOrders: number;
  revenueMonth: number;
}

export interface DailySeries { date: string; revenue: number; orders: number; }
export interface ActivityEvent { id: string; type: string; message: string; at: string; level: 'info' | 'warn' | 'error'; }

// ─── Demo data ───────────────────────────────────────────────────────────────

const DEMO_SUMMARY: AdminSummary = {
  revenueToday: 4_250_000,
  activeOrders: 23,
  branches: 3,
  driversAvailable: 5,
  recon: { matched: 142, review: 8, suspicious: 2, orphan: 1 },
};

const DEMO_RECON: ReconRun[] = [
  { id: 'r1', branchId: 'b1', reconDate: '2026-06-12T00:00:00Z', matched: 48, review: 3, suspicious: 1, orphan: 0, status: 'DONE' },
  { id: 'r2', branchId: 'b2', reconDate: '2026-06-12T00:00:00Z', matched: 51, review: 2, suspicious: 1, orphan: 1, status: 'DONE' },
  { id: 'r3', branchId: 'b3', reconDate: '2026-06-11T00:00:00Z', matched: 43, review: 3, suspicious: 0, orphan: 0, status: 'DONE' },
];

const DEMO_ORDERS: AdminOrder[] = [
  { id: 'ORD-0041', status: 'WASHING', serviceType: 'WASH', customerName: 'ທ. ສຸດາ', branchName: 'ດົງດອກ', weightKg: 5, pricePaid: 45_000, createdAt: '2026-06-12T08:30:00Z' },
  { id: 'ORD-0040', status: 'DONE', serviceType: 'WASH_DRY', customerName: 'ທ. ພົງ', branchName: 'ໂພນທັນ', weightKg: 7, pricePaid: 85_000, createdAt: '2026-06-12T07:15:00Z' },
  { id: 'ORD-0039', status: 'IN_TRANSIT', serviceType: 'delivery', customerName: 'ນ. ຄຳລາ', branchName: 'ດົງດອກ', weightKg: 6, pricePaid: 90_000, createdAt: '2026-06-12T07:00:00Z' },
  { id: 'ORD-0038', status: 'DONE', serviceType: 'WASH', customerName: 'ທ. ວິໄລ', branchName: 'ຕາດ Lao', weightKg: 4, pricePaid: 40_000, createdAt: '2026-06-12T06:45:00Z' },
  { id: 'ORD-0037', status: 'PENDING', serviceType: 'pickup', customerName: 'ທ. ສຸດາ', branchName: 'ດົງດອກ', weightKg: 8, pricePaid: 0, createdAt: '2026-06-11T18:30:00Z' },
  { id: 'ORD-0036', status: 'CANCELLED', serviceType: 'WASH', customerName: 'ທ. ພົງ', branchName: 'ໂພນທັນ', weightKg: 5, pricePaid: 0, createdAt: '2026-06-11T17:00:00Z' },
];

const DEMO_PAYMENTS: Payment[] = [
  { id: 'p1', type: 'topup', amount: 200_000, status: 'REVIEW', customerName: 'ທ. ສຸດາ', bank: 'BCEL', ocrConfidence: 78, submittedAt: '2026-06-12T09:10:00Z' },
  { id: 'p2', type: 'topup', amount: 150_000, status: 'REVIEW', customerName: 'ທ. ພົງ', bank: 'LDB', ocrConfidence: 62, submittedAt: '2026-06-12T08:55:00Z' },
  { id: 'p3', type: 'topup', amount: 300_000, status: 'APPROVED', customerName: 'ນ. ຄຳລາ', bank: 'BCEL', ocrConfidence: 95, submittedAt: '2026-06-12T07:30:00Z' },
  { id: 'p4', type: 'topup', amount: 100_000, status: 'APPROVED', customerName: 'ທ. ວິໄລ', bank: 'APB', ocrConfidence: 88, submittedAt: '2026-06-11T22:40:00Z' },
];

const DEMO_DRIVERS: Driver[] = [
  { id: 'd1', name: 'ທ. ສົມໃຈ', phone: '+856 20 111 111', status: 'ONLINE', rating: 4.9, tripsTotal: 312, branchName: 'ດົງດອກ' },
  { id: 'd2', name: 'ທ. ບຸນທຳ', phone: '+856 20 222 222', status: 'ONLINE', rating: 4.7, tripsTotal: 241, branchName: 'ໂພນທັນ' },
  { id: 'd3', name: 'ນ. ຂຳ', phone: '+856 20 333 333', status: 'OFFLINE', rating: 4.5, tripsTotal: 118, branchName: 'ດົງດອກ' },
  { id: 'd4', name: 'ທ. ພອນ', phone: '+856 20 444 444', status: 'ONLINE', rating: 4.8, tripsTotal: 197, branchName: 'ຕາດ Lao' },
];

const DEMO_BRANCHES: Branch[] = [
  { id: 'b1', name: 'ດົງດອກ', city: 'ວຽງຈັນ', machineCount: 6, activeOrders: 9, revenueMonth: 42_500_000 },
  { id: 'b2', name: 'ໂພນທັນ', city: 'ວຽງຈັນ', machineCount: 4, activeOrders: 6, revenueMonth: 31_200_000 },
  { id: 'b3', name: 'ຕາດ Lao', city: 'ວຽງຈັນ', machineCount: 4, activeOrders: 8, revenueMonth: 28_800_000 },
];

const DEMO_DAILY: DailySeries[] = [
  { date: '06/06', revenue: 3_200_000, orders: 18 },
  { date: '06/07', revenue: 2_900_000, orders: 16 },
  { date: '06/08', revenue: 4_100_000, orders: 24 },
  { date: '06/09', revenue: 3_750_000, orders: 21 },
  { date: '06/10', revenue: 4_800_000, orders: 28 },
  { date: '06/11', revenue: 3_600_000, orders: 20 },
  { date: '06/12', revenue: 4_250_000, orders: 23 },
];

const DEMO_ACTIVITY: ActivityEvent[] = [
  { id: 'a1', type: 'RECON', message: 'Reconciliation completed — 2 suspicious slips', at: '2026-06-12T09:00:00Z', level: 'warn' },
  { id: 'a2', type: 'DRIVER', message: 'ທ. ສົມໃຈ came online (ດົງດອກ)', at: '2026-06-12T08:30:00Z', level: 'info' },
  { id: 'a3', type: 'MACHINE', message: 'M-05 error: E-04 DOOR_LOCK (ດົງດອກ)', at: '2026-06-12T08:15:00Z', level: 'error' },
  { id: 'a4', type: 'PAYMENT', message: '₭300,000 topup approved for ນ. ຄຳລາ', at: '2026-06-12T07:35:00Z', level: 'info' },
  { id: 'a5', type: 'ORDER', message: 'Order ORD-0039 delivery started', at: '2026-06-12T07:10:00Z', level: 'info' },
];

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, token: string | null, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export async function getSummary(token: string | null): Promise<AdminSummary> {
  try { return await apiFetch<AdminSummary>('/bff/admin/summary', token); }
  catch { return DEMO_SUMMARY; }
}

export async function getRecon(token: string | null): Promise<ReconRun[]> {
  try { return await apiFetch<ReconRun[]>('/bff/admin/reconciliation', token); }
  catch { return DEMO_RECON; }
}

export async function listOrders(token: string | null, status?: string): Promise<AdminOrder[]> {
  try {
    const qs = status && status !== 'ALL' ? `?status=${status}` : '';
    return await apiFetch<AdminOrder[]>(`/bff/admin/orders${qs}`, token);
  } catch {
    return status && status !== 'ALL' ? DEMO_ORDERS.filter((o) => o.status === status) : DEMO_ORDERS;
  }
}

export async function listPayments(token: string | null): Promise<Payment[]> {
  try { return await apiFetch<Payment[]>('/bff/admin/payments', token); }
  catch { return DEMO_PAYMENTS; }
}

export async function listDrivers(token: string | null): Promise<Driver[]> {
  try { return await apiFetch<Driver[]>('/bff/admin/drivers', token); }
  catch { return DEMO_DRIVERS; }
}

export async function listBranches(token: string | null): Promise<Branch[]> {
  try { return await apiFetch<Branch[]>('/bff/admin/branches', token); }
  catch { return DEMO_BRANCHES; }
}

export async function getDailySeries(token: string | null): Promise<DailySeries[]> {
  try { return await apiFetch<DailySeries[]>('/bff/admin/analytics/daily', token); }
  catch { return DEMO_DAILY; }
}

export async function getActivity(token: string | null): Promise<ActivityEvent[]> {
  try { return await apiFetch<ActivityEvent[]>('/bff/admin/activity', token); }
  catch { return DEMO_ACTIVITY; }
}

export async function approvePayment(token: string | null, id: string): Promise<void> {
  try { await apiFetch(`/bff/admin/payments/${id}/approve`, token, { method: 'POST' }); }
  catch { /* demo no-op */ }
}

export async function rejectPayment(token: string | null, id: string, reason: string): Promise<void> {
  try {
    await apiFetch(`/bff/admin/payments/${id}/reject`, token, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  } catch { /* demo no-op */ }
}

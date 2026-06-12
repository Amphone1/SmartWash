const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8088/api';

// ─── Interfaces ────────────────────────────────────────────────────────────

export interface OwnerSummary {
  revenueToday: number;
  ordersToday: number;
  machineUtilPct: number;
  nextSettlementKip: number;
  nextSettlementDate: string;
}

export interface MachineCard {
  id: string;
  code: string;
  type: 'WASHER' | 'DRYER';
  capacityKg: number;
  state: 'IDLE' | 'RUNNING' | 'RESERVED' | 'ERROR' | 'MAINTENANCE';
  progressPct?: number;
  minutesLeft?: number;
  currentOrderId?: string;
  errorCode?: string;
}

export interface Order {
  id: string;
  status: string;
  serviceType: string;
  customerName: string;
  weightKg: number;
  createdAt: string;
  pricePaid: number;
  machineCodes?: string[];
}

export interface Slip {
  id: string;
  amount: number;
  customerName: string;
  ocrConfidence: number;
  ocrReason: string;
  qrRef: string;
  bank: string;
  slipUrl: string;
  submittedAt: string;
}

export interface Settlement {
  id: string;
  periodStart: string;
  periodEnd: string;
  revenueKip: number;
  commissionKip: number;
  netKip: number;
  status: 'PENDING' | 'PAID';
  paidAt?: string;
}

export interface HourlyBucket {
  hour: number;
  ordersCount: number;
}

// ─── Demo data ─────────────────────────────────────────────────────────────

const DEMO_SUMMARY: OwnerSummary = {
  revenueToday: 1_850_000,
  ordersToday: 14,
  machineUtilPct: 75,
  nextSettlementKip: 12_400_000,
  nextSettlementDate: '2026-06-15',
};

const DEMO_MACHINES: MachineCard[] = [
  { id: 'm-01', code: 'M-01', type: 'WASHER', capacityKg: 8, state: 'RUNNING', progressPct: 62, minutesLeft: 18, currentOrderId: 'ORD-0041' },
  { id: 'm-02', code: 'M-02', type: 'WASHER', capacityKg: 8, state: 'IDLE' },
  { id: 'm-03', code: 'M-03', type: 'DRYER', capacityKg: 10, state: 'RUNNING', progressPct: 40, minutesLeft: 28, currentOrderId: 'ORD-0039' },
  { id: 'm-04', code: 'M-04', type: 'DRYER', capacityKg: 10, state: 'RESERVED' },
  { id: 'm-05', code: 'M-05', type: 'WASHER', capacityKg: 12, state: 'ERROR', errorCode: 'E-04: DOOR_LOCK' },
  { id: 'm-06', code: 'M-06', type: 'WASHER', capacityKg: 8, state: 'MAINTENANCE' },
];

const DEMO_ORDERS: Order[] = [
  { id: 'ORD-0041', status: 'WASHING', serviceType: 'WASH', customerName: 'ທ. ສຸດາ', weightKg: 5, createdAt: '2026-06-12T08:30:00Z', pricePaid: 45_000, machineCodes: ['M-01'] },
  { id: 'ORD-0040', status: 'DONE', serviceType: 'WASH_DRY', customerName: 'ທ. ພົງ', weightKg: 7, createdAt: '2026-06-12T07:15:00Z', pricePaid: 85_000, machineCodes: ['M-02', 'M-03'] },
  { id: 'ORD-0039', status: 'WASHING', serviceType: 'DRY', customerName: 'ນ. ຄຳລາ', weightKg: 6, createdAt: '2026-06-12T07:00:00Z', pricePaid: 55_000, machineCodes: ['M-03'] },
  { id: 'ORD-0038', status: 'DONE', serviceType: 'WASH', customerName: 'ທ. ວິໄລ', weightKg: 4, createdAt: '2026-06-12T06:45:00Z', pricePaid: 40_000, machineCodes: ['M-02'] },
  { id: 'ORD-0037', status: 'PENDING', serviceType: 'WASH_DRY', customerName: 'ທ. ສຸດາ', weightKg: 8, createdAt: '2026-06-11T18:30:00Z', pricePaid: 90_000 },
  { id: 'ORD-0036', status: 'CANCELLED', serviceType: 'WASH', customerName: 'ທ. ພົງ', weightKg: 5, createdAt: '2026-06-11T17:00:00Z', pricePaid: 0 },
  { id: 'ORD-0035', status: 'DONE', serviceType: 'DRY', customerName: 'ນ. ຄຳລາ', weightKg: 6, createdAt: '2026-06-11T16:20:00Z', pricePaid: 55_000, machineCodes: ['M-04'] },
  { id: 'ORD-0034', status: 'DONE', serviceType: 'WASH_DRY', customerName: 'ທ. ວິໄລ', weightKg: 9, createdAt: '2026-06-11T15:10:00Z', pricePaid: 105_000, machineCodes: ['M-01', 'M-03'] },
  { id: 'ORD-0033', status: 'DONE', serviceType: 'WASH', customerName: 'ທ. ສຸດາ', weightKg: 4, createdAt: '2026-06-11T14:00:00Z', pricePaid: 40_000, machineCodes: ['M-02'] },
  { id: 'ORD-0032', status: 'DONE', serviceType: 'WASH', customerName: 'ທ. ພົງ', weightKg: 6, createdAt: '2026-06-11T13:00:00Z', pricePaid: 55_000, machineCodes: ['M-01'] },
  { id: 'ORD-0031', status: 'DONE', serviceType: 'DRY', customerName: 'ນ. ຄຳລາ', weightKg: 5, createdAt: '2026-06-11T12:30:00Z', pricePaid: 50_000, machineCodes: ['M-03'] },
  { id: 'ORD-0030', status: 'DONE', serviceType: 'WASH_DRY', customerName: 'ທ. ວິໄລ', weightKg: 7, createdAt: '2026-06-11T11:00:00Z', pricePaid: 80_000, machineCodes: ['M-02', 'M-04'] },
];

const DEMO_SLIPS: Slip[] = [
  { id: 'slip-001', amount: 200_000, customerName: 'ທ. ສຸດາ', ocrConfidence: 92, ocrReason: 'Amount matched, QR verified', qrRef: 'QR-20240612-001', bank: 'BCEL', slipUrl: '', submittedAt: '2026-06-12T09:10:00Z' },
  { id: 'slip-002', amount: 150_000, customerName: 'ທ. ພົງ', ocrConfidence: 78, ocrReason: 'Low image quality, amount estimated', qrRef: 'QR-20240612-002', bank: 'LDB', slipUrl: '', submittedAt: '2026-06-12T08:55:00Z' },
  { id: 'slip-003', amount: 300_000, customerName: 'ນ. ຄຳລາ', ocrConfidence: 87, ocrReason: 'Amount clear, date matched', qrRef: 'QR-20240612-003', bank: 'BCEL', slipUrl: '', submittedAt: '2026-06-12T07:30:00Z' },
  { id: 'slip-004', amount: 100_000, customerName: 'ທ. ວິໄລ', ocrConfidence: 95, ocrReason: 'High confidence, all fields verified', qrRef: 'QR-20240611-018', bank: 'APB', slipUrl: '', submittedAt: '2026-06-11T22:40:00Z' },
];

const DEMO_SETTLEMENTS: Settlement[] = [
  { id: 'set-001', periodStart: '2026-06-01', periodEnd: '2026-06-07', revenueKip: 8_750_000, commissionKip: 875_000, netKip: 7_875_000, status: 'PAID', paidAt: '2026-06-09' },
  { id: 'set-002', periodStart: '2026-06-08', periodEnd: '2026-06-14', revenueKip: 12_400_000, commissionKip: 1_240_000, netKip: 11_160_000, status: 'PENDING' },
  { id: 'set-003', periodStart: '2026-05-25', periodEnd: '2026-05-31', revenueKip: 9_200_000, commissionKip: 920_000, netKip: 8_280_000, status: 'PAID', paidAt: '2026-06-02' },
  { id: 'set-004', periodStart: '2026-05-18', periodEnd: '2026-05-24', revenueKip: 7_600_000, commissionKip: 760_000, netKip: 6_840_000, status: 'PAID', paidAt: '2026-05-26' },
];

const DEMO_HOURLY: HourlyBucket[] = [
  { hour: 8, ordersCount: 2 },
  { hour: 9, ordersCount: 5 },
  { hour: 10, ordersCount: 7 },
  { hour: 11, ordersCount: 4 },
  { hour: 12, ordersCount: 3 },
  { hour: 13, ordersCount: 6 },
  { hour: 14, ordersCount: 8 },
  { hour: 15, ordersCount: 9 },
  { hour: 16, ordersCount: 6 },
  { hour: 17, ordersCount: 4 },
  { hour: 18, ordersCount: 7 },
  { hour: 19, ordersCount: 5 },
  { hour: 20, ordersCount: 2 },
];

// ─── HTTP helper ───────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, token: string | null, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── API methods ───────────────────────────────────────────────────────────

export async function getSummary(token: string | null): Promise<OwnerSummary> {
  try {
    return await apiFetch<OwnerSummary>('/bff/owner/summary', token);
  } catch {
    return DEMO_SUMMARY;
  }
}

export async function listMachines(token: string | null): Promise<MachineCard[]> {
  try {
    return await apiFetch<MachineCard[]>('/bff/owner/machines', token);
  } catch {
    return DEMO_MACHINES;
  }
}

export async function listOrders(token: string | null, status?: string): Promise<Order[]> {
  try {
    const qs = status && status !== 'ALL' ? `?status=${encodeURIComponent(status)}` : '';
    return await apiFetch<Order[]>(`/bff/owner/orders${qs}`, token);
  } catch {
    if (status && status !== 'ALL') {
      return DEMO_ORDERS.filter((o) => o.status === status);
    }
    return DEMO_ORDERS;
  }
}

export async function listSlips(token: string | null): Promise<Slip[]> {
  try {
    return await apiFetch<Slip[]>('/bff/owner/slips?status=PENDING', token);
  } catch {
    return DEMO_SLIPS;
  }
}

export async function approveSlip(token: string | null, slipId: string): Promise<void> {
  try {
    await apiFetch(`/bff/owner/slips/${slipId}/approve`, token, { method: 'POST' });
  } catch {
    // demo: no-op
  }
}

export async function rejectSlip(token: string | null, slipId: string, reason: string): Promise<void> {
  try {
    await apiFetch(`/bff/owner/slips/${slipId}/reject`, token, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  } catch {
    // demo: no-op
  }
}

export async function listSettlements(token: string | null): Promise<Settlement[]> {
  try {
    return await apiFetch<Settlement[]>('/bff/owner/settlements', token);
  } catch {
    return DEMO_SETTLEMENTS;
  }
}

export async function getHourlyStats(token: string | null): Promise<HourlyBucket[]> {
  try {
    return await apiFetch<HourlyBucket[]>('/bff/owner/stats/hourly', token);
  } catch {
    return DEMO_HOURLY;
  }
}

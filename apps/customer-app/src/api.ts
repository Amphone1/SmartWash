import Constants from 'expo-constants';
import { resolveDevUrl } from './dev-host';

const BASE_URL: string = resolveDevUrl(
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
    'http://localhost:8088/api',
);

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface Branch {
  id: string;
  name: string;
  nameLao?: string;
  address: string;
  distanceKm?: number;
  hours: string;
}

export interface Machine {
  id: string;
  code: string;
  type: string;
  capacityKg: number;
  price: number;
  state: 'IDLE' | 'RUNNING' | 'RESERVED' | 'OFFLINE';
  progressPct?: number;
  minutesLeft?: number;
  queueCount?: number;
}

export interface Order {
  id: string;
  status: string;
  serviceType: string;
  weightKg: number;
  branchName: string;
  createdAt: string;
  pricePaid?: number;
  estimatedMinutes?: number;
  progressPct?: number;
  driverName?: string;
  driverRating?: number;
}

/**
 * The BFF/order service returns { state, type, branchId, total, ... }. Map it to
 * the screen-facing Order shape so a missing field can never crash a render
 * (e.g. order.status.replace on undefined). Fields the API doesn't carry yet
 * (weightKg, branchName, driver*) fall back to safe defaults.
 */
interface RawOrder {
  id: string;
  state?: string;
  status?: string;
  type?: string;
  serviceType?: string;
  branchId?: string;
  branchName?: string;
  total?: number;
  pricePaid?: number;
  weightKg?: number;
  createdAt: string;
  estimatedMinutes?: number;
  progressPct?: number;
  driverName?: string;
  driverRating?: number;
}

function normalizeOrder(r: RawOrder): Order {
  return {
    id: r.id,
    status: r.status ?? r.state ?? 'PENDING',
    serviceType: r.serviceType ?? r.type ?? '',
    weightKg: r.weightKg ?? 0,
    branchName: r.branchName ?? r.branchId ?? '',
    createdAt: r.createdAt,
    pricePaid: r.pricePaid ?? r.total,
    estimatedMinutes: r.estimatedMinutes,
    progressPct: r.progressPct,
    driverName: r.driverName,
    driverRating: r.driverRating,
  };
}

export interface Delivery {
  id: string;
  status: string;
  estimatedArrival: string;
  driverName: string;
  driverVehicle: string;
  driverPlate: string;
  driverRating: number;
  distanceKm: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface WalletBalance {
  balanceKip: number;
}

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  isDefault: boolean;
  createdAt: string;
}

export interface QrPayment {
  qrRef: string;
  expiresAt: string;
  qrImageUrl: string;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function mapHttpError(status: number): string {
  if (status === 401) return 'Session expired. Please log in again.';
  if (status === 409) return 'Action already in progress.';
  if (status >= 500) return 'Server error. Please try again.';
  return `Request failed (${status}).`;
}

async function request<T>(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(mapHttpError(res.status));
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

function get<T>(path: string, token: string): Promise<T> {
  return request<T>('GET', path, token);
}

function post<T>(path: string, token: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, token, body);
}

// ─── API methods ──────────────────────────────────────────────────────────────

async function postIdem<T>(path: string, token: string, body?: unknown): Promise<T> {
  const key = crypto.randomUUID();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(mapHttpError(res.status));
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const api = {
  listBranches: (token: string) => get<Branch[]>('/bff/branches', token),

  listMachines: (token: string, branchId: string) =>
    get<Machine[]>(`/bff/branches/${branchId}/machines`, token),

  /** BFF expects: branchId, machineId, type (self_service|pickup|delivery), cycle? */
  createOrder: (
    token: string,
    payload: {
      branchId: string;
      machineId: string;
      type: 'self_service' | 'pickup' | 'delivery';
      cycle?: 'quick' | 'normal' | 'heavy';
    },
  ) => postIdem<RawOrder>('/bff/orders', token, payload).then(normalizeOrder),

  joinQueue: (token: string, machineId: string) =>
    postIdem<{ queuePosition: number }>(`/bff/queues/${machineId}/join`, token),

  getOrder: (token: string, orderId: string) =>
    get<RawOrder>(`/bff/orders/${orderId}`, token).then(normalizeOrder),

  listOrders: (token: string) =>
    get<RawOrder[]>('/bff/orders', token).then((rows) => rows.map(normalizeOrder)),

  getWallet: async (token: string): Promise<WalletBalance> => {
    // BFF returns { balance, currency, ... } — normalise to balanceKip (kip).
    const raw = await get<{ balance?: number; balanceKip?: number }>(
      '/bff/wallet',
      token,
    );
    return { balanceKip: raw.balanceKip ?? raw.balance ?? 0 };
  },

  createTopupQr: (token: string, amountKip: number) =>
    postIdem<QrPayment>('/bff/payments', token, { type: 'topup', amount: amountKip }),

  getPaymentStatus: (token: string, qrRef: string) =>
    get<{ status: string }>(`/bff/payments/${qrRef}`, token),

  listNotifications: (token: string) =>
    get<Notification[]>('/bff/notifications', token),

  markAllRead: (token: string) =>
    post<void>('/bff/notifications/read-all', token),

  /** orderId in path; pickup+dropoff coords in body */
  requestDelivery: (
    token: string,
    orderId: string,
    payload: { pickup: { addr: string; lat: number; lng: number }; dropoff: { addr: string; lat: number; lng: number } },
  ) => post<Delivery>(`/bff/orders/${orderId}/request-delivery`, token, payload),

  getDeliveryTracking: (token: string, deliveryId: string) =>
    get<Delivery>(`/bff/deliveries/${deliveryId}/track`, token),

  submitRating: (
    token: string,
    payload: {
      orderId: string;
      rating: number;
      tags: string[];
      comment?: string;
    },
  ) => postIdem<void>('/bff/ratings', token, payload),

  listAddresses: (token: string) => get<SavedAddress[]>('/bff/addresses', token),

  createAddress: (
    token: string,
    payload: { label: string; address: string; lat: number; lng: number; isDefault?: boolean },
  ) => post<SavedAddress>('/bff/addresses', token, payload),

  deleteAddress: (token: string, id: string) =>
    request<void>('DELETE', `/bff/addresses/${id}`, token),
};

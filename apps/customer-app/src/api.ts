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
  ) => postIdem<Order>('/bff/orders', token, payload),

  joinQueue: (token: string, machineId: string) =>
    postIdem<{ queuePosition: number }>(`/bff/queues/${machineId}/join`, token),

  getOrder: (token: string, orderId: string) =>
    get<Order>(`/bff/orders/${orderId}`, token),

  listOrders: (token: string) => get<Order[]>('/bff/orders', token),

  getWallet: (token: string) => get<WalletBalance>('/bff/wallet', token),

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

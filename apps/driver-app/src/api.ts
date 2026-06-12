import Constants from 'expo-constants';

const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  'http://localhost:8088/api';

export interface DriverTask {
  id: string;
  type: 'PICKUP' | 'DELIVERY';
  status: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  feeKip: number;
  distanceKm: number;
  orderId: string;
}

export interface TaskDetail extends DriverTask {
  notes?: string;
  items: Array<{ name: string; qty: number }>;
}

export interface EarningsData {
  todayKip: number;
  weekKip: number;
  monthKip: number;
  tripsToday: number;
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const HTTP_ERRORS: Record<number, string> = {
  400: 'Invalid request. Please check your input.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested item was not found.',
  409: 'This action conflicts with the current state.',
  422: 'The server could not process this request.',
  429: 'Too many requests. Please wait a moment.',
  500: 'Server error. Please try again later.',
  503: 'Service unavailable. Please try again later.',
};

let _token: string | null = null;

export function setAuthToken(token: string | null) {
  _token = token;
}

async function call<T>(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  if (method === 'POST') headers['Idempotency-Key'] = uuid();

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const friendly = HTTP_ERRORS[res.status];
    if (friendly) throw new Error(friendly);
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed (${res.status})`);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const api = {
  listTasks: () => call<DriverTask[]>('/bff/driver/deliveries'),
  getTask: (id: string) => call<TaskDetail>(`/bff/driver/deliveries/${id}`),
  acceptTask: (id: string) => call<void>(`/bff/driver/deliveries/${id}/accept`, 'POST'),
  rejectTask: (id: string) => call<void>(`/bff/driver/deliveries/${id}/reject`, 'POST'),
  advanceTask: (id: string, state: string) =>
    call<void>(`/bff/driver/deliveries/${id}/state`, 'POST', { state }),
  updateLocation: (lat: number, lon: number) =>
    call<void>('/bff/driver/location', 'POST', { lat, lon }),
  getEarnings: () => call<EarningsData>('/bff/driver/earnings'),
};

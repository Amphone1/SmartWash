/** Driver BFF client. All calls go through the Traefik gateway (/api/bff/driver). */
import Constants from 'expo-constants';

const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  'http://localhost:8088/api';

export interface Delivery {
  id: string;
  orderId: string;
  state: string;
  fee: number;
  pickup: { addr: string | null; lat: number; lng: number };
  dropoff: { addr: string | null; lat: number; lng: number };
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function call(
  path: string,
  token: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(method === 'POST' ? { 'idempotency-key': uuid() } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  deliveries: (token: string) =>
    call('/bff/driver/deliveries', token) as Promise<Delivery[]>,
  accept: (token: string, id: string) =>
    call(`/bff/driver/deliveries/${id}/accept`, token, 'POST'),
  reject: (token: string, id: string) =>
    call(`/bff/driver/deliveries/${id}/reject`, token, 'POST'),
  advance: (token: string, id: string, to: string) =>
    call(`/bff/driver/deliveries/${id}/advance`, token, 'POST', { to }),
  complete: (token: string, id: string) =>
    call(`/bff/driver/deliveries/${id}/complete`, token, 'POST'),
  reportLocation: (token: string, lat: number, lng: number) =>
    call('/bff/driver/location', token, 'POST', { lat, lng }),
};

// Shared helpers for k6 scripts.
export const BASE = __ENV.BASE_URL || 'http://localhost:8088/api';
export const TOKEN = __ENV.K6_TOKEN || '';

export function authHeaders(extra) {
  return Object.assign(
    { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    extra || {},
  );
}

// RFC4122-ish v4 for Idempotency-Key headers.
export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

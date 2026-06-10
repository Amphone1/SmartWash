// Smoke test: the gateway is up and auth is enforced.
//   k6 run tools/k6/smoke.js
import http from 'k6/http';
import { check } from 'k6';
import { BASE } from './lib.js';

export const options = {
  vus: 5,
  duration: '15s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  // No token → the BFF must reject with 401 (auth enforced at the edge).
  const res = http.get(`${BASE}/bff/branches`);
  check(res, {
    'gateway reachable': (r) => r.status !== 0,
    'auth enforced (401 without token)': (r) => r.status === 401,
  });
}

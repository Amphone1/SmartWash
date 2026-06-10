// Topup flow load test (requires a customer token).
//   K6_TOKEN=<jwt> k6 run tools/k6/topup.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE, TOKEN, authHeaders, uuid } from './lib.js';

export const options = {
  scenarios: {
    topups: { executor: 'ramping-vus', startVUs: 0, stages: [
      { duration: '20s', target: 20 },
      { duration: '40s', target: 20 },
      { duration: '10s', target: 0 },
    ] },
  },
  thresholds: {
    http_req_duration: ['p(95)<800'],
    checks: ['rate>0.95'],
  },
};

export default function () {
  if (!TOKEN) throw new Error('set K6_TOKEN to a customer access token');

  // 1) Create a topup payment request (QR).
  const create = http.post(
    `${BASE}/bff/payments`,
    JSON.stringify({ type: 'topup', amount: 50000 }),
    { headers: authHeaders({ 'Idempotency-Key': uuid() }) },
  );
  check(create, { 'payment created (201)': (r) => r.status === 201 });

  // 2) Poll wallet balance (read path).
  const wallet = http.get(`${BASE}/bff/wallet`, { headers: authHeaders() });
  check(wallet, { 'wallet readable': (r) => r.status === 200 });

  sleep(1);
}

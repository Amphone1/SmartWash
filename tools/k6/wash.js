// Self-service wash flow load test (requires a customer token + seed ids).
//   K6_TOKEN=<jwt> BRANCH_ID=<uuid> MACHINE_ID=<uuid> k6 run tools/k6/wash.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE, TOKEN, authHeaders, uuid } from './lib.js';

const BRANCH_ID = __ENV.BRANCH_ID || '';
const MACHINE_ID = __ENV.MACHINE_ID || '';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: { http_req_duration: ['p(95)<800'], checks: ['rate>0.9'] },
};

export default function () {
  if (!TOKEN || !BRANCH_ID || !MACHINE_ID) {
    throw new Error('set K6_TOKEN, BRANCH_ID, MACHINE_ID');
  }

  // Create + reserve an order (machine lock contention is expected under load).
  const order = http.post(
    `${BASE}/bff/orders`,
    JSON.stringify({
      branchId: BRANCH_ID,
      machineId: MACHINE_ID,
      type: 'self_service',
      cycle: 'normal',
    }),
    { headers: authHeaders({ 'Idempotency-Key': uuid() }) },
  );
  // 201 reserved, or 409 when the machine is already locked — both are valid.
  check(order, { 'order create handled': (r) => r.status === 201 || r.status === 409 });

  sleep(1);
}

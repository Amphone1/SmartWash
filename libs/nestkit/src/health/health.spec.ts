import { HealthService, type ReadinessCheck } from './health';

const up: ReadinessCheck = { name: 'a', check: () => true };
const down: ReadinessCheck = { name: 'b', check: () => false };
const throws: ReadinessCheck = {
  name: 'c',
  check: () => {
    throw new Error('boom');
  },
};

describe('HealthService', () => {
  it('reports up when all checks pass', async () => {
    const svc = new HealthService([up]);
    await expect(svc.readiness()).resolves.toEqual({
      status: 'up',
      checks: { a: 'up' },
    });
  });

  it('throws 503 when a check is down', async () => {
    const svc = new HealthService([up, down]);
    await expect(svc.readiness()).rejects.toMatchObject({
      response: { status: 'down', checks: { a: 'up', b: 'down' } },
    });
  });

  it('treats a throwing check as down', async () => {
    const svc = new HealthService([throws]);
    await expect(svc.readiness()).rejects.toBeDefined();
  });

  it('is up with no checks registered', async () => {
    const svc = new HealthService([]);
    await expect(svc.readiness()).resolves.toEqual({ status: 'up', checks: {} });
  });
});

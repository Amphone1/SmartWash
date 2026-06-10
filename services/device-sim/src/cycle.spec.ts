import { buildCycle } from './cycle';

describe('buildCycle', () => {
  it('starts STARTING and ends IDLE, passing through FINISHING', () => {
    const steps = buildCycle();
    expect(steps[0].status).toBe('STARTING');
    expect(steps.at(-1)!.status).toBe('IDLE');
    expect(steps.some((s) => s.status === 'FINISHING')).toBe(true);
    expect(steps.some((s) => s.status === 'RUNNING')).toBe(true);
  });

  it('has monotonically non-decreasing progress until FINISHING', () => {
    const steps = buildCycle(8, 30).filter((s) => s.status !== 'IDLE');
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].progress).toBeGreaterThanOrEqual(steps[i - 1].progress);
    }
    expect(steps.at(-1)!.progress).toBe(100);
  });

  it('respects the running tick count', () => {
    expect(buildCycle(3).filter((s) => s.status === 'RUNNING')).toHaveLength(3);
  });
});

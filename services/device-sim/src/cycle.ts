/** Pure wash-cycle status sequence a simulated WISE-4051 emits after START. */
export interface CycleStep {
  status: 'STARTING' | 'RUNNING' | 'FINISHING' | 'IDLE';
  progress: number; // 0..100
  remaining: number; // minutes
}

export function buildCycle(runningTicks = 8, totalMinutes = 30): CycleStep[] {
  const steps: CycleStep[] = [
    { status: 'STARTING', progress: 0, remaining: totalMinutes },
  ];
  for (let i = 1; i <= runningTicks; i++) {
    const progress = Math.round((i / (runningTicks + 1)) * 100);
    const remaining = Math.round(totalMinutes * (1 - progress / 100));
    steps.push({ status: 'RUNNING', progress, remaining });
  }
  steps.push({ status: 'FINISHING', progress: 100, remaining: 0 });
  steps.push({ status: 'IDLE', progress: 0, remaining: 0 });
  return steps;
}

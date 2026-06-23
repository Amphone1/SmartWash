/**
 * A5 dual-write feature flags (default OFF). Read from env per call so a config
 * roll (+ restart) takes effect without a code deploy.
 *
 *   LEDGER_DUAL_WRITE_MODE  = off | shadow_fail_open | shadow_fail_closed   (default off)
 *   LEDGER_DUAL_WRITE_FLOWS = csv of topup,wash,delivery,refund,adjust       (default none)
 *   LEDGER_SHADOW_RECONCILE = on | off                                       (default on)
 */
import { optionalEnv } from '@smartwash/nestkit';

export type DualWriteMode = 'off' | 'shadow_fail_open' | 'shadow_fail_closed';

export interface DualWriteConfig {
  mode: DualWriteMode;
  flows: ReadonlySet<string>;
  reconcile: boolean;
}

const MODES: readonly DualWriteMode[] = ['off', 'shadow_fail_open', 'shadow_fail_closed'];

export function readDualWriteConfig(): DualWriteConfig {
  const raw = optionalEnv('LEDGER_DUAL_WRITE_MODE', 'off');
  const mode = (MODES as readonly string[]).includes(raw) ? (raw as DualWriteMode) : 'off';
  const flows = new Set(
    optionalEnv('LEDGER_DUAL_WRITE_FLOWS', '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const reconcile = optionalEnv('LEDGER_SHADOW_RECONCILE', 'on') !== 'off';
  return { mode, flows, reconcile };
}

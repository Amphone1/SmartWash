# A5_READINESS_REVIEW.md — readiness to start increment A5

> Assesses whether EPIC A increment **A5** is ready to start, given A1–A4 are complete.
> Generated 2026-06-19. **Read-only — no source changed.** Decision only; A5 is
> STOP-and-ask. ⚠️ **A5 is the first increment that writes the new ledger on live traffic.**

## What A5 is (from `REMEDIATION_PLAN.md`)
> *Dual-write shim + shadow reconcile, per-flow drift counters, flag `LEDGER_DUAL_WRITE`.*
> Live money? **⚠️ writes twice (legacy authoritative).** Gate to advance:
> **same-DB-txn · staging zero-drift.**

Legacy single-entry `ledger_entries` stays **authoritative** (all reads, all decisions).
A5 additionally writes the new double-entry transaction (A4) **in the same DB transaction**,
then shadow-reconciles the two and counts drift per flow — proving equivalence on real
traffic before any cutover (A8). Rollback is "flip `LEDGER_DUAL_WRITE` off."

## A5 prerequisites checklist
| # | Prerequisite | State | Evidence |
|---|---|---|---|
| 1 | A4 `postTransaction()` write path | ✅ | `pg-transaction.repository.ts` (6/6 int gate) |
| 2 | A3 builders to translate ops → intents | ✅ | `posting-rules.ts` |
| 3 | A2 resolver / A1 schema + triggers | ✅ | A1/A2 verifies green |
| 4 | Legacy write path to shim onto | ✅ | `pg-ledger.repository.ts` (`postAtomic`/`postRefund`) |
| 5 | Metrics infra for drift counters | ✅ | `@smartwash/nestkit` `MetricsModule` |
| 6 | Atomic-txn primitive | ✅ | `Database.withTransaction` |

Prereqs **met.** A5 design decisions to settle in its plan (these are the substance of A5):

| # | A5 design item | Why it matters |
|---|---|---|
| **D1** | **Same-DB-txn wiring.** A4 `post()` opens its *own* transaction. A5 must run the new write on the **legacy write's client** so both commit/rollback together → extract `postWithClient(client, intent)` from `post()`. | Gate explicitly requires same-DB-txn. |
| **D2** | **Operation mapping + context.** The legacy single-entry call (`user_id, type, amount, ref`) lacks `branchId`, `vatBps`, `channel` needed to build CAPTURE/TOPUP/etc. The shim likely hooks at the **saga / use-case layer** (where that context exists), not at bare `ledger.post`. | Wrong hook point = unbuildable intents. |
| **D3** | **Failure policy.** Same-DB-txn means a new-write throw **rolls back the legacy too** — a bug in the new path could break live money. Decide: (a) gate dual-write behind a staging-proven flag and fail-closed, or (b) capture new-write errors as drift without failing legacy (not same-txn). | This is the central A5 risk. |
| **D4** | **Shadow reconcile + drift counters.** Per flow (topup/wash/refund): compare new-ledger-derived balance vs legacy `balance_after`; emit Prometheus counters; alert on any drift. | The advance gate is "staging zero-drift". |
| **D5** | **Flag `LEDGER_DUAL_WRITE`** (env, default **off**) + per-flow sub-flags so topup can dual-write before wash/refund. | Incremental, reversible rollout. |

## Risk note (elevated)
A5 is the **highest-risk increment so far** — first new-ledger write on live money. The
same-DB-txn requirement (D3) couples the unproven new path to live transactions. Mitigations
to bake into the A5 plan: default-off flag, **staging zero-drift before any prod enable**,
per-flow rollout (topup → wash → refund), instant flip-back, and (recommended) a
try/observe wrapper so the new write cannot abort the authoritative legacy write until it
has proven itself in staging.

## GO / NO-GO recommendation for A5
**🟢 GO to start A5 — design-first, with explicit risk gates.** All prerequisites are in
place. Because A5 first touches live money, the implementation plan **must** be reviewed and
approved before any code, and must specify: the `postWithClient` refactor (D1), the hook
point + context source (D2), the failure policy (D3), the drift-counter/shadow-reconcile
design (D4), and the flag topology (D5) — with a **staging zero-drift gate** before any
production enablement.

**Carry-over (not A5 work):** open findings in `A1_A2_COMPLETION_REPORT.md` §6–§7 (B3/B4,
contract coverage, `LedgerPosted` v2 consumer, H1/H5, doc-hygiene), and the A3 VAT-rounding
policy awaiting finance sign-off, remain tracked to their owning increments.

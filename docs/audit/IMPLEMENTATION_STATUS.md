# IMPLEMENTATION_STATUS.md — epic & increment status

> **Read-only snapshot.** Generated 2026-06-19. Modifies nothing. Source of truth for
> intent: `docs/audit/REMEDIATION_PLAN.md` (EPIC A…G). This report reconciles that plan
> against what actually exists on disk / in git as of the assessment.
> Status legend: ✅ applied · 🟢 design-approved, not started · 🟡 in progress ·
> ⬜ not started · 🔭 reserved (no code) · ⛔ blocked.

## Quick-win hardening (pre-EPIC)
| Item | Scope | Status | Evidence |
|---|---|---|---|
| **B2** | Append-only DB enforcement | ✅ applied | `infra/db/init/06_append_only_enforcement.sql` (ADR-0002) |
| **H2** | audit & notification deployable in CI | ✅ applied | `.github/workflows/ci.yml` matrix + rollout (ADR-0008) |

*(Both on disk; uncommitted — see `PROJECT_STATUS_REPORT.md` §2.)*

## EPIC A — Double-entry ledger (A1–A9)
| Inc | Scope | Status | Evidence / notes |
|---|---|---|---|
| **A1** | Additive schema: `accounts`, `ledger_transactions`, `ledger_postings`, `wallet_balances` + balanced/append-only triggers | ✅ **applied** | `infra/db/init/07_double_entry_ledger.sql` + `tests/07_…verify.sql` (CI-wired). Not in a live money path. |
| **A2** | Chart-of-accounts seed + `resolveAccount()`; vendor/franchise enum-only | 🟢 **design-approved, NOT started (HELD)** | Design: `docs/design/A2_ACCOUNTS_DESIGN.md` (resolves `A2_REVIEW.md` F1–F13). Migration `08` **not yet created**. Implementation paused by user for this assessment. |
| **A3** | Pure posting-rules / transaction builder (9 ops, Σ DR=Σ CR, VAT floor+remainder) | ⬜ not started | — |
| **A4** | `postTransaction()` repo (advisory-lock, dedup, outbox `posted.v2`) | ⬜ not started | — |
| **A5** | Dual-write shim + shadow reconcile, flag `LEDGER_DUAL_WRITE` | ⬜ not started | first increment that writes the new ledger (legacy still authoritative) |
| **A6** | Inbox + DLQ (`processed_events`, `*.dlq`, re-drive) | ⬜ not started | folds in EPIC D consume-side |
| **A7** | Wallet 4-balance projection (`posted.v2`), monotonic `last_txn_id`, L1 reconcile | ⬜ not started | absorbs EPIC B; gated by L1 (EPIC C) |
| A8a/b/c | Per-flow read cutover (topup → wash → refund), 7-day zero-drift gates | ⬜ not started | out of A1–A7 scope (listed for completeness) |
| A9 | Stop legacy writes; `ledger_entries` → read-only; remove shim | ⬜ not started | only irreversible step; far out |

**A1–A7 summary:** A1 done; A2 design-approved and held; **A3–A7 not started.**
Legacy single-entry `ledger_entries` remains authoritative (strangler-fig); nothing in
A1–A2 is on a live money path.

## EPIC B — Wallet (four balances)
**Status:** absorbed into **A7** (`wallet_balances` table already created in A1; projection +
invariants W1/W2/W3 land at A7). Not started as projection logic. (`REMEDIATION_PLAN.md`
marks the standalone epic ⛔ under the old NO-GO; superseded by the A7 folding.)

## EPIC C — Reconciliation & Settlement
**Status:** ⬜ not started. Realized as the **L1/L3 gates of A7/A8**; needs clearing/suspense
accounts (delivered by A2's chart) before it is implementable. ADR-0007 (status text stale
re: NO-GO).

## EPIC D — Event reliability (Inbox / DLQ)
**Status:** 🟢 design-ready, ⬜ not started. `processed_events` inbox + `*.dlq` + re-drive +
`LedgerPosted.v2` (additive). No money-model redesign. Consume-side folds into **A6**.

## EPIC E — DevOps completeness
**Status:** 🟢 partially landed. The **H2 slice is ✅** (audit/notification in CI, ADR-0008).
Remaining ⬜: per-service k8s Deployments (only `deploy-bff.yaml` exists), HPA/limits,
Trivy/dep-audit/secret scanning, Timescale hypertable for `driver_locations`.

## EPIC F — Governance & contracts
**Status:** 🟢 design-ready, ⬜ not started. Reconcile `BUILD_PLAN.md` ↔ `CLAUDE.md`; author
the 6 missing OpenAPI specs (queue, machine, delivery, settlement, reconciliation,
wallet-4-balance); RLS + universal branch filter (H5). Tracked in `CONSISTENCY_REPORT.md`
as 🔴 contract-coverage gaps.

## EPIC G — Tenancy & Loyalty
**Status:** 🔭 reserved, **no code** (ADR-0006). `vendor`/`franchise` exist **only** as
`acct_owner` enum values; A2 explicitly seeds no vendor/franchise accounts and the resolver
+ FK reject them. Nullable `vendor_id`/`franchise_id` and loyalty stubs are design-level only.

## Cross-cutting deliverable state
| Artifact class | State |
|---|---|
| ADRs (0002–0008) | authored; uncommitted; gaps at 0001/0005; 0003/4/7 status text stale |
| Money design pack (4 docs) | approved (`MONEY_MODEL_PROPOSED` §1–5) + A2 design; uncommitted |
| Migrations 05/06/07 + A1 verify | on disk; uncommitted; `08` not created |
| Service code | A1/A2 add no runtime money path yet; 34 modified files are earlier-phase work in flight |
| Tests | A1 DB verify wired in CI; A2 unit/integration tests **not yet written** (in the held plan) |

## What is NOT done (A1–A7 + D/E/F/G), one line
A2 implementation (migration 08 + `resolveAccount()` + tests) · A3 posting rules ·
A4 post repo · A5 dual-write · A6 inbox/DLQ · A7 wallet projection · EPIC C recon jobs ·
EPIC D inbox · EPIC E (k8s/scan/hypertable) · EPIC F (specs/RLS) · EPIC G (all, reserved).

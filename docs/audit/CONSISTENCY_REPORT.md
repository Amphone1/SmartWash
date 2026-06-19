# CONSISTENCY_REPORT.md

> Cross-checks the artifact set before remediation. Verdict per pair:
> 🟢 consistent · 🟡 drift (documented) · 🔴 conflict (must resolve).
> Generated during PHASE A (audit). No source modified by this report.

## Scope
Domain Model (PHASE 0) · ERD (`01_schema.sql` + `MONEY_MODEL_PROPOSED.md`) ·
ADRs (`docs/adr/*`) · Event Catalog (`events.schema.json`) · API Contracts
(`contracts/openapi/*`) · Build Plan (`BUILD_PLAN.md` / `CLAUDE.md`).

## Matrix

| Pair | Verdict | Note |
|---|---|---|
| Domain Model ↔ Current ERD | 🟡 | Schema matches FSM enums & contexts, but has **no Vendor/Franchise/Loyalty** tables and a **single-entry** ledger; both are known gaps (B1, ADR-0006) |
| Domain Model ↔ Proposed ERD | 🟢 | `MONEY_MODEL_PROPOSED.md` adds `accounts`/`ledger_transactions`/`ledger_postings`/`wallet_balances` matching the double-entry contexts |
| Current ERD ↔ Proposed ERD | 🟡 | Intentional divergence: single-entry (live) → double-entry (target). Coexistence + backfill required (ADR-0003); legacy tables kept read-only under ADR-0002 |
| ADRs ↔ Proposed ERD | 🟢 | ADR-0003/0004/0007 are realized by `MONEY_MODEL_PROPOSED.md` §1–§5 |
| ADRs ↔ Build Plan | 🔴 | `BUILD_PLAN.md` predates Flutter, BFF-as-service, libs/nestkit, and the money-model ADRs → **stale; reconcile to CLAUDE.md** (tracked) |
| Event Catalog ↔ ERD | 🟡 | `LedgerPosted` carries a single `balanceAfter`; with four-balance wallet it must carry the affected account + post-balance. **Event needs a v2** (additive) |
| Event Catalog ↔ Code | 🟡 | `OrderStateChanged` enum omits AWAITING_APPROVAL/FAILED/EXPIRED/REJECTED present in `order_state`. Acceptable if not broadcast; document intent |
| API Contracts ↔ Services | 🔴 | Only `order`/`payment`/`ledger` have OpenAPI; **queue, machine, delivery, settlement, reconciliation, wallet(4-balance) missing** → contract drift |
| API Contracts ↔ ADR-0004 | 🔴 | `GET /wallets/{userId}` returns one balance; ADR-0004 requires four → **contract change required** |
| Reliability model ↔ Code | 🟡 | Outbox/idempotency/saga strong; **no Inbox/DLQ**, consumer dedup is LWW (H1/H4) — contract (`events.id` "idempotent consume") not yet enforced |
| owner_account (env) ↔ schema | 🔴 | Global `OWNER_ACCOUNT` env vs per-branch `branches.owner_account` → **resolve to per-branch** (ADR-0007 uses per-branch `bank:branch`) |

## Blocking inconsistencies (must resolve in remediation)
1. **Build Plan stale** vs ADRs/CLAUDE.md (🔴) — reconcile BUILD_PLAN.md.
2. **API contract coverage** (🔴) — author the six missing specs; bump wallet contract for four balances.
3. **owner_account ambiguity** (🔴) — adopt per-branch accounts platform-wide.
4. **LedgerPosted event** needs v2 (🟡→required for four-balance).

## Non-blocking (documented drift, by design)
- Single-entry → double-entry coexistence (ADR-0003 transition).
- Vendor/Franchise/Loyalty absent (reserved, ADR-0006).

## Gate
Inconsistencies exist → **STOP and wait for approval** before generating
implementation artifacts beyond this design pack. **NO-GO remains active.**

# PROJECT_STATUS_REPORT.md — current-state assessment

> **Read-only snapshot.** Generated 2026-06-19. No source, migration, CI, or runtime
> file was modified to produce this report. Companion docs:
> `IMPLEMENTATION_STATUS.md` (epic/increment matrix) and `GO_NO_GO_STATUS.md` (gates).
> Facts below are from `git` + the filesystem at assessment time.

## 1. Repository status
| Field | Value |
|---|---|
| Branch | `main` |
| HEAD | `2c3e3ee` — *fix(apps): derive dev API/Keycloak host from the Metro hostUri* |
| Remote | `origin` → https://github.com/Amphone1/smartwash.git |
| Sync vs `origin/main` | **ahead 2, behind 0** (2 local commits unpushed) |
| Recent commits | last 8 are **all app/Expo work** (`apps/*` SDK 54, LAN dev) |

**Key fact:** the entire money-model program (ADRs, migrations `05/06/07`, the design
pack, the audit pack) and 34 modified service files are **uncommitted in the working
tree** — *none of it is in a commit yet*. The 2 commits ahead of `origin` are Expo/app
changes only. There is currently **no committed restore point** for the A1/B2/H2 work.

## 2. Working-tree status
| Bucket | Count |
|---|---|
| Tracked, modified | **34** |
| Staged | 0 |
| Untracked (excl. node_modules) | **151** |
| — under `apps/smartwash-app/` (Flutter super app) | 126 |
| — under `apps/driver-app/` | 1 |
| — non-app (docs / infra / services / .claude) | 24 |

### 2a. Modified tracked files (34) — grouped
- **Build/infra:** `.github/workflows/ci.yml` (+8/-), `infra/db/init/01_schema.sql` (+7),
  `infra/db/init/02_rbac_seed.sql` (+5), `infra/docker/docker-compose.dev.yml` (+9),
  `tools/seed/keycloak-setup.sh`.
- **Docs:** `CLAUDE.md` (**+528 / heavily rewritten**, uncommitted).
- **Legacy RN app (retiring):** `apps/customer-app/*` (3), `apps/driver-app` (via untracked).
- **Backend services (pre-A2 work in flight):** `bff` (6 files), `payment` (5),
  `ledger` (4), `order` (4), `fraud` (3), `libs/nestkit` idempotency (1).
  These correspond to earlier-phase fixes (e.g. payment top-up BigInt, reporting, IDOR)
  that are **not yet committed**.

### 2b. Untracked highlights (non-app, 24)
- **ADRs (6):** `0002, 0003, 0004, 0006, 0007, 0008` — all new/uncommitted.
- **Audit (3):** `A2_REVIEW.md`, `CONSISTENCY_REPORT.md`, `REMEDIATION_PLAN.md`.
- **Design (4):** `A2_ACCOUNTS_DESIGN.md`, `FINANCIAL_CONTRACT.md`, `MONEY_FLOW_SPEC.md`,
  `MONEY_MODEL_PROPOSED.md`.
- **Migrations (4):** `05_rbac_hardening.sql`, `06_append_only_enforcement.sql`,
  `07_double_entry_ledger.sql`, `tests/07_double_entry_ledger.verify.sql`.
- **Services (3):** `bff/.../staff.controller.ts`, `bff/.../delivery-track.controller.spec.ts`,
  `bff/.../orders.controller.spec.ts`.
- **Tooling (4):** `.claude/settings.json` + 3 `.claude/skills/*`.
- **Flutter super app:** 126 files under `apps/smartwash-app/` (new app, uncommitted).

## 3. Migration status
On-disk migrations (`infra/db/init/`, applied in filename order by `libs/db/src/migrate.ts`):

| File | Git state | Notes |
|---|---|---|
| `01_schema.sql` | **modified** (uncommitted) | base schema; edited in place (+7) |
| `02_rbac_seed.sql` | **modified** (uncommitted) | RBAC seed; edited in place (+5) |
| `03_user_roles_nullable_branch.sql` | clean (committed) | |
| `04_ratings_addresses_notif.sql` | clean (committed) | |
| `05_rbac_hardening.sql` | **untracked** (new) | RBAC hardening |
| `06_append_only_enforcement.sql` | **untracked** (new) | B2 (ADR-0002) |
| `07_double_entry_ledger.sql` | **untracked** (new) | A1 (ADR-0003/4/7) |
| `tests/07_double_entry_ledger.verify.sql` | **untracked** (new) | A1 DB verify (CI-wired) |
| `08_accounts_chart.sql` | **does not exist** | A2 — design proposal only (`docs/design/A2_ACCOUNTS_DESIGN.md`) |

**Runner model:** `migrate.ts` records a SHA-256 of each applied file in `schema_migrations`
and **refuses to re-run a file whose checksum changed** ("migrations are immutable — add a
new file instead of editing this one"). Only top-level `*.sql` are migrations; `tests/*` are
not applied by the runner (run via `psql` in CI).

**⚠️ Integrity risk (M-1):** `01_schema.sql` and `02_rbac_seed.sql` were **edited in place**.
On any persistent database that already applied the originals, `nx run db:migrate` will
**fail with a checksum mismatch**. This only works on a *fresh* DB (CI spins up a clean
PG16 each run; a dev volume that pre-dates the edits would break). See `GO_NO_GO_STATUS.md` R-1.

**Applied state:** cannot be verified from this assessment (no live DB was queried).
`REMEDIATION_PLAN.md` asserts A1 (`07`), B2 (`06`), and H2 are applied; CI applies
`01…07` fresh on every run and then runs the A1 verify (`ci.yml` step "Verify ledger DB
invariants (A1)").

## 4. ADR status
All ADRs are **uncommitted** (untracked). Numbering gaps: **no `0001`, no `0005`**.

| ADR | Title | Stated status | Reality |
|---|---|---|---|
| 0002 | Append-only DB enforcement | Accepted (applied — `06`) | ✅ migration on disk |
| 0003 | Double-entry ledger + chart | Accepted (design approved; *"gated by NO-GO"*) | A1 schema applied; **status text stale** (NO-GO lifted) |
| 0004 | Four-balance wallet | Accepted (design approved; *"gated by NO-GO"*) | table exists (A1); **status text stale** |
| 0006 | Tenancy vendor→franchise | Accepted — **reserved, NOT implemented** | enum values only |
| 0007 | Reconciliation L1/L2/L3 | Accepted (design approved; *"gated by NO-GO"*) | not implemented; **status text stale** |
| 0008 | Deploy completeness (audit/notif in CI) | Accepted (applied — `ci.yml`) | ✅ H2 slice |

**Note (A-1):** ADR-0003/0004/0007 still carry *"implementation gated by NO-GO"* although the
NO-GO was lifted on 2026-06-17 (§6). The ADR headers are stale relative to `REMEDIATION_PLAN.md`.

## 5. Audit status
`docs/audit/` (all uncommitted):
- `CONSISTENCY_REPORT.md` — pre-remediation cross-check; its gate still reads **"NO-GO remains
  active"** → **stale** (predates the lift). See A-2 in `GO_NO_GO_STATUS.md`.
- `REMEDIATION_PLAN.md` — authoritative tracker; **NO-GO lifted**, EPIC A in progress (A1 ✅).
- `A2_REVIEW.md` — A2 audit; verdict **conditional GO** after corrections (now addressed by
  the A2 design).
- `A2_ACCOUNTS_DESIGN.md` (in `docs/design/`) — revised A2 + Migration 08 proposal; **approved
  for implementation**, which is currently **held** at user request (this assessment).
- *(this report set)* `PROJECT_STATUS_REPORT.md`, `IMPLEMENTATION_STATUS.md`, `GO_NO_GO_STATUS.md`.

## 6. NO-GO status
- **Lifted 2026-06-17** (`REMEDIATION_PLAN.md`): the five money-model artifacts
  (`MONEY_MODEL_PROPOSED.md` §1–§5) are approved.
- **Money epics remain STOP-and-ask at every increment** (per CLAUDE.md + the plan).
- **A2 implementation is additionally on HOLD** by explicit user instruction pending this
  current-state assessment.
- One stale contradiction remains in `CONSISTENCY_REPORT.md` (still says NO-GO active) — a
  doc-hygiene item, not an active gate.

## 7. Phase context
`CLAUDE.md` declares **PHASE 1** (Identity + Core); Phase 0 complete. The money-model
remediation (EPIC A…G) runs as a STOP-and-ask track alongside the phase ladder and is the
current active workstream.

## 8. Headline risks (detail in `GO_NO_GO_STATUS.md`)
1. **R-1 / M-1:** in-place edits to `01`/`02` break the immutable-migration runner on a
   persistent DB.
2. **R-2:** large uncommitted surface (money pack + 34 service files + 126-file Flutter app +
   rewritten CLAUDE.md) → **no commit-level restore point**; review/rollback is harder.
3. **R-3:** stale status text in ADR-0003/4/7 and `CONSISTENCY_REPORT.md` vs the lifted NO-GO.

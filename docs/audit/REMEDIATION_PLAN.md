# REMEDIATION_PLAN.md

> Remediation for the enterprise audit findings. **NO-GO LIFTED (2026-06-17)** — the
> five money-model artifacts (`MONEY_MODEL_PROPOSED.md`) are approved. EPIC A is in
> progress (A1, A2, A3, A4, A6 applied; A5 code applied behind flags, default OFF, not
> prod-enabled). Money epics remain STOP-and-ask at every step.
>
> **Execution rules (per approval):** one domain at a time · tests first ·
> migrations first · rollback required · update docs + ADRs · never bypass ledger,
> mutate balances directly, skip reconciliation/audit/idempotency.

## Status legend
✅ applied · 🟢 ready (design approved) · ⛔ blocked by NO-GO · 🔭 future extension

---

## Already applied (quick-win hardening)

### B2 — Append-only DB enforcement ✅
- **Root cause:** rule #2 enforced by convention only; no DB guard.
- **Fix:** `infra/db/init/06_append_only_enforcement.sql` — triggers + REVOKE on
  `ledger_entries`, `audit_log`, `order_events`, `machine_events`.
- **Impact:** UPDATE/DELETE on those tables now raise; corrections must be new rows.
- **Risk:** low — verified all four are INSERT-only in code; caches excluded.
- **Rollback:** `DROP TRIGGER trg_<t>_append_only` + re-`GRANT` (new migration).

### H2 — audit & notification deployability ✅
- **Root cause:** both absent from CI `images` matrix + deploy loop → no image built.
- **Fix:** added to `.github/workflows/ci.yml` (matrix + rollout list).
- **Impact:** audit trail & notifications become buildable/deployable.
- **Risk:** low — both have Dockerfile/project.json. **Follow-up:** author k8s
  Deployment manifests (only `deploy-bff.yaml` exists) — EPIC E below.
- **Rollback:** revert the two CI hunks.

---

## EPIC A — Ledger (double-entry) 🟢 IN PROGRESS

Strategy: **strangler-fig / parallel-run** — legacy single-entry `ledger_entries`
stays authoritative and untouched until the new double-entry ledger is proven
equivalent on real traffic, then a **per-flow flagged cutover**. Rollback is always
"flip a flag back." Locked decisions: 7-day zero-drift bake gate · inbox/DLQ before
the wallet projection · per-flow cutover (topup→wash→refund) · vendor/franchise enum
reserved, no accounts. Every increment is one PR, tests-first, STOP-and-ask.

| Inc | Scope | Live money path? | Gate to advance | Status |
|---|---|---|---|---|
| A1 | Additive schema (`accounts`, `ledger_transactions`, `ledger_postings`, `wallet_balances`) + balanced/append-only triggers — `07_double_entry_ledger.sql` (+ verify.sql) | ❌ | migration clean; DB verify green | ✅ applied |
| A2 | Chart-of-accounts seed + `resolveAccount()`; vendor/franchise enum only | ❌ | all contract accounts resolvable; idempotent create | ✅ applied |
| A3 | Pure posting-rules / transaction builder (9 ops, `Σ DR=Σ CR`, VAT floor+remainder) | ❌ | unit tests per op + rounding | ✅ applied |
| A4 | `postTransaction()` repo (advisory-lock, dedup, outbox `posted.v2`) — unused | ❌ | integration tests (balanced/replay/concurrency/overdraft) | ✅ applied |
| A5 | Dual-write shim + shadow reconcile, per-flow drift counters, flag `LEDGER_DUAL_WRITE` | ⚠️ writes twice (legacy authoritative) | same-DB-txn; staging zero-drift | ✅ applied (code; flags default OFF, not prod-enabled) |
| A6 | Inbox + DLQ (`processed_events`, `*.dlq`, re-drive) | ❌ infra | dedup + poison tests | ✅ applied |
| A7 | Wallet 4-balance projection (`posted.v2`), monotonic `last_txn_id`, L1 reconcile | ❌ reads legacy | projection==legacy; L1 green | ⬜ |
| A8a | Cutover: topup reads | ⚠️ | **7d zero-drift + L1/L3 green (topup)** | ⬜ |
| A8b | Cutover: wash reads (`EnsureFunds`/`available`) | ⚠️ | 7d zero-drift + green (wash) | ⬜ |
| A8c | Cutover: refund reads/history | ⚠️ | 7d zero-drift + green (refund) | ⬜ |
| A9 | Stop legacy writes; `ledger_entries` → read-only history; remove shim | ⚠️ | all flows green through bake | ⬜ |

**Rollback:** legacy authoritative through A7; A8 flips are per-flow sub-flags with
instant flip-back; A9 only after a clean bake. Nothing irreversible until A9.
EPIC B (wallet) is absorbed into A7; EPIC C recon (L1/L3) jobs are the A7/A8 gates.

## EPIC B — Wallet (four balances) ⛔ BLOCKER B3 — gated by NO-GO

| Step | Detail |
|---|---|
| Root cause | Single `balance`; no reserve/hold/pending; cache apply is LWW (H1) |
| Fix | ADR-0004 `wallet_balances`; monotonic apply by `txn_id`; project from `ledger_postings` |
| Order | migration → tests (W1/W2/W3 invariants) → consumer projection update → contract bump (`GET /wallets` → 4 balances) |
| Impact | reserve-then-capture; provisional top-ups unspendable; `EnsureFunds` reads `available` |
| Risk | Medium. Mitigate: assert `current == legacy balance` during transition |
| Rollback | `balance = available` view retains old contract; revert projection |

## EPIC C — Reconciliation & Settlement ⛔ gated by NO-GO

| Step | Detail |
|---|---|
| Root cause | No L1 drift check, no L3 trial balance; settlement is summary-only; no clearing/suspense |
| Fix | ADR-0007 L1/L2/L3 jobs; clearing/suspense accounts; settlement via balanced ledger txns; per-branch `owner_account` authoritative (resolve env ambiguity) |
| Order | accounts (EPIC A) → L1 assert job + alert → L2 statement matcher + exception queue → L3 trial balance → settlement postings |
| Impact | provable end-to-end accounting; orphans queued not dropped |
| Risk | Medium. Mitigate: run recon in report-only mode before enforcing freezes |
| Rollback | disable enforcement (report-only); recon jobs are read-mostly |

## EPIC D — Event reliability (Inbox/DLQ) 🟢 (no money redesign)

| Step | Detail |
|---|---|
| Root cause | Consumer idempotency = LWW; no inbox/DLQ; `LedgerPosted` needs v2 for 4-balance |
| Fix | `processed_events(consumer,event_id)` inbox; `*.dlq` subjects + re-drive; `LedgerPosted.v2` (additive: account + post-balance) |
| Order | inbox lib in nestkit → tests → wire each consumer → DLQ policy → event v2 |
| Risk | Low-Medium | 
| Rollback | inbox is additive; v1 events remain valid |

## EPIC E — DevOps completeness 🟢

| Step | Detail |
|---|---|
| Root cause | Only `deploy-bff.yaml`; audit/notification have no manifest; no HPA/limits; no security scan |
| Fix | author per-service Deployments from BFF template; add Trivy/dep-audit/secret-scan to CI; Timescale hypertable for `driver_locations` |
| Risk | Low | Rollback: manifests are additive; CI gates revertible |

## EPIC F — Governance & contracts 🟢

| Step | Detail |
|---|---|
| Fix | reconcile `BUILD_PLAN.md` to CLAUDE.md; author 6 missing OpenAPI specs; RLS + universal branch filter (H5/security) |
| Risk | Low-Medium (RLS needs careful policy testing) |

## EPIC G — Tenancy & Loyalty 🔭 (reserved, ADR-0006 — not implemented)
Reserve nullable `vendor_id`/`franchise_id`, vendor/franchise account owner types,
loyalty schema stubs. No code now.

---

## Sequencing
`B2,H2 (done)` → money model approved (NO-GO lifted) → **EPIC A in progress: A1 ✅ →
A2…A9** (inbox folded in at A6; per-flow cutover A8a/b/c) → C(recon, as A7/A8 gates)
→ E → F → (G reserved). Money epics are STOP-and-ask at every step.

## Per-change protocol
Each change ships as a PR-style summary: scope · tests added · migration (+rollback)
· invariants checked (L1/W1/ΣDR=ΣCR) · docs/ADR updated · reconciliation green.

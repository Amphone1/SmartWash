# A6_COMPLETION_REPORT.md — EPIC A increment A6 (inbox + DLQ + re-drive)

> Completion evidence for **A6**. Generated 2026-06-19. **Read-only report.** Companion:
> `A7_READINESS_REVIEW.md`. Branch `epic-a/a2-accounts` (14 commits ahead of `origin/main`,
> not pushed). Tree clean.

## 1. Exact files changed
A6 commit **`f07bfdc`** — 8 files, **+447 / −2**:

| File | ± | Kind |
|---|---|---|
| `libs/nestkit/src/events/inbox.ts` | +221 | new — `consumeOnce`, `handleInboxDelivery`, `redrive`, `ReliableConsumer`, metrics |
| `libs/nestkit/src/events/inbox.spec.ts` | +100 | new — unit tests (dedup/poison/retry/ack/redrive) |
| `infra/db/init/10_inbox_dlq.sql` | +19 | new — `processed_events` migration |
| `infra/db/init/tests/10_inbox_dlq.verify.sql` | +51 | new — DB dedup verify (CI-wired) |
| `libs/nestkit/src/index.ts` | +1 | mod — export inbox |
| `.github/workflows/ci.yml` | +3 | mod — A6 verify step |
| `docs/design/A6_INBOX_DLQ.md` | +50 | new — design doc |
| `docs/audit/REMEDIATION_PLAN.md` | +4/−2 | mod — A6 → ✅ |

*(Accepted A5 completion report + A6 readiness review committed separately as `65afff5`.)*

**What shipped:** an exactly-once consumer **inbox** (`processed_events`), a poison-safe
**DLQ** + **re-drive**, and a `ReliableConsumer` JetStream wrapper — all additive in
`@smartwash/nestkit`. The existing `EventBus.subscribe` and the audit/notification/wallet
consumers are **untouched** (A7 migrates the wallet projector onto the reliable path). No
ledger write, no read cutover, no money movement; dual-write flags stay default OFF.

## 2. Migration results (PG16)
- `nx run db:migrate` → **10 applied, 0 errors** (`10_inbox_dlq.sql` applies cleanly after `01..09`).
- Re-runnable: `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` (checksum-locked by the runner).
- `processed_events` is an operational dedup cache (prunable by `processed_at`), **not**
  append-only — append-only and double-entry guarantees are untouched.

## 3. Test results
| Target | Result |
|---|---|
| `nx test nestkit` | **28 passed / 7 suites** (incl. `inbox.spec.ts`) |
| `nx test ledger` | **94 passed, 10 skipped** (no regression; int specs self-skip without DB) |
| `nx lint nestkit` / `nx build nestkit` | clean / success |

**Inbox unit gate** (`inbox.spec.ts`): consumeOnce processes first / skips duplicate;
`handleInboxDelivery` → ack on success, ack+skip on duplicate, **retry** on transient
failure (attempt < maxDeliver), **DLQ** on the final attempt (poison, never dropped);
`redrive` republishes to the original subject; subject helpers round-trip.

## 4. Verification results
**DB inbox verify** (`10_inbox_dlq.verify.sql`, real PG16) — **4/4 PASS**:
- first delivery inserted · redelivery deduplicated · per-consumer isolation · `processed_at` defaulted.

**Regression on the same DB:** A1 `07` **6/6**, A2 `09` **10/10**, A3 `a3_posting_rules` **3/3** — all green.

## 5. Remaining NO-GO items
Program-level NO-GO lifted. Original blockers: B2 ✅; **B1** in progress (schema A1–A4
done, dual-write A5 behind flags, live cutover at A8/A9); **B3** open → **A7** (wallet
four-balance projection, now unblocked — it consumes `posted.v2` through A6); **B4** open →
EPIC C. None block A7.

## 6. Open audit findings
- **H4** (LWW consumer dedup / no inbox/DLQ) → ✅ **closed by A6** (the inbox + DLQ).
- Still open (tracked to owners): BUILD_PLAN stale & 6 missing OpenAPI specs & RLS/H5 (EPIC F);
  `owner_account` per-branch (EPIC C); **H1** wallet LWW projection → **A7**; doc-hygiene
  (stale "NO-GO active" text); A3 VAT-rounding finance sign-off; A5 prod-enable backfill caveat.
- A6 wires no live consumer, so H1 remains until A7 migrates the wallet projector.

## 7. GO / NO-GO (A6)
**🟢 GO — A6 complete.** Inbox dedup, DLQ/poison handling, re-drive, metrics, migration, and
verification all implemented and green (unit + DB). Additive and non-money; A1–A5 behavior
preserved; legacy authoritative; dual-write flags default OFF. A7 readiness in
`A7_READINESS_REVIEW.md`.

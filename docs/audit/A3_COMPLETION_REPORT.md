# A3_COMPLETION_REPORT.md — EPIC A increment A3 (posting rules + transaction builder)

> Completion evidence for **A3**. Generated 2026-06-19. **Read-only report — no source
> changed by this document.** Companion: `A4_READINESS_REVIEW.md`.
> Branch `epic-a/a2-accounts` (now 8 commits ahead of `origin/main`, not pushed). Tree clean.

## 1. Change summary

A3 commit **`fe1c299`** — 10 files, **+700 / −2**:

| File | ± | Kind |
|---|---|---|
| `services/ledger/src/domain/posting-rules.ts` | +202 | new — 9 builders + balanced guard (pure) |
| `services/ledger/src/domain/posting-rules.spec.ts` | +158 | new — per-op unit tests |
| `services/ledger/src/domain/posting-rules.integration.spec.ts` | +91 | new — all-ops invariants |
| `infra/db/init/tests/a3_posting_rules.verify.sql` | +90 | new — DB cross-layer verify (CI-wired) |
| `libs/common/src/lib/money.ts` | +31 | mod — `splitVatInclusive` |
| `libs/common/src/lib/money.spec.ts` | +36 | mod — VAT split tests |
| `libs/common/src/lib/errors.ts` | +11 | mod — `UnbalancedTransactionError(500)` |
| `docs/design/A3_POSTING_RULES.md` | +76 | new — design doc |
| `.github/workflows/ci.yml` | +3 | mod — A3 verify step |
| `docs/audit/REMEDIATION_PLAN.md` | +4/−2 | mod — A3 → ✅ |

*(Accepted A1/A2 review package committed separately as `563ede0`.)*

**What shipped:** a pure transaction builder mapping each of the 9 `ledger_txn_type`
operations to a balanced double-entry `TransactionIntent` over A2 account refs; deterministic
idempotency keys (`FINANCIAL_CONTRACT.md` §4); a balanced guard (`Σ DR = Σ CR`, ≥2 postings)
backed by `UnbalancedTransactionError`; every line fail-closed through A2 `validateAccountRef`;
and `splitVatInclusive` for the CAPTURE/REFUND VAT split (remainder → VAT, rate-consistent
with `order/pricing.ts`). No DB writes, no outbox — those are A4.

## 2. Test results

| Target | Result |
|---|---|
| `nx test ledger` | **79 tests / 6 suites PASS** (was 34; +`posting-rules.spec` + `posting-rules.integration.spec`) |
| `nx test common` | **25 PASS** (was 19; +6 `splitVatInclusive`) |
| `nx lint ledger` | clean (after fixing one `no-unused-expressions`) |
| `nx lint common` | clean |
| `nx build ledger` | success (tsc → esbuild) |

**DB cross-layer verify** (`a3_posting_rules.verify.sql`, fresh PG16):
- A3-1 CAPTURE 3-line (DR gross / CR net + CR vat) — **balanced & accepted**
- A3-2 TOPUP_SETTLE 4-line (two balanced pairs) — **accepted**
- A3-3 unbalanced CAPTURE (VAT dropped) — **rejected** by the A1 deferred trigger
- rc=0. Regression: A1 verify **6/6**, A2 verify **10/10** still green.

## 3. Migration impact analysis

**None.** A3 adds no schema and no migration (`migrate` still applies exactly `01..09`).
A3 is pure domain logic; the only DB artifact is a `tests/` verification script (not applied
by the runner). Append-only and double-entry guarantees are untouched.

## 4. Invariants & requirements preserved

| Requirement | How |
|---|---|
| ADRs / money model / chart / reconciliation | unchanged; A3 consumes them, adds nothing to the model |
| Double-entry, balanced | builder asserts `Σ DR = Σ CR`; A1 deferred trigger backstop (verified) |
| Append-only | A3 writes nothing; corrections are new ADJUSTMENT/REFUND intents |
| Idempotency | deterministic business keys; A1 `idempotency_key UNIQUE` backstop |
| Auditability | `correlationId` carried on every intent for A4 to propagate |
| Vendor/franchise enum-only | rejected fail-closed via `validateAccountRef` |

## 5. Known decision flagged for sign-off (non-blocking)
**VAT rounding policy.** `splitVatInclusive` floors net and posts the ≤1 kip remainder to
VAT. This is internally consistent (`net+vat=gross`, trial balance nets to zero) and
rate-consistent with `order/pricing.ts`, but the captured VAT may differ from the *quoted*
VAT by ≤1 kip. If finance requires quoted-VAT parity, CAPTURE can take explicit `net`/`vat`
carried from the order — a localized one-builder change, **no money-model impact**. See
`docs/design/A3_POSTING_RULES.md`.

## 6. GO / NO-GO (A3)
**🟢 GO — A3 complete.** All builders implemented and tested (unit + integration + DB
cross-layer); invariants preserved; no migration; lint/build green; committed on branch.
The one open item (§5) is a finance policy confirmation, not a correctness blocker.
A4 readiness in `A4_READINESS_REVIEW.md`.

# A2_REVIEW.md — Audit of the A2 design (Chart of Accounts + `resolveAccount()`)

> **Scope:** EPIC A · increment **A2** — *"Chart-of-accounts seed + `resolveAccount()`;
> vendor/franchise enum only"* (`docs/audit/REMEDIATION_PLAN.md` row A2).
> **Mode:** read-only audit. **No source, schema, or migration modified by this report.**
> **Gate under review:** "all contract accounts resolvable; idempotent create."
> Money work is STOP-and-ask (CLAUDE.md) — this report produces a recommendation only.

## Sources audited
- `infra/db/init/07_double_entry_ledger.sql` (A1, **applied**) + `tests/07_double_entry_ledger.verify.sql`
- `docs/design/MONEY_MODEL_PROPOSED.md` §2 (Ledger ERD) + §3 (Chart of Accounts)
- `docs/design/FINANCIAL_CONTRACT.md` §3 (account model) + §4/§6/§7 (operations, events, API)
- `docs/design/MONEY_FLOW_SPEC.md` (flows 1–8, account usage)
- `docs/adr/0003` (double-entry), `0004` (four-balance), `0006` (vendor/franchise), `0007` (recon)
- `infra/db/init/01_schema.sql` (entity ID types: `users.id`, `branches.id`, `drivers.id` all `UUID`)
- Confirmed: **no `resolveAccount()` implementation exists yet** — A2 is unstarted (design-only).

---

## Verdict — **NO-GO for A2 as currently specified. Conditional GO after corrections 1–5.**

The direction is sound: the double-entry chart is the right model and A1 is a clean,
additive, non-live base to build on. The blockers are in the **account identity**
(the `accounts` natural key) and the **account-key grammar**. As specified, an
"idempotent create" resolver can silently **fork accounts** — the exact money-correctness
failure the epic exists to prevent. These are cheap to fix *now*, before any seed or
resolver code exists.

---

## Findings

Severity: 🔴 critical (must fix before code) · 🟠 high · 🟡 medium · ⚪ low/observation.

### 🔴 F1 — `accounts` UNIQUE does not dedupe platform singletons (NULL `owner_id`)
`UNIQUE (acct_type, owner_type, owner_id, sub, currency)` (07 line 31) includes the
**nullable** `owner_id`. In Postgres, NULLs are **distinct** in a UNIQUE constraint by
default, so the platform singletons that intentionally carry `owner_id = NULL`
(`tax:vat`, `suspense:topup`, `bank:platform`) can be inserted **repeatedly**, and
`INSERT … ON CONFLICT (…owner_id…)` will **not** match an existing NULL-owner row.
→ A2's "idempotent create" gate is violated for every singleton; resolveAccount can
mint duplicate singletons under concurrency → split balances that each pass the per-txn
balance check but break L1/L3 trial balance.
*Evidence:* `verify.sql` (lines 20–22) even seeds a `branch` clearing account with
`owner_id NULL`, demonstrating the schema permits owner-less branch accounts too.
**Fix:** PG16 supports `UNIQUE NULLS NOT DISTINCT (…)`. Use that, **or** dual partial
unique indexes (one `WHERE owner_id IS NULL`, one `WHERE owner_id IS NOT NULL`), **or** a
sentinel owner_id for singletons. Recommend `NULLS NOT DISTINCT`.

### 🔴 F2 — `acct_type` in the natural key allows the same logical account under two types
Because `acct_type` is part of the UNIQUE, `(LIABILITY,user,U,available)` and
`(ASSET,user,U,available)` are **two distinct rows**. An account's type is intrinsic to
what it is (determined by `owner_type` + `sub`), so it must **not** participate in
identity. Any drift in the type-mapping forks the account silently.
**Fix:** natural key = `(owner_type, owner_id, sub, currency)`; make `acct_type` a
**validated, derived** attribute (see F3).

### 🔴 F3 — `sub` is unconstrained free `TEXT` → typos fork accounts
`sub TEXT` has no enum/CHECK. `'clearing'` vs `'clearing '` vs `'clear'` become distinct
accounts that each balance correctly but break reconciliation. resolveAccount idempotency
depends on an exact, canonical `sub`.
**Fix:** introduce a small lookup `account_kinds(owner_type, sub, acct_type)` referenced
by FK from `accounts` (this simultaneously fixes F2 by deriving/validating `acct_type`
and enumerates every legal tuple), **or** a CHECK list. Centralize the same constants in
`resolveAccount()`.

### 🟠 F4 — Account-key grammar is self-inconsistent; resolveAccount has no canonical form
Three notations are in play:
- `FINANCIAL_CONTRACT.md §3` declares `{sub}:{owner_type}:{owner_id}` — but its own
  example `wallet:available:{userId}` does **not** fit it (that is `prefix:sub:id`, with
  `owner_type` "user" missing).
- `MONEY_MODEL_PROPOSED.md §3` uses prefixes `wallet:`/`bank:`/`clearing:`/`revenue:`/
  `tax:`/`payable:`/`suspense:` that do not map 1:1 to columns.
- `FINANCIAL_CONTRACT.md §6` ships `accountKey` as a **string in the event payload**, so
  the serialization must be canonical and **bidirectional** (build + parse) for the A7
  wallet projector.

**Fix:** define ONE grammar (recommend `{sub}:{owner_type}:{owner_id|"_"}`, e.g.
`available:user:<uuid>`, `clearing:branch:<uuid>`, `vat:tax:_`), make `resolveAccount()`
the single producer/parser, rewrite the §3 chart to that grammar, and fix the §3 example.

### 🟠 F5 — `tax:vat` owner ambiguity: `platform` vs the `tax` owner_type
The enum defines a dedicated `tax` owner_type, yet the §3 chart lists `tax:vat` as
owner = **platform**. resolveAccount cannot hold both. Pick one (recommend
`owner_type=tax, owner_id=NULL, sub='vat', acct_type=LIABILITY`) and delete the other
from the chart. (Special case of F4, called out because VAT posts on every CAPTURE.)

### 🟠 F6 — `payable:staff:{d}` owner identity undefined (`users.id` vs `drivers.id`)
There is no `staff` table — staff are `users` via `user_roles`; drivers have a separate
`drivers.id` distinct from `users.id`. FLOW 6 writes `payable:staff:{d}` with `{d}` = a
driver, but `owner_type` is `staff`. resolveAccount must fix exactly one identifier.
Recommend the payee's **`users.id`** (payout is owed to a person; map driver → user via
`drivers.user_id`). Otherwise settlement (EPIC C) splits one payee across two accounts.

### 🟡 F7 — Seed-vs-lazy split is unspecified (and entangled with F1)
A2 says "chart-of-accounts **seed** + resolveAccount(); **idempotent create**." But
per-user / per-branch / per-staff accounts **cannot** be seeded at migration time — the
entities don't exist yet. So: only the **platform singletons** (`tax:vat`,
`suspense:topup`, `bank:platform`) are seedable; all entity accounts must be **lazily
get-or-created** by resolveAccount. The singletons are exactly the NULL-owner rows broken
by F1. **Required in the A2 design:** state explicitly (a) migration seeds only singletons,
(b) resolveAccount uses a concurrency-safe `INSERT … ON CONFLICT (natural key) … RETURNING`.

### 🟡 F8 — `resolveAccount()` vs `AccountNotFound` contract tension
Contract §3/§7 says posting to a missing account → `AccountNotFound(404)`, but the A2
gate is "idempotent **create**." Reconcile precisely: resolveAccount **auto-creates** valid
entity accounts (so `AccountNotFound` is reserved for *malformed/unknown* keys, unknown
owner_type, or `status <> 'active'`), and posting code calls resolveAccount rather than a
bare lookup. The `status='active'` filter must be part of the resolve path (status is in
no current index/lookup).

### 🟡 F9 — `accounts.owner_id` has no referential integrity (polymorphic)
No FK is possible on a polymorphic column, so resolveAccount can mint an account for a
non-existent user/branch/driver (typo, or a race with entity deletion). Recommend
resolveAccount **validate owner existence per owner_type** before create; at minimum
document the accepted tradeoff. Low data-integrity risk today, but a silent-orphan vector
for L1/L3.

### 🟡 F10 — Inter-branch `due-from:{b}` / `due-to:{b}` underspecified
A single branch id cannot express a directed A→B position; the chart lists one-sided keys.
This is FLOW 8 / settlement (EPIC C) territory and is **likely out of A2 scope**, but the
chart includes it and the gate says "all contract accounts resolvable." **Decide
explicitly:** defer inter-branch accounts to EPIC C (recommended) and mark them
`reserved` in the chart, or define the two-branch keying now.

### ⚪ F11 — Enum permanence (vendor/franchise) — by design, validate the gate
`acct_owner` (incl. `vendor`, `franchise`), `acct_type`, `ledger_txn_type` are applied in
A1. Postgres can ADD enum values but not easily remove them — acceptable, the reservation
is intentional (ADR-0006). A2 must (a) seed **no** vendor/franchise accounts and (b) have
resolveAccount **reject** those owner_types **fail-closed** until EPIC G. The gate
"vendor/franchise enum only" = present in type, absent from seed, rejected by resolver.

### ⚪ F12 — Currency in identity is correct, but resolver must pin `'LAK'`
`currency` is in the natural key (correct; multi-currency is reserved). An omitted/empty
currency would fork accounts → resolveAccount must default-and-pin `'LAK'`. Aligns with the
contract's "no mixed currency per transaction."

### ⚪ F13 — Several `sub` values left unstated
`revenue:branch` (sub `revenue` or `default`?), `suspense:topup` (sub `topup`? owner
`platform`?). Enumerate **every** `(owner_type, sub, acct_type)` tuple so resolveAccount is
total — rolls into the F3 `account_kinds` lookup.

---

## Validation matrix (against the five requested targets)

| Target | Verdict | Driving findings |
|---|---|---|
| Chart of Accounts design | 🔴 conflict | F2, F3, F4, F5, F13 — keys/subs/types not canonical; identity unsafe |
| `resolveAccount()` contract | 🔴 conflict | F1, F4, F7, F8, F12 — idempotency unsafe for singletons; no canonical key; seed/lazy + AccountNotFound undefined |
| Account ownership model | 🟠 drift | F5, F6, F9 — tax owner ambiguous; staff/driver id undefined; polymorphic owner_id unvalidated |
| Vendor/franchise enum-only | 🟢 sound | F11 — correct as reserved; only needs the fail-closed resolver assertion |
| Compatibility with A1 schema | 🟡 conditional | A1 additive & non-live ✔, but F1/F2/F3 require **ALTERing the already-applied `accounts` table** → forward-only migration 08 (see below) |

---

## Compatibility with the A1 double-entry schema (explicit)
- A1 tables (`accounts`, `ledger_transactions`, `ledger_postings`, `wallet_balances`) are
  additive and **not** in a live money path (strangler-fig) → A2 can build on them safely. ✔
- **However**, corrections F1/F2/F3 change the `accounts` table/constraint that A1 already
  created **and marked applied**. Init scripts in `infra/db/init/` run **once** (first boot),
  so this **cannot** be fixed by editing `07`. The correction MUST ship as a new
  **`08_accounts_chart.sql`** (ALTER the constraint + add `account_kinds`/CHECK + seed
  singletons) **with a rollback** — a migration → **STOP-and-ask** per CLAUDE.md.
  *(Only if no environment has actually run `07` — dev volumes solely — is amending `07`
  in place defensible; the safe default is forward-only ALTER in `08`.)*
- A1's `idempotency_key` is `UNIQUE NOT NULL` (stricter than MONEY_MODEL §2's nullable) —
  good; no A2 impact.
- `idx_postings_account (account_id, id DESC)` already supports reading `balance_after`
  for resolveAccount's callers (A3/A4). ✔
- Mapping note: `wallet_balances` is **one row per user** (4 columns), while the ledger
  holds **four separate LIABILITY accounts** per user. resolveAccount produces 4 account
  rows; the A7 projector folds them into the 1 wallet row. Intentional, but make the
  4-account → 1-row mapping explicit when A7 is designed.

---

## Risks
| ID | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | Forked/duplicate accounts (F1–F4) → balances split silently; pass per-txn check, fail L1/L3 | High | Fix the natural key **before** any seed/resolver code |
| R2 | Account-key grammar drift (F4/F5) → event `accountKey` not reversible → A7 projector misroutes | Med | One canonical grammar owned by resolveAccount |
| R3 | ALTER on an already-applied financial table | Med | Forward-only, additive, rollback script, reuse the `verify.sql` harness pattern |
| R4 | Polymorphic `owner_id` orphans (F9) | Low | Validate owner existence per owner_type |
| R5 | Enum permanence (F11) | Low | Accepted via ADR-0006; resolver fails closed |

---

## Required schema / contract corrections (actionable)
1. **Fix the `accounts` natural key:** drop `acct_type` from identity and make NULL
   owner_id non-distinct → `UNIQUE NULLS NOT DISTINCT (owner_type, owner_id, sub, currency)`
   (PG16) **or** dual partial unique indexes. [F1, F2]
2. **Constrain `sub` + derive/validate `acct_type`** via an `account_kinds(owner_type, sub,
   acct_type)` lookup FK'd from `accounts` (enumerates every legal account), or a CHECK list.
   [F2, F3, F13]
3. **Add `08_accounts_chart.sql`** that ALTERs the constraint, adds the lookup/CHECK, and
   **idempotently seeds only the platform singletons**; ship a rollback + a `.verify.sql`.
   [A1 compat, F7]
4. **Pin the ambiguities:** `tax:vat` owner_type; `payable` owner identity (`users.id`);
   ONE canonical `accountKey` grammar (fix the §3 example to match). [F5, F6, F4]
5. **Specify `resolveAccount()`:** concurrency-safe `INSERT … ON CONFLICT (natural key) …
   RETURNING`; default+pin `currency='LAK'`; **reject vendor/franchise + unknown
   owner_types fail-closed**; active-only on the posting path; define when
   `AccountNotFound` is raised vs auto-create. [F7, F8, F11, F12]
6. **Explicitly defer inter-branch** `due-from`/`due-to` to EPIC C; mark `reserved` in the
   chart. [F10]

---

## GO / NO-GO

**NO-GO for A2 as specified.** The chart direction and the A1 base are sound, but the
account **identity** is unsafe for an "idempotent create" resolver (NULL-owner singletons
and `acct_type`-in-key both permit silently forked accounts), and the account-key grammar
has three conflicting forms. These are precisely the money-correctness failure modes the
epic exists to prevent, and they are cheap to fix before any seed/resolver code exists.

**Conditional GO** once corrections **1–5** are folded into the A2 design and a reviewed,
forward-only **migration `08`** (+ rollback + verify), with inter-branch explicitly
deferred (6). **Re-review the revised A2 design + migration before implementation**
(STOP-and-ask: money + migration, per CLAUDE.md).

*No files other than this report were created or modified. Awaiting approval before any
change.*

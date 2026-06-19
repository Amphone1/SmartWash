# SmartWash — Proposed Money Model (for approval)

> **Status: PROPOSED — NO-GO active.** Approving the five sections below
> (Wallet ERD · Ledger ERD · Chart of Accounts · Settlement Model · Reconciliation
> Model) is the gate that lifts the NO-GO. Nothing here is implemented.
> Implements ADR-0003 (double-entry), ADR-0004 (four-balance), ADR-0007 (reconciliation).

Conventions: money is `BIGINT` kip; all posting tables append-only (ADR-0002).

---

## 1. Wallet ERD (proposed)

Replaces the single `wallets.balance` with four liability sub-balances. The wallet
remains a **cache derived from the ledger** (updated only by `LedgerPosted`).

```
wallet_balances
  user_id     UUID PK -> users(id)
  available   BIGINT NOT NULL DEFAULT 0
  reserved    BIGINT NOT NULL DEFAULT 0
  held        BIGINT NOT NULL DEFAULT 0
  pending     BIGINT NOT NULL DEFAULT 0
  currency    TEXT   NOT NULL DEFAULT 'LAK'
  last_txn_id BIGINT            -- monotonic guard (fixes H1; ignore stale events)
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

**Invariant W1:** `current = available + reserved + held + pending`.
**Invariant W2:** `current = Σ ledger_postings to the user's wallet accounts` (L1).
**Invariant W3:** applied monotonically — only apply a transaction if
`txn_id > last_txn_id` (prevents stale/duplicate redelivery overwrite).

Migration note: `wallets` retained read-compatible (`balance = available`) during
transition; backfill from ledger.

---

## 2. Ledger ERD (proposed double-entry)

```
accounts
  id          BIGSERIAL PK
  acct_type   ENUM(ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE)
  owner_type  ENUM(user, branch, platform, staff, tax, vendor, franchise)  -- vendor/franchise reserved (ADR-0006)
  owner_id    UUID                         -- NULL for platform-singletons
  sub         TEXT                         -- available|reserved|held|pending|clearing|bank|...
  currency    TEXT NOT NULL DEFAULT 'LAK'
  status      TEXT NOT NULL DEFAULT 'active'
  UNIQUE(acct_type, owner_type, owner_id, sub, currency)

ledger_transactions                        -- journal header (one per money movement)
  id              BIGSERIAL PK
  type            ENUM(TOPUP, RESERVE, RELEASE, HOLD, CAPTURE, REFUND_REVERSAL, ADJUSTMENT, SETTLEMENT, TOPUP_SETTLE)
  correlation_id  TEXT
  idempotency_key TEXT UNIQUE              -- e.g. topup:{qrRef}, wash-deduct:{orderId}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()

ledger_postings                            -- APPEND-ONLY DR/CR lines (ADR-0002)
  id            BIGSERIAL PK
  txn_id        BIGINT NOT NULL -> ledger_transactions(id)
  account_id    BIGINT NOT NULL -> accounts(id)
  direction     ENUM(DR, CR) NOT NULL
  amount        BIGINT NOT NULL CHECK (amount > 0)
  balance_after BIGINT NOT NULL            -- running balance for that account
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

**Invariant L1 (balanced):** for each `txn_id`, `Σ amount WHERE DR = Σ amount WHERE CR`.
Enforced by a deferred constraint trigger on `ledger_postings`.
**Invariant L2 (immutable):** append-only (ADR-0002 trigger + REVOKE).
**Invariant L3 (idempotent):** `ledger_transactions.idempotency_key UNIQUE` → replay-safe.
**Invariant L4 (sign):** amounts are positive; direction carries the sign.

The legacy `ledger_entries` is retained read-only (history) post-migration; the
append-only trigger from ADR-0002 already protects it.

---

## 3. Chart of Accounts (proposed)

| Account key | acct_type | owner | Purpose |
|---|---|---|---|
| `wallet:available:{u}` | LIABILITY | user | spendable |
| `wallet:reserved:{u}`  | LIABILITY | user | committed to active wash |
| `wallet:held:{u}`      | LIABILITY | user | auth hold (delivery) |
| `wallet:pending:{u}`   | LIABILITY | user | provisional top-up (pre-recon) |
| `bank:branch:{b}`      | ASSET     | branch | confirmed cash at branch bank |
| `clearing:branch:{b}`  | ASSET     | branch | claimed top-ups awaiting bank match |
| `suspense:topup`       | ASSET     | platform | orphan / unmatched receipts |
| `revenue:branch:{b}`   | REVENUE   | branch | wash fees (net of VAT) |
| `tax:vat`              | LIABILITY | platform | VAT payable (basis points) |
| `payable:staff:{d}`    | LIABILITY | staff | payout owed to driver/staff |
| `bank:platform`        | ASSET     | platform | platform settlement cash |
| `due-from:{b}` / `due-to:{b}` | ASSET/LIABILITY | branch | inter-branch clearing |
| `vendor:* / franchise:*` | (reserved) | vendor/franchise | ADR-0006, not built |

### Posting rules
| Operation | DR | CR |
|---|---|---|
| TOPUP (slip approved) | `clearing:branch:{b}` | `wallet:pending:{u}` |
| TOPUP_SETTLE (bank matched) | `bank:branch:{b}` ; `wallet:pending:{u}` | `clearing:branch:{b}` ; `wallet:available:{u}` |
| RESERVE | `wallet:available:{u}` | `wallet:reserved:{u}` |
| HOLD | `wallet:available:{u}` | `wallet:held:{u}` |
| CAPTURE (DEDUCT) | `wallet:reserved|held:{u}` | `revenue:branch:{b}` ; `tax:vat` |
| RELEASE | `wallet:reserved|held:{u}` | `wallet:available:{u}` |
| REFUND_REVERSAL | `revenue:branch:{b}` ; `tax:vat` | `wallet:available:{u}` |
| SETTLEMENT (payout) | `payable:staff:{d}` | `bank:platform` |
| ADJUSTMENT | per correction (balanced) | per correction (balanced) |

---

## 4. Settlement Model (proposed)

```
settlement_runs(id, branch_id, period_date, status, created_at)  -- header
settlement_postings → ledger_transactions(type=SETTLEMENT)        -- money moves via ledger
```
- Period close per branch: `revenue:branch:{b}` → split platform fee vs branch share
  vs staff payout; each split is a balanced ledger transaction.
- Staff/driver payout: `payable:staff:{d}` accrued from delivery completion; paid via
  `SETTLEMENT` posting (`DR payable:staff / CR bank:platform`).
- **Only VERIFIED (reconciled) revenue is settled** — unreconciled stays in clearing.
- Vendor/franchise roll-up (ADR-0006) is an additive aggregation over branch
  settlements — reserved, not built.
- Inter-branch: top-up at A, spend at B → `due-from:A / due-to:B` cleared at settlement.

**Invariant S1:** a branch is never settled beyond its reconciled `bank:branch` balance.
**Invariant S2:** every settlement is a balanced ledger transaction (no summary-only writes).

---

## 5. Reconciliation Model (proposed)

| Level | Identity | Trigger | Exception path |
|---|---|---|---|
| **L1** wallet | `wallet.current(u) = Σ user wallet postings` | scheduled + on each post | drift → alert + freeze user wallet writes |
| **L2** branch | `bank:branch:{b} = Σ branch bank/clearing postings` vs statement | daily statement import | unmatched bank line → `suspense:topup`; aged credit → ADJUSTMENT |
| **L3** platform | trial balance `Σ DR = Σ CR`; `Σ wallet LIAB = Σ ASSET − REVENUE − VAT` | daily | imbalance → page on-call, halt settlement |

- **Auto-match:** `(amount, ref, time-window, account)` → `VERIFIED`.
- **Manual:** `REVIEW` / `SUSPICIOUS` queue; staff decision audited (actor + IP).
- **Mismatch detection:** L1 drift, L2 orphan, L3 trial-balance imbalance.
- **Resolution:** always a new `ADJUSTMENT` transaction — never an edit (ADR-0002).

**Invariant R1:** no bank line and no ledger credit is ever silently dropped — it
lands in a suspense/exception queue until resolved.

---

## Approval checklist (lifts NO-GO when all checked)
- [ ] Wallet ERD (§1)
- [ ] Ledger ERD (§2)
- [ ] Chart of Accounts (§3)
- [ ] Settlement Model (§4)
- [ ] Reconciliation Model (§5)

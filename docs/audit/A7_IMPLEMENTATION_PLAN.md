# A7_IMPLEMENTATION_PLAN.md — wallet four-balance projection

> **PLANNING ONLY — no code/schema/API/migration changed by this document.**
> EPIC A · increment **A7**. Shadow projection — **no read cutover** (reads stay on legacy
> `wallets` through A8). Generated 2026-06-19. Companion: `A7_RISK_REVIEW.md`.
> Approval of this plan is required before any A7 code.

## 1. Wallet projection architecture
```
ledger (A4/A5) ──outbox──▶ relay ──▶ NATS subject smartwash.ledger.transaction.posted.v2
                                              │
                              A6 ReliableConsumer (durable=wallet-projector-v2)
                              · inbox dedup (consumeOnce)  · DLQ on poison
                                              ▼
                        WalletProjector.apply(envelope.data)  ── one DB txn ──▶ wallet_balances
                                              │
                              L1 reconcile job (scheduled, report-only)
```
- New v2 consumer in **`services/wallet`**, alongside the existing v1
  `LedgerPostedConsumer` (which keeps updating legacy `wallets` — **untouched**, reads stay
  legacy until A8).
- The projector consumes `posted.v2` through the **A6 `ReliableConsumer`** so apply is
  exactly-once and poison-safe. It writes only `wallet_balances` (A1 table; no migration).
- Gated by a flag **`WALLET_PROJECTOR_V2_ENABLED`** (default **off**) so it ships dark.

## 2. Four-balance model (`wallet_balances`, A1)
| Sub | Meaning | Account kind |
|---|---|---|
| `available` | spendable now | `available:user` (LIABILITY) |
| `reserved` | committed to an in-flight wash | `reserved:user` (LIABILITY) |
| `held` | authorization hold (delivery) | `held:user` (LIABILITY) |
| `pending` | provisional top-up (pre-recon) | `pending:user` (LIABILITY) |
Invariant **W1:** `current = available + reserved + held + pending`. All natural-sign,
non-negative (overdraft guard at write time, A4).

## 3. Projection update rules (per A3 transaction type)
The `posted.v2` payload carries, per user posting, `{ accountKey, ownerType, ownerId,
direction, amount, balanceAfter }`; `sub = accountKey.split(':')[0]`; `acctType = LIABILITY`
for all user subs.

**Recommended apply rule = DELTA-apply** (`wallet_balances.<sub> += naturalDelta(LIABILITY,
direction, amount)`), guaranteed **exactly-once** by the A6 inbox → **order-independent**
(addition is commutative; the inbox prevents double-apply). `last_txn_id` is maintained as
`GREATEST(last_txn_id, txnId)` (monotonic; see §4). For a LIABILITY account: `+amount` on CR,
`−amount` on DR.

Per type (only the user-side legs move the wallet; branch/tax/platform legs are ignored):
| Txn | Wallet effect |
|---|---|
| TOPUP | `pending += amount` |
| TOPUP_SETTLE | `pending −= amount`, `available += amount` |
| RESERVE | `available −= amount`, `reserved += amount` |
| HOLD | `available −= amount`, `held += amount` |
| CAPTURE | `reserved\|held −= gross` (revenue/VAT legs ignored) |
| RELEASE | `reserved\|held −= amount`, `available += amount` |
| REFUND_REVERSAL | `available += gross` (revenue/VAT legs ignored) |
| ADJUSTMENT | per the user leg(s) in the posting set |
| SETTLEMENT | no user leg → no wallet change |

**Alternative apply rule = SET-to-`balanceAfter`** (set each touched `sub` to the posting's
`balanceAfter`) + strict monotonic skip. Idempotent, but a nak-retry that reorders two txns
touching **different** subs can skip an older sub-update → drift. **Decision (flagged):**
prefer **delta + inbox**; if SET is chosen, add **per-account** monotonic tracking.

## 4. Monotonic ordering strategy (`last_txn_id` guard)
- Normal path is already in-order: the relay publishes in `created_at` (≈ `txnId`) order and a
  single durable consumer pulls in stream-sequence order.
- `last_txn_id` is updated to `GREATEST(last_txn_id, txnId)` and exposed for W3 observability.
- With **delta-apply** the inbox (exactly-once) is the correctness guarantee, so `last_txn_id`
  is a **monotonic watermark**, not a skip gate (avoids the multi-sub reorder hole).
- With **set-apply** `last_txn_id` is the W3 skip gate (`ignore txnId ≤ last_txn_id`) — but
  must be **per-account** to be safe.

## 5. Replay strategy
- **At-least-once delivery + exactly-once apply:** the A6 inbox (`processed_events`,
  key = stream sequence) makes a redelivered/duplicate `posted.v2` a no-op.
- A durable replay (consumer reset → redeliver from sequence 1) re-applies nothing already in
  `processed_events`; un-applied tail is applied once. With delta-apply this is safe; with
  set-apply the monotonic guard also protects.
- The inbox row and the `wallet_balances` update commit in **one txn** (via `consumeOnce`), so
  a crash mid-apply rolls back both → the message is retried cleanly.

## 6. Rebuild strategy (from `ledger_entries` only)
A full recompute of the projection, decoupled from event delivery. As requested, the
**transition rebuild reads the authoritative legacy `ledger_entries` only**:
```
for each user u:
  current(u) = latest ledger_entries.balance_after for u   (authoritative legacy balance)
  wallet_balances(u) = { available: current(u), reserved:0, held:0, pending:0,
                         last_txn_id: <high-watermark> }
```
- **What it reconstructs:** the **total** (`current`) exactly, matching the legacy wallet — the
  dual-write/projection==legacy identity.
- **Limitation (explicit):** legacy is single-entry, so it has **no** reserved/held/pending
  split → the rebuild collapses everything into `available`. A mid-wash rebuild therefore loses
  the transient reserved/held state (the **total** stays correct). This is acceptable for a
  transition bootstrap (before the new ledger has full history; see A5 §7 backfill caveat).
- **Complementary full-fidelity rebuild (post-backfill / canonical):** recompute each sub from
  **`ledger_postings`** (latest natural `balance_after` per user account). Use this once the new
  ledger is authoritative; it restores the true four-way split. The plan ships **both** rebuild
  modes; the `ledger_entries` mode is the default transition-safe one.
- Rebuild runs offline (projector paused), is idempotent, and ends by resetting `last_txn_id`.

## 7. L1 reconciliation design
Two identities, computed by a scheduled read-only job:
- **L1 / W2 (internal):** `wallet_balances.current(u) == Σ natural balance of u's
  `ledger_postings`` (latest `balance_after` per user account).
- **Advance gate (projection == legacy):** `wallet_balances.current(u) == legacy
  wallets.balance(u)`.
Job: iterate users touched in a window (or full scan off-hours); emit per-identity drift;
**report-only at A7** (freeze/enforcement is A8/EPIC C). The gate identity is the A7→A8
evidence (same fresh-DB vs prod-backfill caveat as A5 §7).

## 8. Drift detection rules
- **Zero tolerance** (money): any non-zero `current − legacy` or `current − Σpostings` is drift.
- Metrics: `wallet_projection_lag_seconds`, `wallet_l1_drift_total{kind=internal|legacy}`,
  `wallet_l1_drift_kip` (histogram), `wallet_projection_applied_total`,
  `wallet_projection_skipped_total{reason=duplicate|stale}`.
- Alerts (extend `infra/observability/alerts/`): **WalletProjectionDrift pages**;
  projection-lag and DLQ-growth warn.

## 9. Test matrix
| Layer | Cases |
|---|---|
| Unit (pure) | delta per txn type; sub-from-accountKey; naturalDelta sign; W1 holds; monotonic watermark |
| Integration (DB-gated) | project a topup→settle→reserve→capture→release→refund sequence → assert 4 balances + W1; **duplicate event → no double-apply** (inbox); **out-of-order delivery → correct** (delta); stale set-apply skip (if chosen) |
| L1 / gate | after a sequence: `current == Σ postings` (internal) and `current == legacy balance` (gate) |
| Rebuild | `ledger_entries` rebuild → `current` matches legacy, subs collapse to available; `ledger_postings` rebuild → exact 4-way split; both idempotent |
| Poison/DLQ | reuse A6: a handler failure → retry then DLQ; projector never blocks the stream |

## 10. Rollback strategy
- **Instant:** `WALLET_PROJECTOR_V2_ENABLED=off` → the v2 projector stops; legacy `wallets`
  and all reads are unaffected (reads never moved).
- **Data:** `wallet_balances` is a **derived cache** (shadow, unread by the app) → safe to
  `TRUNCATE` and **rebuild** (§6). No money to recover.
- **Code:** A7 is additive (new consumer + projector + reconcile job); revert the PR — no
  schema change (`wallet_balances` already exists). The v1 consumer/legacy path is untouched.
- Nothing in A7 is authoritative or irreversible (read cutover is A8).

## Cutover gates before A8
projection == legacy over the bake window · L1 green · exactly-once + reorder tests green ·
rebuild proven · drift alerts armed · flag-off rollback rehearsed · legacy still authoritative.

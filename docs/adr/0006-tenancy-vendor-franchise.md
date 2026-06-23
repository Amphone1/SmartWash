# ADR-0006 — Tenancy Hierarchy: Vendor → Franchise → Branch (Future Extension Point)

- **Status:** Accepted as a reserved extension point — **NOT implemented**
- **Date:** 2026-06-17
- **Relates to:** Findings on Multi-Vendor / Franchise readiness

## Context
`branch` is currently the top of the hierarchy. The product roadmap includes
multi-vendor and franchise operation, which require an ownership/tenancy layer
above branch and per-tenant financial isolation. Building this now is out of scope.

## Decision
Reserve — but do not build — the tenancy hierarchy:
```
platform → vendor → franchise → branch → machine
```
Forward-compatibility commitments (design-level only):
- Schema leaves room for nullable `vendor_id` / `franchise_id` on `branches`
  (non-breaking when added later).
- The double-entry chart of accounts (ADR-0003) keys accounts by `owner_type`
  so `vendor`/`franchise` owner types slot in without redesign.
- RBAC roles leave room for `franchisor` / `vendor_admin` above `owner`.
- Reconciliation/settlement models (ADR-0007) are per-branch today; a vendor/
  franchise roll-up is an additive aggregation, not a rewrite.

## Consequences
- (+) Multi-vendor/franchise stays reachable without foreclosing decisions.
- (−) None now — this ADR only forbids designs that would block the hierarchy.
- **Explicitly:** no migrations, no services, no code created for this ADR.

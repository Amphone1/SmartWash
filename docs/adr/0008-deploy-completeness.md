# ADR-0008 — Deploy Completeness: audit & notification in CI

- **Status:** Accepted (applied — `.github/workflows/ci.yml`)
- **Date:** 2026-06-17
- **Relates to:** Finding **H2**

## Context
`audit` and `notification` are pure event-consumer services (no public port). Both
were absent from the CI `images` build matrix and the deploy rollout loop, so no
container image was ever built — meaning **the audit trail and all notifications
could not run in production**. For a fintech, a non-running audit log is a
compliance hole.

## Decision
Add `notification` and `audit` to the CI `images` matrix and the deploy rollout
loop. Both services already have a `Dockerfile` and `project.json`, so the image
build is valid as-is.

## Consequences
- (+) Audit firehose and notifications are now buildable/deployable.
- (−) **Follow-up required:** the rollout `set image deploy/<svc>` needs a k8s
  Deployment manifest for each (only `deploy-bff.yaml` exists; others copy that
  template). Tracked in REMEDIATION_PLAN.md (EPIC E).
- `device-sim` remains excluded from the deploy loop (dev-only simulator).

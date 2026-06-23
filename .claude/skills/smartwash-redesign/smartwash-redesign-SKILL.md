---
name: smartwash-redesign
description: Produce BUILD_PLAN v2 and supporting architecture/design documents based on an already-reviewed audit. Manual invocation only — run this in Plan Mode (Shift+Tab) or with defaultMode set to plan, so all proposed document changes are shown for approval before anything is written.
disable-model-invocation: true
---

The architecture audit has already been reviewed and approved by the user. Based on its findings:

Create revised design documents. Do NOT write application code — only documentation, diagrams, and specs.

Update:
1. BUILD_PLAN.md
2. Architecture
3. Service Matrix
4. ERD
5. FSM Design
6. Event Architecture
7. API Gateway Design
8. Kubernetes Architecture
9. Wallet Architecture
10. Reconciliation Architecture
11. Super App Architecture

Generate:
- ADRs
- C4 Diagrams
- Service Dependency Graph
- Event Flow Diagrams
- Sequence Diagrams

Present every proposed file change (new or updated) as a single batch, and explain why each change is needed before writing anything to disk. This output becomes BUILD_PLAN v2.

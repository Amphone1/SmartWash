---
name: smartwash-audit
description: Read-only architecture, fintech, wallet/ledger, IoT, security, and Super-App readiness audit of the SmartWash v5 repository. Manual invocation only.
disable-model-invocation: true
context: fork
agent: Explore
---

Review the entire SmartWash repository.

Read first:
- CLAUDE.md (project constitution — the 10 non-negotiable rules)
- BUILD_PLAN.md
- Architecture diagrams (PlantUML/Mermaid)
- FSM diagrams (machine FSM and order FSM)
- ERDs
- SQL schema (smartwash_schema.sql, 28 tables)
- Service matrix
- Infrastructure documents (docker-compose, deployment configs)

DO NOT WRITE CODE.
DO NOT MODIFY FILES.
DO NOT CREATE TASKS.

Your only objective is to understand the system and identify problems.

Generate:
1. Executive Summary
2. Architecture Review
3. Fintech Review
4. Wallet & Ledger Review
5. No Bank API Review
6. IoT Review
7. Security Review
8. DevOps Review
9. Super App Readiness Review
10. Risks
11. Missing Components
12. Technical Debt
13. Critical Gaps
14. High Priority Gaps
15. Medium Priority Gaps
16. Low Priority Gaps

For every issue provide:
- Business Impact
- Technical Impact
- Recommendation

Close the report with a one-line note that this audit is read-only and complete, and that no redesign work has begun — the user reviews this report and decides whether to proceed.

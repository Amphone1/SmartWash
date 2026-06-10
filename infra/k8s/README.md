# SmartWash k3s Deploy

**Review artifacts — not applied to any cluster by this repo.** Hand-review
before any real deploy (per the project's deploy-config review rule).

## Layout
- `namespace.yaml` — the `smartwash` namespace.
- `config.yaml` — shared non-secret env (ConfigMap).
- `secret.example.yaml` — secret template; populate `secret.yaml` out-of-band
  (vault / Sealed Secrets / External Secrets). Never commit real secrets.
- `deploy-bff.yaml` — **canonical** NestJS service (Deployment + Service). Every
  TS service follows this exact shape — copy it, change `name`/`image`/`port`
  (auth 3001, rbac 3002, order 3003, queue 3004, bff 3005, wallet 3006,
  ledger 3007, fraud 3008, payment 3009, saga 3010, machine 3011, delivery 3012,
  gps 3013, settlement 3014, reconciliation 3015). OCR 8001 / Risk 8002 are the
  FastAPI equivalents (same probes).
- `ingressroute.yaml` — Traefik exposes **only** BFF + Auth; everything else is
  cluster-internal.
- `backup-cronjob.yaml` — pgBackRest + restic (see `../backup/README.md`).

## Stateful dependencies
Postgres+TimescaleDB, Redis, NATS JetStream, EMQX, Temporal, Keycloak, MinIO and
the observability stack are deployed via their **official Helm charts / operators**
(pinned versions), not hand-written manifests — they own their own HA, storage,
and upgrade story. The app `ConfigMap` points at their in-cluster service names.

## Migrations
Run `nx run db:migrate` as a one-shot **Job** (or Helm pre-install/pre-upgrade
hook) against the cluster Postgres before rolling out services — never auto-run
from a service on boot.

## Saga note
The `saga` service is a Temporal worker (no public port); it needs the Temporal
address + the same internal token. Scale workers horizontally as load grows.

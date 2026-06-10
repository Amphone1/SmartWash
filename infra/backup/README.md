# Backup / Disaster Recovery

Two layers, both scheduled daily as k8s CronJobs (`infra/k8s/backup-cronjob.yaml`):

## Postgres — pgBackRest
The financial source of truth (ledger, orders, payments, settlements). Config in
`pgbackrest.conf`: encrypted, compressed, S3/MinIO repo, 7 full / 14 diff retention.
- WAL archiving + diff/full backups → **PITR** (point-in-time recovery).
- Restore: `pgbackrest --stanza=smartwash --type=time "--target=<ts>" restore`.

## Object storage — restic
Slip images in MinIO. Encrypted, deduplicated snapshots to a restic repo.
- Restore: `restic restore latest --target /data`.

## RPO / RTO targets (proposed)
- **RPO** ≤ 24h for object storage; ≤ 5 min for Postgres (WAL archiving).
- **RTO** ≤ 1h (restore latest base + replay WAL).

## Drills
Run a restore drill into a scratch namespace quarterly; verify the ledger
balance-chain (`balance_after`) is intact after restore. Backups are worthless
until a restore has been tested.

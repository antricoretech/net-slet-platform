# G08 Isolated Database Reconciliation Runbook

Documentation only. No command in this document is authorization to access `netslet_dev` or production.

## Preconditions

1. Database owner records the target, backup path, checksum, PostgreSQL major version, maintenance window and rollback owner.
2. Operator creates two disposable identities: a restored copy and an empty baseline copy. Neither may resolve to `netslet_dev`, production, a shared volume or port 5432.
3. Operator verifies the backup checksum before restore and records the database identity after connection.
4. Product, engineering and release owners approve the exact scope and stop conditions.

## Read-only diagnosis

- Compare migration directories, Prisma schema, `_prisma_migrations` state, relation inventory, indexes, constraints, functions, triggers, extensions and row counts.
- Record query definitions and counting scope; do not force historical object-count figures to agree when they measure different object classes.
- Never edit `_prisma_migrations` manually during diagnosis.

## Proposed forward-only rehearsal

1. Apply the proposed baseline to the empty disposable database.
2. Restore the verified backup into the separate restored disposable database.
3. Verify schema and representative data before any reconciliation operation.
4. Rehearse the supported Prisma reconciliation command only after a separately approved change record exists. The exact command must be generated from the tested migration directories and reviewed with the database owner.
5. Re-run schema, object, row-count, integrity, application and regression checks.

## Stop conditions

Stop immediately for ambiguous `DATABASE_URL`, target name `netslet_dev`, production host, port 5432, shared volume, checksum mismatch, unsupported PostgreSQL version, unexpected data mutation, migration-history inconsistency, failed rollback restore or any unreviewed `_prisma_migrations` change.

## Rollback

The database owner decides rollback. Restore the verified pre-change backup into an isolated copy first, compare identity and checksums, then follow the separately approved operational recovery procedure. Do not claim rollback success from a failed command or a schema-only comparison.

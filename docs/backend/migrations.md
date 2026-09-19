# Database migration and seed runbook

## Historical migration repair

`drizzle/0000_thankful_beyonder.sql` and `0001_add_tasks_appointments.sql` both
create `tasks` and `appointments`. They are historical artifacts and are retained
unchanged: editing them would invalidate applied migration history. New commands do
**not** point Drizzle at that journal.

- `drizzle/baseline/` is the verified canonical schema for an empty database.
- `drizzle/forward/` is the canonical forward chain, including tenant guards.
- `drizzle.config.ts` generates only the forward chain from `db/schema/canonical.ts`.
- `db/schema.ts` continues to export legacy tables for controlled backfill readers.

Before any write, capture an inventory:

```sh
node scripts/inspect-db.mjs /absolute/path/to/database.sqlite
```

For a local or staging database only, reconcile a recognized empty, legacy, or
canonical shape:

```sh
node scripts/migrate-baseline.mjs --database /absolute/path/to/database.sqlite --environment local
```

The script rejects unknown shapes, preserves existing rows, records the reconciliation
in `crm_migration_reconciliations`, and never stamps the old duplicate migration as
successfully applied. Back up schema/data before staging reconciliation. Production
requires a reviewed change procedure and an approved legacy owner mapping; this script
intentionally rejects `--environment production`.

## Seed policy

Seeds require an explicit database and environment; scripts never scan `.wrangler`,
select an arbitrary SQLite file, use `INSERT OR REPLACE`, or overwrite user records.

```sh
node scripts/seed-backend.mjs --database /absolute/path/to/database.sqlite --environment local
node scripts/seed-backend.mjs --database /absolute/path/to/database.sqlite --environment staging
```

Local/staging seeds contain only labeled synthetic records and repeatable dictionary
keys. Production seeding adds only bootstrap/dictionary configuration and never patient,
contact, lead, message, job, or provider data:

```sh
node scripts/seed-backend.mjs --database /approved/production.sqlite --environment production
```

Run the command twice in a disposable database to verify idempotence before using a
new seed version. Seeds do not dispatch communications or create active delivery jobs.

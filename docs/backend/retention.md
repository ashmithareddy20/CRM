# Retention, legal hold, and deletion

Retention is a per-tenant policy registry, not a guessed legal schedule. Policies independently cover leads, care/finance records, recordings/assets, raw webhooks, audit, exports, keys, and backups with jurisdiction, period, action, reviewer, and production approval. Production patient ingestion fails closed until a reviewed policy exists; local/staging use synthetic fixture policies.

Deletion requests are privileged, audited, dry-run first, resumable with a cursor, and re-check legal holds before every pass. A hold blocks deletion/anonymization. Executors remove or anonymize D1 rows, R2 objects, projections, exports, and identifier indexes according to class policy, then write a non-PHI tombstone. Immutable audit evidence is retained/minimized under its own policy.

Withdrawal/DNC and deletion ledgers remain protected only for suppression/replay. A restore must replay suppression before jobs resume; it cannot resurrect erased contacts or consent-withdrawn journeys. Encrypted retained backups disappear only on their documented expiry/key-retention schedule, not immediately when primary deletion completes.

# Canonical baseline

`0000_canonical_baseline.sql` is for an empty database only. Existing installations
must use `scripts/migrate-baseline.mjs`, which inspects the shape and records a
reconciliation row before applying `drizzle/forward` migrations. Historical
`drizzle/0000_*` and `0001_*` are intentionally preserved and are never replayed
by this baseline.

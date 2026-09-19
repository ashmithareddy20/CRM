# Backend operations

## Daily controls
- Review redacted error/latency, queue/outbox age, DLQ, signature failure, consent-blocked send, SLA/cadence lag, missing evidence, reporting watermark, retention failure, and backup-age metrics. Metric dimensions must not contain identifiers.
- Reconcile provider states before retrying ambiguous delivery. Replay DLQ only through the audited replay command.
- Verify readiness with a privileged request before a release. It checks bindings, a `SELECT 1`, OIDC and key configuration only; it never sends or changes records.

## Release and emergency stop
1. Validate a synthetic staging deployment, migration ledger, readiness, and isolated restore verification.
2. Enable tenant features only after approved configuration and policy review. Production integrations remain disabled unless separately approved.
3. On an incident, first stop dispatch with the integration/tenant kill switch. Preserve audit/event ledgers. Do not use database restore as application rollback.

Logs are structured and redacted. Correlate request, job, and provider opaque IDs; never paste PHI, raw webhook bodies, ciphertext, tokens, or R2 object URLs into incidents.

# Provider, webhook, and durable-work bindings

Provider delivery is simulated by default. `worker/providers` defines the only adapter boundary for WhatsApp, RCS, MMS, calls, and lead-form ingress. Adapters receive opaque message/operation IDs and load sensitive state within the Worker; Queue messages contain only `{ kind, id }` references.

## Required runtime configuration

- `DB`: the tenant CRM D1 binding. It stores the durable inbox, transactional outbox, jobs/leases, dead letters, and audit records.
- A Cloudflare Queue binding supplied to the scheduler/outbox functions as `WorkQueue`. Queue entries are opaque IDs only; long delays remain in `crm_durable_jobs` and are claimed by Cron.
- An environment-specific `ProviderRegistry`, assembled from deployment configuration. Its `IntegrationRegistration` is tenant and environment scoped, contains non-secret webhook secret references for diagnostics, and receives actual `webhookSecrets` only from Worker bindings/secret management.
- Provider secrets must be current and (during rotation) previous `webhookSecrets`. `X-Provider-Signature` is HMAC-SHA-256 base64url over `X-Provider-Timestamp + "." + raw body`; `X-Provider-Timestamp` is Unix seconds or milliseconds and is accepted for five minutes by default.

Register `handleProviderWebhook` before authenticated API middleware for `POST /api/v1/webhooks/:provider/:integrationId`; its integration lookup derives the tenant from configuration, never from the payload. The handler limits raw bodies to 256 KiB, verifies before JSON parsing, persists a unique inbox event before its 202 response, and asynchronously enqueues the inbox ID. Provide a tenant-aware `sealPayload` implementation from the security module; raw callback bodies must never be stored as plaintext.

## Operations

Cron invokes `scheduleDueJobs` and `publishPendingOutbox`. Job leases are five minutes by default and expired leases return to `pending`. Consumers use bounded exponential retry with deterministic jitter and respect provider `Retry-After`; exhausted or aged work moves to `crm_dead_letters`. `replayDeadLetter` creates a new job and append-only audit record—the original diagnostic is retained.

A timeout after an ambiguous provider acceptance must remain `delivery_unknown`. Call `reconcileAmbiguousDelivery` before retrying it. Providers without both a provider idempotency key and status reconciliation require manual resolution, not a claimed exactly-once send.

The `SimulatedProviderAdapter` supports deterministic accepted, timeout-after-acceptance, rate-limit, temporary/permanent failure, and unsupported-channel fixtures. Simulation injection must only be wired in non-production test/admin controls; production simulation, if intentionally configured, must be visibly labeled and excluded from real metrics.

# Environments and bindings

Development, staging, and production use distinct Cloudflare accounts/resources where possible and never share D1, R2, Queue/DLQ, OIDC client, encryption key ring, integration registry, backup destination, or deployment credentials. `wrangler.jsonc` intentionally declares named environments without resource IDs or secrets. Provision concrete bindings in Cloudflare dashboard or reviewed IaC: `DB`, `WORK_QUEUE`, `WORK_DLQ`, `EVIDENCE_BUCKET`, and `BACKUP_BUCKET`.

Store OIDC values, signing/encryption key rings, backup signing material, and provider credentials in environment-scoped Cloudflare secrets. Do not copy secrets into `.dev.vars.example`, client bundles, logs, queue payloads, or manifests. Separate application deploy, backup read/write, and key-recovery permissions. Cron schedules claim jobs, run retention, and verify backup freshness; queue messages contain opaque IDs only.

Production starts `PATIENT_DATA_INGESTION=blocked_until_policy_review`; transition requires an audited reviewed tenant policy and explicit release approval.

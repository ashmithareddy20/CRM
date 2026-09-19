import { keyVersionManifest } from "../security/keys";
export interface ReadinessEnv { DEPLOYMENT_ENV?: string; DEPLOYMENT_VERSION?: string; DB?: D1Database; WORK_QUEUE?: { send(value: unknown): Promise<void> }; EVIDENCE_BUCKET?: unknown; BACKUP_BUCKET?: unknown; FIELD_ENCRYPTION_KEYS?: string; FIELD_ENCRYPTION_ACTIVE_VERSION?: string; OIDC_ISSUER?: string; OIDC_AUDIENCE?: string; }
export interface ReadinessCheck { name: string; ready: boolean; detail?: string; }
export interface ReadinessReport { ready: boolean; environment: string; version?: string; checks: readonly ReadinessCheck[]; }
/** Never sends messages, writes records, or accesses patient data. */
export async function readiness(env: ReadinessEnv): Promise<ReadinessReport> {
  const checks: ReadinessCheck[] = [
    { name: "environment", ready: ["development", "staging", "production", "test"].includes(env.DEPLOYMENT_ENV ?? "") },
    { name: "database", ready: Boolean(env.DB) }, { name: "work_queue", ready: Boolean(env.WORK_QUEUE) },
    { name: "evidence_bucket", ready: Boolean(env.EVIDENCE_BUCKET) }, { name: "backup_bucket", ready: Boolean(env.BACKUP_BUCKET) },
    { name: "oidc", ready: Boolean(env.OIDC_ISSUER?.startsWith("https://") && env.OIDC_AUDIENCE) },
  ];
  try { keyVersionManifest(env); checks.push({ name: "encryption_keys", ready: true }); } catch { checks.push({ name: "encryption_keys", ready: false }); }
  // A minimal query confirms the binding is operational but does not query application data.
  if (env.DB) try { await env.DB.prepare("SELECT 1 AS ready").first(); checks.push({ name: "database_query", ready: true }); } catch { checks.push({ name: "database_query", ready: false }); }
  return { ready: checks.every((check) => check.ready), environment: env.DEPLOYMENT_ENV ?? "unknown", ...(env.DEPLOYMENT_VERSION ? { version: env.DEPLOYMENT_VERSION } : {}), checks };
}

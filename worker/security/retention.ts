/** Retention is policy-driven. No production tenant can process patient data without a reviewed policy. */
export type RetentionClass = "lead" | "care_finance" | "recording_asset" | "raw_webhook" | "audit" | "export" | "key" | "backup";
export type DeletionAction = "anonymize" | "erase" | "retain";
export interface RetentionPolicy {
  readonly id: string;
  readonly dataClass: RetentionClass;
  readonly jurisdiction: string;
  readonly retentionDays: number;
  readonly deletionAction: DeletionAction;
  readonly reviewedAt?: Date;
  readonly reviewedBy?: string;
  readonly productionApproved: boolean;
}
export interface PolicyRegistry { get(tenantId: string, dataClass: RetentionClass): Promise<RetentionPolicy | undefined>; }
export interface LegalHold { readonly id: string; readonly tenantId: string; readonly subjectId: string; readonly reason: string; readonly active: boolean; readonly createdAt: Date; }
export interface LegalHoldRegistry { activeFor(tenantId: string, subjectId: string): Promise<readonly LegalHold[]>; }
export interface PatientDataGateInput { tenantId: string; environment: string; dataClass?: RetentionClass; }

/** Development data is synthetic; real patient data only passes with explicit reviewed production policy. */
export async function requirePatientDataPolicy(registry: PolicyRegistry, input: PatientDataGateInput): Promise<RetentionPolicy> {
  const policy = await registry.get(input.tenantId, input.dataClass ?? "lead");
  if (!policy || policy.retentionDays < 0) throw new Error("Patient data is blocked: no retention policy is configured");
  if (input.environment === "production" && (!policy.productionApproved || !policy.reviewedAt || !policy.reviewedBy || policy.jurisdiction === "unspecified")) {
    throw new Error("Patient data is blocked: an explicitly reviewed production retention policy is required");
  }
  return policy;
}

export interface DeletionTarget { readonly subjectId: string; readonly dataClasses: readonly RetentionClass[]; }
export interface DeletionRequest { readonly id: string; readonly tenantId: string; readonly requestedBy: string; readonly target: DeletionTarget; readonly dryRun: boolean; readonly environment?: string; readonly cursor?: string; }
export interface DeletionProgress { readonly requestId: string; readonly status: "planned" | "running" | "blocked_legal_hold" | "complete"; readonly cursor?: string; readonly processed: number; readonly erased: number; readonly anonymized: number; readonly skipped: number; }
export interface DeletionStepResult { readonly processed: number; readonly erased: number; readonly anonymized: number; readonly skipped: number; readonly complete: boolean; readonly cursor?: string; }
export interface DeletionExecutor {
  /** Applies each data-class policy to D1/R2/projections/exports/indexes in a bounded pass. */
  execute(request: DeletionRequest, policies: readonly RetentionPolicy[], cursor?: string): Promise<DeletionStepResult>;
  tombstone(input: { tenantId: string; subjectId: string; requestId: string; action: "deletion" | "anonymization"; at: Date }): Promise<void>;
}

/** Executes bounded, resumable work. A legal hold is checked before every resumed step. */
export async function processDeletionRequest(input: { request: DeletionRequest; registry: PolicyRegistry; holds: LegalHoldRegistry; executor: DeletionExecutor; now?: Date }): Promise<DeletionProgress> {
  const { request, registry, holds, executor } = input;
  const activeHolds = await holds.activeFor(request.tenantId, request.target.subjectId);
  if (activeHolds.length) return { requestId: request.id, status: "blocked_legal_hold", processed: 0, erased: 0, anonymized: 0, skipped: 0 };
  const policies = await Promise.all(request.target.dataClasses.map((dataClass) => requirePatientDataPolicy(registry, { tenantId: request.tenantId, environment: request.environment ?? "production", dataClass })));
  if (request.dryRun) return { requestId: request.id, status: "planned", cursor: request.cursor, processed: 0, erased: 0, anonymized: 0, skipped: 0 };
  const step = await executor.execute(request, policies, request.cursor);
  if (step.complete) await executor.tombstone({ tenantId: request.tenantId, subjectId: request.target.subjectId, requestId: request.id, action: step.erased ? "deletion" : "anonymization", at: input.now ?? new Date() });
  return { requestId: request.id, status: step.complete ? "complete" : "running", cursor: step.cursor, processed: step.processed, erased: step.erased, anonymized: step.anonymized, skipped: step.skipped };
}

/** Restore must replay this protected ledger before any scheduled work is released. */
export interface SuppressionReplayLedger { readonly subjectId: string; readonly purpose: string; readonly withdrawnAt: Date; }
export async function replaySuppressionsBeforeJobs(entries: readonly SuppressionReplayLedger[], apply: (entry: SuppressionReplayLedger) => Promise<void>): Promise<void> {
  for (const entry of [...entries].sort((a, b) => a.withdrawnAt.getTime() - b.withdrawnAt.getTime())) await apply(entry);
}

/** Concrete D1 storage for policy/hold/deletion control records. Tables are control-plane only and never hold PHI. */
export class D1RetentionRegistry implements PolicyRegistry, LegalHoldRegistry {
  private initialized?: Promise<void>;
  constructor(private readonly db: D1Database) {}
  private async initialize(): Promise<void> {
    this.initialized ??= this.db.batch([
      this.db.prepare(`CREATE TABLE IF NOT EXISTS crm_retention_policies (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, data_class TEXT NOT NULL, jurisdiction TEXT NOT NULL,
        retention_days INTEGER NOT NULL, deletion_action TEXT NOT NULL, production_approved INTEGER NOT NULL DEFAULT 0,
        reviewed_at INTEGER, reviewed_by TEXT, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL,
        UNIQUE(tenant_id, data_class, id))`),
      this.db.prepare(`CREATE TABLE IF NOT EXISTS crm_legal_holds (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, subject_id TEXT NOT NULL, reason TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, released_at INTEGER, released_by TEXT)`),
      this.db.prepare(`CREATE INDEX IF NOT EXISTS crm_legal_holds_subject_idx ON crm_legal_holds(tenant_id, subject_id, active)`),
      this.db.prepare(`CREATE TABLE IF NOT EXISTS crm_deletion_requests (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, subject_id TEXT NOT NULL, requested_by TEXT NOT NULL,
        data_classes_json TEXT NOT NULL, dry_run INTEGER NOT NULL, environment TEXT NOT NULL, status TEXT NOT NULL,
        cursor TEXT, processed INTEGER NOT NULL DEFAULT 0, erased INTEGER NOT NULL DEFAULT 0, anonymized INTEGER NOT NULL DEFAULT 0,
        skipped INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`),
      this.db.prepare(`CREATE INDEX IF NOT EXISTS crm_deletion_requests_pending_idx ON crm_deletion_requests(tenant_id, status, updated_at)`),
    ]).then(() => undefined);
    await this.initialized;
  }
  async get(tenantId: string, dataClass: RetentionClass): Promise<RetentionPolicy | undefined> {
    await this.initialize();
    const row = await this.db.prepare(`SELECT id, data_class AS dataClass, jurisdiction, retention_days AS retentionDays, deletion_action AS deletionAction, production_approved AS productionApproved, reviewed_at AS reviewedAt, reviewed_by AS reviewedBy FROM crm_retention_policies WHERE tenant_id = ? AND data_class = ? AND active = 1 ORDER BY reviewed_at DESC LIMIT 1`).bind(tenantId, dataClass).first<Record<string, unknown>>();
    return row ? policyRow(row) : undefined;
  }
  async savePolicy(tenantId: string, policy: RetentionPolicy, now = new Date()): Promise<void> {
    await this.initialize();
    await this.db.prepare(`INSERT INTO crm_retention_policies (id, tenant_id, data_class, jurisdiction, retention_days, deletion_action, production_approved, reviewed_at, reviewed_by, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
      .bind(policy.id, tenantId, policy.dataClass, policy.jurisdiction, policy.retentionDays, policy.deletionAction, policy.productionApproved ? 1 : 0, policy.reviewedAt?.getTime() ?? null, policy.reviewedBy ?? null, now.getTime()).run();
  }
  async activeFor(tenantId: string, subjectId: string): Promise<readonly LegalHold[]> {
    await this.initialize(); const rows = await this.db.prepare(`SELECT id, tenant_id AS tenantId, subject_id AS subjectId, reason, active, created_at AS createdAt FROM crm_legal_holds WHERE tenant_id = ? AND subject_id = ? AND active = 1`).bind(tenantId, subjectId).all<Record<string, unknown>>();
    return rows.results.map((row) => ({ id: String(row.id), tenantId: String(row.tenantId), subjectId: String(row.subjectId), reason: String(row.reason), active: Boolean(row.active), createdAt: new Date(Number(row.createdAt)) }));
  }
  async placeHold(hold: LegalHold): Promise<void> { await this.initialize(); await this.db.prepare(`INSERT INTO crm_legal_holds (id, tenant_id, subject_id, reason, active, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(hold.id, hold.tenantId, hold.subjectId, hold.reason, hold.active ? 1 : 0, hold.createdAt.getTime()).run(); }
  async releaseHold(tenantId: string, holdId: string, releasedBy: string, now = new Date()): Promise<boolean> { await this.initialize(); const result = await this.db.prepare(`UPDATE crm_legal_holds SET active = 0, released_at = ?, released_by = ? WHERE id = ? AND tenant_id = ? AND active = 1`).bind(now.getTime(), releasedBy, holdId, tenantId).run(); return result.meta.changes === 1; }
  async createDeletionRequest(request: DeletionRequest, now = new Date()): Promise<void> { await this.initialize(); await this.db.prepare(`INSERT INTO crm_deletion_requests (id, tenant_id, subject_id, requested_by, data_classes_json, dry_run, environment, status, cursor, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?, ?)`)
    .bind(request.id, request.tenantId, request.target.subjectId, request.requestedBy, JSON.stringify(request.target.dataClasses), request.dryRun ? 1 : 0, request.environment ?? "production", request.cursor ?? null, now.getTime(), now.getTime()).run(); }
  async recordProgress(progress: DeletionProgress, tenantId: string, now = new Date()): Promise<void> { await this.initialize(); await this.db.prepare(`UPDATE crm_deletion_requests SET status = ?, cursor = ?, processed = ?, erased = ?, anonymized = ?, skipped = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`).bind(progress.status, progress.cursor ?? null, progress.processed, progress.erased, progress.anonymized, progress.skipped, now.getTime(), progress.requestId, tenantId).run(); }
}
function policyRow(row: Record<string, unknown>): RetentionPolicy { return { id: String(row.id), dataClass: row.dataClass as RetentionClass, jurisdiction: String(row.jurisdiction), retentionDays: Number(row.retentionDays), deletionAction: row.deletionAction as DeletionAction, productionApproved: Boolean(row.productionApproved), ...(row.reviewedAt ? { reviewedAt: new Date(Number(row.reviewedAt)) } : {}), ...(row.reviewedBy ? { reviewedBy: String(row.reviewedBy) } : {}) }; }

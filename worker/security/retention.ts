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

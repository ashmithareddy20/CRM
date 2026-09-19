import { ApiError } from "../../api/errors";
import { CORRECTIVE_ACTIONS, primaryForSecondary, REACTIVATION_EXCLUDED_REASONS, type CorrectiveAction, type PrimaryReason, type Recoverability, VALID_SECONDARY_REASONS } from "./taxonomy";

export interface DiagnosisContext { tenantId: string; actorMembershipId: string; now: Date; roles: readonly string[]; }
export interface DiagnosisInput { leadId: string; versionId: string; primaryReason: PrimaryReason; secondaryReason: string; detailedRemark: string; evidenceId?: string; recoverability: Recoverability; responsibleMembershipId: string; reviewAt: Date; }
export interface DiagnosisRecord extends Omit<DiagnosisInput, "detailedRemark" | "evidenceId"> { id: string; tenantId: string; evidenceId: string; status: "active" | "superseded"; createdAt: Date; }
export interface DiagnosisTask { id: string; leadId: string; title: string; assigneeMembershipId: string; dueAt: Date; priority: "high" | "normal"; }
export interface DiagnosisRepository {
  getLead(tenantId: string, leadId: string): Promise<{ id: string; contactId: string; lifecycleStage: string } | undefined>;
  addDiagnosis(record: DiagnosisRecord): Promise<void>;
  addFinding(input: { tenantId: string; diagnosisId: string; finding: string; evidenceId: string; ownerMembershipId: string; reviewAt: Date; createdAt: Date; createdByMembershipId: string }): Promise<void>;
  addTask(task: DiagnosisTask, tenantId: string, actorMembershipId: string, now: Date): Promise<void>;
}
const id = () => crypto.randomUUID();
const canDiagnose = (roles: readonly string[]) => roles.some((role) => ["agent", "manager", "operations", "clinician", "financial_counselor", "tenant_administrator"].includes(role));

/** A closure diagnosis is immutable evidence: no evidence means an evidence-gathering task, never a final closure. */
export class DiagnosisService {
  constructor(private readonly repository: DiagnosisRepository) {}

  async record(context: DiagnosisContext, input: DiagnosisInput): Promise<{ state: "recorded"; diagnosis: DiagnosisRecord; actions: readonly CorrectiveAction[] } | { state: "evidence_pending"; task: DiagnosisTask }> {
    if (!canDiagnose(context.roles)) throw new ApiError("FORBIDDEN", 403, "You are not permitted to record a non-conversion diagnosis");
    const lead = await this.repository.getLead(context.tenantId, input.leadId);
    if (!lead) throw new ApiError("NOT_FOUND", 404, "Lead is unavailable");
    if (lead.lifecycleStage !== "closed") throw new ApiError("VALIDATION_FAILED", 422, "A non-conversion diagnosis is recorded only after operational expiry or closure", { leadId: "Close or expire the active follow-up before diagnosis" });
    if (!input.detailedRemark.trim()) throw new ApiError("VALIDATION_FAILED", 422, "A detailed non-conversion remark is required", { detailedRemark: "Required" });
    if (input.reviewAt <= context.now) throw new ApiError("VALIDATION_FAILED", 422, "Review date must be in the future", { reviewAt: "Must be later than diagnosis time" });
    if (!VALID_SECONDARY_REASONS.has(input.secondaryReason) || primaryForSecondary(input.secondaryReason) !== input.primaryReason) throw new ApiError("VALIDATION_FAILED", 422, "Secondary reason does not belong to the primary reason", { secondaryReason: "Select a reason under the chosen primary reason" });
    if (!input.evidenceId) {
      const task: DiagnosisTask = { id: id(), leadId: input.leadId, title: "Collect evidence required for non-conversion closure", assigneeMembershipId: input.responsibleMembershipId, dueAt: context.now, priority: "high" };
      await this.repository.addTask(task, context.tenantId, context.actorMembershipId, context.now);
      return { state: "evidence_pending", task };
    }
    if (REACTIVATION_EXCLUDED_REASONS.has(input.secondaryReason) && input.recoverability !== "genuine_lost" && input.recoverability !== "invalid_non_actionable") throw new ApiError("VALIDATION_FAILED", 422, "This diagnosis reason cannot be marked recoverable", { recoverability: "Use genuine_lost or invalid_non_actionable" });
    const diagnosis: DiagnosisRecord = { id: id(), tenantId: context.tenantId, leadId: input.leadId, versionId: input.versionId, primaryReason: input.primaryReason, secondaryReason: input.secondaryReason, evidenceId: input.evidenceId, recoverability: input.recoverability, responsibleMembershipId: input.responsibleMembershipId, reviewAt: input.reviewAt, status: "active", createdAt: context.now };
    const correctiveActions = CORRECTIVE_ACTIONS[input.primaryReason];
    await this.repository.addDiagnosis(diagnosis);
    await this.repository.addFinding({ tenantId: context.tenantId, diagnosisId: diagnosis.id, finding: `Diagnosis: ${input.detailedRemark.trim()} | Recommended actions: ${correctiveActions.map((action) => action.code).join(", ")}`, evidenceId: input.evidenceId, ownerMembershipId: input.responsibleMembershipId, reviewAt: input.reviewAt, createdAt: context.now, createdByMembershipId: context.actorMembershipId });
    return { state: "recorded", diagnosis, actions: correctiveActions };
  }
}

export class MemoryDiagnosisRepository implements DiagnosisRepository {
  readonly leads = new Map<string, { id: string; contactId: string; lifecycleStage: string }>();
  readonly diagnoses: DiagnosisRecord[] = []; readonly tasks: DiagnosisTask[] = []; readonly findings: Array<Record<string, unknown>> = [];
  async getLead(_tenantId: string, leadId: string) { return this.leads.get(leadId); }
  async addDiagnosis(record: DiagnosisRecord) { this.diagnoses.push(record); }
  async addFinding(input: { tenantId: string; diagnosisId: string; finding: string; evidenceId: string; ownerMembershipId: string; reviewAt: Date; createdAt: Date; createdByMembershipId: string }) { this.findings.push(input); }
  async addTask(task: DiagnosisTask) { this.tasks.push(task); }
}

export class D1DiagnosisRepository implements DiagnosisRepository {
  constructor(private readonly db: D1Database) {}
  async getLead(tenantId: string, leadId: string) { return (await this.db.prepare("SELECT id, contact_id AS contactId, lifecycle_stage AS lifecycleStage FROM crm_lead_episodes WHERE tenant_id = ? AND id = ? AND archived_at IS NULL").bind(tenantId, leadId).first<{ id: string; contactId: string; lifecycleStage: string }>()) ?? undefined; }
  async addDiagnosis(record: DiagnosisRecord) { await this.db.prepare("INSERT INTO crm_lead_diagnoses (id, tenant_id, lead_id, version_id, primary_reason, secondary_reason, evidence_id, recoverability, review_at, status, created_at, created_by_membership_id, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)").bind(record.id, record.tenantId, record.leadId, record.versionId, record.primaryReason, record.secondaryReason, record.evidenceId, record.recoverability, record.reviewAt.getTime(), record.status, record.createdAt.getTime(), record.responsibleMembershipId).run(); }
  async addFinding(input: { tenantId: string; diagnosisId: string; finding: string; evidenceId: string; ownerMembershipId: string; reviewAt: Date; createdAt: Date; createdByMembershipId: string }) { await this.db.prepare("INSERT INTO crm_management_findings (id, tenant_id, diagnosis_id, finding, evidence_id, owner_membership_id, review_at, created_at, created_by_membership_id, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)").bind(id(), input.tenantId, input.diagnosisId, input.finding, input.evidenceId, input.ownerMembershipId, input.reviewAt.getTime(), input.createdAt.getTime(), input.createdByMembershipId).run(); }
  async addTask(task: DiagnosisTask, tenantId: string, actorMembershipId: string, now: Date) { await this.db.prepare("INSERT INTO crm_tasks (id, tenant_id, lead_id, assignee_membership_id, title, due_at, status, priority, created_at, created_by_membership_id, version) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, 1)").bind(task.id, tenantId, task.leadId, task.assigneeMembershipId, task.title, task.dueAt.getTime(), task.priority, now.getTime(), actorMembershipId).run(); }
}

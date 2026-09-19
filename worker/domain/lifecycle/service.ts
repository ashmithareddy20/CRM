import type { LifecycleStage } from "../../../lib/api/lifecycle";
import { ApiError } from "../../api/errors";

export interface LifecycleContext { tenantId: string; actorMembershipId: string; requestId: string; now: Date; roles: readonly string[]; }
export interface TransitionCommand { toStage: LifecycleStage; expectedVersion: number; reasonId?: string; evidenceId?: string; nextAction?: { action: string; ownerMembershipId: string; dueAt: Date }; commandId?: string; }
interface ExistingTransition { id: string; fromStage: LifecycleStage; toStage: LifecycleStage; expectedVersion: number; }
const id = () => crypto.randomUUID();

// This pure baseline supports validation before a tenant has installed stage-policy dictionaries.
// Commands still require a current configured transition row at persistence time.
const legalTransitions: Readonly<Record<LifecycleStage, readonly LifecycleStage[]>> = {
  received: ["source_identified", "assigned", "closed"], source_identified: ["assigned", "closed"], assigned: ["contact_attempted", "closed"],
  contact_attempted: ["contact_attempted", "meaningful_connection", "follow_up_active", "closed"], meaningful_connection: ["requirement_identified", "follow_up_active", "closed"],
  requirement_identified: ["qualified", "follow_up_active", "closed"], qualified: ["follow_up_active", "appointment_suggested", "closed"], follow_up_active: ["contact_attempted", "meaningful_connection", "appointment_suggested", "closed"],
  appointment_suggested: ["appointment_booked", "follow_up_active", "closed"], appointment_booked: ["appointment_confirmed", "follow_up_active", "closed"], appointment_confirmed: ["arrived", "follow_up_active", "closed"], arrived: ["consultation", "closed"], consultation: ["treatment_advised", "financial_counseling", "closed"], treatment_advised: ["financial_counseling", "procedure_booked", "treatment_completed", "closed"], financial_counseling: ["procedure_booked", "treatment_completed", "closed"], procedure_booked: ["admission", "treatment_completed", "closed"], admission: ["treatment_completed", "revenue_recorded", "closed"], treatment_completed: ["revenue_recorded", "closed"], revenue_recorded: ["closed"], closed: [],
};
export function isLegalLifecycleTransition(from: LifecycleStage, to: LifecycleStage): boolean { return legalTransitions[from].includes(to); }
function canTransition(context: LifecycleContext): boolean { return context.roles.some((role) => ["agent", "manager", "operations", "scheduler", "clinician", "financial_counselor", "tenant_administrator"].includes(role)); }
function requiresSpecialRole(stage: LifecycleStage, roles: readonly string[]) {
  if (stage === "treatment_completed" && !roles.includes("clinician")) throw new ApiError("FORBIDDEN", 403, "Treatment completion requires an authorized clinician");
  if (stage === "revenue_recorded" && !roles.includes("financial_counselor")) throw new ApiError("FORBIDDEN", 403, "Revenue milestones require an authorized financial counselor");
}
function policyAllows(policyJson: string, now: Date) { try { const p = JSON.parse(policyJson) as { active?: boolean; effectiveAt?: string | number; expiresAt?: string | number }; const effective = p.effectiveAt ? new Date(p.effectiveAt).getTime() : Number.NEGATIVE_INFINITY; const expires = p.expiresAt ? new Date(p.expiresAt).getTime() : Number.POSITIVE_INFINITY; return p.active !== false && effective <= now.getTime() && now.getTime() < expires; } catch { return false; } }

/** Explicit, idempotent business transition command. No arbitrary lifecycle PATCH is supported. */
export class LifecycleService {
  constructor(private readonly db: D1Database) {}

  async transition(context: LifecycleContext, leadId: string, command: TransitionCommand): Promise<{ leadId: string; fromStage: LifecycleStage; toStage: LifecycleStage; version: number; transitionId: string; replayed?: boolean }> {
    if (!canTransition(context)) throw new ApiError("FORBIDDEN", 403, "You are not permitted to transition a lead");
    const commandId = command.commandId;
    if (!commandId) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { commandId: "An Idempotency-Key is required for lifecycle commands" });
    const existing = await this.db.prepare("SELECT id, from_stage AS fromStage, to_stage AS toStage, expected_version AS expectedVersion FROM crm_lifecycle_transitions WHERE tenant_id = ? AND command_id = ?").bind(context.tenantId, commandId).first<ExistingTransition>();
    if (existing) {
      if (existing.toStage !== command.toStage || existing.expectedVersion !== command.expectedVersion) throw new ApiError("CONFLICT", 409, "Idempotency key was already used for a different transition");
      return { leadId, fromStage: existing.fromStage, toStage: existing.toStage, version: existing.expectedVersion + 1, transitionId: existing.id, replayed: true };
    }
    const lead = await this.db.prepare("SELECT lifecycle_stage AS stage, version FROM crm_lead_episodes WHERE tenant_id = ? AND id = ? AND archived_at IS NULL").bind(context.tenantId, leadId).first<{ stage: LifecycleStage; version: number }>();
    if (!lead) throw new ApiError("NOT_FOUND", 404, "Lead is unavailable");
    if (lead.version !== command.expectedVersion) throw new ApiError("PRECONDITION_FAILED", 412, "Lead was changed by another request");
    if (!isLegalLifecycleTransition(lead.stage, command.toStage)) throw new ApiError("VALIDATION_FAILED", 422, "This lifecycle transition is not permitted", { toStage: "Transition is not legal from the current stage" });
    requiresSpecialRole(command.toStage, context.roles);
    await this.validateConfiguredTransition(context, lead.stage, command.toStage);
    await this.validateEvidenceAndReason(context, command);
    await this.requireNoPendingRemarks(context.tenantId, leadId, command.toStage);
    if (["follow_up_active", "appointment_suggested"].includes(command.toStage) && !command.nextAction) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { nextAction: "A next action commitment is required" });
    if (["treatment_completed", "revenue_recorded", "closed"].includes(command.toStage)) await this.requireDiagnosis(context.tenantId, leadId);

    const transitionId = id(); const now = context.now.getTime();
    const update = this.db.prepare("UPDATE crm_lead_episodes SET lifecycle_stage = ?, version = version + 1, updated_at = ?, updated_by_membership_id = ? WHERE tenant_id = ? AND id = ? AND version = ? AND archived_at IS NULL")
      .bind(command.toStage, now, context.actorMembershipId, context.tenantId, leadId, command.expectedVersion);
    const writes: D1PreparedStatement[] = [
      update,
      this.db.prepare("INSERT INTO crm_lifecycle_transitions (id, tenant_id, lead_id, from_stage, to_stage, reason_id, command_id, expected_version, occurred_at, evidence_id, created_at, created_by_membership_id, version) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1 WHERE changes() = 1")
        .bind(transitionId, context.tenantId, leadId, lead.stage, command.toStage, command.reasonId ?? null, commandId, command.expectedVersion, now, command.evidenceId ?? null, now, context.actorMembershipId),
      this.db.prepare("INSERT INTO crm_transactional_outbox (id, tenant_id, operation_key, type, payload_ciphertext, status, available_at, created_at, created_by_membership_id, version) SELECT ?, ?, ?, 'lifecycle.transitioned', ?, 'pending', ?, ?, ?, 1 WHERE changes() = 1")
        .bind(id(), context.tenantId, `lifecycle:${leadId}:${commandId}`, JSON.stringify({ leadId, transitionId }), now, now, context.actorMembershipId),
    ];
    if (command.nextAction) writes.push(this.db.prepare("INSERT INTO crm_next_action_commitments (id, tenant_id, lead_id, owner_membership_id, due_at, action, status, created_at, created_by_membership_id, version) SELECT ?, ?, ?, ?, ?, ?, 'open', ?, ?, 1 WHERE changes() = 1").bind(id(), context.tenantId, leadId, command.nextAction.ownerMembershipId, command.nextAction.dueAt.getTime(), command.nextAction.action, now, context.actorMembershipId));
    const results = await this.db.batch(writes);
    if (results[0].meta.changes !== 1) throw new ApiError("PRECONDITION_FAILED", 412, "Lead was changed by another request");
    return { leadId, fromStage: lead.stage, toStage: command.toStage, version: command.expectedVersion + 1, transitionId };
  }

  private async requireNoPendingRemarks(tenantId: string, leadId: string, toStage: LifecycleStage) {
    if (["received", "source_identified", "assigned", "contact_attempted"].includes(toStage)) return;
    const pending = await this.db.prepare("SELECT id FROM crm_call_attempts WHERE tenant_id = ? AND lead_id = ? AND disposition = 'remark_pending' LIMIT 1").bind(tenantId, leadId).first();
    if (pending) throw new ApiError("CONFLICT", 409, "Complete pending mandatory call remarks before progressing this lead");
  }
  private async validateConfiguredTransition(context: LifecycleContext, from: LifecycleStage, to: LifecycleStage) {
    const row = await this.db.prepare("SELECT t.policy_json AS policyJson FROM crm_allowed_transitions t JOIN crm_lifecycle_stages f ON f.tenant_id = t.tenant_id AND f.id = t.from_stage_id JOIN crm_lifecycle_stages n ON n.tenant_id = t.tenant_id AND n.id = t.to_stage_id WHERE t.tenant_id = ? AND f.key = ? AND n.key = ? ORDER BY t.version DESC LIMIT 1").bind(context.tenantId, from, to).first<{ policyJson: string }>();
    if (!row || !policyAllows(row.policyJson, context.now)) throw new ApiError("VALIDATION_FAILED", 422, "This lifecycle transition is not enabled by the current policy", { toStage: "No active configured transition permits this change" });
  }
  private async validateEvidenceAndReason(context: LifecycleContext, command: TransitionCommand) {
    const evidenceRequired = ["meaningful_connection", "requirement_identified", "qualified", "appointment_booked", "consultation", "treatment_advised", "financial_counseling", "procedure_booked", "treatment_completed", "revenue_recorded"].includes(command.toStage);
    if (evidenceRequired && !command.evidenceId) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { evidenceId: "This milestone requires source evidence" });
    if (command.evidenceId) {
      const evidence = await this.db.prepare("SELECT id FROM crm_evidence_assets WHERE tenant_id = ? AND id = ? AND status = 'approved'").bind(context.tenantId, command.evidenceId).first();
      if (!evidence) throw new ApiError("NOT_FOUND", 404, "Evidence is unavailable");
    }
    if (command.toStage === "closed" && !command.reasonId) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { reasonId: "Closing a lead requires an attributable reason" });
    if (command.reasonId) {
      const reason = await this.db.prepare("SELECT r.requires_evidence AS requiresEvidence, s.key AS stageKey FROM crm_lifecycle_reasons r LEFT JOIN crm_lifecycle_stages s ON s.tenant_id = r.tenant_id AND s.id = r.stage_id WHERE r.tenant_id = ? AND r.id = ?").bind(context.tenantId, command.reasonId).first<{ requiresEvidence: number; stageKey: string | null }>();
      if (!reason || (reason.stageKey && reason.stageKey !== command.toStage)) throw new ApiError("NOT_FOUND", 404, "Lifecycle reason is unavailable");
      if (reason.requiresEvidence && !command.evidenceId) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { evidenceId: "This reason requires evidence" });
    }
  }
  private async requireDiagnosis(tenantId: string, leadId: string) {
    const diagnosis = await this.db.prepare("SELECT id FROM crm_lead_diagnoses WHERE tenant_id = ? AND lead_id = ? AND status = 'active' LIMIT 1").bind(tenantId, leadId).first();
    if (!diagnosis) throw new ApiError("CONFLICT", 409, "A diagnosis-linked terminal outcome is required before closing a lead");
  }
}

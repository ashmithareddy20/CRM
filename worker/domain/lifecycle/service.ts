import type { LifecycleStage } from "../../../lib/api/lifecycle";
import { ApiError } from "../../api/errors";

export interface LifecycleContext { tenantId: string; actorMembershipId: string; requestId: string; now: Date; roles: readonly string[]; }
export interface TransitionCommand { toStage: LifecycleStage; expectedVersion: number; reasonId?: string; evidenceId?: string; nextAction?: { action: string; ownerMembershipId: string; dueAt: Date }; commandId?: string; }
const id = () => crypto.randomUUID();

const legalTransitions: Readonly<Record<LifecycleStage, readonly LifecycleStage[]>> = {
  received: ["source_identified", "assigned", "closed"], source_identified: ["assigned", "closed"], assigned: ["contact_attempted", "closed"],
  contact_attempted: ["contact_attempted", "meaningful_connection", "follow_up_active", "closed"], meaningful_connection: ["requirement_identified", "follow_up_active", "closed"],
  requirement_identified: ["qualified", "follow_up_active", "closed"], qualified: ["follow_up_active", "appointment_suggested", "closed"], follow_up_active: ["contact_attempted", "meaningful_connection", "appointment_suggested", "closed"],
  appointment_suggested: ["appointment_booked", "follow_up_active", "closed"], appointment_booked: ["appointment_confirmed", "follow_up_active", "closed"], appointment_confirmed: ["arrived", "follow_up_active", "closed"], arrived: ["consultation", "closed"], consultation: ["treatment_advised", "financial_counseling", "closed"], treatment_advised: ["financial_counseling", "procedure_booked", "treatment_completed", "closed"], financial_counseling: ["procedure_booked", "treatment_completed", "closed"], procedure_booked: ["admission", "treatment_completed", "closed"], admission: ["treatment_completed", "closed"], treatment_completed: ["revenue_recorded", "closed"], revenue_recorded: ["closed"], closed: [],
};

export function isLegalLifecycleTransition(from: LifecycleStage, to: LifecycleStage): boolean { return legalTransitions[from].includes(to); }
function canTransition(context: LifecycleContext): boolean { return context.roles.some((role) => ["agent", "manager", "operations", "scheduler", "clinician", "financial_counselor", "tenant_administrator"].includes(role)); }

/** Uses a lead-version compare-and-swap before any history/outbox write. */
export class LifecycleService {
  constructor(private readonly db: D1Database) {}

  async transition(context: LifecycleContext, leadId: string, command: TransitionCommand): Promise<{ leadId: string; fromStage: LifecycleStage; toStage: LifecycleStage; version: number; transitionId: string }> {
    if (!canTransition(context)) throw new ApiError("FORBIDDEN", 403, "You are not permitted to transition a lead");
    const lead = await this.db.prepare("SELECT lifecycle_stage AS stage, version FROM crm_lead_episodes WHERE tenant_id = ? AND id = ? AND archived_at IS NULL").bind(context.tenantId, leadId).first<{ stage: LifecycleStage; version: number }>();
    if (!lead) throw new ApiError("NOT_FOUND", 404, "Lead is unavailable");
    if (lead.version !== command.expectedVersion) throw new ApiError("PRECONDITION_FAILED", 412, "Lead was changed by another request");
    if (!isLegalLifecycleTransition(lead.stage, command.toStage)) throw new ApiError("VALIDATION_FAILED", 422, "This lifecycle transition is not permitted", { toStage: "Transition is not legal from the current stage" });
    if (command.toStage === "closed" && !command.reasonId) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { reasonId: "Closing a lead requires an attributable reason" });
    if (["meaningful_connection", "requirement_identified", "qualified", "appointment_booked", "consultation", "treatment_advised", "financial_counseling", "procedure_booked", "treatment_completed", "revenue_recorded"].includes(command.toStage) && !command.evidenceId) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { evidenceId: "This milestone requires source evidence" });
    if (["follow_up_active", "appointment_suggested"].includes(command.toStage) && !command.nextAction) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { nextAction: "A next action commitment is required" });

    const transitionId = id(); const commandId = command.commandId ?? id(); const now = context.now.getTime();
    const update = this.db.prepare("UPDATE crm_lead_episodes SET lifecycle_stage = ?, version = version + 1, updated_at = ?, updated_by_membership_id = ? WHERE tenant_id = ? AND id = ? AND version = ? AND archived_at IS NULL")
      .bind(command.toStage, now, context.actorMembershipId, context.tenantId, leadId, command.expectedVersion);
    // SQLite changes() makes every dependent write a no-op when the CAS did not change a row.
    // D1 batch is atomic, so a rejected version cannot leave transition history or an outbox event.
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
}

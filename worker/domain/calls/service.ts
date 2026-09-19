import type { z } from "zod";
import { callAttemptSchema, callRemarkSchema } from "../../../lib/api/lifecycle";
import { ApiError } from "../../api/errors";

export interface CallContext { tenantId: string; actorMembershipId: string; now: Date; requestId: string; roles: readonly string[]; }
export interface CallProtector { encrypt(tenantId: string, recordId: string, purpose: string, value: string): Promise<string>; }
export interface PairingStore { previousAttempt(tenantId: string, pairId: string): Promise<{ dialedAt: Date } | undefined>; remember(tenantId: string, pairId: string, callAttemptId: string, dialedAt: Date): Promise<void>; }
export const MINIMUM_DOUBLE_DIAL_INTERVAL_MS = 15 * 60_000;
const id = () => crypto.randomUUID();

/** Calls preserve provider facts first; only a completed agent remark makes contact work compliant. */
export class CallService {
  constructor(private readonly db: D1Database, private readonly protector: CallProtector, private readonly pairing?: PairingStore) {}

  async recordAttempt(context: CallContext, rawInput: z.input<typeof callAttemptSchema>) {
    const input = callAttemptSchema.parse(rawInput);
    if (!context.roles.some((role) => ["agent", "manager", "operations", "tenant_administrator", "integration_principal"].includes(role))) throw new ApiError("FORBIDDEN", 403, "You are not permitted to record a call attempt");
    const lead = await this.db.prepare("SELECT id FROM crm_lead_episodes WHERE tenant_id = ? AND id = ? AND archived_at IS NULL").bind(context.tenantId, input.leadId).first();
    if (!lead) throw new ApiError("NOT_FOUND", 404, "Lead is unavailable");
    const dialedAt = input.dialedAt ?? context.now;
    if (input.pairId && this.pairing) {
      const previous = await this.pairing.previousAttempt(context.tenantId, input.pairId);
      if (previous && dialedAt.getTime() - previous.dialedAt.getTime() < MINIMUM_DOUBLE_DIAL_INTERVAL_MS) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { pairId: "Double-dial attempts must use the configured minimum interval" });
    }
    const callAttemptId = id();
    const result = await this.db.prepare("INSERT OR IGNORE INTO crm_call_attempts (id, tenant_id, lead_id, membership_id, provider, external_id, direction, disposition, dialed_at, connected_at, ended_at, created_at, created_by_membership_id, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)")
      .bind(callAttemptId, context.tenantId, input.leadId, context.actorMembershipId, input.provider ?? null, input.externalId ?? null, input.direction, input.disposition === "pending" ? "remark_pending" : input.disposition, dialedAt.getTime(), input.connectedAt?.getTime() ?? null, input.endedAt?.getTime() ?? null, context.now.getTime(), context.actorMembershipId).run();
    if (!result.meta.changes) {
      const existing = await this.db.prepare("SELECT id, disposition FROM crm_call_attempts WHERE tenant_id = ? AND provider = ? AND external_id = ?").bind(context.tenantId, input.provider, input.externalId).first<{ id: string; disposition: string }>();
      return { callAttemptId: existing?.id, duplicate: true, remarkPending: existing?.disposition === "remark_pending" };
    }
    if (input.pairId && this.pairing) await this.pairing.remember(context.tenantId, input.pairId, callAttemptId, dialedAt);
    await this.db.prepare("INSERT INTO crm_transactional_outbox (id, tenant_id, operation_key, type, payload_ciphertext, status, available_at, created_at, created_by_membership_id, version) VALUES (?, ?, ?, 'call.attempt_recorded', ?, 'pending', ?, ?, ?, 1)")
      .bind(id(), context.tenantId, `call:${callAttemptId}`, JSON.stringify({ callAttemptId }), context.now.getTime(), context.now.getTime(), context.actorMembershipId).run();
    return { callAttemptId, duplicate: false, remarkPending: true, pairId: input.pairId };
  }

  async completeRemark(context: CallContext, callAttemptId: string, rawInput: z.input<typeof callRemarkSchema>) {
    if (!context.roles.some((role) => ["agent", "manager", "clinician"].includes(role))) throw new ApiError("FORBIDDEN", 403, "You are not permitted to complete call remarks");
    const input = callRemarkSchema.parse(rawInput);
    const attempt = await this.db.prepare("SELECT lead_id AS leadId, disposition FROM crm_call_attempts WHERE tenant_id = ? AND id = ?").bind(context.tenantId, callAttemptId).first<{ leadId: string; disposition: string }>();
    if (!attempt) throw new ApiError("NOT_FOUND", 404, "Call attempt is unavailable");
    const remarkId = id(); const now = context.now.getTime();
    const [patientStatementCiphertext, agentExplanationCiphertext] = await Promise.all([
      input.patientStatement ? this.protector.encrypt(context.tenantId, remarkId, "call-patient-statement", input.patientStatement) : Promise.resolve(null),
      input.agentExplanation ? this.protector.encrypt(context.tenantId, remarkId, "call-agent-explanation", input.agentExplanation) : Promise.resolve(null),
    ]);
    const existing = await this.db.prepare("SELECT id FROM crm_call_remarks WHERE tenant_id = ? AND call_attempt_id = ?").bind(context.tenantId, callAttemptId).first<{ id: string }>();
    const detail = JSON.stringify({ disposition: input.disposition, objection: input.objection, materialShared: input.materialShared, nextAction: input.nextAction, nextActionOwnerMembershipId: input.nextActionOwnerMembershipId, nextActionDueAt: input.nextActionDueAt?.toISOString(), notApplicableReason: input.notApplicableReason });
    const detailCiphertext = await this.protector.encrypt(context.tenantId, existing?.id ?? remarkId, "call-remark-detail", detail);
    const writes: D1PreparedStatement[] = [
      this.db.prepare("UPDATE crm_call_attempts SET disposition = ?, updated_at = ?, updated_by_membership_id = ?, version = version + 1 WHERE tenant_id = ? AND id = ?").bind(input.disposition, now, context.actorMembershipId, context.tenantId, callAttemptId),
      this.db.prepare("INSERT INTO crm_call_remarks (id, tenant_id, call_attempt_id, patient_statement_ciphertext, agent_explanation_ciphertext, objection, next_action, next_action_due_at, not_applicable_reason, created_at, created_by_membership_id, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) ON CONFLICT(tenant_id, call_attempt_id) DO UPDATE SET patient_statement_ciphertext = excluded.patient_statement_ciphertext, agent_explanation_ciphertext = excluded.agent_explanation_ciphertext, objection = excluded.objection, next_action = excluded.next_action, next_action_due_at = excluded.next_action_due_at, not_applicable_reason = excluded.not_applicable_reason, updated_at = excluded.created_at, updated_by_membership_id = excluded.created_by_membership_id, version = crm_call_remarks.version + 1").bind(existing?.id ?? remarkId, context.tenantId, callAttemptId, patientStatementCiphertext, agentExplanationCiphertext, input.objection ?? null, input.nextAction ?? null, input.nextActionDueAt?.getTime() ?? null, input.notApplicableReason ?? null, now, context.actorMembershipId),
      this.db.prepare("INSERT INTO crm_notes (id, tenant_id, lead_id, content_ciphertext, immutable_at, created_at, created_by_membership_id, version) VALUES (?, ?, ?, ?, ?, ?, ?, 1) ON CONFLICT(id) DO NOTHING").bind(existing?.id ?? remarkId, context.tenantId, attempt.leadId, detailCiphertext, now, now, context.actorMembershipId),
    ];
    if (existing) writes.push(this.db.prepare("INSERT INTO crm_note_amendments (id, tenant_id, note_id, content_ciphertext, reason, created_at, created_by_membership_id, version) VALUES (?, ?, ?, ?, 'Call remark corrected', ?, ?, 1)").bind(id(), context.tenantId, existing.id, detailCiphertext, now, context.actorMembershipId));
    if (input.nextAction && input.nextActionOwnerMembershipId && input.nextActionDueAt) writes.push(this.db.prepare("INSERT INTO crm_next_action_commitments (id, tenant_id, lead_id, owner_membership_id, due_at, action, status, created_at, created_by_membership_id, version) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, 1)").bind(id(), context.tenantId, attempt.leadId, input.nextActionOwnerMembershipId, input.nextActionDueAt.getTime(), input.nextAction, now, context.actorMembershipId));
    // Consumers cancel pending not-connected work only after an agent has confirmed meaningful contact.
    writes.push(this.db.prepare("INSERT INTO crm_transactional_outbox (id, tenant_id, operation_key, type, payload_ciphertext, status, available_at, created_at, created_by_membership_id, version) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, 1)")
      .bind(id(), context.tenantId, `call-remark:${callAttemptId}:${existing?.id ?? remarkId}:${now}`, input.disposition === "meaningful_connection" ? "call.meaningful_contact" : "call.remark_completed", JSON.stringify({ callAttemptId, leadId: attempt.leadId }), now, now, context.actorMembershipId));
    await this.db.batch(writes);
    return { callAttemptId, remarkId: existing?.id ?? remarkId, meaningfulContact: input.disposition === "meaningful_connection", amended: Boolean(existing) };
  }
}

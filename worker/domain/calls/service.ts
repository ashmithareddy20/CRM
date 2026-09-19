import type { z } from "zod";
import { callAttemptSchema, callEventSchema, callRemarkSchema } from "../../../lib/api/lifecycle";
import { ApiError } from "../../api/errors";

export interface CallContext { tenantId: string; actorMembershipId: string; now: Date; requestId: string; roles: readonly string[]; }
export interface CallProtector { encrypt(tenantId: string, recordId: string, purpose: string, value: string): Promise<string>; }
export interface PairingStore { previousAttempt(tenantId: string, leadId: string, pairId: string): Promise<{ dialedAt: Date } | undefined>; reserve(tenantId: string, leadId: string, pairId: string, callAttemptId: string, dialedAt: Date): Promise<boolean>; }
export const MINIMUM_DOUBLE_DIAL_INTERVAL_MS = 15 * 60_000;
export function isEligibleSecondPairedAttempt(previous: Date | undefined, proposed: Date): boolean {
  return Boolean(previous && proposed.getTime() - previous.getTime() >= MINIMUM_DOUBLE_DIAL_INTERVAL_MS);
}

/** Durable adapter for the existing outbox store. Pair records are opaque IDs/timestamps only. */
export class D1PairingStore implements PairingStore {
  constructor(private readonly db: D1Database) {}
  private key(leadId: string, pairId: string) { return `call-pair:${leadId}:${pairId}`; }
  async previousAttempt(tenantId: string, leadId: string, pairId: string) {
    const row = await this.db.prepare("SELECT available_at AS dialedAt FROM crm_transactional_outbox WHERE tenant_id = ? AND operation_key = ?")
      .bind(tenantId, this.key(leadId, pairId)).first<{ dialedAt: number }>();
    return row ? { dialedAt: new Date(row.dialedAt) } : undefined;
  }
  /** Unique operation key makes the pair reservation atomic across concurrent requests. */
  async reserve(tenantId: string, leadId: string, pairId: string, callAttemptId: string, dialedAt: Date) {
    const key = this.key(leadId, pairId); const now = Date.now();
    const updated = await this.db.prepare("UPDATE crm_transactional_outbox SET available_at = ?, payload_ciphertext = ?, created_at = ? WHERE tenant_id = ? AND operation_key = ? AND available_at <= ?")
      .bind(dialedAt.getTime(), JSON.stringify({ callAttemptId }), now, tenantId, key, dialedAt.getTime() - MINIMUM_DOUBLE_DIAL_INTERVAL_MS).run();
    if (updated.meta.changes === 1) return true;
    const inserted = await this.db.prepare("INSERT OR IGNORE INTO crm_transactional_outbox (id, tenant_id, operation_key, type, payload_ciphertext, status, available_at, created_at, version) VALUES (?, ?, ?, 'call.double_dial_pair', ?, 'published', ?, ?, 1)")
      .bind(crypto.randomUUID(), tenantId, key, JSON.stringify({ callAttemptId }), dialedAt.getTime(), now).run();
    return inserted.meta.changes === 1;
  }
}
const id = () => crypto.randomUUID();

/** Calls preserve provider facts first; only a completed agent remark makes contact work compliant. */
export class CallService {
  constructor(private readonly db: D1Database, private readonly protector: CallProtector, private readonly pairing: PairingStore = new D1PairingStore(db)) {}

  async recordAttempt(context: CallContext, rawInput: z.input<typeof callAttemptSchema>) {
    const input = callAttemptSchema.parse(rawInput);
    if (!context.roles.some((role) => ["agent", "manager", "operations", "tenant_administrator", "integration_principal"].includes(role))) throw new ApiError("FORBIDDEN", 403, "You are not permitted to record a call attempt");
    const lead = await this.db.prepare("SELECT id FROM crm_lead_episodes WHERE tenant_id = ? AND id = ? AND archived_at IS NULL").bind(context.tenantId, input.leadId).first();
    if (!lead) throw new ApiError("NOT_FOUND", 404, "Lead is unavailable");
    const dialedAt = input.dialedAt ?? context.now;
    await this.requireNoPendingRemark(context.tenantId, input.leadId, input.pairId, dialedAt);
    if (input.pairId) {
      const previous = await this.pairing.previousAttempt(context.tenantId, input.leadId, input.pairId);
      if (previous && !isEligibleSecondPairedAttempt(previous.dialedAt, dialedAt)) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { pairId: "Double-dial attempts must use the configured minimum interval" });
    }
    const callAttemptId = id();
    if (input.pairId && !await this.pairing.reserve(context.tenantId, input.leadId, input.pairId, callAttemptId, dialedAt)) throw new ApiError("CONFLICT", 409, "Double-dial pair was changed by another request");
    // The agent's supplied granular disposition is persisted, but it never permits progress without its structured remark task.
    const initialDisposition = input.disposition === "pending" ? "remark_pending" : input.disposition;
    const result = await this.db.prepare("INSERT OR IGNORE INTO crm_call_attempts (id, tenant_id, lead_id, membership_id, provider, external_id, direction, disposition, dialed_at, connected_at, ended_at, created_at, created_by_membership_id, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)")
      .bind(callAttemptId, context.tenantId, input.leadId, context.actorMembershipId, input.provider ?? null, input.externalId ?? null, input.direction, initialDisposition, dialedAt.getTime(), input.connectedAt?.getTime() ?? null, input.endedAt?.getTime() ?? null, context.now.getTime(), context.actorMembershipId).run();
    if (!result.meta.changes) {
      const existing = await this.db.prepare("SELECT id, disposition FROM crm_call_attempts WHERE tenant_id = ? AND provider = ? AND external_id = ?").bind(context.tenantId, input.provider, input.externalId).first<{ id: string; disposition: string }>();
      return { callAttemptId: existing?.id, duplicate: true, remarkPending: existing?.disposition === "remark_pending" };
    }
    await this.db.batch([
      this.db.prepare("INSERT INTO crm_tasks (id, tenant_id, lead_id, assignee_membership_id, title, due_at, status, priority, created_at, created_by_membership_id, version) VALUES (?, ?, ?, ?, ?, ?, 'open', 'high', ?, ?, 1)")
        .bind(id(), context.tenantId, input.leadId, context.actorMembershipId, `Complete mandatory call remarks: ${callAttemptId}`, context.now.getTime(), context.now.getTime(), context.actorMembershipId),
      this.db.prepare("INSERT INTO crm_transactional_outbox (id, tenant_id, operation_key, type, payload_ciphertext, status, available_at, created_at, created_by_membership_id, version) VALUES (?, ?, ?, 'call.attempt_recorded', ?, 'pending', ?, ?, ?, 1)")
        .bind(id(), context.tenantId, `call:${callAttemptId}`, JSON.stringify({ callAttemptId }), context.now.getTime(), context.now.getTime(), context.actorMembershipId),
    ]);
    return { callAttemptId, duplicate: false, remarkPending: true, disposition: initialDisposition, pairId: input.pairId };
  }

  /** Provider events update the addressed attempt; they never create an unrelated attempt or claim meaningful contact. */
  async recordProviderEvent(context: CallContext, callAttemptId: string, rawInput: z.input<typeof callEventSchema>) {
    const input = callEventSchema.parse(rawInput);
    const attempt = await this.db.prepare("SELECT id, disposition, provider, external_id AS externalId FROM crm_call_attempts WHERE tenant_id = ? AND id = ?").bind(context.tenantId, callAttemptId).first<{ id: string; disposition: string; provider: string | null; externalId: string | null }>();
    if (!attempt) throw new ApiError("NOT_FOUND", 404, "Call attempt is unavailable");
    if (input.provider && attempt.provider && input.provider !== attempt.provider) throw new ApiError("CONFLICT", 409, "Provider event does not match this call attempt");
    if (input.externalId && attempt.externalId && input.externalId !== attempt.externalId) throw new ApiError("CONFLICT", 409, "Provider event does not match this call attempt");
    // Provider telemetry updates granular operational disposition, while the independent open remark task still blocks progress.
    const providerDisposition = input.disposition === "pending" ? attempt.disposition : input.disposition;
    await this.db.prepare("UPDATE crm_call_attempts SET provider = COALESCE(?, provider), external_id = COALESCE(?, external_id), disposition = ?, dialed_at = COALESCE(?, dialed_at), connected_at = COALESCE(?, connected_at), ended_at = COALESCE(?, ended_at), updated_at = ?, updated_by_membership_id = ?, version = version + 1 WHERE tenant_id = ? AND id = ?")
      .bind(input.provider ?? null, input.externalId ?? null, providerDisposition, input.dialedAt?.getTime() ?? null, input.connectedAt?.getTime() ?? null, input.endedAt?.getTime() ?? null, context.now.getTime(), context.actorMembershipId, context.tenantId, callAttemptId).run();
    return { callAttemptId, remarkPending: providerDisposition === "remark_pending" };
  }

  async completeRemark(context: CallContext, callAttemptId: string, rawInput: z.input<typeof callRemarkSchema>) {
    if (!context.roles.some((role) => ["agent", "manager", "clinician"].includes(role))) throw new ApiError("FORBIDDEN", 403, "You are not permitted to complete call remarks");
    const input = callRemarkSchema.parse(rawInput);
    const attempt = await this.db.prepare("SELECT lead_id AS leadId FROM crm_call_attempts WHERE tenant_id = ? AND id = ?").bind(context.tenantId, callAttemptId).first<{ leadId: string }>();
    if (!attempt) throw new ApiError("NOT_FOUND", 404, "Call attempt is unavailable");
    const remarkId = id(); const now = context.now.getTime();
    const [patientStatementCiphertext, agentExplanationCiphertext] = await Promise.all([
      input.patientStatement ? this.protector.encrypt(context.tenantId, remarkId, "call-patient-statement", input.patientStatement) : Promise.resolve(null),
      input.agentExplanation ? this.protector.encrypt(context.tenantId, remarkId, "call-agent-explanation", input.agentExplanation) : Promise.resolve(null),
    ]);
    const existing = await this.db.prepare("SELECT id FROM crm_call_remarks WHERE tenant_id = ? AND call_attempt_id = ?").bind(context.tenantId, callAttemptId).first<{ id: string }>();
    if (existing && !context.roles.includes("manager")) throw new ApiError("FORBIDDEN", 403, "Only a manager may amend an already completed call remark");
    const detail = JSON.stringify({ disposition: input.disposition, objection: input.objection, materialShared: input.materialShared, nextAction: input.nextAction, nextActionOwnerMembershipId: input.nextActionOwnerMembershipId, nextActionDueAt: input.nextActionDueAt?.toISOString(), notApplicableReason: input.notApplicableReason });
    const detailCiphertext = await this.protector.encrypt(context.tenantId, existing?.id ?? remarkId, "call-remark-detail", detail);
    const writes: D1PreparedStatement[] = [
      this.db.prepare("UPDATE crm_call_attempts SET disposition = ?, updated_at = ?, updated_by_membership_id = ?, version = version + 1 WHERE tenant_id = ? AND id = ?").bind(input.disposition, now, context.actorMembershipId, context.tenantId, callAttemptId),
      this.db.prepare("UPDATE crm_tasks SET status = 'completed', updated_at = ?, updated_by_membership_id = ?, version = version + 1 WHERE tenant_id = ? AND lead_id = ? AND title = ? AND status = 'open'").bind(now, context.actorMembershipId, context.tenantId, attempt.leadId, `Complete mandatory call remarks: ${callAttemptId}`),
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

  private async requireNoPendingRemark(tenantId: string, leadId: string, pairId?: string, dialedAt?: Date) {
    const pending = await this.db.prepare("SELECT id FROM crm_tasks WHERE tenant_id = ? AND lead_id = ? AND status = 'open' AND title LIKE 'Complete mandatory call remarks:%' LIMIT 1").bind(tenantId, leadId).first();
    if (!pending) return;
    // The prescribed second leg of an already-reserved double-dial pair is the sole exception.
    if (pairId && dialedAt) {
      const previous = await this.pairing.previousAttempt(tenantId, leadId, pairId);
      if (isEligibleSecondPairedAttempt(previous?.dialedAt, dialedAt)) return;
    }
    throw new ApiError("CONFLICT", 409, "Complete pending mandatory call remarks before recording unrelated call work");
  }
}

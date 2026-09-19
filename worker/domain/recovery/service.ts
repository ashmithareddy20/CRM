import { ApiError } from "../../api/errors";
import { REACTIVATION_EXCLUDED_REASONS, type Recoverability } from "../diagnosis/taxonomy";

export type RecoveryCampaignKind = "price" | "no_show" | "doctor_trust" | "surgery_fear" | "reason_based";
export type RecoveryEnrollmentStatus = "planned" | "active" | "paused" | "completed" | "cancelled" | "excluded";
export interface RecoveryContext { tenantId: string; actorMembershipId: string; now: Date; roles: readonly string[]; }
export interface RecoveryCampaign { id: string; tenantId: string; name: string; kind: RecoveryCampaignKind; status: "draft" | "active" | "paused" | "archived"; eligiblePrimaryReasons: readonly string[]; eligibleSecondaryReasons: readonly string[]; createdAt: Date; createdByMembershipId: string; }
export interface RecoveryDiagnosis { id: string; leadId: string; primaryReason: string; secondaryReason: string; recoverability: Recoverability; evidenceId: string; reviewAt: Date; }
export interface LeadRecoveryState { leadId: string; contactId: string; lifecycleStage: string; contactStatus: string; optedOut: boolean; doNotContact: boolean; invalid: boolean; rejected: boolean; alreadyTreated: boolean; clinicallyIneligible: boolean; }
export interface RecoveryEnrollment { id: string; tenantId: string; leadId: string; diagnosisId: string; campaignId: string; eligibleAt: Date; status: RecoveryEnrollmentStatus; reactivationAt: Date; reasonSnapshot: string; createdAt: Date; createdByMembershipId: string; }
export interface RecoveryRepository {
  addCampaign(campaign: RecoveryCampaign): Promise<void>;
  getCampaign(tenantId: string, campaignId: string): Promise<RecoveryCampaign | undefined>;
  getDiagnosis(tenantId: string, diagnosisId: string): Promise<RecoveryDiagnosis | undefined>;
  getLeadState(tenantId: string, leadId: string): Promise<LeadRecoveryState | undefined>;
  getActiveEnrollment(tenantId: string, leadId: string): Promise<RecoveryEnrollment | undefined>;
  addEnrollment(enrollment: RecoveryEnrollment): Promise<boolean>;
  cancelRoutineJourneys(tenantId: string, contactId: string, reason: string): Promise<void>;
  listDue(tenantId: string, now: Date, limit: number): Promise<RecoveryEnrollment[]>;
  updateEnrollment(enrollment: RecoveryEnrollment): Promise<void>;
  addRecoveryTouch(input: { tenantId: string; enrollmentId: string; leadId: string; contactId: string; dueAt: Date; purpose: string; requestedChannel: "whatsapp" | "rich"; gateKey: string; createdAt: Date; createdByMembershipId: string }): Promise<void>;
}
const id = () => crypto.randomUUID();
const day = 86_400_000;
const canManage = (roles: readonly string[]) => roles.some((role) => ["manager", "operations", "agent", "financial_counselor", "clinician", "tenant_administrator", "scheduler"].includes(role));
const eligibleRecoverability = new Set<Recoverability>(["recoverable", "long_term_nurture"]);

export function reactivationDate(now: Date, requested?: Date, delayDays: 30 | 60 | 90 = 90): Date {
  if (requested && requested > now) return requested;
  return new Date(now.getTime() + delayDays * day);
}
export function recoveryExclusion(state: LeadRecoveryState, diagnosis: RecoveryDiagnosis): string | undefined {
  if (state.optedOut) return "opted_out";
  if (state.doNotContact) return "do_not_contact";
  if (state.invalid || ["wrong_number", "invalid_number", "invalid_lead", "fake_lead", "duplicate"].includes(diagnosis.secondaryReason)) return "invalid_contact_or_lead";
  if (state.rejected || diagnosis.secondaryReason === "firmly_not_interested") return "rejected";
  if (state.alreadyTreated || diagnosis.secondaryReason === "already_treated_elsewhere") return "already_treated";
  if (state.clinicallyIneligible || diagnosis.secondaryReason === "clinically_ineligible") return "clinically_ineligible";
  if (REACTIVATION_EXCLUDED_REASONS.has(diagnosis.secondaryReason)) return "reason_excluded";
  if (!eligibleRecoverability.has(diagnosis.recoverability)) return "recoverability_excluded";
  return undefined;
}

/** Recovery is a separate reason-based journey. It never resumes an expired daily follow-up. */
export class RecoveryService {
  constructor(private readonly repository: RecoveryRepository) {}
  async createCampaign(context: RecoveryContext, input: { name: string; kind: RecoveryCampaignKind; eligiblePrimaryReasons?: string[]; eligibleSecondaryReasons?: string[]; status?: RecoveryCampaign["status"] }): Promise<RecoveryCampaign> {
    if (!canManage(context.roles)) throw new ApiError("FORBIDDEN", 403, "You are not permitted to manage recovery campaigns");
    if (!input.name.trim()) throw new ApiError("VALIDATION_FAILED", 422, "Campaign name is required", { name: "Required" });
    const campaign: RecoveryCampaign = { id: id(), tenantId: context.tenantId, name: input.name.trim(), kind: input.kind, status: input.status ?? "draft", eligiblePrimaryReasons: input.eligiblePrimaryReasons ?? [], eligibleSecondaryReasons: input.eligibleSecondaryReasons ?? [], createdAt: context.now, createdByMembershipId: context.actorMembershipId };
    await this.repository.addCampaign(campaign); return campaign;
  }
  async enroll(context: RecoveryContext, input: { campaignId: string; diagnosisId: string; reactivationAt?: Date; delayDays?: 30 | 60 | 90 }): Promise<RecoveryEnrollment> {
    if (!canManage(context.roles)) throw new ApiError("FORBIDDEN", 403, "You are not permitted to enroll recovery journeys");
    const [campaign, diagnosis] = await Promise.all([this.repository.getCampaign(context.tenantId, input.campaignId), this.repository.getDiagnosis(context.tenantId, input.diagnosisId)]);
    if (!campaign || campaign.status !== "active") throw new ApiError("VALIDATION_FAILED", 422, "Recovery campaign is not active", { campaignId: "Choose an active campaign" });
    if (!diagnosis) throw new ApiError("NOT_FOUND", 404, "Diagnosis is unavailable");
    if (campaign.eligiblePrimaryReasons.length && !campaign.eligiblePrimaryReasons.includes(diagnosis.primaryReason)) throw new ApiError("VALIDATION_FAILED", 422, "Diagnosis does not meet this campaign's primary-reason criteria", { diagnosisId: "Not eligible for this campaign" });
    if (campaign.eligibleSecondaryReasons.length && !campaign.eligibleSecondaryReasons.includes(diagnosis.secondaryReason)) throw new ApiError("VALIDATION_FAILED", 422, "Diagnosis does not meet this campaign's secondary-reason criteria", { diagnosisId: "Not eligible for this campaign" });
    const state = await this.repository.getLeadState(context.tenantId, diagnosis.leadId);
    if (!state) throw new ApiError("NOT_FOUND", 404, "Lead is unavailable");
    const excluded = recoveryExclusion(state, diagnosis);
    if (excluded) throw new ApiError("VALIDATION_FAILED", 422, "Lead is excluded from reactivation", { diagnosisId: excluded });
    const active = await this.repository.getActiveEnrollment(context.tenantId, diagnosis.leadId);
    if (active) throw new ApiError("CONFLICT", 409, "Lead already has an active recovery journey");
    if (input.reactivationAt && input.reactivationAt <= context.now) throw new ApiError("VALIDATION_FAILED", 422, "Patient-requested reactivation date must be in the future", { reactivationAt: "Must be later than now" });
    const at = reactivationDate(context.now, input.reactivationAt, input.delayDays ?? 90);
    const enrollment: RecoveryEnrollment = { id: id(), tenantId: context.tenantId, leadId: diagnosis.leadId, diagnosisId: diagnosis.id, campaignId: campaign.id, eligibleAt: context.now, status: "planned", reactivationAt: at, reasonSnapshot: `${diagnosis.primaryReason}:${diagnosis.secondaryReason}`, createdAt: context.now, createdByMembershipId: context.actorMembershipId };
    if (!await this.repository.addEnrollment(enrollment)) throw new ApiError("CONFLICT", 409, "Lead already has an active recovery journey");
    await this.repository.cancelRoutineJourneys(context.tenantId, state.contactId, "recovery_enrolled");
    return enrollment;
  }
  /** Due processor creates two alternating planned touches. Dispatch itself still runs the contact cadence/consent gate. */
  async scheduleDue(tenantId: string, now: Date, limit = 100): Promise<number> {
    const due = await this.repository.listDue(tenantId, now, limit); let scheduled = 0;
    for (const enrollment of due) {
      const state = await this.repository.getLeadState(tenantId, enrollment.leadId); const diagnosis = await this.repository.getDiagnosis(tenantId, enrollment.diagnosisId);
      if (!state || !diagnosis || recoveryExclusion(state, diagnosis)) { await this.repository.updateEnrollment({ ...enrollment, status: "excluded" }); continue; }
      await this.repository.addRecoveryTouch({ tenantId, enrollmentId: enrollment.id, leadId: enrollment.leadId, contactId: state.contactId, dueAt: enrollment.reactivationAt, purpose: `recovery:${diagnosis.primaryReason}`, requestedChannel: "whatsapp", gateKey: `recovery:${enrollment.id}:1`, createdAt: now, createdByMembershipId: enrollment.createdByMembershipId });
      await this.repository.addRecoveryTouch({ tenantId, enrollmentId: enrollment.id, leadId: enrollment.leadId, contactId: state.contactId, dueAt: new Date(enrollment.reactivationAt.getTime() + 2 * day), purpose: `recovery:${diagnosis.primaryReason}`, requestedChannel: "rich", gateKey: `recovery:${enrollment.id}:2`, createdAt: now, createdByMembershipId: enrollment.createdByMembershipId });
      await this.repository.updateEnrollment({ ...enrollment, status: "active" }); scheduled++;
    }
    return scheduled;
  }
}

export class MemoryRecoveryRepository implements RecoveryRepository {
  readonly campaigns = new Map<string, RecoveryCampaign>(); readonly diagnoses = new Map<string, RecoveryDiagnosis>(); readonly leads = new Map<string, LeadRecoveryState>(); readonly enrollments: RecoveryEnrollment[] = []; readonly touches: Array<Record<string, unknown>> = []; readonly cancelled: string[] = [];
  async addCampaign(campaign: RecoveryCampaign) { this.campaigns.set(campaign.id, campaign); }
  async getCampaign(_tenantId: string, campaignId: string) { return this.campaigns.get(campaignId); }
  async getDiagnosis(_tenantId: string, diagnosisId: string) { return this.diagnoses.get(diagnosisId); }
  async getLeadState(_tenantId: string, leadId: string) { return this.leads.get(leadId); }
  async getActiveEnrollment(_tenantId: string, leadId: string) { return this.enrollments.find((entry) => entry.leadId === leadId && ["planned", "active", "paused"].includes(entry.status)); }
  async addEnrollment(enrollment: RecoveryEnrollment) { if (await this.getActiveEnrollment(enrollment.tenantId, enrollment.leadId)) return false; this.enrollments.push(enrollment); return true; }
  async cancelRoutineJourneys(tenantId: string, contactId: string, reason: string) { this.cancelled.push(`${tenantId}:${contactId}:${reason}`); }
  async listDue(_tenantId: string, now: Date, limit: number) { return this.enrollments.filter((item) => item.status === "planned" && item.reactivationAt <= now).slice(0, limit); }
  async updateEnrollment(enrollment: RecoveryEnrollment) { const index = this.enrollments.findIndex((item) => item.id === enrollment.id); if (index >= 0) this.enrollments[index] = enrollment; }
  async addRecoveryTouch(input: { tenantId: string; enrollmentId: string; leadId: string; contactId: string; dueAt: Date; purpose: string; requestedChannel: "whatsapp" | "rich"; gateKey: string; createdAt: Date; createdByMembershipId: string }) { this.touches.push(input); }
}

export class D1RecoveryRepository implements RecoveryRepository {
  constructor(private readonly db: D1Database) {}
  async addCampaign(c: RecoveryCampaign) { await this.db.prepare("INSERT INTO crm_recovery_campaigns (id, tenant_id, name, status, definition_json, created_at, created_by_membership_id, version) VALUES (?, ?, ?, ?, ?, ?, ?, 1)").bind(c.id, c.tenantId, c.name, c.status, JSON.stringify({ kind: c.kind, eligiblePrimaryReasons: c.eligiblePrimaryReasons, eligibleSecondaryReasons: c.eligibleSecondaryReasons }), c.createdAt.getTime(), c.createdByMembershipId).run(); }
  async getCampaign(tenantId: string, campaignId: string) { const row = await this.db.prepare("SELECT id, tenant_id AS tenantId, name, status, definition_json AS definitionJson, created_at AS createdAt, created_by_membership_id AS createdByMembershipId FROM crm_recovery_campaigns WHERE tenant_id = ? AND id = ? AND archived_at IS NULL").bind(tenantId, campaignId).first<{ id: string; tenantId: string; name: string; status: RecoveryCampaign["status"]; definitionJson: string; createdAt: number; createdByMembershipId: string }>(); if (!row) return undefined; const d = JSON.parse(row.definitionJson) as Pick<RecoveryCampaign, "kind" | "eligiblePrimaryReasons" | "eligibleSecondaryReasons">; return { ...row, ...d, createdAt: new Date(row.createdAt), eligiblePrimaryReasons: d.eligiblePrimaryReasons ?? [], eligibleSecondaryReasons: d.eligibleSecondaryReasons ?? [] }; }
  async getDiagnosis(tenantId: string, diagnosisId: string) { const row = await this.db.prepare("SELECT id, lead_id AS leadId, primary_reason AS primaryReason, secondary_reason AS secondaryReason, recoverability, evidence_id AS evidenceId, review_at AS reviewAt FROM crm_lead_diagnoses WHERE tenant_id = ? AND id = ? AND status = 'active'").bind(tenantId, diagnosisId).first<Omit<RecoveryDiagnosis, "reviewAt"> & { reviewAt: number }>(); return row ? { ...row, reviewAt: new Date(row.reviewAt) } : undefined; }
  async getLeadState(tenantId: string, leadId: string) { const row = await this.db.prepare("SELECT l.id AS leadId, l.contact_id AS contactId, l.lifecycle_stage AS lifecycleStage, c.status AS contactStatus, EXISTS(SELECT 1 FROM crm_suppressions s WHERE s.tenant_id = l.tenant_id AND s.contact_id = l.contact_id AND s.active = 1 AND lower(s.reason) IN ('opt_out', 'opted_out')) AS optedOut, EXISTS(SELECT 1 FROM crm_suppressions s WHERE s.tenant_id = l.tenant_id AND s.contact_id = l.contact_id AND s.active = 1 AND lower(s.reason) IN ('dnc', 'do_not_contact')) AS doNotContact FROM crm_lead_episodes l JOIN crm_contacts c ON c.tenant_id = l.tenant_id AND c.id = l.contact_id WHERE l.tenant_id = ? AND l.id = ? AND l.archived_at IS NULL").bind(tenantId, leadId).first<{ leadId: string; contactId: string; lifecycleStage: string; contactStatus: string; optedOut: number; doNotContact: number }>(); if (!row) return undefined; return { ...row, optedOut: Boolean(row.optedOut), doNotContact: Boolean(row.doNotContact), invalid: row.contactStatus !== "active", rejected: false, alreadyTreated: false, clinicallyIneligible: false }; }
  async getActiveEnrollment(tenantId: string, leadId: string) { const row = await this.db.prepare("SELECT id, tenant_id AS tenantId, lead_id AS leadId, diagnosis_id AS diagnosisId, campaign_id AS campaignId, eligible_at AS eligibleAt, status, created_at AS createdAt, created_by_membership_id AS createdByMembershipId FROM crm_recovery_enrollments WHERE tenant_id = ? AND lead_id = ? AND status IN ('planned', 'active', 'paused') LIMIT 1").bind(tenantId, leadId).first<Omit<RecoveryEnrollment, "reactivationAt" | "reasonSnapshot" | "eligibleAt" | "createdAt"> & { eligibleAt: number; createdAt: number }>(); return row ? { ...row, eligibleAt: new Date(row.eligibleAt), reactivationAt: new Date(row.eligibleAt), reasonSnapshot: "legacy", createdAt: new Date(row.createdAt) } : undefined; }
  /** Single statement closes the check/insert race even though the historical schema's status index is not a partial unique index. */
  async addEnrollment(e: RecoveryEnrollment) { const inserted = await this.db.prepare("INSERT INTO crm_recovery_enrollments (id, tenant_id, lead_id, diagnosis_id, campaign_id, eligible_at, status, created_at, created_by_membership_id, version) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 1 WHERE NOT EXISTS (SELECT 1 FROM crm_recovery_enrollments WHERE tenant_id = ? AND lead_id = ? AND status IN ('planned', 'active', 'paused'))").bind(e.id, e.tenantId, e.leadId, e.diagnosisId, e.campaignId, e.reactivationAt.getTime(), e.status, e.createdAt.getTime(), e.createdByMembershipId, e.tenantId, e.leadId).run(); return inserted.meta.changes === 1; }
  async cancelRoutineJourneys(tenantId: string, contactId: string, _reason: string) { await this.db.prepare("UPDATE crm_scheduled_touches SET status = 'cancelled', updated_at = ? WHERE tenant_id = ? AND contact_id = ? AND status = 'planned'").bind(Date.now(), tenantId, contactId).run(); }
  async listDue(tenantId: string, now: Date, limit: number) { const rows = await this.db.prepare("SELECT id, tenant_id AS tenantId, lead_id AS leadId, diagnosis_id AS diagnosisId, campaign_id AS campaignId, eligible_at AS eligibleAt, status, created_at AS createdAt, created_by_membership_id AS createdByMembershipId FROM crm_recovery_enrollments WHERE tenant_id = ? AND status = 'planned' AND eligible_at <= ? ORDER BY eligible_at LIMIT ?").bind(tenantId, now.getTime(), limit).all<Omit<RecoveryEnrollment, "reactivationAt" | "reasonSnapshot" | "eligibleAt" | "createdAt"> & { eligibleAt: number; createdAt: number }>(); return rows.results.map((row) => ({ ...row, eligibleAt: new Date(row.eligibleAt), reactivationAt: new Date(row.eligibleAt), reasonSnapshot: "stored-in-diagnosis", createdAt: new Date(row.createdAt) })); }
  async updateEnrollment(e: RecoveryEnrollment) { await this.db.prepare("UPDATE crm_recovery_enrollments SET status = ?, updated_at = ? WHERE tenant_id = ? AND id = ?").bind(e.status, Date.now(), e.tenantId, e.id).run(); }
  async addRecoveryTouch(input: { tenantId: string; enrollmentId: string; leadId: string; contactId: string; dueAt: Date; purpose: string; requestedChannel: "whatsapp" | "rich"; gateKey: string; createdAt: Date; createdByMembershipId: string }) { await this.db.prepare("INSERT OR IGNORE INTO crm_scheduled_touches (id, tenant_id, lead_id, contact_id, due_at, status, gate_key, created_at, created_by_membership_id, version) VALUES (?, ?, ?, ?, ?, 'planned', ?, ?, ?, 1)").bind(id(), input.tenantId, input.leadId, input.contactId, input.dueAt.getTime(), input.gateKey, input.createdAt.getTime(), input.createdByMembershipId).run(); }
}

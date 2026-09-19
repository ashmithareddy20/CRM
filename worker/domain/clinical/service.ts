import { and, eq } from "drizzle-orm";
import type { Database } from "../../../db";
import { admissions, clinicalDecisions, consultations, doctors, procedureBookings, treatmentsCompleted } from "../../../db/schema";
import { ApiError } from "../../api/errors";
import { requireEligibleConversion } from "../conversion/policy";

export type ClinicalDecision = "medical_management" | "tests_advised" | "tests_pending" | "tests_results_recorded" | "procedure_advised" | "clinically_ineligible" | "doctor_callback";
export interface ClinicalContext { tenantId: string; actorMembershipId: string; roles: readonly string[]; now: Date; }
export interface ConsultationCommand { leadId: string; evidenceId: string; outcome: "completed" | "medical_management_completed"; commandId?: string; occurredAt?: Date; }
const id = () => crypto.randomUUID();

/** The supplied IDs form the clinical chain. A lead-wide lookup is never enough to authorize care. */
export class ClinicalService {
  constructor(private readonly db: Database) {}

  async completeConsultation(context: ClinicalContext, command: ConsultationCommand): Promise<{ consultationId: string; created: boolean }> {
    await this.requireAssignedClinician(context); requireEvidence(command.evidenceId);
    const existing = await this.db.select({ id: consultations.id }).from(consultations).where(and(eq(consultations.tenantId, context.tenantId), eq(consultations.leadId, command.leadId), eq(consultations.evidenceId, command.evidenceId), eq(consultations.status, command.outcome))).get();
    if (existing) return { consultationId: existing.id, created: false };
    const consultationId = id();
    try {
      await this.db.insert(consultations).values({ id: consultationId, tenantId: context.tenantId, leadId: command.leadId, status: command.outcome, occurredAt: command.occurredAt ?? context.now, evidenceId: command.evidenceId, createdAt: context.now, createdByMembershipId: context.actorMembershipId }).run();
    } catch { return this.existingConsultation(context.tenantId, command); }
    return { consultationId, created: true };
  }

  async recordDecision(context: ClinicalContext, command: { consultationId: string; leadId: string; decision: ClinicalDecision; evidenceId: string; detailsCiphertext?: string; occurredAt?: Date }): Promise<{ decisionId: string; created: boolean }> {
    await this.requireAssignedClinician(context); requireEvidence(command.evidenceId);
    const consultation = await this.db.select({ id: consultations.id, status: consultations.status, evidenceId: consultations.evidenceId }).from(consultations).where(and(eq(consultations.tenantId, context.tenantId), eq(consultations.id, command.consultationId), eq(consultations.leadId, command.leadId))).get();
    if (!consultation || consultation.status !== "completed" || !consultation.evidenceId) throw new ApiError("CONFLICT", 409, "A completed consultation is required");
    const prior = await this.db.select({ id: clinicalDecisions.id }).from(clinicalDecisions).where(and(eq(clinicalDecisions.tenantId, context.tenantId), eq(clinicalDecisions.consultationId, command.consultationId), eq(clinicalDecisions.decision, command.decision))).get();
    if (prior) return { decisionId: prior.id, created: false };
    const decisionId = id();
    await this.db.insert(clinicalDecisions).values({ id: decisionId, tenantId: context.tenantId, consultationId: command.consultationId, leadId: command.leadId, decision: command.decision, detailsCiphertext: command.detailsCiphertext ?? null, confirmedByMembershipId: context.actorMembershipId, occurredAt: command.occurredAt ?? context.now, createdAt: context.now, createdByMembershipId: context.actorMembershipId }).run();
    return { decisionId, created: true };
  }

  async recordProcedureBooking(context: ClinicalContext, command: { leadId: string; decisionId: string; evidenceId: string; occurredAt?: Date }): Promise<{ procedureBookingId: string; created: boolean }> {
    await this.requireAssignedClinician(context); requireEvidence(command.evidenceId);
    await this.requireDecision(context.tenantId, command.leadId, command.decisionId, "procedure_advised");
    const existing = await this.db.select({ id: procedureBookings.id }).from(procedureBookings).where(and(eq(procedureBookings.tenantId, context.tenantId), eq(procedureBookings.leadId, command.leadId), eq(procedureBookings.evidenceId, command.evidenceId), eq(procedureBookings.status, "booked"))).get();
    if (existing) return { procedureBookingId: existing.id, created: false };
    const procedureBookingId = id(); await this.db.insert(procedureBookings).values({ id: procedureBookingId, tenantId: context.tenantId, leadId: command.leadId, status: "booked", occurredAt: command.occurredAt ?? context.now, evidenceId: command.evidenceId, createdAt: context.now, createdByMembershipId: context.actorMembershipId }).run();
    return { procedureBookingId, created: true };
  }

  async recordAdmission(context: ClinicalContext, command: { leadId: string; procedureBookingId: string; evidenceId: string; occurredAt?: Date }): Promise<{ admissionId: string; created: boolean }> {
    await this.requireAssignedClinician(context); requireEvidence(command.evidenceId);
    const booking = await this.db.select({ id: procedureBookings.id }).from(procedureBookings).where(and(eq(procedureBookings.tenantId, context.tenantId), eq(procedureBookings.id, command.procedureBookingId), eq(procedureBookings.leadId, command.leadId), eq(procedureBookings.status, "booked"))).get();
    if (!booking) throw new ApiError("CONFLICT", 409, "The specified procedure booking is required before admission");
    const existing = await this.db.select({ id: admissions.id }).from(admissions).where(and(eq(admissions.tenantId, context.tenantId), eq(admissions.leadId, command.leadId), eq(admissions.evidenceId, command.evidenceId), eq(admissions.status, "admitted"))).get();
    if (existing) return { admissionId: existing.id, created: false };
    const admissionId = id(); await this.db.insert(admissions).values({ id: admissionId, tenantId: context.tenantId, leadId: command.leadId, status: "admitted", occurredAt: command.occurredAt ?? context.now, evidenceId: command.evidenceId, createdAt: context.now, createdByMembershipId: context.actorMembershipId }).run();
    return { admissionId, created: true };
  }

  async completeTreatment(context: ClinicalContext, command: { leadId: string; path: "surgical" | "medical_management"; commandId?: string; admissionId?: string; decisionId?: string; evidenceId: string; occurredAt?: Date }): Promise<{ treatmentId: string; created: boolean }> {
    await this.requireAssignedClinician(context); requireEvidence(command.evidenceId);
    if (command.path === "surgical") {
      if (!command.admissionId) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { admissionId: "Surgical treatment requires an admission" });
      const admission = await this.db.select({ id: admissions.id }).from(admissions).where(and(eq(admissions.tenantId, context.tenantId), eq(admissions.id, command.admissionId), eq(admissions.leadId, command.leadId), eq(admissions.status, "admitted"))).get();
      if (!admission) throw new ApiError("CONFLICT", 409, "The specified admission is required for surgical completion");
    } else {
      if (!command.decisionId) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { decisionId: "Medical management requires a clinician decision" });
      await this.requireDecision(context.tenantId, command.leadId, command.decisionId, "medical_management");
    }
    const completion = command.path === "surgical" ? "procedure_completed" : "medical_management_completed";
    requireEligibleConversion({ completion, evidenceId: command.evidenceId });
    const treatmentId = id();
    // The guarded insert prevents two concurrent completions of the same clinical path.
    const result = await this.db.$client.prepare("INSERT INTO crm_treatments_completed (id, tenant_id, lead_id, completion_identity, command_id, status, occurred_at, evidence_id, created_at, created_by_membership_id, version) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1 WHERE NOT EXISTS (SELECT 1 FROM crm_treatments_completed WHERE tenant_id = ? AND completion_identity = ?)")
      .bind(treatmentId, context.tenantId, command.leadId, `${command.path}:${command.leadId}`, command.commandId ?? command.evidenceId, completion, (command.occurredAt ?? context.now).getTime(), command.evidenceId, context.now.getTime(), context.actorMembershipId, context.tenantId, `${command.path}:${command.leadId}`).run();
    if (result.meta.changes) return { treatmentId, created: true };
    const duplicate = await this.db.select({ id: treatmentsCompleted.id, evidenceId: treatmentsCompleted.evidenceId }).from(treatmentsCompleted).where(and(eq(treatmentsCompleted.tenantId, context.tenantId), eq(treatmentsCompleted.leadId, command.leadId), eq(treatmentsCompleted.status, completion))).get();
    if (duplicate?.evidenceId === command.evidenceId) return { treatmentId: duplicate.id, created: false };
    throw new ApiError("CONFLICT", 409, "Treatment completion is already recorded for this path");
  }

  private async requireAssignedClinician(context: ClinicalContext) {
    if (!context.roles.includes("clinician")) throw new ApiError("FORBIDDEN", 403, "Clinical confirmation requires an authorized clinician");
    const doctor = await this.db.select({ id: doctors.id }).from(doctors).where(and(eq(doctors.tenantId, context.tenantId), eq(doctors.membershipId, context.actorMembershipId), eq(doctors.active, true))).get();
    if (!doctor) throw new ApiError("FORBIDDEN", 403, "Clinician is not assigned to an active doctor record");
  }
  private async existingConsultation(tenantId: string, command: ConsultationCommand): Promise<{ consultationId: string; created: false }> {
    const existing = await this.db.select({ id: consultations.id }).from(consultations).where(and(eq(consultations.tenantId, tenantId), eq(consultations.leadId, command.leadId), eq(consultations.evidenceId, command.evidenceId), eq(consultations.status, command.outcome))).get();
    if (!existing) throw new ApiError("CONFLICT", 409, "Consultation could not be recorded");
    return { consultationId: existing.id, created: false };
  }
  private async requireDecision(tenantId: string, leadId: string, decisionId: string, decision: ClinicalDecision) {
    const record = await this.db.select({ id: clinicalDecisions.id }).from(clinicalDecisions).where(and(eq(clinicalDecisions.tenantId, tenantId), eq(clinicalDecisions.id, decisionId), eq(clinicalDecisions.leadId, leadId), eq(clinicalDecisions.decision, decision))).get();
    if (!record) throw new ApiError("CONFLICT", 409, "The specified clinician decision is missing or stale");
  }
}
function requireEvidence(evidenceId: string): void { if (!evidenceId?.trim()) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { evidenceId: "Evidence is required" }); }

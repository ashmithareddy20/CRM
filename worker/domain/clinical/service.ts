import { and, eq } from "drizzle-orm";
import type { Database } from "../../../db";
import { admissions, clinicalDecisions, consultations, procedureBookings, treatmentsCompleted } from "../../../db/schema";
import { ApiError } from "../../api/errors";

export type ClinicalDecision = "medical_management" | "tests_advised" | "tests_pending" | "tests_results_recorded" | "procedure_advised" | "clinically_ineligible" | "doctor_callback";
export interface ClinicalContext { tenantId: string; actorMembershipId: string; roles: readonly string[]; now: Date; }
export interface ConsultationCommand { leadId: string; evidenceId: string; outcome: "completed" | "medical_management_completed"; occurredAt?: Date; }
const id = () => crypto.randomUUID();

/** Clinical records are only created by clinician roles; appointment notes cannot imply advice or care. */
export class ClinicalService {
  constructor(private readonly db: Database) {}

  async completeConsultation(context: ClinicalContext, command: ConsultationCommand): Promise<{ consultationId: string }> {
    requireClinician(context);
    const consultationId = id(); const occurredAt = command.occurredAt ?? context.now;
    requireEvidence(command.evidenceId);
    await this.db.insert(consultations).values({ id: consultationId, tenantId: context.tenantId, leadId: command.leadId, status: command.outcome, occurredAt, evidenceId: command.evidenceId, createdAt: context.now, createdByMembershipId: context.actorMembershipId }).run();
    return { consultationId };
  }

  async recordDecision(context: ClinicalContext, command: { consultationId: string; leadId: string; decision: ClinicalDecision; evidenceId: string; detailsCiphertext?: string; occurredAt?: Date }): Promise<{ decisionId: string }> {
    requireClinician(context); requireEvidence(command.evidenceId);
    const consultation = await this.db.select({ id: consultations.id, status: consultations.status }).from(consultations).where(and(eq(consultations.tenantId, context.tenantId), eq(consultations.id, command.consultationId), eq(consultations.leadId, command.leadId))).get();
    if (!consultation || !["completed", "medical_management_completed"].includes(consultation.status)) throw new ApiError("CONFLICT", 409, "A completed consultation is required");
    const decisionId = id();
    await this.db.insert(clinicalDecisions).values({ id: decisionId, tenantId: context.tenantId, consultationId: command.consultationId, leadId: command.leadId, decision: command.decision, detailsCiphertext: command.detailsCiphertext ?? null, confirmedByMembershipId: context.actorMembershipId, occurredAt: command.occurredAt ?? context.now, createdAt: context.now, createdByMembershipId: context.actorMembershipId }).run();
    return { decisionId };
  }

  async recordProcedureBooking(context: ClinicalContext, leadId: string, evidenceId: string, occurredAt = context.now): Promise<{ procedureBookingId: string }> {
    requireClinician(context); requireEvidence(evidenceId);
    await this.requireDecision(context.tenantId, leadId, "procedure_advised");
    const procedureBookingId = id();
    await this.db.insert(procedureBookings).values({ id: procedureBookingId, tenantId: context.tenantId, leadId, status: "booked", occurredAt, evidenceId, createdAt: context.now, createdByMembershipId: context.actorMembershipId }).run();
    return { procedureBookingId };
  }

  async recordAdmission(context: ClinicalContext, leadId: string, evidenceId: string, occurredAt = context.now): Promise<{ admissionId: string }> {
    requireClinician(context); requireEvidence(evidenceId);
    const booking = await this.db.select({ id: procedureBookings.id }).from(procedureBookings).where(and(eq(procedureBookings.tenantId, context.tenantId), eq(procedureBookings.leadId, leadId), eq(procedureBookings.status, "booked"))).get();
    if (!booking) throw new ApiError("CONFLICT", 409, "A procedure booking is required before admission");
    const admissionId = id();
    await this.db.insert(admissions).values({ id: admissionId, tenantId: context.tenantId, leadId, status: "admitted", occurredAt, evidenceId, createdAt: context.now, createdByMembershipId: context.actorMembershipId }).run();
    return { admissionId };
  }

  async completeTreatment(context: ClinicalContext, command: { leadId: string; path: "surgical" | "medical_management"; evidenceId: string; occurredAt?: Date }): Promise<{ treatmentId: string }> {
    requireClinician(context); requireEvidence(command.evidenceId);
    if (command.path === "surgical") {
      const admission = await this.db.select({ id: admissions.id }).from(admissions).where(and(eq(admissions.tenantId, context.tenantId), eq(admissions.leadId, command.leadId), eq(admissions.status, "admitted"))).get();
      if (!admission) throw new ApiError("CONFLICT", 409, "Admission is required for surgical treatment completion");
    } else await this.requireDecision(context.tenantId, command.leadId, "medical_management");
    const treatmentId = id();
    await this.db.insert(treatmentsCompleted).values({ id: treatmentId, tenantId: context.tenantId, leadId: command.leadId, status: command.path === "surgical" ? "procedure_completed" : "medical_management_completed", occurredAt: command.occurredAt ?? context.now, evidenceId: command.evidenceId, createdAt: context.now, createdByMembershipId: context.actorMembershipId }).run();
    return { treatmentId };
  }

  private async requireDecision(tenantId: string, leadId: string, decision: ClinicalDecision) {
    const record = await this.db.select({ id: clinicalDecisions.id }).from(clinicalDecisions).where(and(eq(clinicalDecisions.tenantId, tenantId), eq(clinicalDecisions.leadId, leadId), eq(clinicalDecisions.decision, decision))).get();
    if (!record) throw new ApiError("CONFLICT", 409, "Required clinician decision is missing");
  }
}
function requireClinician(context: ClinicalContext): void { if (!context.roles.includes("clinician")) throw new ApiError("FORBIDDEN", 403, "Clinical confirmation requires an authorized clinician"); }
function requireEvidence(evidenceId: string): void { if (!evidenceId?.trim()) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { evidenceId: "Evidence is required" }); }

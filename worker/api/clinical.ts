import { z } from "zod";
import { ClinicalService } from "../domain/clinical/service";
import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { parse, readJsonBody } from "./validation";
const text = z.string().trim().min(1).max(200);
const consultationSchema = z.object({ leadId: text, evidenceId: text, outcome: z.enum(["completed", "medical_management_completed"]) }).strict();
const decisionSchema = z.object({ consultationId: text, leadId: text, decision: z.enum(["medical_management", "tests_advised", "tests_pending", "tests_results_recorded", "procedure_advised", "clinically_ineligible", "doctor_callback"]), evidenceId: text, detailsCiphertext: z.string().max(10_000).optional() }).strict();
const procedureSchema = z.object({ leadId: text, decisionId: text, evidenceId: text }).strict();
const admissionSchema = z.object({ leadId: text, procedureBookingId: text, evidenceId: text }).strict();
const treatmentSchema = z.object({ leadId: text, evidenceId: text, path: z.enum(["surgical", "medical_management"]), admissionId: text.optional(), decisionId: text.optional() }).strict().superRefine((value, issue) => {
  if (value.path === "surgical" && !value.admissionId) issue.addIssue({ code: "custom", path: ["admissionId"], message: "Surgical treatment requires admissionId" });
  if (value.path === "medical_management" && !value.decisionId) issue.addIssue({ code: "custom", path: ["decisionId"], message: "Medical treatment requires decisionId" });
});
export interface ClinicalRouteDependencies { clinical: ClinicalService; }
function clinicalContext(context: RequestContext) { if (!context.actor) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required"); return { tenantId: context.actor.tenantId, actorMembershipId: context.actor.membershipId, roles: context.actor.roles, now: context.now }; }
const response = <T>(context: RequestContext, data: T, status = 200) => Response.json({ success: true, data }, { status, headers: { "X-Request-Id": context.requestId } });
export async function handleClinicalRoutes(request: Request, context: RequestContext, dependencies: ClinicalRouteDependencies): Promise<Response | undefined> {
  const path = new URL(request.url).pathname; if (request.method !== "POST") return path.startsWith("/api/v1/") ? undefined : methodNotAllowed(context.requestId, ["POST"]);
  if (path === "/api/v1/consultations") return response(context, await dependencies.clinical.completeConsultation(clinicalContext(context), parse(consultationSchema, await readJsonBody(request))), 201);
  if (path === "/api/v1/clinical-decisions") return response(context, await dependencies.clinical.recordDecision(clinicalContext(context), parse(decisionSchema, await readJsonBody(request))), 201);
  if (path === "/api/v1/procedure-bookings") return response(context, await dependencies.clinical.recordProcedureBooking(clinicalContext(context), parse(procedureSchema, await readJsonBody(request))), 201);
  if (path === "/api/v1/admissions") return response(context, await dependencies.clinical.recordAdmission(clinicalContext(context), parse(admissionSchema, await readJsonBody(request))), 201);
  if (path === "/api/v1/treatments") return response(context, await dependencies.clinical.completeTreatment(clinicalContext(context), parse(treatmentSchema, await readJsonBody(request))), 201);
  return undefined;
}

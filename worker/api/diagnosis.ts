import { z } from "zod";
import { DiagnosisService } from "../domain/diagnosis/service";
import { REASON_TAXONOMY, type PrimaryReason } from "../domain/diagnosis/taxonomy";
import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { parse, readJsonBody } from "./validation";

const id = z.string().trim().min(1).max(128);
const primaryReason = z.enum(["financial", "interest", "follow_up_failure", "hospital_or_doctor", "competition", "lead_quality", "contactability", "clinical_eligibility"]);
const allSecondary = z.enum(Object.values(REASON_TAXONOMY).flatMap((items) => [...items]) as [string, ...string[]]);
const diagnosis = z.object({ versionId: id, primaryReason, secondaryReason: allSecondary, detailedRemark: z.string().trim().min(3).max(4000), evidenceId: id.optional(), recoverability: z.enum(["recoverable", "long_term_nurture", "genuine_lost", "invalid_non_actionable"]), responsibleMembershipId: id, reviewAt: z.coerce.date() }).strict();
export interface DiagnosisRouteDependencies { diagnoses: DiagnosisService; }
const diagnosisPath = /^\/api\/v1\/leads\/([^/]+)\/diagnoses$/;
function actor(context: RequestContext) { if (!context.actor) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required"); return context.actor; }
/** Registrar seam; router composition is deliberately owned by the application boundary. */
export async function handleDiagnosisRoutes(request: Request, context: RequestContext, dependencies: DiagnosisRouteDependencies): Promise<Response | undefined> {
  const match = new URL(request.url).pathname.match(diagnosisPath);
  if (!match) return undefined;
  if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]);
  const authenticated = actor(context); const body = parse(diagnosis, await readJsonBody(request));
  const data = await dependencies.diagnoses.record({ tenantId: authenticated.tenantId, actorMembershipId: authenticated.membershipId, now: context.now, roles: authenticated.roles }, { leadId: match[1], ...body });
  return Response.json({ success: true, data }, { status: data.state === "recorded" ? 201 : 202, headers: { "X-Request-Id": context.requestId } });
}

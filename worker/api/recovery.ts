import { z } from "zod";
import { RecoveryService } from "../domain/recovery/service";
import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { parse, readJsonBody } from "./validation";
const id = z.string().trim().min(1).max(128);
const campaign = z.object({ name: z.string().trim().min(3).max(200), kind: z.enum(["price", "no_show", "doctor_trust", "surgery_fear", "reason_based"]), status: z.enum(["draft", "active", "paused", "archived"]).optional(), eligiblePrimaryReasons: z.array(z.string().trim().min(1).max(80)).max(20).optional(), eligibleSecondaryReasons: z.array(z.string().trim().min(1).max(80)).max(40).optional() }).strict();
const enrollment = z.object({ diagnosisId: id, reactivationAt: z.coerce.date().optional(), delayDays: z.union([z.literal(30), z.literal(60), z.literal(90)]).optional() }).strict().superRefine((value, ctx) => { if (value.reactivationAt && value.delayDays) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["delayDays"], message: "Choose a patient-requested date or one delay option" }); });
export interface RecoveryRouteDependencies { recovery: RecoveryService; }
const enrollmentPath = /^\/api\/v1\/recovery-campaigns\/([^/]+)\/enrollments$/;
function actor(context: RequestContext) { if (!context.actor) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required"); return context.actor; }
function response(context: RequestContext, data: unknown, status = 200) { return Response.json({ success: true, data }, { status, headers: { "X-Request-Id": context.requestId } }); }
/** Registrar seam for campaign creation and targeted reactivation enrollment. */
export async function handleRecoveryRoutes(request: Request, context: RequestContext, dependencies: RecoveryRouteDependencies): Promise<Response | undefined> {
  const path = new URL(request.url).pathname; if (path !== "/api/v1/recovery-campaigns" && !enrollmentPath.test(path)) return undefined;
  const authenticated = actor(context); const recoveryContext = { tenantId: authenticated.tenantId, actorMembershipId: authenticated.membershipId, now: context.now, roles: authenticated.roles };
  if (path === "/api/v1/recovery-campaigns") { if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]); return response(context, await dependencies.recovery.createCampaign(recoveryContext, parse(campaign, await readJsonBody(request))), 201); }
  const match = path.match(enrollmentPath)!; if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]);
  return response(context, await dependencies.recovery.enroll(recoveryContext, { campaignId: match[1], ...parse(enrollment, await readJsonBody(request)) }), 201);
}

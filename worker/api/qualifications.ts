import { qualificationCommandSchema } from "../../lib/api/leads";
import { QualificationService } from "../domain/qualification/service";
import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { parse, readJsonBody } from "./validation";

export interface QualificationRouteDependencies { qualifications: QualificationService; }
const qualificationPath = /^\/api\/v1\/leads\/([^/]+)\/qualifications$/;

/** Qualification route registration seam for the v1 router. */
export async function handleQualificationRoutes(request: Request, context: RequestContext, dependencies: QualificationRouteDependencies): Promise<Response | undefined> {
  const match = new URL(request.url).pathname.match(qualificationPath);
  if (!match) return undefined;
  if (!context.actor) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required");
  if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]);
  const body = parse(qualificationCommandSchema, await readJsonBody(request));
  const override = body.override ? { classification: body.override.classification, reason: body.override.reason } : undefined;
  const data = await dependencies.qualifications.assess(
    { tenantId: context.actor.tenantId, actorMembershipId: context.actor.membershipId, now: context.now },
    match[1], body.questionnaireId, body.answers, body.policyId, override,
  );
  return Response.json({ success: true, data }, { status: 201, headers: { "X-Request-Id": context.requestId } });
}

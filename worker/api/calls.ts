import { callAttemptSchema, callEventSchema, callRemarkSchema } from "../../lib/api/lifecycle";
import { CallService } from "../domain/calls/service";
import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { parse, readJsonBody } from "./validation";

export interface CallRouteDependencies { calls: CallService; }
const callRemarkPath = /^\/api\/v1\/calls\/([^/]+)\/(remarks|amendments)$/;
const callEventsPath = /^\/api\/v1\/calls\/([^/]+)\/events$/;
function contextFor(context: RequestContext) { if (!context.actor) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required"); return { tenantId: context.actor.tenantId, actorMembershipId: context.actor.membershipId, now: context.now, requestId: context.requestId, roles: context.actor.roles }; }
const success = (context: RequestContext, data: unknown, status = 200) => Response.json({ success: true, data }, { status, headers: { "X-Request-Id": context.requestId } });

/** Registrar seam; callers wire it into the canonical router after auth context is established. */
export async function handleCallRoutes(request: Request, context: RequestContext, dependencies: CallRouteDependencies): Promise<Response | undefined> {
  const path = new URL(request.url).pathname;
  if (path === "/api/v1/calls") {
    if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]);
    return success(context, await dependencies.calls.recordAttempt(contextFor(context), parse(callAttemptSchema, await readJsonBody(request))), 201);
  }
  const event = path.match(callEventsPath);
  if (event) {
    if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]);
    const result = await dependencies.calls.recordProviderEvent(contextFor(context), event[1], parse(callEventSchema, await readJsonBody(request)));
    return success(context, result, 202);
  }
  const remark = path.match(callRemarkPath);
  if (!remark) return undefined;
  if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]);
  return success(context, await dependencies.calls.completeRemark(contextFor(context), remark[1], parse(callRemarkSchema, await readJsonBody(request))), remark[2] === "amendments" ? 201 : 200);
}

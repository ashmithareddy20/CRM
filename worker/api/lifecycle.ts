import { transitionCommandSchema } from "../../lib/api/lifecycle";
import { LifecycleService } from "../domain/lifecycle/service";
import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { parse, readJsonBody } from "./validation";

export interface LifecycleRouteDependencies { lifecycle: LifecycleService; }
const transitionPath = /^\/api\/v1\/leads\/([^/]+)\/transitions$/;
function lifecycleContext(context: RequestContext) {
  if (!context.actor) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required");
  return { tenantId: context.actor.tenantId, actorMembershipId: context.actor.membershipId, requestId: context.requestId, now: context.now, roles: context.actor.roles };
}

/** Lifecycle accepts explicit commands only; there is intentionally no stage PATCH route. */
export async function handleLifecycleRoutes(request: Request, context: RequestContext, dependencies: LifecycleRouteDependencies): Promise<Response | undefined> {
  const match = new URL(request.url).pathname.match(transitionPath);
  if (!match) return undefined;
  if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]);
  const data = await dependencies.lifecycle.transition(lifecycleContext(context), match[1], parse(transitionCommandSchema, await readJsonBody(request)));
  return Response.json({ success: true, data }, { status: 201, headers: { "X-Request-Id": context.requestId } });
}

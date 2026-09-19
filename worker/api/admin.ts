import { policyVersionSchema } from "../../lib/api/lifecycle";
import { AdministrationService } from "../domain/administration/service";
import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { parse, readJsonBody } from "./validation";

export interface AdminRouteDependencies { administration: AdministrationService; }
function contextFor(context: RequestContext) { if (!context.actor) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required"); return { tenantId: context.actor.tenantId, actorMembershipId: context.actor.membershipId, now: context.now, roles: context.actor.roles }; }
const success = (context: RequestContext, data: unknown, status = 200) => Response.json({ success: true, data }, { status, headers: { "X-Request-Id": context.requestId } });

export async function handleAdministrationRoutes(request: Request, context: RequestContext, dependencies: AdminRouteDependencies): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/v1/admin/policies") return undefined;
  if (request.method === "GET") return success(context, await dependencies.administration.list(contextFor(context), url.searchParams.get("key") ?? undefined));
  if (request.method === "POST") return success(context, await dependencies.administration.publish(contextFor(context), parse(policyVersionSchema, await readJsonBody(request))), 201);
  return methodNotAllowed(context.requestId, ["GET", "POST"]);
}

import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { authenticateRequest } from "../auth/authenticate";
import { capabilitiesFor, type Capability } from "../security/permissions";
import { corsHeaders, corsPreflight } from "../security/cors";

function success(data: unknown, requestId: string, headers: Headers): Response { headers.set("X-Request-Id", requestId); return Response.json({ success: true, data }, { headers }); }
const knownCapabilities: readonly Capability[] = ["lead:read:assigned", "lead:write:assigned", "care:read:assigned", "clinical:write:assigned", "finance:read", "finance:write", "appointment:manage", "report:read:aggregate", "membership:manage", "configuration:manage", "audit:read", "integration:ingest", "export:run", "field:decrypt", "discount:approve", "emergency:access"];

/** Exposes server-derived capabilities; clients must not select a role or tenant. */
export async function routeAccessRequest(context: RequestContext): Promise<Response | undefined> {
  const path = new URL(context.request.url).pathname;
  if (path !== "/api/v1/access/capabilities") return undefined;
  const preflight = corsPreflight(context.request, context.env); if (preflight) return preflight;
  if (context.request.method !== "GET") return methodNotAllowed(context.requestId, ["GET"]);
  const actor = await authenticateRequest(context.request, context.env, context.now);
  if (!actor) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required");
  const allowed = capabilitiesFor(actor.roles);
  return success({ tenantId: actor.tenantId, membershipId: actor.membershipId, capabilities: knownCapabilities.filter((capability) => allowed.has(capability)) }, context.requestId, corsHeaders(context.request, context.env));
}

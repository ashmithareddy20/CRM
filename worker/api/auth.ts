import { z } from "zod";
import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { authenticateRequest } from "../auth/authenticate";
import { identityRepository } from "../repositories/identity";
import { clearCsrfCookie, clearSessionCookie, createCsrfCookie, readSessionCookie } from "../auth/session";
import { corsHeaders, corsPreflight } from "../security/cors";

function success(data: unknown, requestId: string, headers = new Headers()): Response { headers.set("X-Request-Id", requestId); return Response.json({ success: true, data }, { headers }); }

/** Route registrar kept separate for later composition in worker/api/router.ts. */
export async function routeAuthRequest(context: RequestContext): Promise<Response | undefined> {
  const path = new URL(context.request.url).pathname;
  if (!path.startsWith("/api/v1/auth") && path !== "/api/v1/me") return undefined;
  const preflight = corsPreflight(context.request, context.env); if (preflight) return preflight;
  const headers = corsHeaders(context.request, context.env);
  if (path === "/api/v1/auth/logout") {
    if (context.request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]);
    const secure = new URL(context.request.url).protocol === "https:";
    const session = await readSessionCookie(context.request, context.env, context.now);
    if (session) await identityRepository(context.env).revokeSession(session.id, session.membershipId, session.tenantId, context.now);
    headers.append("Set-Cookie", clearSessionCookie(secure));
    headers.append("Set-Cookie", clearCsrfCookie(secure));
    return success({ loggedOut: true }, context.requestId, headers);
  }
  if (path !== "/api/v1/me") throw new ApiError("NOT_FOUND", 404, "API route not found");
  if (context.request.method !== "GET") return methodNotAllowed(context.requestId, ["GET"]);
  const actor = await authenticateRequest(context.request, context.env, context.now);
  if (!actor) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required");
  const session = await readSessionCookie(context.request, context.env, context.now);
  if (session) {
    const csrf = await createCsrfCookie(session, context.env, new URL(context.request.url).protocol === "https:");
    headers.append("Set-Cookie", csrf.cookie);
  }
  return success({ subject: actor.subject, tenantId: actor.tenantId, membershipId: actor.membershipId, roles: actor.roles, capabilities: [] }, context.requestId, headers);
}

export const authRouteSchema = z.object({ path: z.enum(["/api/v1/me", "/api/v1/auth/logout"]) });

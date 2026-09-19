import { z } from "zod";
import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { authenticateRequest } from "../auth/authenticate";
import { identityRepository } from "../repositories/identity";
import { clearCsrfCookie, clearSessionCookie, createCsrfCookie, createSessionCookie, readSessionCookie, assertCsrf } from "../auth/session";
import { beginOidcAuthorization, exchangeOidcCallback, requireOidcNonce, type OidcTransactionStore } from "../auth/flow";
import { verifyOidcJwt } from "../auth/oidc";
import { corsHeaders, corsPreflight } from "../security/cors";

function success(data: unknown, requestId: string, headers = new Headers()): Response { headers.set("X-Request-Id", requestId); return Response.json({ success: true, data }, { headers }); }
async function tokenHash(value: string): Promise<string> { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
function transactions(db: D1Database): OidcTransactionStore { return { async put(value) { await db.prepare("INSERT INTO crm_oidc_transactions (id, state, nonce, verifier, redirect_uri, expires_at) VALUES (?, ?, ?, ?, ?, ?)").bind(value.id, value.state, value.nonce, value.verifier, value.redirectUri, value.expiresAt.getTime()).run(); }, async take(state, now) { const row = await db.prepare("DELETE FROM crm_oidc_transactions WHERE state = ? AND expires_at > ? RETURNING id, state, nonce, verifier, redirect_uri AS redirectUri, expires_at AS expiresAt").bind(state, now.getTime()).first<{ id: string; state: string; nonce: string; verifier: string; redirectUri: string; expiresAt: number }>(); return row ? { ...row, expiresAt: new Date(row.expiresAt) } : undefined; } }; }

/** Route registrar kept separate for later composition in worker/api/router.ts. */
export async function routeAuthRequest(context: RequestContext): Promise<Response | undefined> {
  const path = new URL(context.request.url).pathname;
  if (!path.startsWith("/api/v1/auth") && path !== "/api/v1/me") return undefined;
  const preflight = corsPreflight(context.request, context.env); if (preflight) return preflight;
  const headers = corsHeaders(context.request, context.env);
  if (path === "/api/v1/auth/login") {
    if (context.request.method !== "GET" || !context.env.DB) return methodNotAllowed(context.requestId, ["GET"]);
    const flow = await beginOidcAuthorization(context.env, transactions(context.env.DB), context.now);
    return Response.redirect(flow.authorizationUrl, 302);
  }
  if (path === "/api/v1/auth/callback") {
    if (context.request.method !== "GET" || !context.env.DB) return methodNotAllowed(context.requestId, ["GET"]);
    const query = new URL(context.request.url).searchParams; const result = await exchangeOidcCallback({ code: query.get("code") ?? "", state: query.get("state") ?? "", env: context.env, store: transactions(context.env.DB), now: context.now });
    const identity = await verifyOidcJwt(result.idToken, context.env, { now: context.now }); requireOidcNonce(identity.claims, result.transaction);
    const membership = await identityRepository(context.env).membershipForOidc(identity.issuer, identity.subject); if (!membership) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Membership is unavailable");
    const session = { id: crypto.randomUUID(), tenantId: membership.tenantId, membershipId: membership.id, subject: identity.subject, issuedAt: context.now, expiresAt: new Date(context.now.getTime() + 8 * 60 * 60_000) };
    const sessionCookie = await createSessionCookie(session, context.env, new URL(context.request.url).protocol === "https:");
    await context.env.DB.prepare("INSERT INTO crm_sessions (id, tenant_id, membership_id, token_hash, expires_at, created_at, version) VALUES (?, ?, ?, ?, ?, ?, 1)").bind(session.id, session.tenantId, session.membershipId, await tokenHash(sessionCookie), session.expiresAt.getTime(), context.now.getTime()).run();
    headers.append("Set-Cookie", sessionCookie); headers.append("Set-Cookie", (await createCsrfCookie(session, context.env, new URL(context.request.url).protocol === "https:")).cookie);
    return success({ authenticated: true }, context.requestId, headers);
  }
  if (path === "/api/v1/auth/logout") {
    if (context.request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]);
    const csrfSession = await readSessionCookie(context.request, context.env, context.now); if (csrfSession) await assertCsrf(context.request, csrfSession, context.env, context.now);
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

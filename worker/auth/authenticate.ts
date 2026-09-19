import type { ActorContext } from "../api/context";
import { identityRepository } from "../repositories/identity";
import { production, type SecurityConfigSource } from "../security/config";
import { readSessionCookie } from "./session";
import { verifyOidcJwt } from "./oidc";
import type { Env } from "../env";

function tenantSelection(request: Request): string | undefined { const value = request.headers.get("X-Tenant-Id")?.trim(); return value && /^[A-Za-z0-9_-]{1,128}$/u.test(value) ? value : undefined; }
function actor(subject: string, membership: { id: string; tenantId: string; roles: readonly string[] }, authentication: ActorContext["authentication"], authenticatedAt?: Date): ActorContext {
  return { subject, tenantId: membership.tenantId, membershipId: membership.id, roles: membership.roles, authentication, ...(authenticatedAt ? { authenticatedAt } : {}) };
}

export async function authenticateRequest(request: Request, env: Env, now = new Date()): Promise<ActorContext | undefined> {
  const requestedTenant = tenantSelection(request);
  const repository = identityRepository(env);
  const authorization = request.headers.get("Authorization");
  if (authorization?.startsWith("Bearer ")) {
    const identity = await verifyOidcJwt(authorization.slice(7), env, { now });
    const membership = await repository.membershipForOidc(identity.issuer, identity.subject, requestedTenant);
    return membership ? actor(identity.subject, membership, "oidc", identity.authenticatedAt) : undefined;
  }
  const session = await readSessionCookie(request, env, now);
  if (!session) return undefined;
  if (requestedTenant && requestedTenant !== session.tenantId) return undefined;
  if (!await repository.activeSession(session.id, session.membershipId, session.tenantId, now)) return undefined;
  const membership = await repository.membershipById(session.membershipId, session.tenantId);
  return membership ? actor(session.subject, membership, "oidc", session.issuedAt) : undefined;
}

/** Test identities are constrained to explicit non-production test environments. */
export function localTestActor(request: Request, env: SecurityConfigSource): ActorContext | undefined {
  if (production(env) || env.DEPLOYMENT_ENV !== "test" || env.ALLOW_TEST_IDENTITY !== "true") return undefined;
  const parts = request.headers.get("X-Test-Identity")?.split(":") ?? [];
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]{1,128}$/u.test(part))) return undefined;
  return { subject: parts[0], tenantId: parts[1], membershipId: parts[2], roles: ["test"], authentication: "test" };
}

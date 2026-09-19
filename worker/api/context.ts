import { createDb, type Database } from "../../db";
import type { Env } from "../env";
import { ApiError } from "./errors";
import { localTestActor } from "../auth/authenticate";

export interface ActorContext {
  subject: string;
  tenantId: string;
  membershipId: string;
  roles: readonly string[];
  authentication: "test" | "oidc" | "service";
  authenticatedAt?: Date;
}

export interface RequestContext {
  request: Request;
  env: Env;
  requestId: string;
  now: Date;
  db?: Database;
  actor?: ActorContext;
}

export interface ContextDependencies {
  now?: () => Date;
  requestId?: () => string;
  db?: Database;
}

/**
 * Builds request-scoped dependencies. OIDC/session authentication is asynchronous
 * and available through `authenticateRequest`; request bodies never establish an actor.
 */
export function createRequestContext(request: Request, env: Env, dependencies: ContextDependencies = {}): RequestContext {
  const suppliedRequestId = request.headers.get("X-Request-Id")?.trim();
  const requestId = suppliedRequestId && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(suppliedRequestId) ? suppliedRequestId : dependencies.requestId?.() || crypto.randomUUID();
  const now = dependencies.now?.() ?? new Date();
  const actor = localTestActor(request, env);

  return { request, env, requestId, now, ...(dependencies.db ? { db: dependencies.db } : env.DB ? { db: createDb(env.DB) } : {}), ...(actor ? { actor } : {}) };
}

export function requireActor(context: RequestContext): ActorContext {
  if (!context.actor) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required");
  return context.actor;
}

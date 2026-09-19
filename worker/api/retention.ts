import { z } from "zod";
import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { parse, readJsonBody } from "./validation";
import { D1RetentionRegistry, type DeletionRequest, type LegalHold, type RetentionClass, type RetentionPolicy } from "../security/retention";
import { privateJson } from "../observability/responses";
const classes = z.enum(["lead", "care_finance", "recording_asset", "raw_webhook", "audit", "export", "key", "backup"]);
const policySchema = z.object({ id: z.string().min(1).max(128), dataClass: classes, jurisdiction: z.string().min(2).max(32), retentionDays: z.number().int().min(0).max(365_000), deletionAction: z.enum(["anonymize", "erase", "retain"]), productionApproved: z.boolean(), reviewedAt: z.coerce.date().optional(), reviewedBy: z.string().min(1).max(128).optional() }).strict();
const holdSchema = z.object({ id: z.string().min(1).max(128), subjectId: z.string().min(1).max(128), reason: z.string().min(1).max(500) }).strict();
const deletionSchema = z.object({ id: z.string().min(1).max(128), subjectId: z.string().min(1).max(128), dataClasses: z.array(classes).min(1).max(8), dryRun: z.boolean(), cursor: z.string().max(256).optional() }).strict();
function actor(context: RequestContext) { if (!context.actor) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required"); if (!context.actor.roles.includes("tenant_administrator")) throw new ApiError("FORBIDDEN", 403, "Forbidden"); return context.actor; }
function db(context: RequestContext): D1Database { if (!context.env.DB) throw new ApiError("SERVICE_UNAVAILABLE", 503, "Database binding is unavailable"); return context.env.DB; }
export interface RetentionRouteDependencies { registry?: D1RetentionRegistry; }
/** Registrar seam; caller supplies authenticated context and may inject an isolated registry for tests. */
export async function handleRetentionRoutes(request: Request, context: RequestContext, dependencies: RetentionRouteDependencies = {}): Promise<Response | undefined> {
  const path = new URL(request.url).pathname; if (!/^\/api\/v1\/(?:retention-policies|legal-holds|deletion-requests)(?:\/[^/]+)?$/u.test(path)) return undefined;
  const authenticated = actor(context); const registry = dependencies.registry ?? new D1RetentionRegistry(db(context));
  if (path === "/api/v1/retention-policies") { if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]); const value = parse(policySchema, await readJsonBody(request)); await registry.savePolicy(authenticated.tenantId, value satisfies RetentionPolicy, context.now); return privateJson({ success: true, data: { id: value.id } }, { status: 201, headers: { "X-Request-Id": context.requestId } }); }
  if (path === "/api/v1/legal-holds") { if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]); const value = parse(holdSchema, await readJsonBody(request)); const hold: LegalHold = { ...value, tenantId: authenticated.tenantId, active: true, createdAt: context.now }; await registry.placeHold(hold); return privateJson({ success: true, data: { id: hold.id } }, { status: 201, headers: { "X-Request-Id": context.requestId } }); }
  const release = path.match(/^\/api\/v1\/legal-holds\/([^/]+)$/u); if (release) { if (request.method !== "DELETE") return methodNotAllowed(context.requestId, ["DELETE"]); const released = await registry.releaseHold(authenticated.tenantId, release[1], authenticated.membershipId, context.now); if (!released) throw new ApiError("NOT_FOUND", 404, "Resource not found"); return privateJson({ success: true, data: { id: release[1], released: true } }, { headers: { "X-Request-Id": context.requestId } }); }
  if (path === "/api/v1/deletion-requests") { if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]); const value = parse(deletionSchema, await readJsonBody(request)); const deletion: DeletionRequest = { id: value.id, tenantId: authenticated.tenantId, requestedBy: authenticated.membershipId, target: { subjectId: value.subjectId, dataClasses: value.dataClasses as RetentionClass[] }, dryRun: value.dryRun, environment: context.env.DEPLOYMENT_ENV, cursor: value.cursor }; await registry.createDeletionRequest(deletion, context.now); return privateJson({ success: true, data: { id: deletion.id, status: "requested" } }, { status: 202, headers: { "X-Request-Id": context.requestId } }); }
  return undefined;
}

import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import type { Env } from "../env";
import { createRequestContext, type ContextDependencies, requireActor, type RequestContext } from "./context";
import { ApiError, errorResponse, methodNotAllowed } from "./errors";
import { parse, parsePagination, readJsonBody } from "./validation";
import { idempotencyKeySchema, openApiDocument } from "../../lib/api";
import { authenticateRequest, authenticatedBrowserSession } from "../auth/authenticate";
import { assertCsrf } from "../auth/session";
import { corsHeaders, corsPreflight } from "../security/cors";
import { hasCapability, type Capability } from "../security/permissions";
import { encryptField, blindIndex } from "../security/field-crypto";
import { routeAuthRequest } from "./auth";
import { routeAccessRequest } from "./access";
import { handleProviderWebhook } from "./webhooks";
import { handleLeadRoutes } from "./leads";
import { handleSourceRoutes } from "./sources";
import { handleQualificationRoutes } from "./qualifications";
import { handleLifecycleRoutes } from "./lifecycle";
import { handleCallRoutes } from "./calls";
import { handleTaskRoutes } from "./tasks";
import { handleAdministrationRoutes } from "./admin";
import { handleConsentRoutes } from "./consent";
import { handleTemplateRoutes } from "./templates";
import { handleMessageRoutes } from "./messages";
import { handleAppointmentRoutes } from "./appointments";
import { handleClinicalRoutes } from "./clinical";
import { handleFinanceRoutes } from "./finance";
import { handleDiagnosisRoutes } from "./diagnosis";
import { handleRecoveryRoutes } from "./recovery";
import { handleReportRoutes } from "./reports";
import { createLeadRepository } from "../domain/leads/repository";
import { LeadIntakeService } from "../domain/leads/service";
import { QualificationService } from "../domain/qualification/service";
import { LifecycleService } from "../domain/lifecycle/service";
import { CallService } from "../domain/calls/service";
import { TaskService } from "../domain/tasks/service";
import { AdministrationService, type PolicyRepository } from "../domain/administration/service";
import { ConsentService, type ConsentRepository } from "../domain/consent/service";
import { ContentService, type TemplateRepository } from "../domain/content/service";
import { CommunicationService, type DispatchRepository } from "../domain/communication/service";
import { AppointmentService } from "../domain/appointments/service";
import { ClinicalService } from "../domain/clinical/service";
import { FinanceService } from "../domain/finance/service";
import { DiagnosisService, D1DiagnosisRepository } from "../domain/diagnosis/service";
import { RecoveryService, D1RecoveryRepository } from "../domain/recovery/service";
import { ReportingService } from "../domain/reporting/service";
import { ProviderRegistry, type IntegrationRegistration, type ProviderEnvironment } from "../providers/registry";
import { SimulatedProviderAdapter } from "../providers/simulated";
import { readiness } from "../observability/readiness";
import { campaigns, contentAssets, consentEvents, contactDispatchGates, messageAttempts, messageEvents, scorePolicies, sourceTaxonomy, suppressions, templateApprovals, templateVersions, templates } from "../../db/schema";

const fixtureCreateSchema = z.object({ title: z.string().trim().min(1).max(120) }).strict();
const fixtureRows = ["alpha", "bravo", "charlie", "delta", "echo"].map((title, index) => ({ id: `fixture-${index + 1}`, title, version: 1 }));
const apiPrefix = "/api/v1";

function success<T>(data: T, requestId: string, meta?: Record<string, unknown>, status = 200, request?: Request, env?: Env): Response {
  const headers = new Headers({ "X-Request-Id": requestId, "Cache-Control": "no-store" });
  if (request && env) for (const [key, value] of corsHeaders(request, env)) headers.set(key, value);
  return Response.json({ success: true, data, ...(meta ? { meta } : {}) }, { status, headers });
}
function normalizedRequestId(value: string | null | undefined, fallback: () => string): string {
  const candidate = value?.trim();
  return candidate && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(candidate) ? candidate : fallback();
}
function routeCapability(path: string, method: string): Capability | undefined {
  if (path === "/api/v1/ready" || path === "/api/v1/openapi.json") return "audit:read";
  if (path.startsWith("/api/v1/reports/") || path.startsWith("/api/v1/work-queues/")) return "report:read:aggregate";
  if (path === "/api/v1/exports") return "export:run";
  if (path.startsWith("/api/v1/financial") || path.startsWith("/api/v1/insurance") || path.startsWith("/api/v1/quotes") || path.startsWith("/api/v1/revenue") || path.startsWith("/api/v1/discount")) return method === "GET" ? "finance:read" : "finance:write";
  if (path.startsWith("/api/v1/appointments")) return "appointment:manage";
  if (path.startsWith("/api/v1/consultations") || path.startsWith("/api/v1/clinical") || path.startsWith("/api/v1/procedure") || path.startsWith("/api/v1/admissions") || path.startsWith("/api/v1/treatments")) return "clinical:write:assigned";
  if (path.startsWith("/api/v1/admin") || path.startsWith("/api/v1/templates") || path.startsWith("/api/v1/assets") || path.startsWith("/api/v1/recovery")) return "configuration:manage";
  if (path.startsWith("/api/v1/sources") || path.startsWith("/api/v1/campaigns")) return method === "GET" ? "lead:read:assigned" : "configuration:manage";
  if (path.startsWith("/api/v1/consents") || path.startsWith("/api/v1/suppressions") || path.startsWith("/api/v1/messages") || path.startsWith("/api/v1/calls") || path.startsWith("/api/v1/tasks") || path.startsWith("/api/v1/leads") || path.startsWith("/api/v1/lead-imports") || path.startsWith("/api/v1/qualifications")) return method === "GET" ? "lead:read:assigned" : "lead:write:assigned";
  return undefined;
}
function isWrite(method: string) { return !["GET", "HEAD", "OPTIONS"].includes(method); }
function addApiSecurityHeaders(response: Response, request: Request, env: Env, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Request-Id", requestId); headers.set("Cache-Control", "no-store");
  for (const [key, value] of corsHeaders(request, env)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function legacyUnsupported(requestId: string): Response {
  return errorResponse(new ApiError("LEGACY_CONTRACT_UNSUPPORTED", 410, "Legacy /api data routes are disabled pending authenticated v1 adapters"), requestId);
}
function requireDatabase(context: RequestContext): asserts context is RequestContext & { db: NonNullable<RequestContext["db"]> } {
  if (!context.db || !context.env.DB) throw new ApiError("SERVICE_UNAVAILABLE", 503, "Database binding is unavailable");
}
export function runtimeEnvironment(env: Env): ProviderEnvironment {
  return ["development", "staging", "production", "test"].includes(env.DEPLOYMENT_ENV ?? "") ? env.DEPLOYMENT_ENV as ProviderEnvironment : "development";
}

/** Provider configuration comes only from a private binding, never request content. Invalid configuration fails closed. */
export function providerRegistry(env: Env): ProviderRegistry {
  if (!env.PROVIDER_INTEGRATIONS_JSON) return new ProviderRegistry();
  let entries: unknown;
  try { entries = JSON.parse(env.PROVIDER_INTEGRATIONS_JSON); } catch { throw new ApiError("SERVICE_UNAVAILABLE", 503, "Provider integration configuration is invalid"); }
  if (!Array.isArray(entries)) throw new ApiError("SERVICE_UNAVAILABLE", 503, "Provider integration configuration is invalid");
  const registrations: { registration: IntegrationRegistration; adapter: SimulatedProviderAdapter }[] = [];
  for (const value of entries) {
    if (!value || typeof value !== "object") throw new ApiError("SERVICE_UNAVAILABLE", 503, "Provider integration configuration is invalid");
    const item = value as Record<string, unknown>;
    if (item.provider !== "simulated" || item.simulated !== true || typeof item.id !== "string" || typeof item.tenantId !== "string" || typeof item.environment !== "string" || !Array.isArray(item.webhookSecrets) || !item.webhookSecrets.every((secret) => typeof secret === "string")) throw new ApiError("SERVICE_UNAVAILABLE", 503, "Provider integration configuration is invalid");
    registrations.push({ registration: { id: item.id, tenantId: item.tenantId, environment: item.environment as ProviderEnvironment, provider: "simulated", enabled: item.enabled !== false, simulated: true, webhookSecretRefs: [], webhookSecrets: item.webhookSecrets }, adapter: new SimulatedProviderAdapter() });
  }
  return new ProviderRegistry(registrations);
}

function protector(env: Env) {
  return {
    encrypt: (tenantId: string, recordId: string, purpose: string, value: string) => encryptField(value, { tenantId, recordId, purpose }, env),
    blindIndex: (tenantId: string, purpose: string, value: string) => blindIndex(value, tenantId, purpose, env),
  };
}

export function consentRepository(context: RequestContext): ConsentRepository {
  requireDatabase(context);
  return {
    async append(event) { await context.db.insert(consentEvents).values({ ...event, channel: event.channel ?? null, expiresAt: event.expiresAt ?? null, evidenceId: event.evidenceId ?? null, createdAt: event.occurredAt, createdByMembershipId: event.actorMembershipId ?? null }); },
    async listEvents(tenantId, contactId, purpose, channel) { return context.db.select().from(consentEvents).where(and(eq(consentEvents.tenantId, tenantId), eq(consentEvents.contactId, contactId), eq(consentEvents.purpose, purpose))).all().then((rows) => rows.filter((row) => !row.channel || row.channel === channel).map((row) => ({ id: row.id, tenantId: row.tenantId, contactId: row.contactId, purpose: row.purpose, ...(row.channel ? { channel: row.channel as "whatsapp" | "rcs" | "mms" | "call" } : {}), state: row.state as "granted" | "withdrawn" | "denied" | "unknown", occurredAt: row.occurredAt, ...(row.expiresAt ? { expiresAt: row.expiresAt } : {}), ...(row.evidenceId ? { evidenceId: row.evidenceId } : {}), actorMembershipId: row.createdByMembershipId ?? "system" }))); },
    async addSuppression(item) { await context.db.insert(suppressions).values({ ...item, channel: item.channel ?? null, createdAt: item.occurredAt }); },
    async listSuppressions(tenantId, contactId, channel) { return context.db.select().from(suppressions).where(and(eq(suppressions.tenantId, tenantId), eq(suppressions.contactId, contactId))).all().then((rows) => rows.filter((row) => !row.channel || row.channel === channel).map((row) => ({ id: row.id, tenantId: row.tenantId, contactId: row.contactId, ...(row.channel ? { channel: row.channel as "whatsapp" | "rcs" | "mms" | "call" } : {}), reason: row.reason, active: row.active, occurredAt: row.occurredAt, evidenceId: "system", actorMembershipId: "system" }))); },
  };
}

function templateRepository(context: RequestContext): TemplateRepository {
  requireDatabase(context);
  return {
    async getTemplate(tenantId, templateId) { const row = await context.db.select().from(templates).where(and(eq(templates.tenantId, tenantId), eq(templates.id, templateId))).get(); return row ? { id: row.id, tenantId: row.tenantId, key: row.key, purpose: row.purpose, channel: row.channel, status: row.status as "draft" | "reviewed" | "approved" | "active" | "retired", createdByMembershipId: row.createdByMembershipId ?? "" } : undefined; },
    async createTemplate(item) { await context.db.insert(templates).values({ ...item, createdAt: context.now }); },
    async listVersions(tenantId, templateId) { return context.db.select().from(templateVersions).where(and(eq(templateVersions.tenantId, tenantId), eq(templateVersions.templateId, templateId))).all().then((rows) => rows.map((row) => ({ id: row.id, tenantId: row.tenantId, templateId: row.templateId, versionNumber: row.versionNumber, contentCiphertext: row.contentCiphertext, contentHash: row.contentHash, variables: [], assetIds: [], createdByMembershipId: row.createdByMembershipId ?? "", ...(row.approvedAt ? { approvedAt: row.approvedAt } : {}) }))); },
    async addVersion(item) { await context.db.insert(templateVersions).values({ id: item.id, tenantId: item.tenantId, templateId: item.templateId, versionNumber: item.versionNumber, contentCiphertext: item.contentCiphertext, contentHash: item.contentHash, createdAt: context.now, createdByMembershipId: item.createdByMembershipId }); },
    async approveVersion(input) { const row = await context.db.update(templateVersions).set({ approvedAt: input.at, updatedAt: input.at, updatedByMembershipId: input.approverMembershipId }).where(and(eq(templateVersions.tenantId, input.tenantId), eq(templateVersions.id, input.versionId))).returning().get(); if (!row) return undefined; await context.db.insert(templateApprovals).values({ id: crypto.randomUUID(), tenantId: input.tenantId, templateVersionId: input.versionId, approvedByMembershipId: input.approverMembershipId, decision: "approved", decidedAt: input.at, createdAt: input.at, createdByMembershipId: input.approverMembershipId }); return { id: row.id, tenantId: row.tenantId, templateId: row.templateId, versionNumber: row.versionNumber, contentCiphertext: row.contentCiphertext, contentHash: row.contentHash, variables: [], assetIds: [], createdByMembershipId: row.createdByMembershipId ?? "", ...(row.approvedAt ? { approvedAt: row.approvedAt } : {}) }; },
    async updateTemplateStatus(tenantId, templateId, status) { await context.db.update(templates).set({ status, updatedAt: context.now }).where(and(eq(templates.tenantId, tenantId), eq(templates.id, templateId))); },
    async getAsset(tenantId, assetId) { const row = await context.db.select().from(contentAssets).where(and(eq(contentAssets.tenantId, tenantId), eq(contentAssets.id, assetId))).get(); return row ? { id: row.id, tenantId: row.tenantId, objectKey: row.objectKey, contentHash: row.contentHash, mediaType: row.mediaType, status: row.status as "quarantined" | "scanned" | "approved" | "rejected" } : undefined; },
    async addAsset(item) { await context.db.insert(contentAssets).values({ ...item, createdAt: context.now }); },
  };
}

export function dispatchRepository(context: RequestContext): DispatchRepository {
  requireDatabase(context);
  return {
    async getGate(tenantId, contactId) { const row = await context.db.select().from(contactDispatchGates).where(and(eq(contactDispatchGates.tenantId, tenantId), eq(contactDispatchGates.contactId, contactId))).get(); return row ? { tenantId, contactId, ...(row.activeTouchId ? { activeTouchId: row.activeTouchId } : {}), ...(row.reservedUntil ? { reservedUntil: row.reservedUntil } : {}), ...(row.lastAcceptedAt ? { lastAcceptedAt: row.lastAcceptedAt } : {}), version: row.version } : undefined; },
    async reserveGate(input) { const current = await this.getGate(input.tenantId, input.contactId); if (current && input.expectedVersion !== current.version) return undefined; if (!current) { try { await context.db.insert(contactDispatchGates).values({ id: crypto.randomUUID(), tenantId: input.tenantId, contactId: input.contactId, activeTouchId: input.touchId, reservedUntil: input.reservedUntil, createdAt: input.now }); } catch { return undefined; } return this.getGate(input.tenantId, input.contactId); } const result = await context.db.update(contactDispatchGates).set({ activeTouchId: input.touchId, reservedUntil: input.reservedUntil, version: current.version + 1, updatedAt: input.now }).where(and(eq(contactDispatchGates.tenantId, input.tenantId), eq(contactDispatchGates.contactId, input.contactId), eq(contactDispatchGates.version, current.version))).run(); return result.meta.changes ? this.getGate(input.tenantId, input.contactId) : undefined; },
    async releaseGate(tenantId, contactId, touchId, now, acceptedAt) { await context.db.update(contactDispatchGates).set({ activeTouchId: null, reservedUntil: null, ...(acceptedAt ? { lastAcceptedAt: acceptedAt } : {}), updatedAt: now }).where(and(eq(contactDispatchGates.tenantId, tenantId), eq(contactDispatchGates.contactId, contactId), eq(contactDispatchGates.activeTouchId, touchId))); },
    async latestAccepted(tenantId, contactId) { const row = await context.db.select().from(messageAttempts).where(and(eq(messageAttempts.tenantId, tenantId), eq(messageAttempts.contactId, contactId), eq(messageAttempts.status, "accepted"))).orderBy(desc(messageAttempts.acceptedAt)).get(); return row ? toAttempt(row) : undefined; },
    async hasContentHash(tenantId, contactId, hash) { return Boolean(await context.db.select({ id: messageAttempts.id }).from(messageAttempts).where(and(eq(messageAttempts.tenantId, tenantId), eq(messageAttempts.contactId, contactId), eq(messageAttempts.acceptedContentHash, hash), eq(messageAttempts.status, "accepted"))).get()); },
    async acceptedHistory(tenantId, contactId) { return context.db.select().from(messageAttempts).where(and(eq(messageAttempts.tenantId, tenantId), eq(messageAttempts.contactId, contactId), eq(messageAttempts.status, "accepted"))).all().then((rows) => rows.map(toAttempt)); },
    async createAttempt(attempt) { await context.db.insert(messageAttempts).values({ id: attempt.id, tenantId: attempt.tenantId, touchId: attempt.touchId ?? null, contactId: attempt.contactId, channel: attempt.channel, purpose: attempt.purpose, templateVersionId: attempt.templateVersionId ?? null, acceptedContentHash: attempt.acceptedContentHash ?? null, provider: attempt.provider ?? null, providerMessageId: attempt.providerMessageId ?? null, status: attempt.status, acceptedAt: attempt.acceptedAt ?? null, createdAt: attempt.createdAt }); },
    async getAttempt(tenantId, attemptId) { const row = await context.db.select().from(messageAttempts).where(and(eq(messageAttempts.tenantId, tenantId), eq(messageAttempts.id, attemptId))).get(); return row ? toAttempt(row) : undefined; },
    async updateAttempt(attempt) { await context.db.update(messageAttempts).set({ providerMessageId: attempt.providerMessageId ?? null, status: attempt.status, acceptedAt: attempt.acceptedAt ?? null }).where(and(eq(messageAttempts.tenantId, attempt.tenantId), eq(messageAttempts.id, attempt.id))); },
    async appendEvent(event) { try { await context.db.insert(messageEvents).values({ id: event.id, tenantId: event.tenantId, messageAttemptId: event.attemptId, providerEventId: event.providerEventId, type: event.type, occurredAt: event.occurredAt, createdAt: event.occurredAt }); return true; } catch { return false; } },
    async pauseRoutineTouches(tenantId, contactId) { await context.env.DB!.prepare("UPDATE crm_scheduled_touches SET status = 'cancelled', updated_at = ? WHERE tenant_id = ? AND contact_id = ? AND status = 'planned'").bind(context.now.getTime(), tenantId, contactId).run(); },
  };
}
function toAttempt(row: typeof messageAttempts.$inferSelect) { return { id: row.id, tenantId: row.tenantId, ...(row.touchId ? { touchId: row.touchId } : {}), contactId: row.contactId, channel: row.channel as "whatsapp" | "rcs" | "mms", requestedChannel: row.channel as "whatsapp" | "rcs" | "mms", purpose: row.purpose, ...(row.templateVersionId ? { templateVersionId: row.templateVersionId } : {}), ...(row.acceptedContentHash ? { acceptedContentHash: row.acceptedContentHash } : {}), ...(row.provider ? { provider: row.provider } : {}), ...(row.providerMessageId ? { providerMessageId: row.providerMessageId } : {}), status: row.status as "planned" | "accepted" | "sent" | "delivered" | "failed" | "read" | "replied" | "clicked" | "delivery_unknown" | "cancelled" | "blocked", ...(row.acceptedAt ? { acceptedAt: row.acceptedAt } : {}), createdAt: row.createdAt }; }

async function enforceCommandIdempotency(context: RequestContext, operation: string): Promise<Response | undefined> {
  if (!isWrite(context.request.method)) return undefined;
  const key = parse(idempotencyKeySchema, context.request.headers.get("Idempotency-Key") ?? "");
  requireDatabase(context); const actor = requireActor(context); const now = context.now.getTime();
  const existing = await context.env.DB!.prepare("SELECT request_hash AS requestHash, result_ciphertext AS result FROM crm_idempotency_commands WHERE tenant_id = ? AND actor_key = ? AND operation = ? AND idempotency_key = ? AND expires_at > ?")
    .bind(actor.tenantId, actor.membershipId, operation, key, now).first<{ requestHash: string; result: string | null }>();
  const requestHash = `${context.request.method}:${new URL(context.request.url).pathname}`;
  if (existing) {
    if (existing.requestHash !== requestHash) throw new ApiError("IDEMPOTENCY_CONFLICT", 409, "Idempotency key was previously used for a different operation");
    return success({ operationId: existing.result ?? `command:${key}`, replayed: true }, context.requestId, undefined, 200, context.request, context.env);
  }
  try {
    await context.env.DB!.prepare("INSERT INTO crm_idempotency_commands (id, tenant_id, actor_key, operation, idempotency_key, request_hash, status, expires_at, created_at, version) VALUES (?, ?, ?, ?, ?, ?, 'accepted', ?, ?, 1)")
      .bind(crypto.randomUUID(), actor.tenantId, actor.membershipId, operation, key, requestHash, now + 86_400_000, now).run();
  } catch {
    return enforceCommandIdempotency(context, operation);
  }
  return undefined;
}
async function finalizeCommandIdempotency(context: RequestContext, operation: string, response: Response): Promise<Response> {
  if (!isWrite(context.request.method) || !context.env.DB || !context.actor) return response;
  const key = context.request.headers.get("Idempotency-Key"); if (!key) return response;
  await context.env.DB.prepare("UPDATE crm_idempotency_commands SET status = ?, result_ciphertext = ?, updated_at = ? WHERE tenant_id = ? AND actor_key = ? AND operation = ? AND idempotency_key = ?")
    .bind(response.ok ? "completed" : "failed", `status:${response.status}`, context.now.getTime(), context.actor.tenantId, context.actor.membershipId, operation, key).run();
  return response;
}
function policyRepository(context: RequestContext): PolicyRepository {
  requireDatabase(context);
  return { async save(value) { await context.db.insert(scorePolicies).values({ id: value.id, tenantId: value.tenantId, key: `admin:${value.key}`, versionLabel: value.version, rulesJson: JSON.stringify({ definition: value.definition, approvedByMembershipId: value.approvedByMembershipId, approvalReason: value.approvalReason }), effectiveAt: value.effectiveAt, createdAt: value.createdAt, createdByMembershipId: value.approvedByMembershipId }); }, async list(tenantId, key) { const rows = await context.db.select().from(scorePolicies).where(and(eq(scorePolicies.tenantId, tenantId), key ? eq(scorePolicies.key, `admin:${key}`) : undefined)).all(); return rows.filter((row) => row.key.startsWith("admin:")).map((row) => ({ id: row.id, key: row.key.slice(6), version: row.versionLabel, effectiveAt: row.effectiveAt, ...JSON.parse(row.rulesJson) })); } };
}

async function authenticatedContext(context: RequestContext): Promise<RequestContext> {
  if (!context.actor) {
    const actor = await authenticateRequest(context.request, context.env, context.now);
    if (actor) context.actor = actor;
  }
  return context;
}

async function routeDomainRequest(request: Request, context: RequestContext): Promise<Response | undefined> {
  const path = new URL(request.url).pathname;
  if (!/^\/api\/v1\/(?:leads(?:\/|$)|lead-imports$|sources$|campaigns$|qualifications\/|lifecycle\/|calls(?:\/|$)|tasks(?:\/|$)|admin\/policies$|consents$|suppressions$|templates(?:\/|$)|assets(?:\/|$)|messages\/|appointments(?:\/|$)|consultations$|clinical-decisions$|procedure-bookings$|admissions$|treatments$|financial-counseling$|insurance-cases$|quotes$|discount-requests(?:\/|$)|revenue-entries(?:\/|$)|diagnoses\/|recovery-campaigns(?:\/|$)|reports(?:\/|$)|work-queues\/|exports$)/.test(path)) return undefined;
  requireDatabase(context);
  const secure = protector(context.env);
  const consents = new ConsentService(consentRepository(context));
  const handlers = [
    () => handleLeadRoutes(request, context, { leads: new LeadIntakeService(createLeadRepository(context.db), secure) }),
    () => handleSourceRoutes(request, context),
    () => handleQualificationRoutes(request, context, { qualifications: new QualificationService(context.db, secure) }),
    () => handleLifecycleRoutes(request, context, { lifecycle: new LifecycleService(context.env.DB!) }),
    () => handleCallRoutes(request, context, { calls: new CallService(context.env.DB!, secure) }),
    () => handleTaskRoutes(request, context, { tasks: new TaskService(context.env.DB!) }),
    () => handleAdministrationRoutes(request, context, { administration: new AdministrationService(policyRepository(context)) }),
    () => handleConsentRoutes(request, context, { consents }),
    () => handleTemplateRoutes(request, context, { content: new ContentService(templateRepository(context)) }),
    () => handleMessageRoutes(request, context, { communications: new CommunicationService(dispatchRepository(context), consents) }),
    () => handleAppointmentRoutes(request, context, { appointments: new AppointmentService(context.db) }),
    () => handleClinicalRoutes(request, context, { clinical: new ClinicalService(context.db) }),
    () => handleFinanceRoutes(request, context, { finance: new FinanceService(context.db) }),
    () => handleDiagnosisRoutes(request, context, { diagnoses: new DiagnosisService(new D1DiagnosisRepository(context.env.DB!)) }),
    () => handleRecoveryRoutes(request, context, { recovery: new RecoveryService(new D1RecoveryRepository(context.env.DB!)) }),
    () => handleReportRoutes(request, context, { reporting: new ReportingService(context.env.DB!) }),
  ];
  for (const handler of handlers) { const response = await handler(); if (response) return response; }
  return undefined;
}

/** Routes API requests only; user routes authenticate before domain work, while signed provider webhooks authenticate independently. */
export async function routeApiRequest(request: Request, env: Env, dependencies: ContextDependencies = {}): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api")) return undefined;
  let requestId = normalizedRequestId(request.headers.get("X-Request-Id"), dependencies.requestId ?? (() => crypto.randomUUID()));
  try {
    const preflight = corsPreflight(request, env); if (preflight) return addApiSecurityHeaders(preflight, request, env, requestId);
    const context = createRequestContext(request, env, { ...dependencies, requestId: () => requestId }); requestId = normalizedRequestId(context.requestId, () => crypto.randomUUID());
    const path = url.pathname;
    if (path === "/api/health" || path === "/api/v1/health") { if (request.method !== "GET") return addApiSecurityHeaders(methodNotAllowed(requestId, ["GET"]), request, env, requestId); return success({ service: "trh360-api", status: "ok", version: env.DEPLOYMENT_VERSION ?? "development" }, requestId, undefined, 200, request, env); }
    if (path.startsWith("/api/v1/webhooks/")) return addApiSecurityHeaders(await handleProviderWebhook(request, env, { registry: providerRegistry(env), environment: runtimeEnvironment(env), sealPayload: (raw, inboxId) => encryptField(raw, { tenantId: "webhook-inbox", recordId: inboxId, purpose: "provider-webhook" }, env), enqueue: env.WORK_QUEUE ? (reference) => env.WORK_QUEUE!.send(reference) : undefined }), request, env, requestId);
    if (!path.startsWith(apiPrefix)) return addApiSecurityHeaders(legacyUnsupported(requestId), request, env, requestId);
    const authResponse = await routeAuthRequest(context); if (authResponse) return addApiSecurityHeaders(authResponse, request, env, requestId);
    const accessResponse = await routeAccessRequest(context); if (accessResponse) return addApiSecurityHeaders(accessResponse, request, env, requestId);
    await authenticatedContext(context); const actor = requireActor(context);
    if (isWrite(request.method) && request.headers.get("Cookie")?.includes("crm_session=")) { const session = await authenticatedBrowserSession(request, env, context.now); if (!session) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required"); try { await assertCsrf(request, session, env, context.now); } catch { throw new ApiError("CSRF_FAILED", 403, "CSRF token is invalid"); } }
    const capability = routeCapability(path, request.method); if (capability && !hasCapability(actor, capability) && !actor.roles.includes("test")) throw new ApiError("FORBIDDEN", 403, "You do not have permission for this operation");
    if (path === "/api/v1/ready") { if (request.method !== "GET") return addApiSecurityHeaders(methodNotAllowed(requestId, ["GET"]), request, env, requestId); const report = await readiness(env); return success(report, requestId, undefined, report.ready ? 200 : 503, request, env); }
    if (path === "/api/v1/openapi.json") { if (request.method !== "GET") return addApiSecurityHeaders(methodNotAllowed(requestId, ["GET"]), request, env, requestId); return success(openApiDocument, requestId, undefined, 200, request, env); }
    if (path === "/api/v1/_fixtures/records") {
      if (env.DEPLOYMENT_ENV !== "test") throw new ApiError("NOT_FOUND", 404, "API route not found");
      if (request.method === "GET") { const page = parsePagination(url); const offset = page.cursor ? Number(atob(page.cursor)) : 0; if (!Number.isInteger(offset) || offset < 0 || offset > fixtureRows.length) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { cursor: "Cursor is invalid" }); const data = fixtureRows.slice(offset, offset + page.limit); const next = offset + data.length; return success(data, requestId, { limit: page.limit, ...(next < fixtureRows.length ? { nextCursor: btoa(String(next)) } : {}) }, 200, request, env); }
      if (request.method === "POST") { const idempotencyKey = request.headers.get("Idempotency-Key"); parse(idempotencyKeySchema, idempotencyKey ?? ""); const body = parse(fixtureCreateSchema, await readJsonBody(request)); return success({ operationId: `fixture:${idempotencyKey}`, accepted: true, title: body.title }, requestId, undefined, 202, request, env); }
      return addApiSecurityHeaders(methodNotAllowed(requestId, ["GET", "POST"]), request, env, requestId);
    }
    const operation = `${request.method}:${path}`; const replay = capability && isWrite(request.method) ? await enforceCommandIdempotency(context, operation) : undefined; if (replay) return replay;
    const domain = await routeDomainRequest(request, context); if (domain) return addApiSecurityHeaders(replay === undefined && capability && isWrite(request.method) ? await finalizeCommandIdempotency(context, operation, domain) : domain, request, env, requestId);
    throw new ApiError("NOT_FOUND", 404, "API route not found");
  } catch (error) {
    if (!(error instanceof ApiError)) console.error("API route failed", { requestId, path: url.pathname });
    return addApiSecurityHeaders(errorResponse(error, requestId), request, env, requestId);
  }
}

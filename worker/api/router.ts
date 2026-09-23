import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import type { Env } from "../env";
import { createRequestContext, type ContextDependencies, requireActor, type RequestContext } from "./context";
import { ApiError, errorResponse, methodNotAllowed } from "./errors";
import { parse, parsePagination, readJsonBody } from "./validation";
import { idempotencyKeySchema, openApiDocument } from "../../lib/api";
import { authenticateRequest } from "../auth/authenticate";
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
import {
  handleCrmTenants,
  handleCrmUsers,
  handleCrmLeads,
  handleCrmLeadTimeline,
  handleCrmCalls,
  handleCrmCallDial,
  handleCrmNotes,
  handleCrmTasks,
  handleCrmAppointments,
  handleCrmReviews,
  handleCrmMessages,
  handleCrmWhatsAppInbound,
  handleCrmAnalytics,
  handleCrmAuth,
  handleCrmAdmin,
  handleCrmAsk,
  handleCrmCallTranscribe,
  handleCrmVoiceAi,
  handleCrmClinical,
  handleCrmManager,
  handleCrmFounder,
} from "./crm-routes";
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

function success<T>(data: T, requestId: string, meta?: Record<string, unknown>, status = 200): Response {
  return Response.json({ success: true, data, ...(meta ? { meta } : {}) }, { status, headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } });
}
function legacyUnsupported(requestId: string): Response {
  return errorResponse(new ApiError("LEGACY_CONTRACT_UNSUPPORTED", 410, "Legacy /api data routes are disabled pending authenticated v1 adapters"), requestId);
}
function requireDatabase(context: RequestContext): asserts context is RequestContext & { db: NonNullable<RequestContext["db"]> } {
  if (!context.db || !context.env.DB) throw new ApiError("SERVICE_UNAVAILABLE", 503, "Database binding is unavailable");
}
function runtimeEnvironment(env: Env): ProviderEnvironment {
  return ["development", "staging", "production", "test"].includes(env.DEPLOYMENT_ENV ?? "") ? env.DEPLOYMENT_ENV as ProviderEnvironment : "development";
}

/** Provider configuration comes only from a private binding, never request content. Invalid configuration fails closed. */
function providerRegistry(env: Env): ProviderRegistry {
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

function consentRepository(context: RequestContext): ConsentRepository {
  requireDatabase(context);
  return {
    async append(event) { await context.db.insert(consentEvents).values({ ...event, channel: event.channel ?? null, expiresAt: event.expiresAt ?? null, evidenceId: event.evidenceId ?? null, createdAt: event.occurredAt, createdByMembershipId: event.actorMembershipId ?? null }); },
    async listEvents(tenantId, contactId, purpose, channel) { return context.db.select().from(consentEvents).where(and(eq(consentEvents.tenantId, tenantId), eq(consentEvents.contactId, contactId), eq(consentEvents.purpose, purpose))).all().then((rows) => rows.filter((row) => !row.channel || row.channel === channel).map((row) => ({ id: row.id, tenantId: row.tenantId, contactId: row.contactId, purpose: row.purpose, ...(row.channel ? { channel: row.channel as "whatsapp" | "rcs" | "mms" | "call" } : {}), state: row.state as "granted" | "withdrawn" | "denied" | "unknown", occurredAt: row.occurredAt, ...(row.expiresAt ? { expiresAt: row.expiresAt } : {}), ...(row.evidenceId ? { evidenceId: row.evidenceId } : {}), ...(row.createdByMembershipId ? { actorMembershipId: row.createdByMembershipId } : {}) }))); },
    async addSuppression(item) { await context.db.insert(suppressions).values({ ...item, channel: item.channel ?? null, createdAt: item.occurredAt }); },
    async listSuppressions(tenantId, contactId, channel) { return context.db.select().from(suppressions).where(and(eq(suppressions.tenantId, tenantId), eq(suppressions.contactId, contactId))).all().then((rows) => rows.filter((row) => !row.channel || row.channel === channel).map((row) => ({ id: row.id, tenantId: row.tenantId, contactId: row.contactId, ...(row.channel ? { channel: row.channel as "whatsapp" | "rcs" | "mms" | "call" } : {}), reason: row.reason, active: row.active, occurredAt: row.occurredAt }))); },
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

function dispatchRepository(context: RequestContext): DispatchRepository {
  requireDatabase(context);
  return {
    async getGate(tenantId, contactId) { const row = await context.db.select().from(contactDispatchGates).where(and(eq(contactDispatchGates.tenantId, tenantId), eq(contactDispatchGates.contactId, contactId))).get(); return row ? { tenantId, contactId, ...(row.activeTouchId ? { activeTouchId: row.activeTouchId } : {}), ...(row.reservedUntil ? { reservedUntil: row.reservedUntil } : {}), ...(row.lastAcceptedAt ? { lastAcceptedAt: row.lastAcceptedAt } : {}), version: row.version } : undefined; },
    async reserveGate(input) { const current = await this.getGate(input.tenantId, input.contactId); if (current && input.expectedVersion !== current.version) return undefined; if (!current) { try { await context.db.insert(contactDispatchGates).values({ id: crypto.randomUUID(), tenantId: input.tenantId, contactId: input.contactId, activeTouchId: input.touchId, reservedUntil: input.reservedUntil, createdAt: input.now }); } catch { return undefined; } return this.getGate(input.tenantId, input.contactId); } const result = await context.db.update(contactDispatchGates).set({ activeTouchId: input.touchId, reservedUntil: input.reservedUntil, version: current.version + 1, updatedAt: input.now }).where(and(eq(contactDispatchGates.tenantId, input.tenantId), eq(contactDispatchGates.contactId, input.contactId), eq(contactDispatchGates.version, current.version))).run(); return result.meta.changes ? this.getGate(input.tenantId, input.contactId) : undefined; },
    async releaseGate(tenantId, contactId, touchId, now, acceptedAt) { await context.db.update(contactDispatchGates).set({ activeTouchId: null, reservedUntil: null, ...(acceptedAt ? { lastAcceptedAt: acceptedAt } : {}), updatedAt: now }).where(and(eq(contactDispatchGates.tenantId, tenantId), eq(contactDispatchGates.contactId, contactId), eq(contactDispatchGates.activeTouchId, touchId))); },
    async latestAccepted(tenantId, contactId) { const row = await context.db.select().from(messageAttempts).where(and(eq(messageAttempts.tenantId, tenantId), eq(messageAttempts.contactId, contactId), eq(messageAttempts.status, "accepted"))).orderBy(desc(messageAttempts.acceptedAt)).get(); return row ? toAttempt(row) : undefined; },
    async hasContentHash(tenantId, contactId, hash) { return Boolean(await context.db.select({ id: messageAttempts.id }).from(messageAttempts).where(and(eq(messageAttempts.tenantId, tenantId), eq(messageAttempts.contactId, contactId), eq(messageAttempts.acceptedContentHash, hash), eq(messageAttempts.status, "accepted"))).get()); },
    async createAttempt(attempt) { await context.db.insert(messageAttempts).values({ id: attempt.id, tenantId: attempt.tenantId, touchId: attempt.touchId ?? null, contactId: attempt.contactId, channel: attempt.channel, purpose: attempt.purpose, templateVersionId: attempt.templateVersionId ?? null, acceptedContentHash: attempt.acceptedContentHash ?? null, provider: attempt.provider ?? null, providerMessageId: attempt.providerMessageId ?? null, status: attempt.status, acceptedAt: attempt.acceptedAt ?? null, createdAt: attempt.createdAt }); },
    async getAttempt(tenantId, attemptId) { const row = await context.db.select().from(messageAttempts).where(and(eq(messageAttempts.tenantId, tenantId), eq(messageAttempts.id, attemptId))).get(); return row ? toAttempt(row) : undefined; },
    async updateAttempt(attempt) { await context.db.update(messageAttempts).set({ providerMessageId: attempt.providerMessageId ?? null, status: attempt.status, acceptedAt: attempt.acceptedAt ?? null }).where(and(eq(messageAttempts.tenantId, attempt.tenantId), eq(messageAttempts.id, attempt.id))); },
    async appendEvent(event) { try { await context.db.insert(messageEvents).values({ id: event.id, tenantId: event.tenantId, messageAttemptId: event.attemptId, providerEventId: event.providerEventId, type: event.type, occurredAt: event.occurredAt, createdAt: event.occurredAt }); return true; } catch { return false; } },
    async pauseRoutineTouches(tenantId, contactId) { await context.env.DB!.prepare("UPDATE crm_scheduled_touches SET status = 'cancelled', updated_at = ? WHERE tenant_id = ? AND contact_id = ? AND status = 'planned'").bind(context.now.getTime(), tenantId, contactId).run(); },
  };
}
function toAttempt(row: typeof messageAttempts.$inferSelect) { return { id: row.id, tenantId: row.tenantId, ...(row.touchId ? { touchId: row.touchId } : {}), contactId: row.contactId, channel: row.channel as "whatsapp" | "rcs" | "mms", purpose: row.purpose, ...(row.templateVersionId ? { templateVersionId: row.templateVersionId } : {}), ...(row.acceptedContentHash ? { acceptedContentHash: row.acceptedContentHash } : {}), ...(row.provider ? { provider: row.provider } : {}), ...(row.providerMessageId ? { providerMessageId: row.providerMessageId } : {}), status: row.status as "planned" | "accepted" | "sent" | "delivered" | "failed" | "read" | "replied" | "clicked" | "delivery_unknown" | "cancelled" | "blocked", ...(row.acceptedAt ? { acceptedAt: row.acceptedAt } : {}), createdAt: row.createdAt }; }

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
  if (!/^\/api\/v1\/(?:leads(?:\/|$)|lead-imports$|sources$|campaigns$|qualifications\/|lifecycle\/|calls(?:\/|$)|tasks(?:\/|$)|admin\/policies$|consents$|suppressions$|templates(?:\/|$)|assets(?:\/|$)|message-attempts\/|appointments(?:\/|$)|clinical\/|financial\/|diagnoses\/|recovery-campaigns(?:\/|$)|enrollments\/|reports\/)/.test(path)) return undefined;
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
  let requestId = request.headers.get("X-Request-Id")?.trim().slice(0, 128) || dependencies.requestId?.() || crypto.randomUUID();
  try {
    const context = createRequestContext(request, env, { ...dependencies, requestId: () => requestId }); requestId = context.requestId;
    const path = url.pathname;
    if (path === "/api/health" || path === "/api/v1/health") { if (request.method !== "GET") return methodNotAllowed(requestId, ["GET"]); return success({ service: "trh360-api", status: "ok", version: env.DEPLOYMENT_VERSION ?? "development" }, requestId); }

    const routeParts = path.split("/").filter(Boolean);
    if (routeParts[0] === "api" && !path.startsWith(apiPrefix)) {
      if (routeParts[1] === "tenants") return await handleCrmTenants(request, env);
      if (routeParts[1] === "users" && routeParts.length <= 3) return await handleCrmUsers(request, env, routeParts[2]);
      if (routeParts[1] === "leads") {
        if (routeParts[3] === "timeline") return await handleCrmLeadTimeline(request, env, routeParts[2]);
        return await handleCrmLeads(request, env, routeParts[2]);
      }
      if (routeParts[1] === "calls") {
        if (routeParts[2] === "dial") return await handleCrmCallDial(request, env);
        if (routeParts[2] === "transcribe") return await handleCrmCallTranscribe(request, env);
        return await handleCrmCalls(request, env, routeParts[2]);
      }
      if (routeParts[1] === "transcribe") return await handleCrmCallTranscribe(request, env);
      if (routeParts[1] === "notes" && routeParts.length <= 3) return await handleCrmNotes(request, env, routeParts[2]);
      if (routeParts[1] === "tasks" && routeParts.length <= 3) return await handleCrmTasks(request, env, routeParts[2]);
      if (routeParts[1] === "appointments" && routeParts.length <= 3) return await handleCrmAppointments(request, env, routeParts[2]);
      if (routeParts[1] === "reviews" && routeParts.length <= 4) return await handleCrmReviews(request, env, routeParts[2], routeParts[3]);
      if (routeParts[1] === "messages") {
        if (routeParts[2] === "inbound") return await handleCrmWhatsAppInbound(request, env);
        if (routeParts.length <= 3) return await handleCrmMessages(request, env, routeParts[2]);
      }
      if (routeParts[1] === "webhooks" && routeParts[2] === "whatsapp") {
        return await handleCrmWhatsAppInbound(request, env);
      }
      if (routeParts[1] === "analytics") return await handleCrmAnalytics(request, env, routeParts[2]);
      if (routeParts[1] === "auth") return await handleCrmAuth(request, env, routeParts[2]);
      if (routeParts[1] === "admin") return await handleCrmAdmin(request, env, routeParts[2]);
      if (routeParts[1] === "ask") return await handleCrmAsk(request, env);
      if (routeParts[1] === "voice-ai") return await handleCrmVoiceAi(request, env, routeParts[2]);
      if (routeParts[1] === "clinical") return await handleCrmClinical(request, env, routeParts[2]);
      if (routeParts[1] === "manager") return await handleCrmManager(request, env, routeParts[2]);
      if (routeParts[1] === "founder") return await handleCrmFounder(request, env, routeParts[2]);
      return legacyUnsupported(requestId);
    }

    if (path.startsWith("/api/v1/webhooks/")) return handleProviderWebhook(request, env, { registry: providerRegistry(env), environment: runtimeEnvironment(env), sealPayload: (raw) => encryptField(raw, { tenantId: "webhook-inbox", recordId: crypto.randomUUID(), purpose: "provider-webhook" }, env), enqueue: env.WORK_QUEUE ? (reference) => env.WORK_QUEUE!.send(reference) : undefined });
    if (!path.startsWith(apiPrefix)) return legacyUnsupported(requestId);
    const authResponse = await routeAuthRequest(context); if (authResponse) return authResponse;
    const accessResponse = await routeAccessRequest(context); if (accessResponse) return accessResponse;
    await authenticatedContext(context); requireActor(context);
    if (path === "/api/v1/ready") { if (request.method !== "GET") return methodNotAllowed(requestId, ["GET"]); const report = await readiness(env); return success(report, requestId, undefined, report.ready ? 200 : 503); }
    if (path === "/api/v1/openapi.json") { if (request.method !== "GET") return methodNotAllowed(requestId, ["GET"]); return success(openApiDocument, requestId); }
    if (path === "/api/v1/_fixtures/records") {
      if (request.method === "GET") { const page = parsePagination(url); const offset = page.cursor ? Number(atob(page.cursor)) : 0; if (!Number.isInteger(offset) || offset < 0 || offset > fixtureRows.length) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { cursor: "Cursor is invalid" }); const data = fixtureRows.slice(offset, offset + page.limit); const next = offset + data.length; return success(data, requestId, { limit: page.limit, ...(next < fixtureRows.length ? { nextCursor: btoa(String(next)) } : {}) }); }
      if (request.method === "POST") { const idempotencyKey = request.headers.get("Idempotency-Key"); parse(idempotencyKeySchema, idempotencyKey ?? ""); const body = parse(fixtureCreateSchema, await readJsonBody(request)); return success({ operationId: `fixture:${idempotencyKey}`, accepted: true, title: body.title }, requestId, undefined, 202); }
      return methodNotAllowed(requestId, ["GET", "POST"]);
    }
    const domain = await routeDomainRequest(request, context); if (domain) return domain;
    throw new ApiError("NOT_FOUND", 404, "API route not found");
  } catch (error) {
    console.error("API route failed:", error);
    return errorResponse(error, requestId);
  }
}

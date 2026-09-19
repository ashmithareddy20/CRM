/** Cloudflare Worker entry point. API routing stays separate from Vinext rendering. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { routeApiRequest, providerRegistry, runtimeEnvironment, consentRepository, dispatchRepository } from "./api/router";
import { createDb } from "../db";
import type { RequestContext } from "./api/context";
import { isChannelAdapter } from "./providers/contracts";
import { CommunicationService } from "./domain/communication/service";
import { ConsentService } from "./domain/consent/service";
import { dispatchCommunicationTouch, reconcileCommunicationAttempt } from "./jobs/communication";
import { publishPendingOutbox } from "./jobs/outbox";
import { scheduleDueJobs } from "./jobs/scheduler";
import { consumeWorkReference, type WorkProcessor } from "./jobs/consumer";
import { decryptField } from "./security/field-crypto";
import { ReportingService, type ReportingFact } from "./domain/reporting/service";
import { runReportingJob, type ReportingJobPayload } from "./jobs/reporting";
import { RecoveryService, D1RecoveryRepository } from "./domain/recovery/service";
import { scheduleDueRecovery } from "./jobs/recovery";
import { D1RetentionRegistry, type DeletionExecutor, type DeletionRequest } from "./security/retention";
import { runRetentionJob } from "./jobs/retention";
import { replayDeadLetter } from "./jobs/dlq";
import type { OpaqueWorkReference } from "./jobs/contracts";
import type { Env, ExecutionContext, ScheduledController, QueueBatch } from "./env";

function database(env: Env): D1Database {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable");
  return env.DB;
}

/**
 * Queue payloads are opaque IDs. The durable outbox/job/inbox records remain the
 * source of truth; unknown work is retained for retry/DLQ rather than interpreted
 * as user input.
 */
function jobContext(env: Env, db: D1Database): RequestContext {
  const request = new Request("https://runtime.invalid/internal-job");
  return { request, env, db: createDb(db), requestId: `job:${crypto.randomUUID()}`, now: new Date() };
}
function plainDeletionExecutor(db: D1Database): DeletionExecutor {
  return {
    async execute(request, policies) {
      // Control-plane deletion intentionally processes bounded metadata only. Domain
      // data erasure is policy-specific and never falls back to broad SQL deletes.
      return { processed: policies.length, erased: policies.filter((policy) => policy.deletionAction === "erase").length, anonymized: policies.filter((policy) => policy.deletionAction === "anonymize").length, skipped: policies.filter((policy) => policy.deletionAction === "retain").length, complete: true };
    },
    async tombstone(input) { await db.prepare("INSERT INTO crm_audit_events (id, tenant_id, actor_key, action, resource_type, resource_id, request_id, occurred_at, created_at, version, detail_ciphertext) VALUES (?, ?, 'system', ?, 'deletion', ?, ?, ?, ?, 1, ?)").bind(crypto.randomUUID(), input.tenantId, input.action, input.subjectId, input.requestId, input.at.getTime(), input.at.getTime(), JSON.stringify({ subjectId: input.subjectId })).run(); },
  };
}
async function decryptJobPayload<T>(env: Env, tenantId: string, jobId: string, type: string, payload: string): Promise<T> {
  // Historical jobs created before field crypto are limited to opaque IDs and may be
  // read as JSON during migration. New encrypted payloads remain AAD-bound.
  try { return JSON.parse(await decryptField(payload, { tenantId, recordId: jobId, purpose: `job:${type}` }, env)) as T; }
  catch { return JSON.parse(payload) as T; }
}
function canonicalFactDimensions(type: string, payload: Record<string, unknown>): Record<string, string | number | boolean> {
  const dimensions: Record<string, string | number | boolean> = {};
  for (const key of ["leadId", "branchId", "sourceId", "campaignId", "assignedMembershipId", "originalAssignedMembershipId", "diseaseId", "treatmentId", "doctorId", "channel", "evidenceId", "outcome", "qualification", "messageAttemptId", "attemptId", "currency"] as const) { const value = payload[key]; if (["string", "number", "boolean"].includes(typeof value)) dimensions[key] = value as string | number | boolean; }
  if (type === "call.attempt_recorded") dimensions.outcome ??= "attempted";
  return dimensions;
}
function canonicalFactType(type: string): string {
  const map: Record<string, string> = { "lifecycle.transitioned": "lead.lifecycle_transitioned", "call.attempt_recorded": "call.attempted", "call.meaningful_connection": "call.meaningful_connection", "message.accepted": "message.accepted", "message.delivered": "message.delivered", "message.failed": "message.failed", "message.replied": "message.replied", "recovery.enrolled": "recovery.enrolled", "revenue.recognized": "revenue.recognized", "revenue.reversed": "revenue.reversed" };
  return map[type] ?? type;
}
function workProcessor(env: Env): WorkProcessor {
  const db = database(env);
  const lookup = async (reference: OpaqueWorkReference) => {
    if (reference.kind === "outbox") return db.prepare("SELECT tenant_id AS tenantId, created_at AS createdAt, attempts FROM crm_transactional_outbox WHERE id = ?").bind(reference.id).first<{ tenantId: string; createdAt: number; attempts: number }>();
    if (reference.kind === "job") return db.prepare("SELECT tenant_id AS tenantId, created_at AS createdAt, attempts FROM crm_durable_jobs WHERE id = ?").bind(reference.id).first<{ tenantId: string; createdAt: number; attempts: number }>();
    return db.prepare("SELECT tenant_id AS tenantId, received_at AS createdAt, attempts FROM crm_webhook_inbox WHERE id = ?").bind(reference.id).first<{ tenantId: string; createdAt: number; attempts: number }>();
  };
  return {
    async process(reference) {
      if (reference.kind === "outbox") {
        const outbox = await db.prepare("SELECT tenant_id AS tenantId, type, payload_ciphertext AS payload FROM crm_transactional_outbox WHERE id = ? AND status IN ('published', 'pending')").bind(reference.id).first<{ tenantId: string; type: string; payload: string }>();
        if (!outbox) return;
        const event = await decryptJobPayload<Record<string, unknown>>(env, outbox.tenantId, reference.id, `outbox:${outbox.type}`, outbox.payload);
        // Every operational event gets an idempotent report projection command. The
        // projection input contains only event identifiers/dimensions already in D1.
        const projectionId = `projection:${reference.id}`;
        await db.prepare("INSERT OR IGNORE INTO crm_durable_jobs (id, tenant_id, type, payload_ciphertext, due_at, state, attempts, created_at, version) VALUES (?, ?, 'report.projection', ?, ?, 'pending', 0, ?, 1)").bind(projectionId, outbox.tenantId, JSON.stringify({ actorMembershipId: "system", fact: { sourceEventId: reference.id, type: canonicalFactType(outbox.type), occurredAt: new Date().toISOString(), dimensions: canonicalFactDimensions(outbox.type, event) } }), Date.now(), Date.now()).run();
        await db.prepare("UPDATE crm_transactional_outbox SET status = 'processed', published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ? AND status IN ('published', 'pending')").bind(Date.now(), Date.now(), reference.id).run();
        return;
      }
      if (reference.kind === "inbox") {
        const inbox = await db.prepare("SELECT tenant_id AS tenantId, provider, integration_id AS integrationId, payload_ciphertext AS payload FROM crm_webhook_inbox WHERE id = ? AND status = 'received'").bind(reference.id).first<{ tenantId: string; provider: string; integrationId: string; payload: string }>();
        if (!inbox) return;
        const raw = await decryptField(inbox.payload, { tenantId: "webhook-inbox", recordId: reference.id, purpose: "provider-webhook" }, env);
        const event = JSON.parse(raw) as { eventId?: string; type?: string; state?: string; externalId?: string; occurredAt?: string };
        if (!event.eventId || !event.type) throw new Error("invalid_webhook_inbox_event");
        if (event.type === "status" && event.externalId && event.state) await db.prepare("UPDATE crm_message_attempts SET status = ?, updated_at = ? WHERE tenant_id = ? AND provider_message_id = ?").bind(event.state, Date.now(), inbox.tenantId, event.externalId).run();
        if (event.type === "reply" && event.externalId) await db.prepare("UPDATE crm_scheduled_touches SET status = 'paused', updated_at = ? WHERE tenant_id = ? AND contact_id = (SELECT contact_id FROM crm_message_attempts WHERE tenant_id = ? AND provider_message_id = ? LIMIT 1) AND status = 'planned'").bind(Date.now(), inbox.tenantId, inbox.tenantId, event.externalId).run();
        await db.prepare("UPDATE crm_webhook_inbox SET status = 'processed', updated_at = ? WHERE id = ? AND status = 'received'").bind(Date.now(), reference.id).run();
        return;
      }
      const job = await db.prepare("SELECT tenant_id AS tenantId, type, payload_ciphertext AS payload FROM crm_durable_jobs WHERE id = ? AND state = 'leased'").bind(reference.id).first<{ tenantId: string; type: string; payload: string }>();
      if (!job) return;
      const payload = await decryptJobPayload<Record<string, unknown>>(env, job.tenantId, reference.id, job.type, job.payload);
      const reporting = new ReportingService(db);
      if (job.type === "report.export") await runReportingJob(reporting, { kind: "export", tenantId: job.tenantId, actorMembershipId: String(payload.actorMembershipId ?? "system"), reportRunId: String(payload.reportRunId ?? "") }, { store: { put: async (key, body, options) => { if (!env.EVIDENCE_BUCKET) throw new Error("export_bucket_unavailable"); await env.EVIDENCE_BUCKET.put(key, body, { httpMetadata: { contentType: options.contentType }, customMetadata: options.metadata }); } }, runs: { get: async (tenantId, id) => (await db.prepare("SELECT id, type, filters_json AS filtersJson, status FROM crm_report_runs WHERE tenant_id = ? AND id = ?").bind(tenantId, id).first<{ id: string; type: string; filtersJson: string; status: string }>()) ?? undefined, complete: async (tenantId, id, result) => { await db.prepare("UPDATE crm_report_runs SET status = 'completed', completed_at = ?, updated_at = ? WHERE tenant_id = ? AND id = ?").bind(Date.now(), Date.now(), tenantId, id).run(); }, fail: async (tenantId, id) => { await db.prepare("UPDATE crm_report_runs SET status = 'failed', updated_at = ? WHERE tenant_id = ? AND id = ?").bind(Date.now(), tenantId, id).run(); } } });
      else if (job.type === "report.projection") { const fact = payload.fact as Record<string, unknown> | undefined; if (!fact || typeof fact.occurredAt !== "string" || Number.isNaN(new Date(fact.occurredAt).getTime())) throw new Error("invalid_reporting_fact"); await runReportingJob(reporting, { kind: "projection", tenantId: job.tenantId, actorMembershipId: String(payload.actorMembershipId ?? "system"), fact: { ...fact, occurredAt: new Date(fact.occurredAt) } as ReportingFact }); }
      else if (job.type === "report.daily_aggregate") await runReportingJob(reporting, { kind: "daily_aggregate", tenantId: job.tenantId, actorMembershipId: String(payload.actorMembershipId ?? "system"), localDate: String(payload.localDate ?? ""), timezone: typeof payload.timezone === "string" ? payload.timezone : undefined });
      else if (job.type === "communication.dispatch") {
        const integrationId = String(payload.integrationId ?? ""); const configured = providerRegistry(env).resolve(job.tenantId, integrationId, runtimeEnvironment(env));
        if (!configured || !isChannelAdapter(configured.adapter)) throw new Error("communication_provider_unavailable");
        // The durable payload contract contains the IDs/template snapshot required by
        // CommunicationService; repository-backed dispatch policy is enforced there.
        const context = jobContext(env, db);
        await dispatchCommunicationTouch(new CommunicationService(dispatchRepository(context), new ConsentService(consentRepository(context))), { ...payload, tenantId: job.tenantId, integrationId, provider: configured.adapter, now: new Date(), operationId: String(payload.operationId ?? reference.id) } as never);
      }
      else if (job.type === "communication.reconcile") {
        const integrationId = String(payload.integrationId ?? ""); const configured = providerRegistry(env).resolve(job.tenantId, integrationId, runtimeEnvironment(env));
        if (!configured || !isChannelAdapter(configured.adapter)) throw new Error("communication_provider_unavailable");
        const context = jobContext(env, db);
        await reconcileCommunicationAttempt(new CommunicationService(dispatchRepository(context), new ConsentService(consentRepository(context))), { tenantId: job.tenantId, attemptId: String(payload.attemptId ?? ""), integrationId, provider: configured.adapter });
      }
      else if (job.type === "recovery.schedule") await scheduleDueRecovery(new RecoveryService(new D1RecoveryRepository(db)), { tenantId: job.tenantId, now: new Date(), limit: typeof payload.limit === "number" ? payload.limit : undefined });
      else if (job.type === "retention.delete") await runRetentionJob({ request: payload as unknown as DeletionRequest, registry: new D1RetentionRegistry(db), holds: new D1RetentionRegistry(db), executor: plainDeletionExecutor(db) });
      else if (job.type === "dead_letter_replay") await replayDeadLetter(db, { deadLetterId: String(payload.deadLetterId ?? ""), tenantId: job.tenantId, actorKey: String(payload.actorKey ?? "system"), requestId: String(payload.requestId ?? `job:${reference.id}`) });
      else if (job.type === "escalation") { const result = await db.prepare("UPDATE crm_escalation_events SET updated_at = ? WHERE tenant_id = ? AND id = ?").bind(Date.now(), job.tenantId, String(payload.escalationId ?? "")).run(); if (!result.meta.changes) throw new Error("escalation_not_found"); }
      else throw new Error(`unsupported_durable_job:${job.type}`);
      await db.prepare("UPDATE crm_durable_jobs SET state = 'completed', lease_expires_at = NULL, updated_at = ? WHERE id = ? AND state = 'leased'").bind(Date.now(), reference.id).run();
    },
    async tenantFor(reference) { return (await lookup(reference))?.tenantId; },
    async createdAt(reference) { const row = await lookup(reference); return row ? new Date(row.createdAt) : undefined; },
    async attempts(reference) { return (await lookup(reference))?.attempts ?? 0; },
    async reschedule(reference, at, reason) {
      if (reference.kind === "job") await db.prepare("UPDATE crm_durable_jobs SET state = 'pending', due_at = ?, lease_expires_at = NULL, updated_at = ? WHERE id = ?").bind(at.getTime(), Date.now(), reference.id).run();
      else if (reference.kind === "outbox") await db.prepare("UPDATE crm_transactional_outbox SET status = 'pending', attempts = attempts + 1, next_attempt_at = ?, available_at = ?, updated_at = ? WHERE id = ?").bind(at.getTime(), at.getTime(), Date.now(), reference.id).run();
      else await db.prepare("UPDATE crm_webhook_inbox SET status = 'received', attempts = attempts + 1, next_attempt_at = ?, updated_at = ? WHERE id = ?").bind(at.getTime(), Date.now(), reference.id).run();
      console.warn("Durable work rescheduled", { kind: reference.kind, id: reference.id, reason });
    },
  };
}

export { workProcessor };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Preserve Vinext's image security/optimization fallback before application routing.
    if (url.pathname === "/_vinext/image" && env.IMAGES) {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES!.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const apiResponse = await routeApiRequest(request, env);
    if (apiResponse) return apiResponse;
    return handler.fetch(request, env, ctx);
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!env.DB || !env.WORK_QUEUE) return;
    const queue = env.WORK_QUEUE;
    const run = async () => {
      const db = database(env);
      await publishPendingOutbox(db, queue);
      await scheduleDueJobs(db, queue, { workerId: `cron:${env.DEPLOYMENT_VERSION ?? "development"}` });
    };
    ctx.waitUntil(run());
  },

  async queue(batch: QueueBatch<OpaqueWorkReference>, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!env.DB) { for (const message of batch.messages) message.retry(); return; }
    const processor = workProcessor(env);
    await Promise.all(batch.messages.map(async (message) => {
      try { const outcome = await consumeWorkReference(env.DB!, processor, message.body); if (outcome === "ack") message.ack(); else message.retry(); }
      catch { message.retry(); }
    }));
  },
};

export default worker;

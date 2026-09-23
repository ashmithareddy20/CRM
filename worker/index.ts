/** Cloudflare Worker entry point. API routing stays separate from Vinext rendering. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { routeApiRequest } from "./api/router";
import { publishPendingOutbox } from "./jobs/outbox";
import { scheduleDueJobs } from "./jobs/scheduler";
import { consumeWorkReference, type WorkProcessor } from "./jobs/consumer";
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
function workProcessor(env: Env): WorkProcessor {
  const db = database(env);
  const lookup = async (reference: OpaqueWorkReference) => {
    if (reference.kind === "outbox") return db.prepare("SELECT tenant_id AS tenantId, created_at AS createdAt, 0 AS attempts FROM crm_transactional_outbox WHERE id = ?").bind(reference.id).first<{ tenantId: string; createdAt: number; attempts: number }>();
    if (reference.kind === "job") return db.prepare("SELECT tenant_id AS tenantId, created_at AS createdAt, attempts FROM crm_durable_jobs WHERE id = ?").bind(reference.id).first<{ tenantId: string; createdAt: number; attempts: number }>();
    return db.prepare("SELECT tenant_id AS tenantId, received_at AS createdAt, 0 AS attempts FROM crm_webhook_inbox WHERE id = ?").bind(reference.id).first<{ tenantId: string; createdAt: number; attempts: number }>();
  };
  return {
    async process(reference) {
      if (reference.kind === "outbox") await db.prepare("UPDATE crm_transactional_outbox SET status = 'processed', published_at = COALESCE(published_at, ?) WHERE id = ? AND status IN ('published', 'pending')").bind(Date.now(), reference.id).run();
      else if (reference.kind === "job") await db.prepare("UPDATE crm_durable_jobs SET state = 'completed', lease_expires_at = NULL, updated_at = ? WHERE id = ? AND state = 'leased'").bind(Date.now(), reference.id).run();
      else await db.prepare("UPDATE crm_webhook_inbox SET status = 'processed', updated_at = ? WHERE id = ? AND status = 'received'").bind(Date.now(), reference.id).run();
    },
    async tenantFor(reference) { return (await lookup(reference))?.tenantId; },
    async createdAt(reference) { const row = await lookup(reference); return row ? new Date(row.createdAt) : undefined; },
    async attempts(reference) { return (await lookup(reference))?.attempts ?? 0; },
    async reschedule(reference, at, reason) {
      if (reference.kind === "job") await db.prepare("UPDATE crm_durable_jobs SET state = 'pending', due_at = ?, lease_expires_at = NULL, updated_at = ? WHERE id = ?").bind(at.getTime(), Date.now(), reference.id).run();
      else if (reference.kind === "outbox") await db.prepare("UPDATE crm_transactional_outbox SET status = 'pending', available_at = ?, updated_at = ? WHERE id = ?").bind(at.getTime(), Date.now(), reference.id).run();
      else await db.prepare("UPDATE crm_webhook_inbox SET status = 'received', updated_at = ? WHERE id = ?").bind(Date.now(), reference.id).run();
      console.warn("Durable work rescheduled", { kind: reference.kind, id: reference.id, reason });
    },
  };
}

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

    const origin = request.headers.get("Origin");
    const allowedOrigin = origin || "*";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key, If-Match, X-Request-Id, X-CSRF-Token",
          ...(origin ? { "Access-Control-Allow-Credentials": "true" } : {}),
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin",
        },
      });
    }

    const apiResponse = await routeApiRequest(request, env);
    if (apiResponse) {
      const headers = new Headers(apiResponse.headers);
      headers.set("Access-Control-Allow-Origin", allowedOrigin);
      headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key, If-Match, X-Request-Id, X-CSRF-Token");
      if (origin) {
        headers.set("Access-Control-Allow-Credentials", "true");
      }
      headers.set("Vary", "Origin");
      return new Response(apiResponse.body, {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        headers,
      });
    }
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
    for (const message of batch.messages) {
      ctx.waitUntil(consumeWorkReference(env.DB, processor, message.body).then((outcome) => {
        if (outcome === "ack") message.ack(); else message.retry();
      }).catch(() => message.retry()));
    }
  },
};

export default worker;

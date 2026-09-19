import { ApiError, errorResponse, methodNotAllowed } from "./errors";
import type { Env } from "../env";
import { ProviderRegistry, type ProviderEnvironment } from "../providers/registry";

const MAX_WEBHOOK_BYTES = 256 * 1024;
const DEFAULT_REPLAY_WINDOW_MS = 5 * 60_000;

function base64Url(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, ""); }
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index++) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}
async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
}

export interface WebhookHandlerOptions {
  readonly registry: ProviderRegistry;
  readonly environment: ProviderEnvironment;
  readonly now?: () => Date;
  readonly maxBodyBytes?: number;
  readonly replayWindowMs?: number;
  /** Encrypts raw provider payloads before durable storage. Required outside tests. */
  /** Inbox ID is provided so ciphertext AAD is bound to the persisted record. */
  readonly sealPayload: (rawPayload: string, inboxId: string) => Promise<string>;
  readonly enqueue?: (reference: { kind: "inbox"; id: string }) => Promise<void>;
}

/**
 * Verifies the exact raw bytes before parsing, stores a deduplicated inbox row,
 * then acknowledges. Webhook payload tenant fields are deliberately ignored.
 */
export async function handleProviderWebhook(request: Request, env: Env, options: WebhookHandlerOptions): Promise<Response> {
  const requestId = request.headers.get("X-Request-Id")?.slice(0, 128) || crypto.randomUUID();
  try {
    if (request.method !== "POST") return methodNotAllowed(requestId, ["POST"]);
    if (!env.DB) throw new ApiError("SERVICE_UNAVAILABLE", 503, "Database binding is unavailable");
    const parts = new URL(request.url).pathname.split("/").filter(Boolean);
    const [api, version, webhooks, provider, integrationId] = parts;
    if (api !== "api" || version !== "v1" || webhooks !== "webhooks" || !provider || !integrationId || parts.length !== 5) throw new ApiError("NOT_FOUND", 404, "Webhook route not found");
    const configured = options.registry.resolveIntegration(integrationId, options.environment);
    if (!configured || configured.registration.provider !== provider) throw new ApiError("NOT_FOUND", 404, "Webhook route not found");
    const timestamp = request.headers.get("X-Provider-Timestamp");
    const signature = request.headers.get("X-Provider-Signature");
    if (!timestamp || !signature || !/^\d{10,16}$/.test(timestamp)) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Webhook signature is invalid");
    const timestampMs = Number(timestamp.length === 10 ? `${timestamp}000` : timestamp);
    const now = options.now?.() ?? new Date();
    if (!Number.isSafeInteger(timestampMs) || Math.abs(now.getTime() - timestampMs) > (options.replayWindowMs ?? DEFAULT_REPLAY_WINDOW_MS)) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Webhook timestamp is outside the accepted window");
    const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
    if (declaredLength > (options.maxBodyBytes ?? MAX_WEBHOOK_BYTES)) throw new ApiError("INVALID_REQUEST", 413, "Webhook body is too large");
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > (options.maxBodyBytes ?? MAX_WEBHOOK_BYTES)) throw new ApiError("INVALID_REQUEST", 413, "Webhook body is too large");
    const raw = new TextDecoder().decode(bytes);
    const signed = `${timestamp}.${raw}`;
    const signatureValue = signature.replace(/^sha256=/i, "");
    const signatureMatches = await Promise.all(configured.registration.webhookSecrets.map(async (secret) => timingSafeEqual(await hmac(secret, signed), signatureValue)));
    if (!signatureMatches.some(Boolean)) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Webhook signature is invalid");
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { throw new ApiError("INVALID_REQUEST", 400, "Webhook body must be JSON"); }
    const event = configured.adapter.parseWebhook(payload);
    if (Number.isNaN(event.occurredAt.getTime()) || !event.eventId || event.eventId.length > 200) throw new ApiError("INVALID_REQUEST", 422, "Webhook event is invalid");
    const inboxId = crypto.randomUUID();
    const sealedPayload = await options.sealPayload(raw, inboxId);
    const inserted = await env.DB.prepare(`INSERT OR IGNORE INTO crm_webhook_inbox
      (id, tenant_id, provider, integration_id, provider_event_id, payload_ciphertext, received_at, status, created_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'received', ?, 1)`).bind(inboxId, configured.registration.tenantId, provider, integrationId, event.eventId, sealedPayload, now.getTime(), now.getTime()).run();
    if (inserted.meta.changes === 1 && options.enqueue) await options.enqueue({ kind: "inbox", id: inboxId });
    return Response.json({ success: true, data: { accepted: true, duplicate: inserted.meta.changes === 0 }, meta: { requestId } }, { status: 202, headers: { "X-Request-Id": requestId } });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

/** Test helper and integration documentation reference; production secrets stay in bindings. */
export async function createWebhookSignature(secret: string, timestampMs: number, rawBody: string): Promise<string> { return hmac(secret, `${timestampMs}.${rawBody}`); }

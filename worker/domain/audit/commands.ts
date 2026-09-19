import { base64UrlEncode, cryptoBytes, utf8 } from "../../security/encoding";
import type { ActorContext } from "../../api/context";
import type { SecurityConfigSource } from "../../security/config";

export interface AuditCommand { action: string; resourceType: string; resourceId?: string; requestId: string; reason?: string; before?: Record<string, unknown>; after?: Record<string, unknown>; evidenceId?: string }
function redacted(value: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/(phone|email|name|remark|note|statement|cipher|token|secret)/iu.test(key)));
}
async function digest(value: string, env: SecurityConfigSource): Promise<string> {
  if (!env.AUDIT_ANCHOR_KEY) throw new Error("Audit anchor key is required");
  const key = await crypto.subtle.importKey("raw", cryptoBytes(Uint8Array.from(atob(env.AUDIT_ANCHOR_KEY.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - env.AUDIT_ANCHOR_KEY.length % 4) % 4)), (character) => character.charCodeAt(0))), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64UrlEncode(new Uint8Array(await crypto.subtle.sign("HMAC", key, cryptoBytes(utf8(value)))));
}
export async function appendAuditEvent(db: D1Database, actor: ActorContext, event: AuditCommand, env: SecurityConfigSource, now = new Date()): Promise<{ id: string; anchor: string }> {
  if (!event.action || !event.resourceType || !event.requestId) throw new Error("Audit event requires action, resource type, and request ID");
  const id = crypto.randomUUID(); const occurredAt = now.getTime();
  const detail = { reason: event.reason, before: redacted(event.before), after: redacted(event.after), evidenceId: event.evidenceId };
  const anchor = await digest(JSON.stringify({ id, tenantId: actor.tenantId, actor: actor.membershipId, action: event.action, resourceType: event.resourceType, resourceId: event.resourceId, requestId: event.requestId, occurredAt, detail }), env);
  await db.prepare("INSERT INTO crm_audit_events (id, tenant_id, actor_key, action, resource_type, resource_id, request_id, occurred_at, detail_ciphertext) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, actor.tenantId, actor.membershipId, event.action, event.resourceType, event.resourceId ?? null, event.requestId, occurredAt, JSON.stringify({ ...detail, anchor })).run();
  return { id, anchor };
}

import { base64UrlEncode, cryptoBytes, utf8 } from "../../security/encoding";
import type { ActorContext } from "../../api/context";
import type { SecurityConfigSource } from "../../security/config";

export interface AuditCommand { action: string; resourceType: string; resourceId?: string; requestId: string; reason?: string; before?: Record<string, unknown>; after?: Record<string, unknown>; evidenceId?: string }
export interface AuditAnchorStore { append(anchor: { eventId: string; tenantId: string; digest: string; previousDigest?: string; occurredAt: Date }): Promise<void>; }
const allowedFields = new Set(["status", "stage", "version", "assignedMembershipId", "branchId", "teamId", "roleId", "permission", "consentState", "channel", "purpose", "amountMinor", "currency", "reasonCode", "policyVersion", "templateVersion", "integrationId", "exportType", "expiresAt"]);
function details(value: Record<string, unknown> | undefined): Record<string, string | number | boolean | null> | undefined {
  if (!value) return undefined;
  return Object.fromEntries(Object.entries(value).filter(([key, entry]) => allowedFields.has(key) && (entry === null || ["string", "number", "boolean"].includes(typeof entry)))) as Record<string, string | number | boolean | null>;
}
async function digest(value: string, env: SecurityConfigSource): Promise<string> {
  if (!env.AUDIT_ANCHOR_KEY) throw new Error("Audit anchor key is required");
  const key = await crypto.subtle.importKey("raw", cryptoBytes(Uint8Array.from(atob(env.AUDIT_ANCHOR_KEY.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - env.AUDIT_ANCHOR_KEY.length % 4) % 4)), (character) => character.charCodeAt(0))), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64UrlEncode(new Uint8Array(await crypto.subtle.sign("HMAC", key, cryptoBytes(utf8(value)))));
}
async function previousAnchor(db: D1Database, tenantId: string): Promise<string | undefined> {
  const row = await db.prepare("SELECT detail_ciphertext FROM crm_audit_events WHERE tenant_id = ? ORDER BY occurred_at DESC LIMIT 1").bind(tenantId).first<{ detail_ciphertext?: string }>();
  try { const parsed = row?.detail_ciphertext ? JSON.parse(row.detail_ciphertext) as { anchor?: string } : undefined; return parsed?.anchor; } catch { return undefined; }
}
/** Appends allow-listed operational metadata only. PHI/free text/ciphertext is never copied into audit detail. */
export async function appendAuditEvent(db: D1Database, actor: ActorContext, event: AuditCommand, env: SecurityConfigSource, now = new Date(), anchors?: AuditAnchorStore): Promise<{ id: string; anchor: string }> {
  if (!event.action || !event.resourceType || !event.requestId) throw new Error("Audit event requires action, resource type, and request ID");
  const id = crypto.randomUUID(); const occurredAt = now.getTime(); const previousDigest = await previousAnchor(db, actor.tenantId);
  const reasonCode = event.reason && /^[a-z0-9_.-]{1,80}$/u.test(event.reason) ? event.reason : undefined;
  const detail = { ...(reasonCode ? { reasonCode } : {}), ...(details(event.before) ? { before: details(event.before) } : {}), ...(details(event.after) ? { after: details(event.after) } : {}), ...(event.evidenceId ? { evidenceId: event.evidenceId } : {}) };
  const anchor = await digest(JSON.stringify({ id, tenantId: actor.tenantId, actor: actor.membershipId, action: event.action, resourceType: event.resourceType, resourceId: event.resourceId, requestId: event.requestId, occurredAt, previousDigest, detail }), env);
  await db.prepare("INSERT INTO crm_audit_events (id, tenant_id, actor_key, action, resource_type, resource_id, request_id, occurred_at, detail_ciphertext, created_at, created_by_membership_id, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)")
    .bind(id, actor.tenantId, actor.membershipId, event.action, event.resourceType, event.resourceId ?? null, event.requestId, occurredAt, JSON.stringify({ ...detail, anchor, ...(previousDigest ? { previousDigest } : {}) }), occurredAt, actor.membershipId).run();
  if (anchors) await anchors.append({ eventId: id, tenantId: actor.tenantId, digest: anchor, ...(previousDigest ? { previousDigest } : {}), occurredAt: now });
  return { id, anchor };
}

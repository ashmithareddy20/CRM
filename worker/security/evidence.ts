export interface PrivateObjectStore { head(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>; put(key: string, value: ReadableStream | ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>; get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>; delete(key: string): Promise<void>; }
export interface EvidenceAccess { tenantId: string; evidenceId: string; objectKey: string; expiresAt: Date; authorized: boolean; }
export interface EvidenceRecord { id: string; tenantId: string; objectKey: string; status: "pending" | "clean" | "rejected"; classification: string; leadId?: string; createdByMembershipId?: string; }
export interface EvidenceRepository { get(tenantId: string, evidenceId: string): Promise<EvidenceRecord | undefined>; create(record: EvidenceRecord): Promise<void>; }
const supportedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "audio/mpeg", "audio/wav"]);
export function evidenceObjectKey(tenantId: string, evidenceId: string): string { return `tenants/${tenantId}/evidence/${evidenceId}`; }
export function validateEvidenceUpload(input: { mediaType: string; size: number; scanStatus: "clean" | "pending" | "rejected"; recordingConsent?: boolean }): void {
  if (!supportedTypes.has(input.mediaType) || input.size < 1 || input.size > 25 * 1024 * 1024) throw new Error("Evidence upload type or size is not permitted");
  if (input.scanStatus !== "clean") throw new Error("Evidence upload is unavailable until malware scanning passes");
  if (input.mediaType.startsWith("audio/") && !input.recordingConsent) throw new Error("Recording consent is required");
}
/** Verify referenced evidence belongs to the tenant, exists and cleared scanning before irreversible commands. */
export async function requireEvidenceOwnership(repository: EvidenceRepository, tenantId: string, evidenceId: string, options: { classification?: string; leadId?: string } = {}): Promise<EvidenceRecord> {
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(evidenceId)) throw new Error("Evidence is required");
  const evidence = await repository.get(tenantId, evidenceId);
  if (!evidence || evidence.tenantId !== tenantId || evidence.status !== "clean" || (options.classification && evidence.classification !== options.classification) || (options.leadId && evidence.leadId !== options.leadId)) throw new Error("Evidence is unavailable");
  return evidence;
}
export async function registerPrivateUpload(input: { store: PrivateObjectStore; repository: EvidenceRepository; tenantId: string; createdByMembershipId: string; mediaType: string; size: number; scanStatus: "clean" | "pending" | "rejected"; classification: string; leadId?: string; recordingConsent?: boolean; body: ReadableStream | ArrayBuffer | string }): Promise<EvidenceRecord> {
  validateEvidenceUpload(input); const id = crypto.randomUUID(); const objectKey = evidenceObjectKey(input.tenantId, id);
  await input.store.put(objectKey, input.body, { httpMetadata: { contentType: input.mediaType }, customMetadata: { tenantId: input.tenantId, evidenceId: id, classification: input.classification } });
  const record: EvidenceRecord = { id, tenantId: input.tenantId, objectKey, status: "clean", classification: input.classification, ...(input.leadId ? { leadId: input.leadId } : {}), createdByMembershipId: input.createdByMembershipId };
  await input.repository.create(record); return record;
}
/** A Worker proxy verifies authorization, repository ownership, and expiry on every download. */
export async function privateEvidenceResponse(store: PrivateObjectStore, repository: EvidenceRepository, access: EvidenceAccess, now?: Date): Promise<Response>;
/** @deprecated Supply an EvidenceRepository to enforce ownership/existence checks. */
export async function privateEvidenceResponse(store: PrivateObjectStore, access: EvidenceAccess, now?: Date): Promise<Response>;
export async function privateEvidenceResponse(store: PrivateObjectStore, repositoryOrAccess: EvidenceRepository | EvidenceAccess, accessOrNow?: EvidenceAccess | Date, suppliedNow = new Date()): Promise<Response> {
  const hasRepository = typeof (repositoryOrAccess as EvidenceRepository).get === "function";
  const repository = hasRepository ? repositoryOrAccess as EvidenceRepository : undefined;
  const access = (hasRepository ? accessOrNow : repositoryOrAccess) as EvidenceAccess;
  const now = hasRepository ? suppliedNow : (accessOrNow instanceof Date ? accessOrNow : suppliedNow);
  const evidence = repository ? await repository.get(access.tenantId, access.evidenceId) : undefined;
  if (!access.authorized || access.expiresAt <= now || (repository && (!evidence || evidence.status !== "clean" || access.objectKey !== evidence.objectKey)) || access.objectKey !== evidenceObjectKey(access.tenantId, access.evidenceId)) return new Response("Not found", { status: 404 });
  const object = await store.get(access.objectKey); if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" } });
}

/** D1 metadata registry enforces tenant ownership before any private object is returned. */
export class D1EvidenceMetadataRegistry implements EvidenceRepository {
  constructor(private readonly db: D1Database) {}
  async get(tenantId: string, evidenceId: string): Promise<EvidenceRecord | undefined> {
    const row = await this.db.prepare(`SELECT id, tenant_id AS tenantId, lead_id AS leadId, object_key AS objectKey, status, classification, created_by_membership_id AS createdByMembershipId FROM crm_evidence_assets WHERE tenant_id = ? AND id = ?`).bind(tenantId, evidenceId).first<Record<string, unknown>>();
    if (!row) return undefined;
    return { id: String(row.id), tenantId: String(row.tenantId), objectKey: String(row.objectKey), status: row.status === "approved" || row.status === "clean" ? "clean" : row.status === "rejected" ? "rejected" : "pending", classification: String(row.classification), ...(row.leadId ? { leadId: String(row.leadId) } : {}), ...(row.createdByMembershipId ? { createdByMembershipId: String(row.createdByMembershipId) } : {}) };
  }
  async create(record: EvidenceRecord): Promise<void> {
    await this.db.prepare(`INSERT INTO crm_evidence_assets (id, tenant_id, lead_id, object_key, sha256, media_type, classification, status) VALUES (?, ?, ?, ?, '', 'application/octet-stream', ?, ?)`)
      .bind(record.id, record.tenantId, record.leadId ?? null, record.objectKey, record.classification, record.status).run();
  }
}
/** Hides authorization/ownership differences but always returns a no-store private response. */
export async function privateEvidenceResponseFor(registry: EvidenceRepository, store: PrivateObjectStore, input: { tenantId: string; evidenceId: string; requestedLeadId?: string; permitted: boolean; expiresAt: Date }, now = new Date()): Promise<Response> {
  if (!input.permitted) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store, private" } });
  const record = await registry.get(input.tenantId, input.evidenceId);
  if (!record || (input.requestedLeadId && record.leadId !== input.requestedLeadId)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store, private" } });
  return privateEvidenceResponse(store, registry, { tenantId: input.tenantId, evidenceId: input.evidenceId, objectKey: record.objectKey, expiresAt: input.expiresAt, authorized: true }, now);
}

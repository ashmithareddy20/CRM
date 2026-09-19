export interface PrivateObjectStore { head(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>; put(key: string, value: ReadableStream | ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>; get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>; delete(key: string): Promise<void>; }
export interface EvidenceAccess { tenantId: string; evidenceId: string; objectKey: string; expiresAt: Date; authorized: boolean; }
const supportedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "audio/mpeg", "audio/wav"]);
export function evidenceObjectKey(tenantId: string, evidenceId: string): string { return `tenants/${tenantId}/evidence/${evidenceId}`; }
export function validateEvidenceUpload(input: { mediaType: string; size: number; scanStatus: "clean" | "pending" | "rejected"; recordingConsent?: boolean }): void {
  if (!supportedTypes.has(input.mediaType) || input.size < 1 || input.size > 25 * 1024 * 1024) throw new Error("Evidence upload type or size is not permitted");
  if (input.scanStatus !== "clean") throw new Error("Evidence upload is unavailable until malware scanning passes");
  if (input.mediaType.startsWith("audio/") && !input.recordingConsent) throw new Error("Recording consent is required");
}
/** A Worker proxy verifies authorization on every access rather than exposing a reusable R2 URL. */
export async function privateEvidenceResponse(store: PrivateObjectStore, access: EvidenceAccess, now = new Date()): Promise<Response> {
  if (!access.authorized || access.expiresAt.getTime() <= now.getTime() || access.objectKey !== evidenceObjectKey(access.tenantId, access.evidenceId)) return new Response("Not found", { status: 404 });
  const object = await store.get(access.objectKey); if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" } });
}

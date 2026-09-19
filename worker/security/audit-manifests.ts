import { base64UrlEncode, cryptoBytes, utf8 } from "./encoding";
export interface AuditAnchorManifest { version: 1; day: string; previousDigest?: string; eventAnchors: readonly { eventId: string; anchor: string }[]; createdAt: string; digest: string; }
export interface AuditAnchorManifestStore { put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>; get?(key: string): Promise<{ text(): Promise<string> } | null>; }
export function auditAnchorManifestKey(day: string): string { if (!/^\d{4}-\d{2}-\d{2}$/u.test(day)) throw new Error("Invalid audit manifest day"); return `audit-anchors/${day}.json`; }
async function sha256(value: string): Promise<string> { return base64UrlEncode(new Uint8Array(await crypto.subtle.digest("SHA-256", cryptoBytes(utf8(value))))); }
/** Stores a tamper-evident anchor set outside D1; the caller persists only opaque IDs/anchors. */
export async function persistAuditAnchorManifest(store: AuditAnchorManifestStore, input: Omit<AuditAnchorManifest, "version" | "digest">): Promise<AuditAnchorManifest> {
  const unsigned = { version: 1 as const, ...input }; const manifest = { ...unsigned, digest: await sha256(JSON.stringify(unsigned)) };
  await store.put(auditAnchorManifestKey(manifest.day), JSON.stringify(manifest), { httpMetadata: { contentType: "application/json" } }); return manifest;
}
export async function verifyAuditAnchorManifest(manifest: AuditAnchorManifest): Promise<boolean> { const { digest, ...unsigned } = manifest; return digest === await sha256(JSON.stringify(unsigned)); }

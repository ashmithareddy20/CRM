import { describe, expect, it } from "vitest";
import { validateEvidenceUpload, privateEvidenceResponse, evidenceObjectKey } from "../../../worker/security/evidence";
import { processDeletionRequest, requirePatientDataPolicy, replaySuppressionsBeforeJobs } from "../../../worker/security/retention";
import { structuredLog } from "../../../worker/observability/logging";
import { metric } from "../../../worker/observability/metrics";
import { verifyIsolatedRestore } from "../../../worker/jobs/backup-verification";
import { base64UrlEncode } from "../../../worker/security/encoding";

const key = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
const policy = { id: "retention-v1", dataClass: "lead" as const, jurisdiction: "IN", retentionDays: 365, deletionAction: "anonymize" as const, reviewedAt: new Date(), reviewedBy: "privacy-officer", productionApproved: true };

describe("operational privacy controls", () => {
  it("fails closed for unreviewed production patient policy", async () => {
    await expect(requirePatientDataPolicy({ get: async () => ({ ...policy, productionApproved: false }) }, { tenantId: "t", environment: "production" })).rejects.toThrow("reviewed production");
    await expect(requirePatientDataPolicy({ get: async () => policy }, { tenantId: "t", environment: "production" })).resolves.toEqual(policy);
  });

  it("honors legal holds and supports dry-run/resumable deletion", async () => {
    const request = { id: "delete-1", tenantId: "t", requestedBy: "admin", target: { subjectId: "contact-1", dataClasses: ["lead" as const] }, dryRun: false, environment: "production" };
    const deps = { registry: { get: async () => policy }, executor: { execute: async () => ({ processed: 1, erased: 0, anonymized: 1, skipped: 0, complete: false, cursor: "next" }), tombstone: async () => undefined } };
    const held = await processDeletionRequest({ request, ...deps, holds: { activeFor: async () => [{ id: "hold", tenantId: "t", subjectId: "contact-1", reason: "case", active: true, createdAt: new Date() }] } });
    expect(held.status).toBe("blocked_legal_hold");
    const resumed = await processDeletionRequest({ request, ...deps, holds: { activeFor: async () => [] } });
    expect(resumed).toMatchObject({ status: "running", cursor: "next", anonymized: 1 });
    const planned = await processDeletionRequest({ request: { ...request, dryRun: true }, ...deps, holds: { activeFor: async () => [] } });
    expect(planned.status).toBe("planned");
  });

  it("proxies evidence only while the authorization window is valid", async () => {
    validateEvidenceUpload({ mediaType: "application/pdf", size: 10, scanStatus: "clean" });
    expect(() => validateEvidenceUpload({ mediaType: "audio/mpeg", size: 10, scanStatus: "clean" })).toThrow("Recording consent");
    const store = { head: async () => null, put: async () => undefined, delete: async () => undefined, get: async () => ({ body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("safe")); controller.close(); } }), httpMetadata: { contentType: "application/pdf" } }) };
    const response = await privateEvidenceResponse(store, { tenantId: "t", evidenceId: "e", objectKey: evidenceObjectKey("t", "e"), authorized: true, expiresAt: new Date("2026-01-02") }, new Date("2026-01-01"));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect((await privateEvidenceResponse(store, { tenantId: "t", evidenceId: "e", objectKey: "other", authorized: true, expiresAt: new Date("2026-01-02") }, new Date("2026-01-01"))).status).toBe(404);
  });

  it("redacts logs and rejects identifier metric dimensions", () => {
    const log = structuredLog({ level: "error", event: "provider.failed", detail: { phone: "+15551234567", attempt: 2 } });
    expect(log).not.toContain("15551234567"); expect(log).toContain("[redacted]");
    const dimensions: Record<string, string>[] = []; metric({ increment: (_n, _v, d) => dimensions.push(d ?? {}), observe() {} }, "http_requests", 1, { route: "api", phone: "+15551234567" });
    expect(dimensions[0]).toEqual({ route: "api" });
  });

  it("verifies isolated restore before replaying suppression", async () => {
    const replayed: string[] = [];
    const result = await verifyIsolatedRestore({ manifest: { version: 1, createdAt: "2026-01-01T00:00:00Z", environment: "staging", database: { exportKey: "db.sqlite", sha256: "a".repeat(64) }, objects: [{ key: "asset", sha256: "b".repeat(64), size: 1 }], config: { schemaVersion: "forward-v1", configDigest: "config" }, keys: { algorithm: "AES-GCM", activeVersion: "v1", versions: ["v1"], generatedAt: "2026-01-01T00:00:00Z" } }, env: { FIELD_ENCRYPTION_ACTIVE_VERSION: "v1", FIELD_ENCRYPTION_KEYS: JSON.stringify({ v1: key }) }, restoreDatabase: async () => undefined, restoreObject: async () => undefined, suppressions: [{ subjectId: "contact", purpose: "marketing", withdrawnAt: new Date() }], replaySuppression: async (entry) => { replayed.push(entry.subjectId); } });
    expect(result.restoredObjects).toBe(1); expect(replayed).toEqual(["contact"]);
  });

  it("replays suppressions in chronological order", async () => {
    const values: string[] = [];
    await replaySuppressionsBeforeJobs([{ subjectId: "late", purpose: "x", withdrawnAt: new Date(2) }, { subjectId: "early", purpose: "x", withdrawnAt: new Date(1) }], async (entry) => { values.push(entry.subjectId); });
    expect(values).toEqual(["early", "late"]);
  });
});

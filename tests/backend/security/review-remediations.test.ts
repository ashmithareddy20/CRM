import { describe, expect, it } from "vitest";
import { base64UrlEncode } from "../../../worker/security/encoding";
import { assertCsrf, createCsrfCookie, createSessionCookie, readSessionCookie } from "../../../worker/auth/session";
import { beginOidcAuthorization, exchangeOidcCallback, type OidcTransaction, type OidcTransactionStore } from "../../../worker/auth/flow";
import { localTestActor } from "../../../worker/auth/authenticate";
import { oidcConfig } from "../../../worker/security/config";
import { requireEvidenceOwnership, registerPrivateUpload, type EvidenceRecord, type EvidenceRepository, type PrivateObjectStore } from "../../../worker/security/evidence";
import { requireIngestionAllowed } from "../../../worker/security/ingestion";

const sessionKey = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
const session = { id: "session-1", tenantId: "tenant-1", membershipId: "member-1", subject: "subject-1", issuedAt: new Date("2026-01-01T00:00:00Z"), expiresAt: new Date("2026-01-01T01:00:00Z") };
const env = { SESSION_SIGNING_KEY: sessionKey, AUDIT_ANCHOR_KEY: base64UrlEncode(crypto.getRandomValues(new Uint8Array(32))) };

class Transactions implements OidcTransactionStore {
  row?: OidcTransaction;
  async put(transaction: OidcTransaction) { this.row = transaction; }
  async take(state: string, now: Date) { const row = this.row; this.row = undefined; return row?.state === state && row.expiresAt > now ? row : undefined; }
}
class EvidenceMemory implements PrivateObjectStore {
  objects = new Map<string, { body: string; type?: string }>();
  async head(key: string) { const item = this.objects.get(key); return item ? { size: item.body.length, httpMetadata: { contentType: item.type } } : null; }
  async put(key: string, value: ReadableStream | ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string } }) { this.objects.set(key, { body: typeof value === "string" ? value : "binary", type: options?.httpMetadata?.contentType }); }
  async get(key: string) { const item = this.objects.get(key); return item ? { body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(item.body)); controller.close(); } }), httpMetadata: { contentType: item.type } } : null; }
  async delete(key: string) { this.objects.delete(key); }
}

describe("security review remediations", () => {
  it("uses distinct session signing material and session-bound signed CSRF", async () => {
    await expect(createSessionCookie(session, { AUDIT_ANCHOR_KEY: env.AUDIT_ANCHOR_KEY }, false)).rejects.toThrow("Session signing key");
    const sessionCookie = await createSessionCookie(session, env, false); const csrf = await createCsrfCookie(session, env, false);
    const request = new Request("http://crm.test", { headers: { Cookie: `${sessionCookie}; ${csrf.cookie}`, "X-CSRF-Token": csrf.token } });
    await expect(assertCsrf(request, session, env, new Date("2026-01-01T00:30:00Z"))).resolves.toBeUndefined();
    await expect(assertCsrf(request, { ...session, id: "different" }, env)).rejects.toThrow("CSRF token");
    expect(await readSessionCookie(request, env, new Date("2026-01-01T00:30:00Z"))).toMatchObject({ id: "session-1" });
  });

  it("requires a test-only secret as well as test mode", () => {
    const request = new Request("https://crm.test", { headers: { "X-Test-Identity": "user:tenant:member", "X-Test-Identity-Secret": "correct" } });
    expect(localTestActor(request, { DEPLOYMENT_ENV: "test", ALLOW_TEST_IDENTITY: "true" })).toBeUndefined();
    expect(localTestActor(request, { DEPLOYMENT_ENV: "test", ALLOW_TEST_IDENTITY: "true", TEST_IDENTITY_SECRET: "wrong" })).toBeUndefined();
    expect(localTestActor(request, { DEPLOYMENT_ENV: "test", ALLOW_TEST_IDENTITY: "true", TEST_IDENTITY_SECRET: "correct" })?.subject).toBe("user");
  });

  it("creates one-time OIDC state plus PKCE and refuses non-HTTPS endpoints", async () => {
    const store = new Transactions(); const config = { OIDC_ISSUER: "https://issuer.test", OIDC_AUDIENCE: "crm", OIDC_ALLOWED_ALGORITHMS: "RS256", OIDC_AUTHORIZATION_ENDPOINT: "https://issuer.test/authorize", OIDC_TOKEN_ENDPOINT: "https://issuer.test/token", OIDC_CLIENT_ID: "crm-web", OIDC_REDIRECT_URI: "https://crm.test/api/v1/auth/callback" };
    const start = await beginOidcAuthorization(config, store, new Date("2026-01-01T00:00:00Z")); const url = new URL(start.authorizationUrl);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256"); expect(url.searchParams.get("state")).toBe(start.transaction.state);
    await expect(exchangeOidcCallback({ code: "code", state: start.transaction.state, env: config, store, fetcher: async () => new Response(JSON.stringify({ id_token: "token" })), now: new Date("2026-01-01T00:01:00Z") })).resolves.toMatchObject({ idToken: "token", transaction: { nonce: expect.any(String) } });
    expect(() => oidcConfig({ ...config, OIDC_JWKS_URL: "http://issuer.test/keys" })).toThrow("HTTPS");
  });

  it("checks evidence ownership and fails closed patient-data ingestion", async () => {
    const memory = new EvidenceMemory(); const recordsMap = new Map<string, EvidenceRecord>(); const records = { get: async (_tenant: string, id: string) => recordsMap.get(id), create: async (record: EvidenceRecord) => { recordsMap.set(record.id, record); } }; const record = await registerPrivateUpload({ store: memory, repository: records, tenantId: "tenant-1", createdByMembershipId: "member-1", mediaType: "application/pdf", size: 10, scanStatus: "clean", classification: "consultation", body: "evidence" });
    await expect(requireEvidenceOwnership(records, "tenant-1", record.id, { classification: "consultation" })).resolves.toMatchObject({ id: record.id });
    await expect(requireEvidenceOwnership(records, "tenant-2", record.id)).rejects.toThrow("Evidence is unavailable");
    await expect(requireIngestionAllowed({ DEPLOYMENT_ENV: "production", PATIENT_DATA_INGESTION: "blocked_until_policy_review" }, undefined, { tenantId: "tenant-1", source: "manual", containsPatientData: true })).rejects.toThrow("blocked");
    await expect(requireIngestionAllowed({ DEPLOYMENT_ENV: "test" }, undefined, { tenantId: "tenant-1", source: "manual", containsPatientData: true, synthetic: true })).resolves.toBeUndefined();
  });
});

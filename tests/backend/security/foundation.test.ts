import { describe, expect, it } from "vitest";
import { blindIndex, decryptField, encryptField } from "../../../worker/security/field-crypto";
import { base64UrlEncode, cryptoBytes, utf8 } from "../../../worker/security/encoding";
import { corsHeaders, corsPreflight } from "../../../worker/security/cors";
import { localTestActor } from "../../../worker/auth/authenticate";
import { capabilitiesFor, canReadField, requireCapability } from "../../../worker/security/permissions";
import { createSessionCookie, readSessionCookie } from "../../../worker/auth/session";
import { verifyOidcJwt } from "../../../worker/auth/oidc";

const key = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
const env = { DEPLOYMENT_ENV: "test", FIELD_ENCRYPTION_KEYS: JSON.stringify({ v1: key, v2: base64UrlEncode(crypto.getRandomValues(new Uint8Array(32))) }), FIELD_ENCRYPTION_ACTIVE_VERSION: "v1", BLIND_INDEX_KEY: key, AUDIT_ANCHOR_KEY: key, SESSION_SIGNING_KEY: key };

describe("security foundation", () => {
  it("encrypts with record/purpose AAD and supports versioned keys", async () => {
    const context = { tenantId: "tenant-a", recordId: "contact-a", purpose: "phone" };
    const encrypted = await encryptField("+15551234567", context, env);
    expect(await decryptField(encrypted, context, env)).toBe("+15551234567");
    await expect(decryptField(encrypted, { ...context, tenantId: "tenant-b" }, env)).rejects.toThrow();
    const rotated = await encryptField("next", context, { ...env, FIELD_ENCRYPTION_ACTIVE_VERSION: "v2" });
    expect(await decryptField(rotated, context, env)).toBe("next");
  });

  it("creates tenant-separated stable blind indexes", async () => {
    const a = await blindIndex(" Test@Example.com ", "tenant-a", "email", env);
    expect(a).toBe(await blindIndex("test@example.com", "tenant-a", "email", env));
    expect(a).not.toBe(await blindIndex("test@example.com", "tenant-b", "email", env));
  });

  it("accepts only exact CORS origins and rejects unauthorized preflight", () => {
    const configured = { CORS_ALLOWED_ORIGINS: "https://app.example" };
    const allowed = new Request("https://api.example", { headers: { Origin: "https://app.example" } });
    expect(corsHeaders(allowed, configured).get("Access-Control-Allow-Origin")).toBe("https://app.example");
    const denied = new Request("https://api.example", { method: "OPTIONS", headers: { Origin: "https://evil.example" } });
    expect(corsPreflight(denied, configured)?.status).toBe(403);
  });

  it("limits test identity to the test environment and denies ungranted capabilities", () => {
    const request = new Request("https://api.example", { headers: { "X-Test-Identity": "user:tenant:member", "X-Test-Identity-Secret": "test-secret" } });
    expect(localTestActor(request, { DEPLOYMENT_ENV: "production", ALLOW_TEST_IDENTITY: "true" })).toBeUndefined();
    expect(localTestActor(request, { DEPLOYMENT_ENV: "test", ALLOW_TEST_IDENTITY: "true", TEST_IDENTITY_SECRET: "test-secret" })?.tenantId).toBe("tenant");
    const actor = { subject: "u", tenantId: "t", membershipId: "m", roles: ["tenant_administrator"], authentication: "oidc" as const };
    expect(capabilitiesFor(actor.roles).has("configuration:manage")).toBe(true);
    expect(canReadField(actor, "clinical")).toBe(false);
    expect(() => requireCapability(actor, "field:decrypt")).toThrow("Forbidden");
  });

  it("signs short-lived browser session cookies and rejects tampering", async () => {
    const cookie = await createSessionCookie({ id: "s", tenantId: "t", membershipId: "m", subject: "u", issuedAt: new Date("2026-01-01T00:00:00Z"), expiresAt: new Date("2026-01-01T01:00:00Z") }, env, false);
    const request = new Request("http://api.example", { headers: { Cookie: cookie } });
    expect((await readSessionCookie(request, env, new Date("2026-01-01T00:10:00Z")))?.membershipId).toBe("m");
    const altered = new Request("http://api.example", { headers: { Cookie: cookie.replace("crm_session=", "crm_session=x") } });
    expect(await readSessionCookie(altered, env)).toBeUndefined();
  });

  it("requires exact issuer, audience and allow-listed JWT algorithm", async () => {
    const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
    const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey) as JsonWebKey & { kid?: string; use?: string }; jwk.kid = "key-1"; jwk.use = "sig";
    const encode = (value: unknown) => base64UrlEncode(utf8(JSON.stringify(value)));
    const header = encode({ alg: "RS256", kid: "key-1", typ: "JWT" }); const payload = encode({ iss: "https://issuer.example", sub: "subject", aud: "crm", exp: 2_000_000_000 });
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, cryptoBytes(utf8(`${header}.${payload}`)));
    const token = `${header}.${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
    const options = { OIDC_ISSUER: "https://issuer.example", OIDC_AUDIENCE: "crm", OIDC_ALLOWED_ALGORITHMS: "RS256", OIDC_JWKS_URL: "https://issuer.example/keys" };
    await expect(verifyOidcJwt(token, options, { fetcher: async () => new Response(JSON.stringify({ keys: [jwk] })) })).resolves.toMatchObject({ subject: "subject" });
    await expect(verifyOidcJwt(token, { ...options, OIDC_AUDIENCE: "wrong" }, { fetcher: async () => new Response(JSON.stringify({ keys: [jwk] })) })).rejects.toThrow("JWT claims");
  });
});

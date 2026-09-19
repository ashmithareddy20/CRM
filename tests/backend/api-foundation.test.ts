import { describe, expect, it } from "vitest";
import { routeApiRequest } from "../../worker/api/router";
import type { Env } from "../../worker/env";

const env = { ALLOW_TEST_IDENTITY: "true", TEST_IDENTITY_SECRET: "test-only-secret", DEPLOYMENT_ENV: "test", DEPLOYMENT_VERSION: "test" } as Env;
const actor = { "X-Test-Identity": "test-user:tenant-test:member-test", "X-Test-Identity-Secret": "test-only-secret" };

async function request(path: string, init: RequestInit = {}) {
  return routeApiRequest(new Request(`https://crm.example${path}`, init), env, { requestId: () => "req-test" });
}

describe("v1 API foundation", () => {
  it("returns a public liveness envelope with a request ID", async () => {
    const response = await request("/api/v1/health");
    expect(response?.status).toBe(200);
    expect(response?.headers.get("X-Request-Id")).toBe("req-test");
    expect(await response?.json()).toMatchObject({ success: true, data: { status: "ok", version: "test" } });
  });

  it("denies protected routes without a verified request context", async () => {
    const response = await request("/api/v1/_fixtures/records");
    expect(response?.status).toBe(401);
    expect(await response?.json()).toMatchObject({ success: false, error: { code: "AUTHENTICATION_REQUIRED", requestId: "req-test" } });
  });

  it("validates pagination and returns bounded cursor metadata", async () => {
    const response = await request("/api/v1/_fixtures/records?limit=2", { headers: actor });
    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({
      success: true,
      data: [{ id: "fixture-1", title: "alpha", version: 1 }, { id: "fixture-2", title: "bravo", version: 1 }],
      meta: { limit: 2, nextCursor: "Mg==" },
    });

    const invalid = await request("/api/v1/_fixtures/records?limit=101", { headers: actor });
    expect(invalid?.status).toBe(422);
    expect(await invalid?.json()).toMatchObject({ error: { code: "VALIDATION_FAILED", fields: { limit: expect.any(String) } } });
  });

  it("requires an idempotency key and returns an operation for accepted commands", async () => {
    const missing = await request("/api/v1/_fixtures/records", { method: "POST", headers: actor, body: JSON.stringify({ title: "Example" }) });
    expect(missing?.status).toBe(422);

    const accepted = await request("/api/v1/_fixtures/records", {
      method: "POST",
      headers: { ...actor, "Content-Type": "application/json", "Idempotency-Key": "operation-123" },
      body: JSON.stringify({ title: "Example" }),
    });
    expect(accepted?.status).toBe(202);
    expect(await accepted?.json()).toMatchObject({ success: true, data: { accepted: true, operationId: "fixture:operation-123" } });
  });

  it("returns deterministic method, missing-route, and legacy-contract errors", async () => {
    const method = await request("/api/v1/health", { method: "POST" });
    expect(method?.status).toBe(405);
    expect(method?.headers.get("Allow")).toBe("GET");

    const missing = await request("/api/v1/not-a-route", { headers: actor });
    expect(missing?.status).toBe(404);
    expect(await missing?.json()).toMatchObject({ error: { code: "NOT_FOUND", requestId: "req-test" } });

    const legacy = await request("/api/leads");
    expect(legacy?.status).toBe(410);
    expect(await legacy?.json()).toMatchObject({ error: { code: "LEGACY_CONTRACT_UNSUPPORTED" } });
  });
});

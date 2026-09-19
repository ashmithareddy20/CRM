import { describe, expect, it } from "vitest";
import { routeApiRequest } from "../../worker/api/router";
import type { Env } from "../../worker/env";

const testEnv = {
  DEPLOYMENT_ENV: "test",
  DEPLOYMENT_VERSION: "test",
  ALLOW_TEST_IDENTITY: "true",
} as Env;
const identity = { "X-Test-Identity": "integration-user:tenant-integration:membership-integration" };

function api(path: string, init: RequestInit = {}) {
  return routeApiRequest(new Request(`https://crm.example${path}`, init), testEnv, { requestId: () => "integration-request" });
}

describe("composed API runtime", () => {
  it("does not let legacy or canonical protected routes bypass authentication", async () => {
    const [legacy, lead, reports] = await Promise.all([
      api("/api/leads"),
      api("/api/v1/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }),
      api("/api/v1/reports/funnel"),
    ]);
    expect(legacy?.status).toBe(410);
    expect(lead?.status).toBe(401);
    expect(reports?.status).toBe(401);
  });

  it("reaches the authenticated composition boundary without fabricating a database fallback", async () => {
    const response = await api("/api/v1/leads", {
      method: "POST",
      headers: { ...identity, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response?.status).toBe(503);
    expect(await response?.json()).toMatchObject({ success: false, error: { code: "SERVICE_UNAVAILABLE", requestId: "integration-request" } });
  });

  it("keeps provider ingress outside user-session middleware while failing closed without a configured integration", async () => {
    const response = await api("/api/v1/webhooks/simulated/unconfigured", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Provider-Timestamp": String(Date.now()), "X-Provider-Signature": "invalid" },
      body: JSON.stringify({ eventId: "event-1", type: "delivered" }),
    });
    expect(response?.status).toBe(503); // No D1 binding is acknowledged before any webhook payload is trusted.
  });
});

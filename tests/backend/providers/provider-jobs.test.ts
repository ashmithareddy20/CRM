import { describe, expect, it } from "vitest";
import { createWebhookSignature, handleProviderWebhook } from "../../../worker/api/webhooks";
import { ProviderRegistry } from "../../../worker/providers/registry";
import { SimulatedProviderAdapter } from "../../../worker/providers/simulated";
import { reconcileAmbiguousDelivery } from "../../../worker/jobs/reconcile";
import { retryDelay, retryBudgetExceeded } from "../../../worker/jobs/retry";
import { defaultRetryPolicy } from "../../../worker/jobs/contracts";

const now = new Date("2026-09-19T00:00:00.000Z");
const secret = "test-webhook-secret";

function registry(adapter = new SimulatedProviderAdapter()) {
  return new ProviderRegistry([{ registration: {
    id: "integration-1", tenantId: "tenant-1", environment: "test", provider: "simulated", enabled: true, simulated: true,
    webhookSecretRefs: [{ name: "SIM_SECRET" }], webhookSecrets: [secret],
  }, adapter }]);
}

function database() {
  const rows: unknown[][] = [];
  return {
    rows,
    prepare() { return { bind(...values: unknown[]) { rows.push(values); return { async run() { return { meta: { changes: rows.length === 1 ? 1 : 0 } }; } }; } }; },
  } as unknown as D1Database;
}

async function webhook(registryValue: ProviderRegistry, db: D1Database, body: string, signature: string, timestamp = now.getTime()) {
  return handleProviderWebhook(new Request("https://crm.test/api/v1/webhooks/simulated/integration-1", {
    method: "POST", body, headers: { "X-Provider-Timestamp": String(timestamp), "X-Provider-Signature": signature },
  }), { DB: db } as never, { registry: registryValue, environment: "test", now: () => now, sealPayload: async (raw) => `sealed:${raw}` });
}

describe("provider registry and simulator", () => {
  it("scopes integrations to their tenant and environment", () => {
    const providers = registry();
    expect(providers.resolve("tenant-1", "integration-1", "test")?.registration.webhookSecretRefs).toEqual([{ name: "SIM_SECRET" }]);
    expect(providers.resolve("other-tenant", "integration-1", "test")).toBeUndefined();
  });

  it("reconciles an ambiguous timeout rather than resending", async () => {
    const adapter = new SimulatedProviderAdapter({ outcomeFor: () => "timeout_after_acceptance" });
    const timeout = await adapter.send({ operationId: "op-1", tenantId: "tenant-1", integrationId: "integration-1", channel: "whatsapp", idempotencyKey: "logical-send-1", messageAttemptId: "attempt-1" }).catch((error) => error);
    const result = await reconcileAmbiguousDelivery({ registry: registry(adapter), tenantId: "tenant-1", integrationId: "integration-1", environment: "test", providerMessageId: timeout.providerMessageId });
    expect(result).toMatchObject({ state: "resolved", result: { state: "accepted" } });
  });

  it("has deterministic bounded retry decisions", () => {
    const first = retryDelay(now, 1, "job-1", defaultRetryPolicy);
    const again = retryDelay(now, 1, "job-1", defaultRetryPolicy);
    expect(first.getTime()).toBe(again.getTime());
    expect(retryBudgetExceeded(new Date(now.getTime() - defaultRetryPolicy.maxAgeMs - 1), now, 0, defaultRetryPolicy)).toBe(true);
  });
});

describe("signed webhook ingress", () => {
  it("persists an authenticated raw-body event before acknowledging it", async () => {
    const body = JSON.stringify({ eventId: "event-1", type: "status", occurredAt: now.toISOString(), state: "delivered" });
    const response = await webhook(registry(), database(), body, await createWebhookSignature(secret, now.getTime(), body));
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ success: true, data: { accepted: true, duplicate: false } });
  });

  it("rejects invalid signatures and stale callback timestamps", async () => {
    const body = JSON.stringify({ eventId: "event-2", type: "status" });
    expect((await webhook(registry(), database(), body, "invalid")).status).toBe(401);
    const signature = await createWebhookSignature(secret, now.getTime() - 6 * 60_000, body);
    expect((await webhook(registry(), database(), body, signature, now.getTime() - 6 * 60_000)).status).toBe(401);
  });
});

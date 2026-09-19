import { describe, expect, it, vi } from "vitest";

vi.mock("vinext/server/app-router-entry", () => ({ default: { fetch: vi.fn() } }));
vi.mock("vinext/server/image-optimization", () => ({
  handleImageOptimization: vi.fn(), DEFAULT_DEVICE_SIZES: [], DEFAULT_IMAGE_SIZES: [],
}));

import worker from "../../worker/index";
import type { Env, ExecutionContext, QueueBatch } from "../../worker/env";
import type { OpaqueWorkReference } from "../../worker/jobs/contracts";

function deferredContext() {
  const work: Promise<unknown>[] = [];
  const ctx: ExecutionContext = { waitUntil: (promise) => { work.push(promise); }, passThroughOnException() {} };
  return { ctx, drain: async () => { await Promise.all(work); } };
}

function message(body: OpaqueWorkReference) {
  let acked = 0; let retried = 0;
  return {
    value: { body, ack: () => { acked++; }, retry: () => { retried++; } },
    outcome: () => ({ acked, retried }),
  };
}

describe("Worker durable runtime handlers", () => {
  it("schedules no work without both durable bindings", async () => {
    const runtime = deferredContext();
    await worker.scheduled({ cron: "* * * * *", scheduledTime: Date.now(), noRetry() {} }, {} as Env, runtime.ctx);
    await runtime.drain();
  });

  it("acknowledges an opaque queue reference that is already consumed", async () => {
    const queued = message({ kind: "outbox", id: "already-processed" });
    const db = {
      prepare: () => ({ bind: () => ({ first: async () => undefined }) }),
    } as unknown as D1Database;
    const runtime = deferredContext();
    await worker.queue({ messages: [queued.value] } as unknown as QueueBatch<OpaqueWorkReference>, { DB: db } as Env, runtime.ctx);
    await runtime.drain();
    expect(queued.outcome()).toEqual({ acked: 1, retried: 0 });
  });

  it("retries queue delivery when the D1 binding is unavailable", async () => {
    const queued = message({ kind: "job", id: "job-1" });
    const runtime = deferredContext();
    await worker.queue({ messages: [queued.value] } as unknown as QueueBatch<OpaqueWorkReference>, {} as Env, runtime.ctx);
    await runtime.drain();
    expect(queued.outcome()).toEqual({ acked: 0, retried: 1 });
  });
});

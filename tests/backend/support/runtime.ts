import type { ContextDependencies } from "../../../worker/api/context";
import type { Env, ExecutionContext } from "../../../worker/env";

export const testIdentity = Object.freeze({
  subject: "test-user",
  tenantId: "tenant-test",
  membershipId: "membership-test",
  header: "test-user:tenant-test:membership-test",
});

export function fixedClock(iso = "2026-09-19T00:00:00.000Z"): ContextDependencies {
  const now = new Date(iso);
  return { now: () => new Date(now), requestId: () => "req-test" };
}

export function testEnv(overrides: Partial<Env> = {}): Env {
  return { ALLOW_TEST_IDENTITY: "true", DEPLOYMENT_ENV: "test", DEPLOYMENT_VERSION: "test", ...overrides } as Env;
}

export function authenticatedHeaders(headers: HeadersInit = {}): Headers {
  const result = new Headers(headers);
  result.set("X-Test-Identity", testIdentity.header);
  return result;
}

export const noOpExecutionContext: ExecutionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

/** Invokes Worker Cron exports deterministically without a running dev server. */
export async function invokeScheduled(
  scheduled: (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => Promise<void> | void,
  env: Env,
  scheduledTime = new Date("2026-09-19T00:00:00.000Z").getTime(),
): Promise<void> {
  const event = { cron: "* * * * *", scheduledTime, noRetry() {} } as ScheduledEvent;
  await scheduled(event, env, noOpExecutionContext);
}

/** Invokes a queue consumer with deterministic messages and acknowledgement state. */
export async function invokeQueue<T>(
  consumer: (batch: MessageBatch<T>, env: Env, ctx: ExecutionContext) => Promise<void> | void,
  env: Env,
  bodies: T[],
): Promise<{ acknowledged: T[]; retried: T[] }> {
  const acknowledged: T[] = [];
  const retried: T[] = [];
  const messages = bodies.map((body) => ({
    id: crypto.randomUUID(), body, timestamp: new Date("2026-09-19T00:00:00.000Z"),
    attempts: 1, ack: () => acknowledged.push(body), retry: () => retried.push(body),
  })) as unknown as Message<T>[];
  await consumer({ queue: "test", messages, ackAll: () => bodies.forEach((body) => acknowledged.push(body)), retryAll: () => bodies.forEach((body) => retried.push(body)) } as unknown as MessageBatch<T>, env, noOpExecutionContext);
  return { acknowledged, retried };
}

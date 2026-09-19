import type { OpaqueWorkReference, RetryPolicy } from "./contracts";
import { defaultRetryPolicy } from "./contracts";
import { moveToDeadLetter } from "./dlq";
import { retryBudgetExceeded, retryDelay } from "./retry";

export interface WorkProcessor { process(reference: OpaqueWorkReference): Promise<void>; tenantFor(reference: OpaqueWorkReference): Promise<string | undefined>; createdAt(reference: OpaqueWorkReference): Promise<Date | undefined>; attempts(reference: OpaqueWorkReference): Promise<number>; reschedule(reference: OpaqueWorkReference, at: Date, reason: string): Promise<void>; }

/** Queue failures are converted to D1 reschedules; the queue never contains business payloads. */
export async function consumeWorkReference(db: D1Database, processor: WorkProcessor, reference: OpaqueWorkReference, now = new Date(), policy: RetryPolicy = defaultRetryPolicy): Promise<"ack" | "retry"> {
  try {
    await processor.process(reference);
    return "ack";
  } catch (error) {
    const [tenantId, createdAt, attempts] = await Promise.all([processor.tenantFor(reference), processor.createdAt(reference), processor.attempts(reference)]);
    // Messages can contain provider data; persist only a bounded error class as a diagnostic.
    const reason = error instanceof Error && error.name && error.name !== "Error" ? error.name.slice(0, 80) : "provider_work_failed";
    if (!tenantId || !createdAt || retryBudgetExceeded(createdAt, now, attempts, policy)) {
      if (tenantId) await moveToDeadLetter(db, { tenantId, jobId: reference.kind === "job" ? reference.id : undefined, reason, opaquePayload: JSON.stringify(reference) }, now);
      return "ack";
    }
    await processor.reschedule(reference, retryDelay(now, attempts, reference.id, policy), reason);
    return "ack";
  }
}

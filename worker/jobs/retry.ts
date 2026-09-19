import type { RetryPolicy } from "./contracts";

/** Stable deterministic jitter prevents retry storms while keeping test fixtures reproducible. */
export function retryAt(now: Date, attempt: number, key: string, policy: RetryPolicy): Date {
  const exponential = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** Math.max(0, attempt - 1));
  let hash = 0;
  for (let index = 0; index < key.length; index++) hash = (Math.imul(hash, 31) + key.charCodeAt(index)) | 0;
  const jitter = Math.abs(hash % Math.max(1, Math.floor(exponential * 0.2)));
  return new Date(now.getTime() + exponential + jitter);
}

export function retryDelay(now: Date, attempt: number, key: string, policy: RetryPolicy, retryAfterSeconds?: number): Date {
  const calculated = retryAt(now, attempt, key, policy);
  return retryAfterSeconds ? new Date(Math.max(calculated.getTime(), now.getTime() + retryAfterSeconds * 1000)) : calculated;
}

export function retryBudgetExceeded(createdAt: Date, now: Date, attempts: number, policy: RetryPolicy): boolean {
  return attempts >= policy.maxAttempts || now.getTime() - createdAt.getTime() >= policy.maxAgeMs;
}

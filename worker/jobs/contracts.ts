/** Cloudflare Queue messages deliberately carry no contact, content, or provider credentials. */
export type OpaqueWorkReference =
  | { readonly kind: "outbox"; readonly id: string }
  | { readonly kind: "job"; readonly id: string }
  | { readonly kind: "inbox"; readonly id: string };

export interface WorkQueue { send(message: OpaqueWorkReference): Promise<void>; }
export interface JobPayload { readonly operationId: string; readonly integrationId?: string; readonly provider?: string; readonly [key: string]: string | undefined; }
export interface RetryPolicy { readonly maxAttempts: number; readonly maxAgeMs: number; readonly baseDelayMs: number; readonly maxDelayMs: number; }
export const defaultRetryPolicy: RetryPolicy = { maxAttempts: 8, maxAgeMs: 7 * 24 * 60 * 60 * 1000, baseDelayMs: 30_000, maxDelayMs: 6 * 60 * 60 * 1000 };

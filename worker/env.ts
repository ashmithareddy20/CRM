/** Bindings available to the CRM Worker runtime. */
export interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  /** Development/test-only identity bridge. It must never be enabled in production. */
  ALLOW_TEST_IDENTITY?: string;
  DEPLOYMENT_VERSION?: string;
  DEPLOYMENT_ENV?: string;
  OIDC_ISSUER?: string;
  OIDC_AUDIENCE?: string;
  OIDC_ALLOWED_ALGORITHMS?: string;
  OIDC_JWKS_URL?: string;
  CORS_ALLOWED_ORIGINS?: string;
  /** JSON object of key version to base64url 32-byte AES key. Never store this in D1. */
  FIELD_ENCRYPTION_KEYS?: string;
  FIELD_ENCRYPTION_ACTIVE_VERSION?: string;
  /** base64url HMAC key used for tenant-separated blind indexes. */
  BLIND_INDEX_KEY?: string;
  /** base64url HMAC key for signed sessions and audit anchors. */
  AUDIT_ANCHOR_KEY?: string;
  SESSION_SIGNING_KEY?: string;
  TEST_IDENTITY_SECRET?: string;
  /** Synthetic-only or reviewed production ingestion gate. */
  PATIENT_DATA_INGESTION?: string;
  /** Private JSON integration registry. Entries must be simulated unless a separately reviewed adapter is installed. */
  PROVIDER_INTEGRATIONS_JSON?: string;
  WORK_QUEUE?: { send(message: { kind: string; id: string }): Promise<void> };
  WORK_DLQ?: { send(message: { kind: string; id: string }): Promise<void> };
  EVIDENCE_BUCKET?: R2Bucket;
  BACKUP_BUCKET?: R2Bucket;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export interface ScheduledController {
  scheduledTime: number;
  cron: string;
  noRetry(): void;
}

export interface QueueMessage<T> {
  body: T;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
}

export interface QueueBatch<T> {
  messages: readonly QueueMessage<T>[];
}

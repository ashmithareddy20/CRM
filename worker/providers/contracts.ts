/** Provider-facing identifiers never contain contacts, addresses, or content. */
export type ProviderChannel = "whatsapp" | "rcs" | "mms" | "call" | "lead_form";
export type DeliveryState = "accepted" | "delivery_unknown" | "delivered" | "read" | "failed" | "unsupported";

export interface ProviderCapabilities {
  readonly channels: readonly ProviderChannel[];
  readonly supportsProviderIdempotency: boolean;
  readonly supportsReconciliation: boolean;
  readonly supportsCancellation: boolean;
  readonly supportsDeliveryReceipts: boolean;
  readonly supportsReads: boolean;
  readonly supportsClicks: boolean;
  readonly supportsAttachments: boolean;
}

export interface ProviderDispatchRequest {
  readonly operationId: string;
  readonly tenantId: string;
  readonly integrationId: string;
  readonly channel: Exclude<ProviderChannel, "lead_form">;
  /** A stable logical-send key; must be supplied to idempotent providers. */
  readonly idempotencyKey: string;
  /** Opaque IDs only. Content and destination are loaded inside the adapter. */
  readonly messageAttemptId: string;
}

export interface ProviderDispatchResult {
  readonly state: DeliveryState;
  readonly providerMessageId?: string;
  readonly retryAfterSeconds?: number;
  readonly diagnosticCode?: string;
}

export interface ProviderReconciliationResult {
  readonly state: DeliveryState;
  readonly providerMessageId: string;
  readonly diagnosticCode?: string;
}

export interface ProviderWebhookEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly type: "status" | "reply" | "opt_out" | "call" | "lead_form";
  /** Provider IDs only. The normalized handler resolves any domain records. */
  readonly externalId?: string;
  readonly state?: DeliveryState;
  readonly opaquePayload: Record<string, unknown>;
}

export interface ChannelProviderAdapter {
  readonly provider: string;
  readonly capabilities: ProviderCapabilities;
  send(request: ProviderDispatchRequest): Promise<ProviderDispatchResult>;
  reconcile(input: { tenantId: string; integrationId: string; providerMessageId: string }): Promise<ProviderReconciliationResult | undefined>;
  cancel?(input: { tenantId: string; integrationId: string; providerMessageId: string }): Promise<boolean>;
  parseWebhook(payload: unknown): ProviderWebhookEvent;
}

export interface LeadFormProviderAdapter {
  readonly provider: string;
  readonly capabilities: ProviderCapabilities;
  parseWebhook(payload: unknown): ProviderWebhookEvent;
}

export type ProviderAdapter = ChannelProviderAdapter | LeadFormProviderAdapter;

export function isChannelAdapter(adapter: ProviderAdapter): adapter is ChannelProviderAdapter {
  return "send" in adapter && "reconcile" in adapter;
}

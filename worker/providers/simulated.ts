import type { ChannelProviderAdapter, DeliveryState, ProviderCapabilities, ProviderDispatchRequest, ProviderDispatchResult, ProviderReconciliationResult, ProviderWebhookEvent } from "./contracts";

export type SimulationOutcome = "accepted" | "timeout_after_acceptance" | "rate_limited" | "temporary_failure" | "permanent_failure" | "unsupported";
export interface SimulatedProviderOptions {
  readonly outcomeFor?: (request: ProviderDispatchRequest) => SimulationOutcome;
  readonly latencyMs?: number;
  readonly channels?: readonly ProviderCapabilities["channels"][number][];
}

function stableId(input: string): string {
  // This is an opaque deterministic simulator identifier, not a cryptographic digest.
  let value = 2166136261;
  for (let index = 0; index < input.length; index++) value = Math.imul(value ^ input.charCodeAt(index), 16777619);
  return `sim_${(value >>> 0).toString(36)}`;
}

export class SimulatedProviderAdapter implements ChannelProviderAdapter {
  readonly provider = "simulated";
  readonly capabilities: ProviderCapabilities;
  private readonly state = new Map<string, DeliveryState>();

  constructor(private readonly options: SimulatedProviderOptions = {}) {
    this.capabilities = {
      channels: options.channels ?? ["whatsapp", "rcs", "mms", "call", "lead_form"],
      supportsProviderIdempotency: true, supportsReconciliation: true, supportsCancellation: true,
      supportsDeliveryReceipts: true, supportsReads: true, supportsClicks: true, supportsAttachments: true,
    };
  }

  async send(request: ProviderDispatchRequest): Promise<ProviderDispatchResult> {
    if (!this.capabilities.channels.includes(request.channel)) return { state: "unsupported", diagnosticCode: "SIMULATED_CHANNEL_UNSUPPORTED" };
    if (this.options.latencyMs) await new Promise((resolve) => setTimeout(resolve, this.options.latencyMs));
    const providerMessageId = stableId(`${request.integrationId}:${request.idempotencyKey}`);
    const outcome = this.options.outcomeFor?.(request) ?? "accepted";
    if (outcome === "rate_limited") return { state: "delivery_unknown", retryAfterSeconds: 60, diagnosticCode: "SIMULATED_RATE_LIMIT" };
    if (outcome === "temporary_failure") return { state: "delivery_unknown", diagnosticCode: "SIMULATED_TEMPORARY_FAILURE" };
    if (outcome === "permanent_failure") return { state: "failed", diagnosticCode: "SIMULATED_PERMANENT_FAILURE" };
    if (outcome === "unsupported") return { state: "unsupported", diagnosticCode: "SIMULATED_CHANNEL_UNSUPPORTED" };
    this.state.set(providerMessageId, outcome === "timeout_after_acceptance" ? "accepted" : "accepted");
    if (outcome === "timeout_after_acceptance") throw new SimulatedTimeoutAfterAcceptance(providerMessageId);
    return { state: "accepted", providerMessageId };
  }

  async reconcile(input: { tenantId: string; integrationId: string; providerMessageId: string }): Promise<ProviderReconciliationResult | undefined> {
    const state = this.state.get(input.providerMessageId);
    return state ? { state, providerMessageId: input.providerMessageId } : undefined;
  }

  async cancel(input: { tenantId: string; integrationId: string; providerMessageId: string }): Promise<boolean> {
    if (!this.state.has(input.providerMessageId)) return false;
    this.state.set(input.providerMessageId, "failed");
    return true;
  }

  parseWebhook(payload: unknown): ProviderWebhookEvent {
    if (!payload || typeof payload !== "object") throw new Error("Webhook payload must be an object");
    const event = payload as Record<string, unknown>;
    if (typeof event.eventId !== "string" || typeof event.type !== "string") throw new Error("Webhook eventId and type are required");
    return { eventId: event.eventId, type: event.type as ProviderWebhookEvent["type"], occurredAt: new Date(typeof event.occurredAt === "string" ? event.occurredAt : Date.now()), ...(typeof event.externalId === "string" ? { externalId: event.externalId } : {}), ...(typeof event.state === "string" ? { state: event.state as DeliveryState } : {}), opaquePayload: event };
  }
}

export class SimulatedTimeoutAfterAcceptance extends Error {
  constructor(readonly providerMessageId: string) { super("Simulated provider timed out after accepting delivery"); }
}

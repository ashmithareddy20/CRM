import { isChannelAdapter, type ChannelProviderAdapter, type ProviderReconciliationResult } from "../providers/contracts";
import { type ProviderEnvironment, ProviderRegistry } from "../providers/registry";

export type ReconciliationOutcome =
  | { state: "resolved"; result: ProviderReconciliationResult }
  | { state: "manual_resolution_required"; reason: string };

/** Ambiguous delivery is reconciled before any retry or alternate-channel decision. */
export async function reconcileAmbiguousDelivery(input: {
  registry: ProviderRegistry;
  tenantId: string;
  integrationId: string;
  environment: ProviderEnvironment;
  providerMessageId?: string;
}): Promise<ReconciliationOutcome> {
  const configured = input.registry.resolve(input.tenantId, input.integrationId, input.environment);
  if (!configured || !isChannelAdapter(configured.adapter)) return { state: "manual_resolution_required", reason: "provider_not_configured" };
  const adapter: ChannelProviderAdapter = configured.adapter;
  if (!adapter.capabilities.supportsReconciliation || !input.providerMessageId) return { state: "manual_resolution_required", reason: "provider_cannot_reconcile_delivery" };
  const result = await adapter.reconcile({ tenantId: input.tenantId, integrationId: input.integrationId, providerMessageId: input.providerMessageId });
  return result ? { state: "resolved", result } : { state: "manual_resolution_required", reason: "provider_has_no_delivery_record" };
}

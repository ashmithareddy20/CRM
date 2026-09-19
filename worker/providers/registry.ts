import type { ProviderAdapter } from "./contracts";

export type ProviderEnvironment = "development" | "staging" | "production" | "test";

/** Values are kept in bindings/secret managers; this value is safe to return to an administrator. */
export interface SecretReference { readonly name: string; readonly version?: string; }
export interface IntegrationRegistration {
  readonly id: string;
  readonly tenantId: string;
  readonly environment: ProviderEnvironment;
  readonly provider: string;
  readonly enabled: boolean;
  readonly simulated: boolean;
  readonly webhookSecretRefs: readonly SecretReference[];
  /** Resolved only in Worker memory, never serialized in API responses. */
  readonly webhookSecrets: readonly string[];
}

export class ProviderRegistry {
  private readonly entries = new Map<string, { registration: IntegrationRegistration; adapter: ProviderAdapter }>();

  constructor(entries: readonly { registration: IntegrationRegistration; adapter: ProviderAdapter }[] = []) {
    for (const entry of entries) this.register(entry.registration, entry.adapter);
  }

  register(registration: IntegrationRegistration, adapter: ProviderAdapter): void {
    if (registration.provider !== adapter.provider) throw new Error("Provider registration does not match adapter");
    this.entries.set(this.key(registration.tenantId, registration.id, registration.environment), { registration, adapter });
  }

  resolve(tenantId: string, integrationId: string, environment: ProviderEnvironment): { registration: IntegrationRegistration; adapter: ProviderAdapter } | undefined {
    const result = this.entries.get(this.key(tenantId, integrationId, environment));
    return result?.registration.enabled ? result : undefined;
  }

  /** Webhook URLs authenticate to a configured integration, never a tenant supplied in payload. */
  resolveIntegration(integrationId: string, environment: ProviderEnvironment): { registration: IntegrationRegistration; adapter: ProviderAdapter } | undefined {
    const matches = [...this.entries.values()].filter((entry) => entry.registration.id === integrationId && entry.registration.environment === environment && entry.registration.enabled);
    if (matches.length !== 1) return undefined;
    return matches[0];
  }

  private key(tenantId: string, integrationId: string, environment: ProviderEnvironment): string {
    return `${environment}:${tenantId}:${integrationId}`;
  }
}

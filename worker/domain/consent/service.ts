import { ApiError } from "../../api/errors";
import { capabilitiesFor } from "../../security/permissions";

export type ConsentChannel = "whatsapp" | "rcs" | "mms" | "call";
export type ConsentState = "granted" | "withdrawn" | "denied" | "unknown";
export interface ConsentActorContext { tenantId: string; actorMembershipId: string; roles: readonly string[]; capabilities?: ReadonlySet<string>; now: Date; }
export interface ConsentEvent { id: string; tenantId: string; contactId: string; purpose: string; channel?: ConsentChannel; state: ConsentState; occurredAt: Date; expiresAt?: Date; evidenceId?: string; actorMembershipId: string; }
export interface Suppression { id: string; tenantId: string; contactId: string; channel?: ConsentChannel; reason: string; active: boolean; occurredAt: Date; evidenceId: string; actorMembershipId: string; }
export interface EvidenceOwnershipVerifier { verifyOwnedEvidence(input: { tenantId: string; evidenceId: string; actorMembershipId: string; contactId: string }): Promise<boolean>; }
export interface ConsentRepository {
  append(event: ConsentEvent): Promise<void>;
  listEvents(tenantId: string, contactId: string, purpose: string, channel: ConsentChannel): Promise<ConsentEvent[]>;
  addSuppression(suppression: Suppression): Promise<void>;
  listSuppressions(tenantId: string, contactId: string, channel: ConsentChannel): Promise<Suppression[]>;
}
export interface ConsentDecision { allowed: boolean; reason?: "suppressed" | "withdrawn" | "denied" | "unknown" | "expired"; }
const id = () => crypto.randomUUID();
const mayManageConsent = (roles: readonly string[]) => roles.includes("tenant_administrator") || roles.includes("manager") || roles.includes("agent") || roles.includes("integration_principal");

/** Append-only consent ledger. The newest applicable event wins; active DNC still always wins. */
export class ConsentService {
  constructor(private readonly repository: ConsentRepository, private readonly evidence: EvidenceOwnershipVerifier = { verifyOwnedEvidence: async () => false }) {}

  async record(context: ConsentActorContext, input: Omit<ConsentEvent, "id" | "tenantId" | "actorMembershipId">): Promise<ConsentEvent> {
    this.requireManager(context);
    if (input.state === "granted") await this.requireEvidence(context, input.contactId, input.evidenceId);
    if (input.expiresAt && input.expiresAt <= input.occurredAt) throw new ApiError("VALIDATION_FAILED", 422, "Consent expiry must be later than capture time", { expiresAt: "Must be later than occurredAt" });
    const event = { ...input, id: id(), tenantId: context.tenantId, actorMembershipId: context.actorMembershipId };
    await this.repository.append(event); return event;
  }
  async suppress(context: ConsentActorContext, input: Omit<Suppression, "id" | "tenantId" | "actorMembershipId" | "active">): Promise<Suppression> {
    this.requireManager(context); await this.requireEvidence(context, input.contactId, input.evidenceId);
    const suppression = { ...input, id: id(), tenantId: context.tenantId, actorMembershipId: context.actorMembershipId, active: true };
    await this.repository.addSuppression(suppression); return suppression;
  }
  /** DNC removal is an auditable counter-event, not a mutable delete. */
  async deactivateSuppression(context: ConsentActorContext, input: Omit<Suppression, "id" | "tenantId" | "actorMembershipId" | "active">): Promise<Suppression> {
    this.requireManager(context); await this.requireEvidence(context, input.contactId, input.evidenceId);
    const deactivation = { ...input, id: id(), tenantId: context.tenantId, actorMembershipId: context.actorMembershipId, active: false, reason: `deactivated:${input.reason}` };
    await this.repository.addSuppression(deactivation); return deactivation;
  }
  async evaluate(tenantId: string, contactId: string, purpose: string, channel: ConsentChannel, now: Date): Promise<ConsentDecision> {
    const suppressions = (await this.repository.listSuppressions(tenantId, contactId, channel)).filter((item) => item.occurredAt <= now);
    // Deactivation applies only to the same scope. A global release cannot silently clear a channel-specific DNC.
    const globalSuppression = suppressions.filter((item) => !item.channel).sort(orderNewest)[0];
    const channelSuppression = suppressions.filter((item) => item.channel === channel).sort(orderNewest)[0];
    if (globalSuppression?.active || channelSuppression?.active) return { allowed: false, reason: "suppressed" };
    const events = (await this.repository.listEvents(tenantId, contactId, purpose, channel)).filter((event) => event.occurredAt <= now).sort(orderNewest);
    const latest = events[0];
    if (!latest || latest.state === "unknown") return { allowed: false, reason: "unknown" };
    if (latest.state === "withdrawn" || latest.state === "denied") return { allowed: false, reason: latest.state };
    if (latest.expiresAt && latest.expiresAt <= now) return { allowed: false, reason: "expired" };
    return { allowed: true };
  }
  private requireManager(context: ConsentActorContext) {
    const capabilities = context.capabilities ?? capabilitiesFor(context.roles);
    if (!mayManageConsent(context.roles) || !["lead:write:assigned", "configuration:manage", "integration:ingest"].some((capability) => capabilities.has(capability))) throw new ApiError("FORBIDDEN", 403, "Consent management permission is required");
  }
  private async requireEvidence(context: ConsentActorContext, contactId: string, evidenceId?: string) { if (!evidenceId) throw new ApiError("VALIDATION_FAILED", 422, "Consent evidence is required", { evidenceId: "Required" }); if (!await this.evidence.verifyOwnedEvidence({ tenantId: context.tenantId, evidenceId, actorMembershipId: context.actorMembershipId, contactId })) throw new ApiError("FORBIDDEN", 403, "Consent evidence is unavailable"); }
}
function orderNewest<T extends { occurredAt: Date; id: string }>(a: T, b: T) { return b.occurredAt.getTime() - a.occurredAt.getTime() || b.id.localeCompare(a.id); }
export class MemoryConsentRepository implements ConsentRepository {
  readonly events: ConsentEvent[] = []; readonly suppressions: Suppression[] = [];
  async append(event: ConsentEvent) { this.events.push(event); } async addSuppression(suppression: Suppression) { this.suppressions.push(suppression); }
  async listEvents(tenantId: string, contactId: string, purpose: string, channel: ConsentChannel) { return this.events.filter((event) => event.tenantId === tenantId && event.contactId === contactId && event.purpose === purpose && (!event.channel || event.channel === channel)); }
  async listSuppressions(tenantId: string, contactId: string, channel: ConsentChannel) { return this.suppressions.filter((item) => item.tenantId === tenantId && item.contactId === contactId && (!item.channel || item.channel === channel)); }
}

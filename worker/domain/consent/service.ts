import { ApiError } from "../../api/errors";

export type ConsentChannel = "whatsapp" | "rcs" | "mms" | "call";
export type ConsentState = "granted" | "withdrawn" | "denied" | "unknown";
export interface ConsentEvent { id: string; tenantId: string; contactId: string; purpose: string; channel?: ConsentChannel; state: ConsentState; occurredAt: Date; expiresAt?: Date; evidenceId?: string; actorMembershipId?: string; }
export interface Suppression { id: string; tenantId: string; contactId: string; channel?: ConsentChannel; reason: string; active: boolean; occurredAt: Date; }
export interface ConsentRepository {
  append(event: ConsentEvent): Promise<void>;
  listEvents(tenantId: string, contactId: string, purpose: string, channel: ConsentChannel): Promise<ConsentEvent[]>;
  addSuppression(suppression: Suppression): Promise<void>;
  listSuppressions(tenantId: string, contactId: string, channel: ConsentChannel): Promise<Suppression[]>;
}
export interface ConsentDecision { allowed: boolean; reason?: "suppressed" | "withdrawn" | "denied" | "unknown" | "expired"; }
const id = () => crypto.randomUUID();

/** The ledger is append-only: a later grant never deletes the withdrawal evidence. */
export class ConsentService {
  constructor(private readonly repository: ConsentRepository) {}

  async record(input: Omit<ConsentEvent, "id">): Promise<ConsentEvent> {
    if (input.state === "granted" && !input.evidenceId) throw new ApiError("VALIDATION_FAILED", 422, "Consent evidence is required for an opt-in", { evidenceId: "Required for granted consent" });
    if (input.expiresAt && input.expiresAt <= input.occurredAt) throw new ApiError("VALIDATION_FAILED", 422, "Consent expiry must be later than capture time", { expiresAt: "Must be later than occurredAt" });
    const event = { ...input, id: id() };
    await this.repository.append(event);
    return event;
  }

  async suppress(input: Omit<Suppression, "id">): Promise<Suppression> {
    const suppression = { ...input, id: id() };
    await this.repository.addSuppression(suppression);
    return suppression;
  }

  /** Suppression wins first, then any channel/global withdrawal or denial. Unknown is never opt-in. */
  async evaluate(tenantId: string, contactId: string, purpose: string, channel: ConsentChannel, now: Date): Promise<ConsentDecision> {
    const suppressions = await this.repository.listSuppressions(tenantId, contactId, channel);
    if (suppressions.some((item) => item.active && item.occurredAt <= now)) return { allowed: false, reason: "suppressed" };
    const events = (await this.repository.listEvents(tenantId, contactId, purpose, channel))
      .filter((event) => event.occurredAt <= now)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    const restrictive = events.find((event) => event.state === "withdrawn" || event.state === "denied");
    if (restrictive) return { allowed: false, reason: restrictive.state === "withdrawn" ? "withdrawn" : "denied" };
    const grant = events.find((event) => event.state === "granted");
    if (!grant) return { allowed: false, reason: "unknown" };
    if (grant.expiresAt && grant.expiresAt <= now) return { allowed: false, reason: "expired" };
    return { allowed: true };
  }
}

/** Small deterministic repository for isolated service tests and simulation fixtures. */
export class MemoryConsentRepository implements ConsentRepository {
  readonly events: ConsentEvent[] = [];
  readonly suppressions: Suppression[] = [];
  async append(event: ConsentEvent) { this.events.push(event); }
  async addSuppression(suppression: Suppression) { this.suppressions.push(suppression); }
  async listEvents(tenantId: string, contactId: string, purpose: string, channel: ConsentChannel) {
    return this.events.filter((event) => event.tenantId === tenantId && event.contactId === contactId && event.purpose === purpose && (!event.channel || event.channel === channel));
  }
  async listSuppressions(tenantId: string, contactId: string, channel: ConsentChannel) {
    return this.suppressions.filter((item) => item.tenantId === tenantId && item.contactId === contactId && (!item.channel || item.channel === channel));
  }
}

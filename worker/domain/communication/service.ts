import { ApiError } from "../../api/errors";
import type { ConsentChannel, ConsentService } from "../consent/service";
import type { TemplateVersion } from "../content/service";
import { SimulatedTimeoutAfterAcceptance } from "../../providers/simulated";
import type { ChannelProviderAdapter, DeliveryState } from "../../providers/contracts";

export type MessageChannel = Exclude<ConsentChannel, "call">;
export type MessageStatus = "planned" | "accepted" | "sent" | "delivered" | "failed" | "read" | "replied" | "clicked" | "delivery_unknown" | "cancelled" | "blocked";
export type RequestedChannel = MessageChannel | "rich";
export interface DispatchGate { tenantId: string; contactId: string; activeTouchId?: string; reservedUntil?: Date; lastAcceptedAt?: Date; version: number; }
export interface MessageAttempt { id: string; tenantId: string; touchId?: string; journeyId?: string; contactId: string; channel: MessageChannel; requestedChannel: RequestedChannel; fallbackReason?: string; purpose: string; templateVersionId?: string; acceptedContentHash?: string; provider?: string; providerMessageId?: string; status: MessageStatus; acceptedAt?: Date; createdAt: Date; }
export interface MessageEvent { id: string; tenantId: string; attemptId: string; providerEventId: string; type: MessageStatus; occurredAt: Date; }
export interface DispatchRepository {
  getGate(tenantId: string, contactId: string): Promise<DispatchGate | undefined>;
  /** CAS reservation prevents concurrent lead episodes / manual sends from passing together. */
  reserveGate(input: { tenantId: string; contactId: string; touchId: string; now: Date; reservedUntil: Date; expectedVersion?: number }): Promise<DispatchGate | undefined>;
  releaseGate(tenantId: string, contactId: string, touchId: string, now: Date, acceptedAt?: Date): Promise<void>;
  latestAccepted(tenantId: string, contactId: string): Promise<MessageAttempt | undefined>;
  hasContentHash(tenantId: string, contactId: string, hash: string, since: Date): Promise<boolean>;
  /** Restrict channel alternation to the current journey; cadence itself remains contact-wide. */
  acceptedHistory?(tenantId: string, contactId: string, journeyId?: string): Promise<readonly MessageAttempt[]>;
  createAttempt(attempt: MessageAttempt): Promise<void>;
  getAttempt(tenantId: string, attemptId: string): Promise<MessageAttempt | undefined>;
  updateAttempt(attempt: MessageAttempt): Promise<void>;
  appendEvent(event: MessageEvent): Promise<boolean>;
  pauseRoutineTouches(tenantId: string, contactId: string, reason: "reply" | "booking" | "conversion" | "consent_loss" | "invalid_contact"): Promise<void>;
}
export interface DispatchInput { tenantId: string; contactId: string; touchId: string; journeyId?: string; purpose: string; requestedChannel: RequestedChannel; /** A rich slot may use this only after cadence has elapsed and no RCS/MMS capability exists. */ singleChannelFallback?: { channel: "whatsapp"; reason: string }; templateVersion: TemplateVersion; integrationId: string; provider: ChannelProviderAdapter; now: Date; operationId: string; }
export interface DispatchResult { attempt: MessageAttempt; state: "accepted" | "blocked" | "manual_resolution_required"; reason?: string; }
export const MIN_OUTBOUND_INTERVAL_MS = 48 * 60 * 60 * 1000;
export const CONTENT_REPETITION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const id = () => crypto.randomUUID();

export function resolveRichChannel(provider: ChannelProviderAdapter): MessageChannel | undefined {
  if (provider.capabilities.channels.includes("rcs")) return "rcs";
  if (provider.capabilities.channels.includes("mms")) return "mms";
  return undefined;
}

/** Contact-scoped policy gate. Calls are deliberately outside this outbound-message cadence service. */
export class CommunicationService {
  constructor(private readonly repository: DispatchRepository, private readonly consents: ConsentService, private readonly minimumIntervalMs = MIN_OUTBOUND_INTERVAL_MS, private readonly contentRepetitionWindowMs = CONTENT_REPETITION_WINDOW_MS) {}

  async dispatch(input: DispatchInput): Promise<DispatchResult> {
    const richChannel = input.requestedChannel === "rich" ? resolveRichChannel(input.provider) : undefined;
    const fallback = input.requestedChannel === "rich" && !richChannel ? input.singleChannelFallback : undefined;
    const channel = input.requestedChannel === "rich" ? richChannel ?? fallback?.channel : input.requestedChannel;
    if (!channel) return this.blocked(input, "rich_channel_unavailable");
    if (!input.templateVersion.approvedAt) return this.blocked(input, "template_not_approved", channel);
    const consent = await this.consents.evaluate(input.tenantId, input.contactId, input.purpose, channel, input.now);
    if (!consent.allowed) { await this.repository.pauseRoutineTouches(input.tenantId, input.contactId, "consent_loss"); return this.blocked(input, `consent_${consent.reason}`, channel); }
    const gate = await this.repository.getGate(input.tenantId, input.contactId);
    const lastAcceptedAt = gate?.lastAcceptedAt ?? (await this.repository.latestAccepted(input.tenantId, input.contactId))?.acceptedAt;
    if (lastAcceptedAt && input.now.getTime() - lastAcceptedAt.getTime() < this.minimumIntervalMs) return this.blocked(input, "minimum_48_hours", channel);
    if (await this.repository.hasContentHash(input.tenantId, input.contactId, input.templateVersion.contentHash, new Date(input.now.getTime() - this.contentRepetitionWindowMs))) return this.blocked(input, "content_repetition", channel);
    const latestAccepted = await this.repository.latestAccepted(input.tenantId, input.contactId);
    const acceptedHistory: readonly MessageAttempt[] = this.repository.acceptedHistory
      ? await this.repository.acceptedHistory(input.tenantId, input.contactId, input.journeyId)
      : latestAccepted ? [latestAccepted] : [];
    const lastChannel = [...acceptedHistory].sort((a, b) => (b.acceptedAt?.getTime() ?? 0) - (a.acceptedAt?.getTime() ?? 0))[0]?.channel;
    // A documented fallback is the sole exception to alternation; cadence and consent were checked above.
    if (!fallback && lastChannel === channel) return this.blocked(input, "channel_not_alternating", channel);
    if (gate?.activeTouchId && gate.activeTouchId !== input.touchId && (!gate.reservedUntil || gate.reservedUntil > input.now)) return this.blocked(input, "contact_gate_reserved", channel);
    const reservation = await this.repository.reserveGate({ tenantId: input.tenantId, contactId: input.contactId, touchId: input.touchId, now: input.now, reservedUntil: new Date(input.now.getTime() + 5 * 60_000), expectedVersion: gate?.version });
    if (!reservation) return this.blocked(input, "contact_gate_race", channel);
    // State can change while queued. Always re-evaluate immediately before provider dispatch.
    const immediate = await this.consents.evaluate(input.tenantId, input.contactId, input.purpose, channel, input.now);
    if (!immediate.allowed) { await this.repository.releaseGate(input.tenantId, input.contactId, input.touchId, input.now); await this.repository.pauseRoutineTouches(input.tenantId, input.contactId, "consent_loss"); return this.blocked(input, `consent_${immediate.reason}`, channel); }
    const attempt: MessageAttempt = { id: id(), tenantId: input.tenantId, touchId: input.touchId, ...(input.journeyId ? { journeyId: input.journeyId } : {}), contactId: input.contactId, channel, requestedChannel: input.requestedChannel, ...(fallback ? { fallbackReason: fallback.reason } : {}), purpose: input.purpose, templateVersionId: input.templateVersion.id, acceptedContentHash: input.templateVersion.contentHash, provider: input.provider.provider, status: "planned", createdAt: input.now };
    await this.repository.createAttempt(attempt);
    try {
      const sent = await input.provider.send({ operationId: input.operationId, tenantId: input.tenantId, integrationId: input.integrationId, channel, idempotencyKey: `message:${attempt.id}`, messageAttemptId: attempt.id });
      if (sent.state === "accepted") {
        attempt.status = "accepted"; attempt.acceptedAt = input.now; attempt.providerMessageId = sent.providerMessageId;
        await this.repository.updateAttempt(attempt); await this.repository.releaseGate(input.tenantId, input.contactId, input.touchId, input.now, input.now);
        return { attempt, state: "accepted" };
      }
      attempt.status = sent.state === "delivery_unknown" ? "delivery_unknown" : "failed"; attempt.providerMessageId = sent.providerMessageId;
      await this.repository.updateAttempt(attempt); await this.repository.releaseGate(input.tenantId, input.contactId, input.touchId, input.now);
      // Ambiguous delivery never changes channel or retries automatically; reconciliation/manual review owns it.
      return { attempt, state: sent.state === "delivery_unknown" ? "manual_resolution_required" : "blocked", reason: sent.diagnosticCode ?? sent.state };
    } catch (error) {
      attempt.status = "delivery_unknown";
      if (error instanceof SimulatedTimeoutAfterAcceptance) attempt.providerMessageId = error.providerMessageId;
      await this.repository.updateAttempt(attempt); await this.repository.releaseGate(input.tenantId, input.contactId, input.touchId, input.now);
      return { attempt, state: "manual_resolution_required", reason: "provider_response_ambiguous" };
    }
  }

  async recordEvent(input: Omit<MessageEvent, "id">): Promise<boolean> {
    const inserted = await this.repository.appendEvent({ ...input, id: id() });
    if (!inserted) return false;
    const attempt = await this.repository.getAttempt(input.tenantId, input.attemptId);
    if (attempt && shouldAdvanceStatus(attempt.status, input.type)) { attempt.status = input.type; await this.repository.updateAttempt(attempt); }
    return true;
  }
  async reconcileAttempt(input: { tenantId: string; attemptId: string; integrationId: string; provider: ChannelProviderAdapter }): Promise<"resolved" | "manual_resolution_required"> {
    const attempt = await this.repository.getAttempt(input.tenantId, input.attemptId);
    if (!attempt || attempt.status !== "delivery_unknown" || !attempt.providerMessageId || !input.provider.capabilities.supportsReconciliation) return "manual_resolution_required";
    const result = await input.provider.reconcile({ tenantId: input.tenantId, integrationId: input.integrationId, providerMessageId: attempt.providerMessageId });
    if (!result) return "manual_resolution_required";
    const next = receiptStatus(result.state);
    if (next === "accepted" && attempt.status === "delivery_unknown") attempt.status = next;
    else if (shouldAdvanceStatus(attempt.status, next)) attempt.status = next;
    attempt.providerMessageId = result.providerMessageId;
    if (result.state === "accepted") attempt.acceptedAt ??= new Date();
    await this.repository.updateAttempt(attempt); return "resolved";
  }
  async pause(tenantId: string, contactId: string, reason: "reply" | "booking" | "conversion" | "consent_loss" | "invalid_contact") { await this.repository.pauseRoutineTouches(tenantId, contactId, reason); }
  async pauseForAttempt(tenantId: string, attemptId: string, reason: "reply" | "booking" | "conversion" | "consent_loss" | "invalid_contact") { const attempt = await this.repository.getAttempt(tenantId, attemptId); if (attempt) await this.pause(tenantId, attempt.contactId, reason); }
  private async blocked(input: DispatchInput, reason: string, channel: MessageChannel = input.requestedChannel === "rich" ? "rcs" : input.requestedChannel): Promise<DispatchResult> {
    const attempt: MessageAttempt = { id: id(), tenantId: input.tenantId, touchId: input.touchId, ...(input.journeyId ? { journeyId: input.journeyId } : {}), contactId: input.contactId, channel, requestedChannel: input.requestedChannel, ...(input.singleChannelFallback ? { fallbackReason: input.singleChannelFallback.reason } : {}), purpose: input.purpose, templateVersionId: input.templateVersion.id, acceptedContentHash: input.templateVersion.contentHash, provider: input.provider.provider, status: "blocked", createdAt: input.now };
    await this.repository.createAttempt(attempt); return { attempt, state: "blocked", reason };
  }
}

export class MemoryDispatchRepository implements DispatchRepository {
  readonly gates = new Map<string, DispatchGate>(); readonly attempts: MessageAttempt[] = []; readonly events: MessageEvent[] = []; readonly pauses: string[] = [];
  private key(tenantId: string, contactId: string) { return `${tenantId}:${contactId}`; }
  async getGate(tenantId: string, contactId: string) { return this.gates.get(this.key(tenantId, contactId)); }
  async reserveGate(input: { tenantId: string; contactId: string; touchId: string; now: Date; reservedUntil: Date; expectedVersion?: number }) { const current = await this.getGate(input.tenantId, input.contactId); if (current && input.expectedVersion !== current.version) return undefined; const next = { tenantId: input.tenantId, contactId: input.contactId, activeTouchId: input.touchId, reservedUntil: input.reservedUntil, lastAcceptedAt: current?.lastAcceptedAt, version: (current?.version ?? 0) + 1 }; this.gates.set(this.key(input.tenantId, input.contactId), next); return next; }
  async releaseGate(tenantId: string, contactId: string, touchId: string, _now: Date, acceptedAt?: Date) { const gate = await this.getGate(tenantId, contactId); if (gate?.activeTouchId === touchId) this.gates.set(this.key(tenantId, contactId), { ...gate, activeTouchId: undefined, reservedUntil: undefined, lastAcceptedAt: acceptedAt ?? gate.lastAcceptedAt, version: gate.version + 1 }); }
  async latestAccepted(tenantId: string, contactId: string) { return this.attempts.filter((item) => item.tenantId === tenantId && item.contactId === contactId && item.acceptedAt).sort((a, b) => b.acceptedAt!.getTime() - a.acceptedAt!.getTime())[0]; }
  async hasContentHash(tenantId: string, contactId: string, hash: string, since: Date) { return this.attempts.some((item) => item.tenantId === tenantId && item.contactId === contactId && item.acceptedContentHash === hash && Boolean(item.acceptedAt && item.acceptedAt >= since)); }
  async acceptedHistory(tenantId: string, contactId: string, journeyId?: string) { return this.attempts.filter((item) => item.tenantId === tenantId && item.contactId === contactId && Boolean(item.acceptedAt) && (!journeyId || item.journeyId === journeyId)); }
  async createAttempt(attempt: MessageAttempt) { this.attempts.push(attempt); }
  async getAttempt(tenantId: string, attemptId: string) { return this.attempts.find((item) => item.tenantId === tenantId && item.id === attemptId); }
  async updateAttempt(attempt: MessageAttempt) { const index = this.attempts.findIndex((item) => item.id === attempt.id); if (index >= 0) this.attempts[index] = { ...attempt }; }
  async appendEvent(event: MessageEvent) { if (this.events.some((item) => item.tenantId === event.tenantId && item.providerEventId === event.providerEventId)) return false; this.events.push(event); return true; }
  async pauseRoutineTouches(tenantId: string, contactId: string, reason: "reply" | "booking" | "conversion" | "consent_loss" | "invalid_contact") { this.pauses.push(`${tenantId}:${contactId}:${reason}`); }
}

function receiptStatus(state: DeliveryState): MessageStatus { return state === "unsupported" ? "failed" : state; }
const STATUS_RANK: Readonly<Record<MessageStatus, number>> = { planned: 0, blocked: 0, accepted: 1, sent: 2, delivery_unknown: 2, delivered: 3, read: 4, clicked: 4, replied: 5, failed: 6, cancelled: 6 };
/** Receipts are append-only; stale or contradictory provider events may be retained but never regress a confirmed status. */
export function shouldAdvanceStatus(current: MessageStatus, incoming: MessageStatus): boolean {
  if (current === incoming) return false;
  if (["failed", "cancelled"].includes(current)) return false;
  if (["failed", "cancelled"].includes(incoming)) return STATUS_RANK[current] < 3;
  return STATUS_RANK[incoming] > STATUS_RANK[current];
}

import { describe, expect, it } from "vitest";
import { ConsentService, MemoryConsentRepository } from "../../../worker/domain/consent/service";
import { CommunicationService, MemoryDispatchRepository, MIN_OUTBOUND_INTERVAL_MS } from "../../../worker/domain/communication/service";
import { SimulatedProviderAdapter } from "../../../worker/providers/simulated";
import { JourneyService, MemoryJourneyRepository } from "../../../worker/domain/journeys/service";

const start = new Date("2026-09-19T00:00:00.000Z");
const version = { id: "version-1", tenantId: "tenant-1", templateId: "template-1", versionNumber: 1, contentCiphertext: "sealed", contentHash: "content-hash-1", variables: [], assetIds: [], createdByMembershipId: "author", approvedAt: start };
async function setup() {
  const consentRepo = new MemoryConsentRepository(); const consents = new ConsentService(consentRepo, { verifyOwnedEvidence: async () => true });
  const actor = { tenantId: "tenant-1", actorMembershipId: "member-1", roles: ["agent"], now: start };
  await consents.record(actor, { contactId: "contact-1", purpose: "education", channel: "whatsapp", state: "granted", occurredAt: start, evidenceId: "evidence-1" });
  await consents.record(actor, { contactId: "contact-1", purpose: "education", channel: "rcs", state: "granted", occurredAt: start, evidenceId: "evidence-2" });
  await consents.record(actor, { contactId: "contact-1", purpose: "education", channel: "mms", state: "granted", occurredAt: start, evidenceId: "evidence-3" });
  const repo = new MemoryDispatchRepository(); return { consents, repo, service: new CommunicationService(repo, consents) };
}
function input(provider: SimulatedProviderAdapter, now = start, touchId = "touch-1") { return { tenantId: "tenant-1", contactId: "contact-1", touchId, purpose: "education", requestedChannel: "whatsapp" as const, templateVersion: version, integrationId: "integration-1", provider, now, operationId: "operation-1" }; }

describe("consent and contact dispatch policy", () => {
  it("does not infer consent and suppression wins a channel grant", async () => {
    const { consents } = await setup();
    expect(await consents.evaluate("tenant-1", "other-contact", "education", "whatsapp", start)).toMatchObject({ allowed: false, reason: "unknown" });
    await consents.suppress({ tenantId: "tenant-1", actorMembershipId: "member-1", roles: ["agent"], now: start }, { contactId: "contact-1", reason: "DNC", evidenceId: "evidence-dnc", occurredAt: start });
    expect(await consents.evaluate("tenant-1", "contact-1", "education", "whatsapp", start)).toMatchObject({ allowed: false, reason: "suppressed" });
  });
  it("uses accepted-send time and rejects 47:59:59 but accepts exactly 48:00:00", async () => {
    const { service } = await setup(); const provider = new SimulatedProviderAdapter();
    expect((await service.dispatch(input(provider))).state).toBe("accepted");
    const early = await service.dispatch({ ...input(provider, new Date(start.getTime() + MIN_OUTBOUND_INTERVAL_MS - 1000), "touch-2"), requestedChannel: "rich", templateVersion: { ...version, id: "version-2", contentHash: "content-hash-2" } });
    expect(early).toMatchObject({ state: "blocked", reason: "minimum_48_hours" });
    const atBoundary = await service.dispatch({ ...input(provider, new Date(start.getTime() + MIN_OUTBOUND_INTERVAL_MS), "touch-3"), requestedChannel: "rich", templateVersion: { ...version, id: "version-3", contentHash: "content-hash-3" } });
    expect(atBoundary.state).toBe("accepted");
  });
  it("uses a rich slot as RCS then MMS, never a second WhatsApp fallback", async () => {
    const { service } = await setup(); const rcs = new SimulatedProviderAdapter({ channels: ["rcs"] });
    const rich = await service.dispatch({ ...input(rcs), requestedChannel: "rich" }); expect(rich.attempt.channel).toBe("rcs");
    const { service: fallback } = await setup(); const mms = new SimulatedProviderAdapter({ channels: ["mms"] });
    expect((await fallback.dispatch({ ...input(mms), requestedChannel: "rich" })).attempt.channel).toBe("mms");
  });
  it("holds ambiguous sends for reconciliation and pauses routine work on reply", async () => {
    const { service, repo } = await setup(); const ambiguous = new SimulatedProviderAdapter({ outcomeFor: () => "timeout_after_acceptance" });
    const result = await service.dispatch(input(ambiguous)); expect(result).toMatchObject({ state: "manual_resolution_required", attempt: { status: "delivery_unknown" } });
    await service.pauseForAttempt("tenant-1", result.attempt.id, "reply"); expect(repo.pauses).toContain("tenant-1:contact-1:reply");
  });
});

describe("journey schedules", () => {
  it("seeds Hot/Warm/Cold/Not Connected schedules and preserves the day-six 48h rich touch", async () => {
    const repo = new MemoryJourneyRepository(); const journeys = new JourneyService(repo);
    const hot = await journeys.enroll({ tenantId: "tenant-1", leadId: "lead-1", contactId: "contact-1", journeyId: "hot-1", kind: "hot", startsAt: start });
    expect(hot.find((touch) => touch.sequence === 7)?.dueAt.getTime()).toBe(start.getTime() + 6 * 86_400_000);
    await journeys.enroll({ tenantId: "tenant-1", leadId: "lead-2", contactId: "contact-2", journeyId: "warm-1", kind: "warm", startsAt: start });
    await journeys.enroll({ tenantId: "tenant-1", leadId: "lead-3", contactId: "contact-3", journeyId: "cold-1", kind: "cold", startsAt: start });
    await journeys.enroll({ tenantId: "tenant-1", leadId: "lead-4", contactId: "contact-4", journeyId: "nc-1", kind: "not_connected", startsAt: start });
    expect(repo.touches.length).toBeGreaterThanOrEqual(26);
    await journeys.pauseForReply("tenant-1", "contact-1");
    expect(repo.touches.filter((touch) => touch.contactId === "contact-1").every((touch) => touch.status === "paused")).toBe(true);
    await journeys.cancelForTerminalOutcome("tenant-1", "contact-1");
    expect(repo.touches.filter((touch) => touch.contactId === "contact-1").every((touch) => touch.status === "cancelled")).toBe(true);
  });
});


describe("consent and delivery review regressions", () => {
  it("requires an authorized actor and evidence that belongs to the contact", async () => {
    const repo = new MemoryConsentRepository();
    const service = new ConsentService(repo, { verifyOwnedEvidence: async () => false });
    await expect(service.record({ tenantId: "tenant-1", actorMembershipId: "viewer", roles: ["auditor"], now: start }, { contactId: "contact-1", purpose: "education", state: "granted", occurredAt: start, evidenceId: "other-contact-evidence" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.record({ tenantId: "tenant-1", actorMembershipId: "agent", roles: ["agent"], now: start }, { contactId: "contact-1", purpose: "education", state: "granted", occurredAt: start, evidenceId: "other-contact-evidence" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("allows a later evidenced grant while a later active suppression remains controlling", async () => {
    const repo = new MemoryConsentRepository(); const service = new ConsentService(repo, { verifyOwnedEvidence: async () => true });
    const actor = { tenantId: "tenant-1", actorMembershipId: "agent", roles: ["agent"], now: start };
    await service.record(actor, { contactId: "contact-1", purpose: "education", channel: "whatsapp", state: "withdrawn", occurredAt: start, evidenceId: "withdrawal" });
    await service.record({ ...actor, now: new Date(start.getTime() + 1) }, { contactId: "contact-1", purpose: "education", channel: "whatsapp", state: "granted", occurredAt: new Date(start.getTime() + 1), evidenceId: "fresh-opt-in" });
    expect(await service.evaluate("tenant-1", "contact-1", "education", "whatsapp", new Date(start.getTime() + 2))).toEqual({ allowed: true });
    await service.suppress({ ...actor, now: new Date(start.getTime() + 3) }, { contactId: "contact-1", reason: "dnc", evidenceId: "dnc", occurredAt: new Date(start.getTime() + 3) });
    expect(await service.evaluate("tenant-1", "contact-1", "education", "whatsapp", new Date(start.getTime() + 4))).toMatchObject({ reason: "suppressed" });
    await service.deactivateSuppression({ ...actor, now: new Date(start.getTime() + 5) }, { contactId: "contact-1", reason: "dnc", evidenceId: "release", occurredAt: new Date(start.getTime() + 5) });
    expect(await service.evaluate("tenant-1", "contact-1", "education", "whatsapp", new Date(start.getTime() + 6))).toEqual({ allowed: true });
  });
  it("does not let a global suppression release clear a channel-specific DNC", async () => {
    const repo = new MemoryConsentRepository(); const service = new ConsentService(repo, { verifyOwnedEvidence: async () => true });
    const actor = { tenantId: "tenant-1", actorMembershipId: "agent", roles: ["agent"], now: start };
    await service.record(actor, { contactId: "contact-1", purpose: "education", channel: "whatsapp", state: "granted", occurredAt: start, evidenceId: "grant" });
    await service.suppress(actor, { contactId: "contact-1", channel: "whatsapp", reason: "channel-dnc", evidenceId: "dnc", occurredAt: start });
    await service.deactivateSuppression({ ...actor, now: new Date(start.getTime() + 1) }, { contactId: "contact-1", reason: "global-dnc", evidenceId: "release", occurredAt: new Date(start.getTime() + 1) });
    expect(await service.evaluate("tenant-1", "contact-1", "education", "whatsapp", new Date(start.getTime() + 2))).toMatchObject({ reason: "suppressed" });
  });
  it("persists requested channel, alternates accepted channels, bounds content repetition, and updates receipts", async () => {
    const { service, repo } = await setup(); const provider = new SimulatedProviderAdapter();
    const first = await service.dispatch(input(provider)); expect(first.attempt.requestedChannel).toBe("whatsapp");
    const same = await service.dispatch({ ...input(provider, new Date(start.getTime() + MIN_OUTBOUND_INTERVAL_MS), "same"), templateVersion: { ...version, id: "v2", contentHash: "fresh" } });
    expect(same.reason).toBe("channel_not_alternating");
    const rich = await service.dispatch({ ...input(provider, new Date(start.getTime() + MIN_OUTBOUND_INTERVAL_MS), "rich"), requestedChannel: "rich", templateVersion: { ...version, id: "v3", contentHash: "fresh" } });
    expect(rich.state).toBe("accepted");
    expect(await service.recordEvent({ tenantId: "tenant-1", attemptId: rich.attempt.id, providerEventId: "receipt-1", type: "delivered", occurredAt: new Date(start.getTime() + MIN_OUTBOUND_INTERVAL_MS + 1) })).toBe(true);
    expect((await repo.getAttempt("tenant-1", rich.attempt.id))?.status).toBe("delivered");
    const repeatAfterWindow = await service.dispatch({ ...input(provider, new Date(start.getTime() + MIN_OUTBOUND_INTERVAL_MS + 31 * 86_400_000), "repeat"), templateVersion: version });
    expect(repeatAfterWindow.state).toBe("accepted");
  });
  it("reconciles a provider timeout instead of retrying or changing channel", async () => {
    const { service, repo } = await setup(); const provider = new SimulatedProviderAdapter({ outcomeFor: () => "timeout_after_acceptance" });
    const result = await service.dispatch(input(provider)); expect(result.attempt.providerMessageId).toBeDefined();
    expect(await service.reconcileAttempt({ tenantId: "tenant-1", attemptId: result.attempt.id, integrationId: "integration-1", provider })).toBe("resolved");
    expect((await repo.getAttempt("tenant-1", result.attempt.id))?.status).toBe("accepted");
  });
});

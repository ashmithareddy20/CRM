import type { MessageChannel } from "../communication/service";

export type JourneyKind = "hot" | "warm" | "cold" | "not_connected" | "appointment" | "recovery";
export interface JourneyStepDefinition { sequence: number; dueAfterDays: number; purpose: string; channel: MessageChannel | "rich" | "call"; }
export interface PlannedTouch { id: string; tenantId: string; leadId: string; contactId: string; journeyId: string; sequence: number; purpose: string; channel: MessageChannel | "rich" | "call"; dueAt: Date; status: "planned" | "paused" | "cancelled"; gateKey: string; }
export interface JourneyRepository { addTouches(touches: readonly PlannedTouch[]): Promise<void>; pauseContact(tenantId: string, contactId: string, reason: string): Promise<void>; }
const id = () => crypto.randomUUID();
/** Calls are planned independently; messages remain subject to the dispatch service's 48h accepted-send gate. */
export const JOURNEY_SCHEDULES: Readonly<Record<Exclude<JourneyKind, "appointment" | "recovery">, readonly JourneyStepDefinition[]>> = {
  hot: [
    { sequence: 1, dueAfterDays: 0, purpose: "acknowledgement", channel: "call" }, { sequence: 2, dueAfterDays: 0, purpose: "acknowledgement", channel: "whatsapp" },
    { sequence: 3, dueAfterDays: 2, purpose: "education", channel: "call" }, { sequence: 4, dueAfterDays: 2, purpose: "education", channel: "rich" },
    { sequence: 5, dueAfterDays: 4, purpose: "action", channel: "call" }, { sequence: 6, dueAfterDays: 4, purpose: "action", channel: "whatsapp" },
    { sequence: 7, dueAfterDays: 6, purpose: "trust", channel: "rich" },
  ],
  warm: [
    { sequence: 1, dueAfterDays: 0, purpose: "acknowledgement", channel: "whatsapp" }, { sequence: 2, dueAfterDays: 2, purpose: "education", channel: "rich" },
    { sequence: 3, dueAfterDays: 4, purpose: "trust", channel: "whatsapp" }, { sequence: 4, dueAfterDays: 6, purpose: "treatment_understanding", channel: "rich" },
    { sequence: 5, dueAfterDays: 8, purpose: "social_proof", channel: "whatsapp" }, { sequence: 6, dueAfterDays: 10, purpose: "financial_support", channel: "rich" },
    { sequence: 7, dueAfterDays: 12, purpose: "action", channel: "whatsapp" }, { sequence: 8, dueAfterDays: 14, purpose: "action", channel: "rich" },
  ],
  cold: [
    { sequence: 1, dueAfterDays: 0, purpose: "acknowledgement", channel: "call" }, { sequence: 2, dueAfterDays: 0, purpose: "education", channel: "whatsapp" },
    { sequence: 3, dueAfterDays: 7, purpose: "education", channel: "rich" }, { sequence: 4, dueAfterDays: 14, purpose: "trust", channel: "whatsapp" },
    { sequence: 5, dueAfterDays: 21, purpose: "qualification", channel: "call" },
  ],
  not_connected: [
    { sequence: 1, dueAfterDays: 0, purpose: "callback", channel: "call" }, { sequence: 2, dueAfterDays: 0, purpose: "acknowledgement", channel: "whatsapp" },
    { sequence: 3, dueAfterDays: 1, purpose: "callback", channel: "call" }, { sequence: 4, dueAfterDays: 2, purpose: "education", channel: "call" }, { sequence: 5, dueAfterDays: 2, purpose: "education", channel: "rich" },
    { sequence: 6, dueAfterDays: 3, purpose: "callback", channel: "call" }, { sequence: 7, dueAfterDays: 4, purpose: "callback", channel: "call" }, { sequence: 8, dueAfterDays: 4, purpose: "action", channel: "whatsapp" },
  ],
};

export class JourneyService {
  constructor(private readonly repository: JourneyRepository) {}
  async enroll(input: { tenantId: string; leadId: string; contactId: string; journeyId: string; kind: Exclude<JourneyKind, "appointment" | "recovery">; startsAt: Date }): Promise<readonly PlannedTouch[]> {
    const touches = JOURNEY_SCHEDULES[input.kind].map((step) => ({ id: id(), tenantId: input.tenantId, leadId: input.leadId, contactId: input.contactId, journeyId: input.journeyId, sequence: step.sequence, purpose: step.purpose, channel: step.channel, dueAt: new Date(input.startsAt.getTime() + step.dueAfterDays * 86_400_000), status: "planned" as const, gateKey: `${input.journeyId}:${step.sequence}` }));
    await this.repository.addTouches(touches); return touches;
  }
  async pauseForReply(tenantId: string, contactId: string) { await this.repository.pauseContact(tenantId, contactId, "reply"); }
  async pauseForBooking(tenantId: string, contactId: string) { await this.repository.pauseContact(tenantId, contactId, "booking"); }
  async pauseForConversion(tenantId: string, contactId: string) { await this.repository.pauseContact(tenantId, contactId, "conversion"); }
}
export class MemoryJourneyRepository implements JourneyRepository { readonly touches: PlannedTouch[] = []; readonly pauses: string[] = []; async addTouches(touches: readonly PlannedTouch[]) { this.touches.push(...touches); } async pauseContact(tenantId: string, contactId: string, reason: string) { this.pauses.push(`${tenantId}:${contactId}:${reason}`); for (const touch of this.touches) if (touch.tenantId === tenantId && touch.contactId === contactId && touch.status === "planned") touch.status = "paused"; } }

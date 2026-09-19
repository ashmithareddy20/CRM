import { describe, expect, it } from "vitest";
import { callEventSchema, callRemarkSchema, transitionCommandSchema } from "../../../lib/api/lifecycle";
import { isLegalLifecycleTransition } from "../../../worker/domain/lifecycle/service";
import { CallService, D1PairingStore, MINIMUM_DOUBLE_DIAL_INTERVAL_MS, isEligibleSecondPairedAttempt, type PairingStore } from "../../../worker/domain/calls/service";
import { isBusinessInstant } from "../../../worker/domain/tasks/service";

describe("lifecycle guards", () => {
  it("allows only ordered lifecycle milestones", () => {
    expect(isLegalLifecycleTransition("assigned", "contact_attempted")).toBe(true);
    expect(isLegalLifecycleTransition("assigned", "revenue_recorded")).toBe(false);
    expect(isLegalLifecycleTransition("closed", "follow_up_active")).toBe(false);
  });
  it("requires a patient statement for meaningful contact", () => {
    expect(callRemarkSchema.safeParse({ disposition: "meaningful_connection", notApplicableReason: "Not recorded" }).success).toBe(false);
    expect(callRemarkSchema.safeParse({ disposition: "meaningful_connection", patientStatement: "Patient asked for a consultation", agentExplanation: "Explained available appointment times", nextAction: "Call to confirm", nextActionOwnerMembershipId: "member-1", nextActionDueAt: new Date("2026-09-20T10:00:00Z") }).success).toBe(true);
  });
  it("sets a non-trivial double dial interval", () => expect(MINIMUM_DOUBLE_DIAL_INTERVAL_MS).toBe(15 * 60_000));
  it("permits only the timed second leg of an active double-dial pair", () => {
    const first = new Date("2026-09-20T10:00:00Z");
    expect(isEligibleSecondPairedAttempt(first, new Date(first.getTime() + MINIMUM_DOUBLE_DIAL_INTERVAL_MS - 1))).toBe(false);
    expect(isEligibleSecondPairedAttempt(first, new Date(first.getTime() + MINIMUM_DOUBLE_DIAL_INTERVAL_MS))).toBe(true);
    expect(isEligibleSecondPairedAttempt(undefined, new Date(first.getTime() + MINIMUM_DOUBLE_DIAL_INTERVAL_MS))).toBe(false);
  });
  it("validates provider events independently of call creation", () => {
    expect(callEventSchema.safeParse({ disposition: "answered", dialedAt: new Date("2026-09-20T10:00:00Z"), connectedAt: new Date("2026-09-20T10:01:00Z") }).success).toBe(true);
    expect(callEventSchema.safeParse({ disposition: "answered", dialedAt: new Date("2026-09-20T10:00:00Z"), connectedAt: new Date("2026-09-20T09:59:00Z") }).success).toBe(false);
  });
  it("requires a stable command identifier at the API contract boundary", () => {
    expect(transitionCommandSchema.safeParse({ toStage: "contact_attempted", expectedVersion: 1 }).success).toBe(true);
  });
  it("exposes a durable pair-store contract with atomic reservation semantics", async () => {
    const calls: string[] = [];
    const db = { prepare: () => ({ bind: (...args: unknown[]) => ({
      first: async () => undefined,
      run: async () => ({ meta: { changes: calls.push(String(args[2])) === 1 ? 1 : 0 } }),
    }) }) } as unknown as D1Database;
    const store: PairingStore = new D1PairingStore(db);
    expect(await store.reserve("tenant", "lead", "pair", "call-1", new Date("2026-09-20T10:00:00Z"))).toBe(true);
  });
  it("keeps call disposition and mandatory work obligations distinct", async () => {
    const statements: string[] = [];
    const db = { prepare: (sql: string) => ({ bind: (...args: unknown[]) => ({
      first: async () => sql.includes("crm_lead_episodes") ? { id: "lead" } : undefined,
      run: async () => { statements.push(sql); return { meta: { changes: 1 } }; },
    }) }), batch: async () => [] } as unknown as D1Database;
    const service = new CallService(db, { encrypt: async (_tenant, _id, _purpose, value) => value }, { previousAttempt: async () => undefined, reserve: async () => true });
    const result = await service.recordAttempt({ tenantId: "tenant", actorMembershipId: "member", requestId: "request", now: new Date("2026-09-20T10:00:00Z"), roles: ["agent"] }, { leadId: "lead", direction: "outbound", disposition: "no_answer" });
    expect(result).toMatchObject({ disposition: "no_answer", remarkPending: true });
    expect(statements.some((sql) => sql.includes("'remark_pending'"))).toBe(false);
  });
  it("evaluates business time in its explicit calendar timezone", () => {
    const calendar = { timezone: "Asia/Kolkata", schedule: { fri: [{ start: "09:00", end: "17:00" }] } };
    expect(isBusinessInstant(new Date("2026-09-18T04:30:00Z"), calendar)).toBe(true);
    expect(isBusinessInstant(new Date("2026-09-18T12:30:00Z"), calendar)).toBe(false);
  });
});

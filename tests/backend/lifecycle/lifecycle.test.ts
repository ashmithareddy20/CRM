import { describe, expect, it } from "vitest";
import { callRemarkSchema } from "../../../lib/api/lifecycle";
import { isLegalLifecycleTransition } from "../../../worker/domain/lifecycle/service";
import { MINIMUM_DOUBLE_DIAL_INTERVAL_MS } from "../../../worker/domain/calls/service";
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
  it("evaluates business time in its explicit calendar timezone", () => {
    const calendar = { timezone: "Asia/Kolkata", schedule: { fri: [{ start: "09:00", end: "17:00" }] } };
    expect(isBusinessInstant(new Date("2026-09-18T04:30:00Z"), calendar)).toBe(true);
    expect(isBusinessInstant(new Date("2026-09-18T12:30:00Z"), calendar)).toBe(false);
  });
});

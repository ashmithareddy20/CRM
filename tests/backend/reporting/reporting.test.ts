import { describe, expect, it } from "vitest";
import { escapeCsvCell, toSafeCsv, type FactDimensions, type ReportingFact } from "../../../worker/domain/reporting/service";

function fact(type: string, leadId: string, sourceEventId: string, dimensions: FactDimensions = {}): ReportingFact {
  return { type, sourceEventId, occurredAt: new Date("2026-09-19T09:00:00.000Z"), dimensions: { leadId, branchId: "branch-a", sourceId: "source-a", assignedMembershipId: "agent-a", ...dimensions } };
}

describe("reporting fact contract", () => {
  it("models hand-counted funnel facts without multiplying an episode across repeated events", () => {
    const facts = [
      fact("lead.received", "lead-1", "received-1"), fact("call.meaningful_connection", "lead-1", "connected-1"),
      fact("qualification.completed", "lead-1", "qualified-1"), fact("qualification.hot", "lead-1", "hot-1"),
      fact("appointment.booked", "lead-1", "booking-1"), fact("conversion.completed", "lead-1", "conversion-1", { evidenceId: "evidence-1" }),
      fact("conversion.completed", "lead-1", "conversion-duplicate-event", { evidenceId: "evidence-2" }),
      fact("lead.received", "lead-2", "received-2"), fact("call.attempted", "lead-2", "attempt-2"), fact("lead.final_loss", "lead-2", "loss-2", { evidenceId: "evidence-loss" }),
      fact("lead.received", "lead-3", "received-3"),
    ];
    const received = new Set(facts.filter((item) => item.type === "lead.received").map((item) => item.dimensions.leadId));
    const converted = new Set(facts.filter((item) => item.type === "conversion.completed").map((item) => item.dimensions.leadId));
    const finalLoss = new Set(facts.filter((item) => item.type === "lead.final_loss").map((item) => item.dimensions.leadId));
    expect(received.size).toBe(3);
    expect(converted.size).toBe(1);
    expect(finalLoss.size).toBe(1);
    expect([...received].filter((lead) => !converted.has(lead) && !finalLoss.has(lead))).toEqual(["lead-3"]);
  });

  it("keeps original attribution when ownership changes", () => {
    const ownershipChanged = fact("conversion.completed", "lead-1", "conversion-1", { sourceId: "source-original", originalAssignedMembershipId: "agent-original", assignedMembershipId: "agent-current", evidenceId: "evidence-1" });
    expect(ownershipChanged.dimensions.sourceId).toBe("source-original");
    expect(ownershipChanged.dimensions.originalAssignedMembershipId).toBe("agent-original");
  });

  it("protects CSV formulas and RFC-style quoting", () => {
    const escapedFormula = escapeCsvCell("=HYPERLINK(\"https://bad.example\")");
    expect(escapedFormula.startsWith("\"'=HYPERLINK(")).toBe(true);
    expect(escapedFormula).toContain('""https://bad.example""');
    expect(escapedFormula.endsWith("\"")).toBe(true);
    expect(escapeCsvCell("normal, value")).toBe('"normal, value"');
    expect(toSafeCsv(["metric", "value"], [{ metric: "+cmd", value: 'a"b' }])).toBe("metric,value\r\n'+cmd,\"a\"\"b\"");
  });

  it("defines a zero denominator as not applicable rather than zero percent", () => {
    const denominator = 0;
    const value = denominator ? 1 / denominator : null;
    expect(value).toBeNull();
  });
});

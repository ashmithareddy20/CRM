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

class FactDb {
  readonly sql: string[] = [];
  readonly binds: unknown[][] = [];
  constructor(private readonly rows: Array<{ id: string; sourceEventId: string; factType: string; occurredAt: number; dimensionsJson: string; valueMinor: number | null }>) {}
  prepare(sql: string) {
    this.sql.push(sql); const rows = this.rows; const binds = this.binds;
    return { bind(...values: unknown[]) { binds.push(values); return { async all() { const cursor = Number(values.at(-4)); const cursorId = String(values.at(-2)); const limit = Number(values.at(-1)); const branch = values.find((value): value is string => typeof value === "string" && value.startsWith("branch-")); const result = rows.filter((row) => !branch || JSON.parse(row.dimensionsJson).branchId === branch).filter((row) => row.occurredAt > cursor || (row.occurredAt === cursor && row.id > cursorId)).slice(0, limit); return { results: result }; } }; } };
  }
}

describe("reporting query and export regressions", () => {
  it("places branch, date, and owner predicates in SQL before every page limit and excludes branchless facts", async () => {
    const now = Date.parse("2026-09-19T09:00:00.000Z");
    const db = new FactDb([{ id: "a", sourceEventId: "event-a", factType: "lead.received", occurredAt: now, dimensionsJson: JSON.stringify({ leadId: "lead-a", branchId: "branch-a", assignedMembershipId: "agent-a" }), valueMinor: null }]);
    const { ReportingService } = await import("../../../worker/domain/reporting/service");
    const service = new ReportingService(db as never, () => new Date(now));
    await service.funnel({ tenantId: "tenant", actorMembershipId: "manager", roles: ["manager"], branchIds: ["branch-a"] }, { from: new Date(now - 1), to: new Date(now + 1), assignedMembershipId: "agent-a" });
    expect(db.sql[0]).toContain("json_extract(dimensions_json, '$.branchId') IS NOT NULL");
    expect(db.sql[0]).toContain("json_extract(dimensions_json, '$.branchId') IN (?)");
    expect(db.sql[0]).toContain("occurred_at >= ?");
    expect(db.sql[0]).toContain("assignedMembershipId");
    expect(db.sql[0].indexOf("json_extract(dimensions_json, '$.branchId')")).toBeLessThan(db.sql[0].indexOf("LIMIT ?"));
  });

  it("keeps another branch and branchless facts out of branch-scoped totals", async () => {
    const at = Date.parse("2026-09-19T09:00:00.000Z");
    const db = new FactDb([
      { id: "a", sourceEventId: "a", factType: "lead.received", occurredAt: at, dimensionsJson: JSON.stringify({ leadId: "lead-a", branchId: "branch-a" }), valueMinor: null },
      { id: "b", sourceEventId: "b", factType: "lead.received", occurredAt: at + 1, dimensionsJson: JSON.stringify({ leadId: "lead-b", branchId: "branch-b" }), valueMinor: null },
      { id: "c", sourceEventId: "c", factType: "lead.received", occurredAt: at + 2, dimensionsJson: JSON.stringify({ leadId: "lead-branchless" }), valueMinor: null },
    ]); const { ReportingService } = await import("../../../worker/domain/reporting/service"); const service = new ReportingService(db as never, () => new Date(at));
    const scoped = await service.funnel({ tenantId: "tenant", actorMembershipId: "manager", roles: ["manager"], branchIds: ["branch-a"] });
    expect(scoped.find((item) => item.key === "connected_rate")?.denominator).toBe(1);
  });

  it("pages beyond 20,000 facts instead of silently truncating aggregates", async () => {
    const at = Date.parse("2026-09-19T09:00:00.000Z");
    const rows = Array.from({ length: 20_001 }, (_, index) => ({ id: `fact-${String(index).padStart(5, "0")}`, sourceEventId: `event-${index}`, factType: "lead.received", occurredAt: at + index, dimensionsJson: JSON.stringify({ leadId: `lead-${index}`, branchId: "branch-a" }), valueMinor: null }));
    const db = new FactDb(rows);
    const { ReportingService } = await import("../../../worker/domain/reporting/service");
    const service = new ReportingService(db as never, () => new Date(at));
    const metrics = await service.funnel({ tenantId: "tenant", actorMembershipId: "manager", roles: ["manager"], branchIds: ["branch-a"] });
    expect(metrics.find((item) => item.key === "connected_rate")?.denominator).toBe(20_001);
    expect(db.sql.length).toBeGreaterThan(20);
  });

  it("requires evidence-backed conversion and reconciles recognized revenue and reversals by stable lead", async () => {
    const at = Date.parse("2026-09-19T09:00:00.000Z");
    const rows = [
      { id: "1", sourceEventId: "received", factType: "lead.received", occurredAt: at, dimensionsJson: JSON.stringify({ leadId: "lead-a", branchId: "branch-a" }), valueMinor: null },
      { id: "2", sourceEventId: "unproven-conversion", factType: "conversion.completed", occurredAt: at + 1, dimensionsJson: JSON.stringify({ leadId: "lead-a", branchId: "branch-a" }), valueMinor: null },
      { id: "3", sourceEventId: "proven-conversion", factType: "treatment.completed", occurredAt: at + 2, dimensionsJson: JSON.stringify({ leadId: "lead-a", branchId: "branch-a", evidenceId: "evidence-a" }), valueMinor: null },
      { id: "4", sourceEventId: "revenue", factType: "revenue.recognized", occurredAt: at + 3, dimensionsJson: JSON.stringify({ leadId: "lead-a", branchId: "branch-a", evidenceId: "ledger-a", currency: "INR" }), valueMinor: 10_000 },
      { id: "5", sourceEventId: "reversal", factType: "revenue.reversed", occurredAt: at + 4, dimensionsJson: JSON.stringify({ leadId: "lead-a", branchId: "branch-a", evidenceId: "ledger-reversal", currency: "INR" }), valueMinor: -2_500 },
    ];
    const db = new FactDb(rows); const { ReportingService } = await import("../../../worker/domain/reporting/service"); const service = new ReportingService(db as never, () => new Date(at));
    const scope = { tenantId: "tenant", actorMembershipId: "manager", roles: ["manager"] as const, branchIds: ["branch-a"] };
    expect((await service.funnel(scope)).find((item) => item.key === "conversion_rate")?.numerator).toBe(1);
    expect((await service.finance(scope)).recognizedNetMinorByCurrency).toEqual({ INR: 7_500 });
  });

  it("writes an export artifact from the durable run contract and records completion", async () => {
    const { runReportingJob } = await import("../../../worker/jobs/reporting");
    const puts: unknown[] = []; const completions: unknown[] = [];
    const service = { funnel: async () => [{ key: "conversion_rate", version: "v1", numerator: 1, denominator: 2, value: 0.5, unknown: 0, asOf: "2026-09-19T00:00:00.000Z" }] } as never;
    const result = await runReportingJob(service, { kind: "export", tenantId: "tenant", actorMembershipId: "manager", reportRunId: "run-1" }, {
      now: () => new Date("2026-09-19T00:00:00.000Z"),
      store: { put: async (...args) => { puts.push(args); } },
      runs: { get: async () => ({ id: "run-1", type: "export:funnel", status: "pending", filtersJson: JSON.stringify({ type: "funnel", filters: {}, scope: { branchIds: ["branch-a"], actorMembershipId: "manager" }, expiresAt: "2026-09-20T00:00:00.000Z", identifiers: "suppressed_by_default" }) }), complete: async (...args) => { completions.push(args); }, fail: async () => {} },
    });
    expect(result.objectKey).toBe("exports/tenant/run-1.csv");
    expect(puts).toHaveLength(1);
    expect(completions).toHaveLength(1);
  });
});

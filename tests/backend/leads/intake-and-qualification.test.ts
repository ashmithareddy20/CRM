import { describe, expect, it } from "vitest";
import { leadIntakeSchema, qualificationCommandSchema } from "../../../lib/api/leads";
import { normalizeEmail, normalizePhone } from "../../../worker/domain/leads/normalization";
import { LeadIntakeService } from "../../../worker/domain/leads/service";

describe("lead intake contracts", () => {
  it("normalizes E.164 and email but refuses a country-ambiguous phone", () => {
    expect(normalizePhone("(987) 654-3210", "91")).toBe("+919876543210");
    expect(normalizePhone("+1 (415) 555-0100")).toBe("+14155550100");
    expect(normalizeEmail(" Patient@Example.COM ")).toBe("patient@example.com");
    expect(() => normalizePhone("9876543210")).toThrow("Request validation failed");
  });

  it("requires explicit campaign/form provenance instead of inventing it", () => {
    expect(() => leadIntakeSchema.parse({ phone: "+919876543210", sourceId: "source", platform: "meta", origin: "provider_form", campaignId: "campaign" })).toThrow();
    expect(leadIntakeSchema.parse({ phone: "+919876543210", sourceId: "manual", platform: "staff", origin: "non_campaign" }).origin).toBe("non_campaign");
  });

  it("records duplicate provider deliveries once and leaves identifier matches as review candidates", async () => {
    const repository = {
      findExternalSubmission: async () => ({ id: "submission", leadId: "existing-lead" }),
      findSource: async () => ({ id: "source" }), findContactMatches: async () => [], findLead: async () => undefined,
      createSource: async () => {}, createCampaign: async () => {}, createIntake: async () => { throw new Error("should not create"); },
      createMerge: async () => false, listCandidates: async () => [],
    };
    const service = new LeadIntakeService(repository, { encrypt: async (_tenant, _recordId, _purpose, value) => `enc:${value}`, blindIndex: async (_tenant, _purpose, value) => `idx:${value}` });
    const result = await service.intake({ tenantId: "tenant-a", actorMembershipId: "member", now: new Date("2026-09-19T00:00:00Z"), requestId: "request" }, {
      phone: "+919876543210", sourceId: "source", platform: "meta", origin: "provider_form", campaignId: "campaign", formId: "form", externalSubmissionId: "evt-1",
    });
    expect(result).toEqual({ leadId: "existing-lead", duplicateDelivery: true, candidateLeadIds: [], provenanceStatus: "complete" });
  });
});

describe("qualification contracts", () => {
  it("permits incomplete assessments and requires evidence for any override", () => {
    const base = { questionnaireId: "questionnaire", answers: { urgency: "urgent" } };
    expect(qualificationCommandSchema.parse(base).answers.urgency).toBe("urgent");
    expect(() => qualificationCommandSchema.parse({ ...base, override: { classification: "hot", reason: "" } })).toThrow();
  });
});

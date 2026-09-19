import { describe, expect, it } from "vitest";
import { isEligibleConversion, sumMinorByCurrency, uniqueEligibleConversions } from "../../../worker/domain/conversion/policy";
import { ClinicalService } from "../../../worker/domain/clinical/service";

const now = new Date("2026-09-19T00:00:00.000Z");

describe("conversion evidence definition", () => {
  it("does not convert a quote or appointment and deduplicates eligible treatment evidence by lead episode", () => {
    expect(isEligibleConversion({ completion: "procedure_completed", evidenceId: "evidence-1" })).toBe(true);
    expect(isEligibleConversion({ completion: "procedure_completed", evidenceId: "" })).toBe(false);
    expect(uniqueEligibleConversions([
      { leadId: "lead-a", completion: "treatment_completed", evidenceId: "treatment-1", completedAt: now },
      { leadId: "lead-a", completion: "procedure_completed", evidenceId: "treatment-2", completedAt: new Date(now.getTime() + 1) },
      { leadId: "lead-b", completion: "medical_management_completed", evidenceId: "medical-1", completedAt: now },
    ])).toEqual(["lead-a", "lead-b"]);
  });

  it("keeps minor units separate by currency and includes reversals", () => {
    expect(sumMinorByCurrency([
      { amountMinor: 150_000, currency: "INR" }, { amountMinor: -50_000, currency: "INR" }, { amountMinor: 20_000, currency: "USD" },
    ])).toEqual({ INR: 100_000, USD: 20_000 });
    expect(() => sumMinorByCurrency([{ amountMinor: 1.5, currency: "INR" }])).toThrow("minor-unit");
  });
});

describe("clinical authorization boundary", () => {
  it("rejects agent-created consultations before it accesses storage", async () => {
    const clinical = new ClinicalService({} as never);
    await expect(clinical.completeConsultation({ tenantId: "tenant", actorMembershipId: "agent", roles: ["agent"], now }, { leadId: "lead", evidenceId: "evidence", outcome: "completed" }))
      .rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});

import { handleAppointmentRoutes } from "../../../worker/api/appointments";
import { isLegalAppointmentTransition } from "../../../worker/domain/appointments/service";

describe("appointment and API regression boundaries", () => {
  it("only permits terminal clinical progression after arrival", () => {
    expect(isLegalAppointmentTransition("confirmed", "arrived")).toBe(true);
    expect(isLegalAppointmentTransition("arrived", "consultation_completed")).toBe(true);
    expect(isLegalAppointmentTransition("confirmed", "consultation_completed")).toBe(false);
    expect(isLegalAppointmentTransition("cancelled", "confirmed")).toBe(false);
  });

  it("returns an authenticated tenant-scoped appointment on GET", async () => {
    const record = { id: "appointment-1", seriesId: "series-1", leadId: "lead-1", doctorId: "doctor-1", branchId: "branch-1", startsAt: now, endsAt: now, status: "confirmed" as const, version: 3 };
    const response = await handleAppointmentRoutes(new Request("https://example.test/api/v1/appointments/appointment-1"), {
      request: new Request("https://example.test"), env: {} as never, requestId: "request-1", now,
      actor: { subject: "user", tenantId: "tenant-1", membershipId: "member-1", roles: ["scheduler"], authentication: "test" },
    }, { appointments: { get: async (tenantId: string, id: string) => tenantId === "tenant-1" && id === "appointment-1" ? record : undefined } as never });
    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({ data: { id: "appointment-1", version: 3 } });
  });
});

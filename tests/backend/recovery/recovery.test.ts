import { describe, expect, it } from "vitest";
import { DiagnosisService, MemoryDiagnosisRepository } from "../../../worker/domain/diagnosis/service";
import { CORRECTIVE_ACTIONS, REASON_TAXONOMY } from "../../../worker/domain/diagnosis/taxonomy";
import { MemoryRecoveryRepository, RecoveryService, reactivationDate } from "../../../worker/domain/recovery/service";

const now = new Date("2026-09-19T00:00:00.000Z");
const context = { tenantId: "tenant-1", actorMembershipId: "manager-1", now, roles: ["manager"] };

describe("expiry diagnosis", () => {
  it("requires evidence, creates a missing-evidence task, and maps all primary reason families to actions", async () => {
    const repository = new MemoryDiagnosisRepository(); repository.leads.set("lead-1", { id: "lead-1", contactId: "contact-1", lifecycleStage: "closed" });
    const service = new DiagnosisService(repository);
    const pending = await service.record(context, { leadId: "lead-1", versionId: "v1", primaryReason: "financial", secondaryReason: "package_above_budget", detailedRemark: "Patient described a package outside their budget", recoverability: "recoverable", responsibleMembershipId: "owner-1", reviewAt: new Date("2026-09-20T00:00:00.000Z") });
    expect(pending.state).toBe("evidence_pending"); expect(repository.diagnoses).toHaveLength(0); expect(repository.tasks[0]?.title).toContain("evidence");
    const recorded = await service.record(context, { leadId: "lead-1", versionId: "v1", primaryReason: "financial", secondaryReason: "package_above_budget", detailedRemark: "Patient described a package outside their budget", evidenceId: "call-remark-1", recoverability: "recoverable", responsibleMembershipId: "owner-1", reviewAt: new Date("2026-09-20T00:00:00.000Z") });
    expect(recorded).toMatchObject({ state: "recorded" }); expect(recorded.state === "recorded" && recorded.actions.map((item) => item.code)).toContain("financial_counselor_call");
    expect(Object.keys(CORRECTIVE_ACTIONS).sort()).toEqual(Object.keys(REASON_TAXONOMY).sort());
  });
  it("rejects an orphan secondary reason and prohibited recoverability", async () => {
    const repository = new MemoryDiagnosisRepository(); repository.leads.set("lead-1", { id: "lead-1", contactId: "contact-1", lifecycleStage: "closed" }); const service = new DiagnosisService(repository);
    await expect(service.record(context, { leadId: "lead-1", versionId: "v1", primaryReason: "financial", secondaryReason: "wrong_number", detailedRemark: "Number is wrong", evidenceId: "e1", recoverability: "recoverable", responsibleMembershipId: "owner-1", reviewAt: new Date("2026-09-20T00:00:00.000Z") } as never)).rejects.toMatchObject({ status: 422 });
  });
});

describe("targeted recovery", () => {
  it("uses a separate default 90-day journey with explicit 30/60 or patient-requested scheduling and gated alternating touches", async () => {
    const repository = new MemoryRecoveryRepository(); const service = new RecoveryService(repository);
    const campaign = await service.createCampaign(context, { name: "Price recovery", kind: "price", status: "active", eligiblePrimaryReasons: ["financial"] });
    repository.diagnoses.set("diagnosis-1", { id: "diagnosis-1", leadId: "lead-1", primaryReason: "financial", secondaryReason: "budget_insufficient", recoverability: "recoverable", evidenceId: "remark-1", reviewAt: new Date("2026-09-20T00:00:00.000Z") });
    repository.leads.set("lead-1", { leadId: "lead-1", contactId: "contact-1", lifecycleStage: "closed", contactStatus: "active", optedOut: false, doNotContact: false, invalid: false, rejected: false, alreadyTreated: false, clinicallyIneligible: false });
    const enrollment = await service.enroll(context, { campaignId: campaign.id, diagnosisId: "diagnosis-1" });
    expect(enrollment.reactivationAt).toEqual(reactivationDate(now)); expect(repository.cancelled).toContain("tenant-1:contact-1:recovery_enrolled");
    await expect(service.enroll(context, { campaignId: campaign.id, diagnosisId: "diagnosis-1", delayDays: 30 })).rejects.toMatchObject({ status: 409 });
    expect(reactivationDate(now, undefined, 30).getTime() - now.getTime()).toBe(30 * 86_400_000);
    expect(reactivationDate(now, undefined, 60).getTime() - now.getTime()).toBe(60 * 86_400_000);
    await service.scheduleDue("tenant-1", enrollment.reactivationAt); expect(repository.touches).toHaveLength(2); expect(repository.touches.map((touch) => touch.requestedChannel)).toEqual(["whatsapp", "rich"]);
  });
  it("excludes opt-out/DNC, invalid, rejection, already-treated and clinically-ineligible leads", async () => {
    const blocked = ["optedOut", "doNotContact", "invalid", "rejected", "alreadyTreated", "clinicallyIneligible"] as const;
    for (const flag of blocked) {
      const repository = new MemoryRecoveryRepository(); const service = new RecoveryService(repository); const campaign = await service.createCampaign(context, { name: `Campaign ${flag}`, kind: "reason_based", status: "active" });
      repository.diagnoses.set("d", { id: "d", leadId: "lead", primaryReason: "interest", secondaryReason: "wants_to_wait", recoverability: "long_term_nurture", evidenceId: "e", reviewAt: new Date("2026-09-20T00:00:00.000Z") });
      repository.leads.set("lead", { leadId: "lead", contactId: "contact", lifecycleStage: "closed", contactStatus: "active", optedOut: false, doNotContact: false, invalid: false, rejected: false, alreadyTreated: false, clinicallyIneligible: false, [flag]: true });
      await expect(service.enroll(context, { campaignId: campaign.id, diagnosisId: "d" })).rejects.toMatchObject({ status: 422 });
    }
  });
});

import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../../../db";
import { counselingSessions, discountRequests, insuranceCases, quotes, revenueLedger, treatmentsCompleted } from "../../../db/schema";
import { ApiError } from "../../api/errors";
import { requireEligibleConversion, sumMinorByCurrency } from "../conversion/policy";

export interface FinanceContext { tenantId: string; actorMembershipId: string; roles: readonly string[]; now: Date; }
const id = () => crypto.randomUUID();
const currency = (value: string) => /^[A-Z]{3}$/.test(value);
function requireFinance(context: FinanceContext) { if (!context.roles.includes("financial_counselor")) throw new ApiError("FORBIDDEN", 403, "Financial counseling permission is required"); }
function requireApprover(context: FinanceContext) { if (!context.roles.includes("discount_approver")) throw new ApiError("FORBIDDEN", 403, "Independent discount approval permission is required"); }
function validateMoney(amountMinor: number, code: string) { if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !currency(code)) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { amountMinor: "Use a positive integer minor-unit amount", currency: "Use a three-letter uppercase currency" }); }

export class FinanceService {
  constructor(private readonly db: Database) {}
  async counsel(context: FinanceContext, leadId: string, evidenceId: string, status: "pending" | "completed" = "completed") {
    requireFinance(context); requireEvidence(evidenceId, "Counseling");
    const counselingId = id(); await this.db.insert(counselingSessions).values({ id: counselingId, tenantId: context.tenantId, leadId, status, occurredAt: context.now, evidenceId, createdAt: context.now, createdByMembershipId: context.actorMembershipId }).run(); return { counselingId };
  }
  async recordInsurance(context: FinanceContext, leadId: string, evidenceId: string, status: "pending" | "approved" | "rejected") {
    requireFinance(context); requireEvidence(evidenceId, "Insurance");
    const insuranceCaseId = id(); await this.db.insert(insuranceCases).values({ id: insuranceCaseId, tenantId: context.tenantId, leadId, status, occurredAt: context.now, evidenceId, createdAt: context.now, createdByMembershipId: context.actorMembershipId }).run(); return { insuranceCaseId };
  }
  async quote(context: FinanceContext, leadId: string, amountMinor: number, code: string, status: "quoted" | "accepted" = "quoted") {
    requireFinance(context); validateMoney(amountMinor, code);
    const latest = await this.db.select({ versionNumber: quotes.versionNumber }).from(quotes).where(and(eq(quotes.tenantId, context.tenantId), eq(quotes.leadId, leadId))).orderBy(desc(quotes.versionNumber)).get();
    const quoteId = id(); await this.db.insert(quotes).values({ id: quoteId, tenantId: context.tenantId, leadId, versionNumber: (latest?.versionNumber ?? 0) + 1, amountMinor, currency: code, status, issuedAt: context.now, createdAt: context.now, createdByMembershipId: context.actorMembershipId }).run(); return { quoteId, versionNumber: (latest?.versionNumber ?? 0) + 1 };
  }
  async requestDiscount(context: FinanceContext, leadId: string, requestedMinor: number, code: string, reason: string) {
    requireFinance(context); validateMoney(requestedMinor, code); if (!reason.trim()) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { reason: "Discount reason is required" });
    const discountRequestId = id(); await this.db.insert(discountRequests).values({ id: discountRequestId, tenantId: context.tenantId, leadId, requestedByMembershipId: context.actorMembershipId, requestedMinor, currency: code, reason, status: "requested", createdAt: context.now, createdByMembershipId: context.actorMembershipId }).run(); return { discountRequestId };
  }
  async approveDiscount(context: FinanceContext, requestId: string, approvedMinor: number, expiresAt: Date) {
    requireApprover(context); if (!Number.isSafeInteger(approvedMinor) || approvedMinor <= 0) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { approvedMinor: "Use a positive integer minor-unit amount" }); if (expiresAt <= context.now) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { expiresAt: "Approval expiry must be in the future" });
    const request = await this.db.select().from(discountRequests).where(and(eq(discountRequests.tenantId, context.tenantId), eq(discountRequests.id, requestId), eq(discountRequests.status, "requested"))).get();
    if (!request) throw new ApiError("NOT_FOUND", 404, "Discount request is unavailable");
    if (request.requestedByMembershipId === context.actorMembershipId) throw new ApiError("FORBIDDEN", 403, "A requester cannot approve their own discount");
    if (approvedMinor > request.requestedMinor) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { approvedMinor: "Approval cannot exceed requested amount" });
    const result = await this.db.update(discountRequests).set({ status: "approved", approvedByMembershipId: context.actorMembershipId, expiresAt, updatedAt: context.now, updatedByMembershipId: context.actorMembershipId }).where(and(eq(discountRequests.tenantId, context.tenantId), eq(discountRequests.id, requestId), eq(discountRequests.status, "requested"))).run();
    if (result.meta.changes !== 1) throw new ApiError("CONFLICT", 409, "Discount request has changed"); return { requestId, approvedMinor, currency: request.currency };
  }
  async recordRevenue(context: FinanceContext, command: { leadId: string; treatmentId: string; kind: "quoted" | "booked" | "recognized" | "received"; amountMinor: number; currency: string; evidenceId: string; occurredAt?: Date }) {
    requireFinance(context); validateMoney(command.amountMinor, command.currency); requireEvidence(command.evidenceId, "Revenue");
    const treatment = await this.db.select({ id: treatmentsCompleted.id, evidenceId: treatmentsCompleted.evidenceId, status: treatmentsCompleted.status }).from(treatmentsCompleted).where(and(eq(treatmentsCompleted.tenantId, context.tenantId), eq(treatmentsCompleted.id, command.treatmentId), eq(treatmentsCompleted.leadId, command.leadId))).get();
    if (!treatment?.evidenceId) throw new ApiError("CONFLICT", 409, "The specified completed treatment is required before recording revenue");
    try { requireEligibleConversion({ completion: treatment.status as "medical_management_completed" | "procedure_completed" | "treatment_completed", evidenceId: treatment.evidenceId }); } catch { throw new ApiError("CONFLICT", 409, "Treatment is not eligible conversion evidence"); }
    // evidenceId is the immutable accounting reference. The guard makes retries safe until the schema gains a treatment_id column.
    const entryId = id();
    const result = await this.db.$client.prepare("INSERT INTO crm_revenue_ledger (id, tenant_id, lead_id, treatment_completion_id, kind, amount_minor, currency, occurred_at, evidence_id, created_at, created_by_membership_id, version) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1 WHERE NOT EXISTS (SELECT 1 FROM crm_revenue_ledger WHERE tenant_id = ? AND lead_id = ? AND kind = ? AND evidence_id = ?)")
      .bind(entryId, context.tenantId, command.leadId, command.treatmentId, command.kind, command.amountMinor, command.currency, (command.occurredAt ?? context.now).getTime(), command.evidenceId, context.now.getTime(), context.actorMembershipId, context.tenantId, command.leadId, command.kind, command.evidenceId).run();
    if (!result.meta.changes) {
      const existing = await this.db.select({ id: revenueLedger.id }).from(revenueLedger).where(and(eq(revenueLedger.tenantId, context.tenantId), eq(revenueLedger.leadId, command.leadId), eq(revenueLedger.kind, command.kind), eq(revenueLedger.evidenceId, command.evidenceId))).get();
      if (existing) return { entryId: existing.id, created: false, treatmentId: command.treatmentId };
      throw new ApiError("CONFLICT", 409, "Revenue entry could not be recorded");
    }
    return { entryId, created: true, treatmentId: command.treatmentId };
  }
  async reverseRevenue(context: FinanceContext, entryId: string, evidenceId: string) {
    requireFinance(context); requireEvidence(evidenceId, "Reversal");
    const original = await this.db.select().from(revenueLedger).where(and(eq(revenueLedger.tenantId, context.tenantId), eq(revenueLedger.id, entryId))).get();
    if (!original || original.kind === "reversal") throw new ApiError("NOT_FOUND", 404, "Revenue entry is unavailable");
    const reversalId = id();
    // INSERT … SELECT turns the read/check/write into one statement; only one racing reversal can win.
    const result = await this.db.$client.prepare("INSERT INTO crm_revenue_ledger (id, tenant_id, lead_id, kind, amount_minor, currency, reverses_entry_id, occurred_at, evidence_id, created_at, created_by_membership_id, version) SELECT ?, ?, ?, 'reversal', ?, ?, ?, ?, ?, ?, ?, 1 WHERE NOT EXISTS (SELECT 1 FROM crm_revenue_ledger WHERE tenant_id = ? AND reverses_entry_id = ?)")
      .bind(reversalId, context.tenantId, original.leadId, -original.amountMinor, original.currency, entryId, context.now.getTime(), evidenceId, context.now.getTime(), context.actorMembershipId, context.tenantId, entryId).run();
    if (result.meta.changes) return { reversalId, created: true };
    const existing = await this.db.select({ id: revenueLedger.id }).from(revenueLedger).where(and(eq(revenueLedger.tenantId, context.tenantId), eq(revenueLedger.reversesEntryId, entryId))).get();
    if (existing) return { reversalId: existing.id, created: false };
    throw new ApiError("CONFLICT", 409, "Revenue reversal could not be recorded");
  }
  async totals(context: FinanceContext, leadId: string) { requireFinance(context); const entries = await this.db.select({ amountMinor: revenueLedger.amountMinor, currency: revenueLedger.currency }).from(revenueLedger).where(and(eq(revenueLedger.tenantId, context.tenantId), eq(revenueLedger.leadId, leadId))).all(); return sumMinorByCurrency(entries); }
}
function requireEvidence(value: string, label: string) { if (!value?.trim()) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { evidenceId: `${label} evidence is required` }); }

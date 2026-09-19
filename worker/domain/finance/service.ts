import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { Database } from "../../../db";
import { counselingSessions, discountRequests, insuranceCases, quotes, revenueLedger, treatmentsCompleted } from "../../../db/schema";
import { ApiError } from "../../api/errors";
import { sumMinorByCurrency } from "../conversion/policy";

export interface FinanceContext { tenantId: string; actorMembershipId: string; roles: readonly string[]; now: Date; }
const id = () => crypto.randomUUID();
const currency = (value: string) => /^[A-Z]{3}$/.test(value);
function requireFinance(context: FinanceContext) { if (!context.roles.includes("financial_counselor")) throw new ApiError("FORBIDDEN", 403, "Financial counseling permission is required"); }
function requireApprover(context: FinanceContext) { if (!context.roles.includes("discount_approver")) throw new ApiError("FORBIDDEN", 403, "Independent discount approval permission is required"); }
function validateMoney(amountMinor: number, code: string) { if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !currency(code)) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { amountMinor: "Use a positive integer minor-unit amount", currency: "Use a three-letter uppercase currency" }); }

export class FinanceService {
  constructor(private readonly db: Database) {}
  async counsel(context: FinanceContext, leadId: string, evidenceId: string, status: "pending" | "completed" = "completed") {
    requireFinance(context); if (!evidenceId?.trim()) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { evidenceId: "Counseling evidence is required" });
    const counselingId = id(); await this.db.insert(counselingSessions).values({ id: counselingId, tenantId: context.tenantId, leadId, status, occurredAt: context.now, evidenceId, createdAt: context.now, createdByMembershipId: context.actorMembershipId }).run(); return { counselingId };
  }
  async recordInsurance(context: FinanceContext, leadId: string, evidenceId: string, status: "pending" | "approved" | "rejected") {
    requireFinance(context); if (!evidenceId?.trim()) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { evidenceId: "Insurance evidence is required" });
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
  async recordRevenue(context: FinanceContext, command: { leadId: string; kind: "quoted" | "booked" | "recognized" | "received"; amountMinor: number; currency: string; evidenceId: string; occurredAt?: Date }) {
    requireFinance(context); validateMoney(command.amountMinor, command.currency); if (!command.evidenceId?.trim()) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { evidenceId: "Revenue evidence is required" });
    if (["recognized", "received"].includes(command.kind)) {
      const completion = await this.db.select({ id: treatmentsCompleted.id }).from(treatmentsCompleted).where(and(eq(treatmentsCompleted.tenantId, context.tenantId), eq(treatmentsCompleted.leadId, command.leadId), isNotNull(treatmentsCompleted.evidenceId))).get();
      if (!completion) throw new ApiError("CONFLICT", 409, "Treatment completion evidence is required before revenue recognition");
    }
    const entryId = id(); await this.db.insert(revenueLedger).values({ id: entryId, tenantId: context.tenantId, leadId: command.leadId, kind: command.kind, amountMinor: command.amountMinor, currency: command.currency, occurredAt: command.occurredAt ?? context.now, evidenceId: command.evidenceId, createdAt: context.now, createdByMembershipId: context.actorMembershipId }).run(); return { entryId };
  }
  async reverseRevenue(context: FinanceContext, entryId: string, evidenceId: string) {
    requireFinance(context); if (!evidenceId?.trim()) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { evidenceId: "Reversal evidence is required" });
    const original = await this.db.select().from(revenueLedger).where(and(eq(revenueLedger.tenantId, context.tenantId), eq(revenueLedger.id, entryId))).get();
    if (!original || original.reversesEntryId) throw new ApiError("NOT_FOUND", 404, "Revenue entry is unavailable");
    const existing = await this.db.select({ id: revenueLedger.id }).from(revenueLedger).where(and(eq(revenueLedger.tenantId, context.tenantId), eq(revenueLedger.reversesEntryId, entryId))).get();
    if (existing) throw new ApiError("CONFLICT", 409, "Revenue entry is already reversed");
    const reversalId = id(); await this.db.insert(revenueLedger).values({ id: reversalId, tenantId: context.tenantId, leadId: original.leadId, kind: "reversal", amountMinor: -original.amountMinor, currency: original.currency, reversesEntryId: entryId, occurredAt: context.now, evidenceId, createdAt: context.now, createdByMembershipId: context.actorMembershipId }).run(); return { reversalId };
  }
  async totals(context: FinanceContext, leadId: string) { requireFinance(context); const entries = await this.db.select({ amountMinor: revenueLedger.amountMinor, currency: revenueLedger.currency }).from(revenueLedger).where(and(eq(revenueLedger.tenantId, context.tenantId), eq(revenueLedger.leadId, leadId))).all(); return sumMinorByCurrency(entries); }
}

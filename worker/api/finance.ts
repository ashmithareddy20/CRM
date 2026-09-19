import { z } from "zod";
import { FinanceService } from "../domain/finance/service";
import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { parse, readJsonBody } from "./validation";
const text = z.string().trim().min(1).max(500);
const amount = z.number().int().safe();
const code = z.string().regex(/^[A-Z]{3}$/);
const financeSchema = z.object({ leadId: text, evidenceId: text, status: z.enum(["pending", "completed"]).optional() }).strict();
const insuranceSchema = z.object({ leadId: text, evidenceId: text, status: z.enum(["pending", "approved", "rejected"]) }).strict();
const quoteSchema = z.object({ leadId: text, amountMinor: amount, currency: code, status: z.enum(["quoted", "accepted"]).optional() }).strict();
const discountSchema = z.object({ leadId: text, requestedMinor: amount, currency: code, reason: text }).strict();
const approvalSchema = z.object({ approvedMinor: amount, expiresAt: z.string().datetime({ offset: true }).transform((value) => new Date(value)) }).strict();
const revenueSchema = z.object({ leadId: text, treatmentId: text, kind: z.enum(["quoted", "booked", "recognized", "received"]), amountMinor: amount, currency: code, evidenceId: text }).strict();
const reversalSchema = z.object({ evidenceId: text }).strict();
export interface FinanceRouteDependencies { finance: FinanceService; }
function financeContext(context: RequestContext) { if (!context.actor) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required"); return { tenantId: context.actor.tenantId, actorMembershipId: context.actor.membershipId, roles: context.actor.roles, now: context.now }; }
const response = <T>(context: RequestContext, data: T, status = 200) => Response.json({ success: true, data }, { status, headers: { "X-Request-Id": context.requestId } });
export async function handleFinanceRoutes(request: Request, context: RequestContext, dependencies: FinanceRouteDependencies): Promise<Response | undefined> {
  const path = new URL(request.url).pathname;
  if (path === "/api/v1/financial-counseling") { if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]); const body = parse(financeSchema, await readJsonBody(request)); return response(context, await dependencies.finance.counsel(financeContext(context), body.leadId, body.evidenceId, body.status), 201); }
  if (path === "/api/v1/insurance-cases") { if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]); const body = parse(insuranceSchema, await readJsonBody(request)); return response(context, await dependencies.finance.recordInsurance(financeContext(context), body.leadId, body.evidenceId, body.status), 201); }
  if (path === "/api/v1/quotes") { if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]); const body = parse(quoteSchema, await readJsonBody(request)); return response(context, await dependencies.finance.quote(financeContext(context), body.leadId, body.amountMinor, body.currency, body.status), 201); }
  if (path === "/api/v1/discount-requests") { if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]); const body = parse(discountSchema, await readJsonBody(request)); return response(context, await dependencies.finance.requestDiscount(financeContext(context), body.leadId, body.requestedMinor, body.currency, body.reason), 201); }
  const approve = path.match(/^\/api\/v1\/discount-requests\/([^/]+)\/approve$/);
  if (approve) { if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]); const body = parse(approvalSchema as z.ZodTypeAny, await readJsonBody(request)) as z.infer<typeof approvalSchema>; return response(context, await dependencies.finance.approveDiscount(financeContext(context), approve[1], body.approvedMinor, body.expiresAt)); }
  if (path === "/api/v1/revenue-entries") { if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]); return response(context, await dependencies.finance.recordRevenue(financeContext(context), parse(revenueSchema, await readJsonBody(request))), 201); }
  const reversal = path.match(/^\/api\/v1\/revenue-entries\/([^/]+)\/reverse$/);
  if (reversal) { if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]); const body = parse(reversalSchema, await readJsonBody(request)); return response(context, await dependencies.finance.reverseRevenue(financeContext(context), reversal[1], body.evidenceId), 201); }
  return undefined;
}

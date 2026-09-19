import { z } from "zod";
import { ReportingService, type ReportFilters } from "../domain/reporting/service";
import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { parse, readJsonBody } from "./validation";

const date = z.string().datetime({ offset: true }).transform((value) => new Date(value));
const filtersSchema = z.object({ from: date.optional(), to: date.optional(), branchId: z.string().trim().min(1).max(128).optional(), sourceId: z.string().trim().min(1).max(128).optional(), campaignId: z.string().trim().min(1).max(128).optional(), assignedMembershipId: z.string().trim().min(1).max(128).optional(), channel: z.string().trim().min(1).max(32).optional(), diseaseId: z.string().trim().min(1).max(128).optional(), treatmentId: z.string().trim().min(1).max(128).optional() }).strict();
const exportSchema = z.object({ type: z.enum(["funnel", "cohorts", "drill-down"]), filters: filtersSchema.default({}) }).strict();
export interface ReportRouteDependencies { reporting: ReportingService; branchScope?: (context: RequestContext) => readonly string[] | undefined; }
function scope(context: RequestContext, dependencies: ReportRouteDependencies) {
  if (!context.actor) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required");
  return { tenantId: context.actor.tenantId, actorMembershipId: context.actor.membershipId, roles: context.actor.roles, branchIds: dependencies.branchScope?.(context) };
}
function filters(request: Request): ReportFilters { const query = new URL(request.url).searchParams; return parse(filtersSchema as unknown as z.ZodType<ReportFilters>, Object.fromEntries([...query].filter(([, value]) => value !== ""))); }
const response = (context: RequestContext, data: unknown, status = 200) => Response.json({ success: true, data }, { status, headers: { "X-Request-Id": context.requestId, "Cache-Control": "no-store" } });

/** Registration seam; router composition intentionally remains outside this phase. */
export async function handleReportRoutes(request: Request, context: RequestContext, dependencies: ReportRouteDependencies): Promise<Response | undefined> {
  const path = new URL(request.url).pathname; const reportingScope = scope(context, dependencies); const reportFilters = filters(request);
  if (path === "/api/v1/reports/funnel") { if (request.method !== "GET") return methodNotAllowed(context.requestId, ["GET"]); return response(context, await dependencies.reporting.funnel(reportingScope, reportFilters)); }
  if (path === "/api/v1/reports/cohorts") { if (request.method !== "GET") return methodNotAllowed(context.requestId, ["GET"]); return response(context, await dependencies.reporting.cohorts(reportingScope, reportFilters)); }
  if (path === "/api/v1/reports/communications") { if (request.method !== "GET") return methodNotAllowed(context.requestId, ["GET"]); return response(context, await dependencies.reporting.communication(reportingScope, reportFilters)); }
  if (path === "/api/v1/reports/agents") { if (request.method !== "GET") return methodNotAllowed(context.requestId, ["GET"]); return response(context, await dependencies.reporting.agents(reportingScope, reportFilters)); }
  if (path === "/api/v1/reports/sources") { if (request.method !== "GET") return methodNotAllowed(context.requestId, ["GET"]); return response(context, await dependencies.reporting.sources(reportingScope, reportFilters)); }
  if (path === "/api/v1/reports/channels") { if (request.method !== "GET") return methodNotAllowed(context.requestId, ["GET"]); return response(context, await dependencies.reporting.channels(reportingScope, reportFilters)); }
  if (path === "/api/v1/reports/revenue") { if (request.method !== "GET") return methodNotAllowed(context.requestId, ["GET"]); return response(context, await dependencies.reporting.finance(reportingScope, reportFilters)); }
  if (path === "/api/v1/reports/recovery") { if (request.method !== "GET") return methodNotAllowed(context.requestId, ["GET"]); return response(context, await dependencies.reporting.recovery(reportingScope, reportFilters)); }
  if (path === "/api/v1/reports/drill-down") { if (request.method !== "GET") return methodNotAllowed(context.requestId, ["GET"]); return response(context, await dependencies.reporting.drillDown(reportingScope, reportFilters)); }
  const diagnostic = path.match(/^\/api\/v1\/reports\/diagnostic\/(daily|weekly|15-day|monthly)$/);
  if (diagnostic) { if (request.method !== "GET") return methodNotAllowed(context.requestId, ["GET"]); const days = ({ daily: 1, weekly: 7, "15-day": 15, monthly: 30 } as const)[diagnostic[1] as "daily" | "weekly" | "15-day" | "monthly"]; return response(context, await dependencies.reporting.diagnostic(reportingScope, days, reportFilters)); }
  const queue = path.match(/^\/api\/v1\/work-queues\/(morning|day|end)$/);
  if (queue) { if (request.method !== "GET") return methodNotAllowed(context.requestId, ["GET"]); return response(context, await dependencies.reporting.managementQueue(reportingScope, queue[1] as "morning" | "day" | "end")); }
  if (path === "/api/v1/exports") { if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]); const input = parse(exportSchema as unknown as z.ZodType<{ type: "funnel" | "cohorts" | "drill-down"; filters: ReportFilters }>, await readJsonBody(request)); return response(context, await dependencies.reporting.requestExport(reportingScope, input.type, input.filters), 202); }
  return undefined;
}

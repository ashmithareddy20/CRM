import { z } from "zod";
import { leadImportSchema, leadIntakeSchema, leadMergeSchema } from "../../lib/api/leads";
import { LeadIntakeService } from "../domain/leads/service";
import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { parse, readJsonBody } from "./validation";

export interface LeadRouteDependencies { leads: LeadIntakeService; }
const leadPath = /^\/api\/v1\/leads\/([^/]+)(?:\/(merge|dedup-candidates))?$/;
const response = <T>(context: RequestContext, data: T, status = 200) => Response.json({ success: true, data }, { status, headers: { "X-Request-Id": context.requestId } });
function domainContext(context: RequestContext) {
  if (!context.actor) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required");
  return { tenantId: context.actor.tenantId, actorMembershipId: context.actor.membershipId, now: context.now, requestId: context.requestId };
}

/** Route registration seam: router integration owns authentication/context construction. */
export async function handleLeadRoutes(request: Request, context: RequestContext, dependencies: LeadRouteDependencies): Promise<Response | undefined> {
  const path = new URL(request.url).pathname;
  if (path === "/api/v1/leads") {
    if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]);
    const body = parse(leadIntakeSchema, await readJsonBody(request));
    return response(context, await dependencies.leads.intake(domainContext(context), body), 201);
  }
  if (path === "/api/v1/lead-imports") {
    if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]);
    const body = parse(leadImportSchema, await readJsonBody(request));
    const rows = await Promise.all(body.rows.map(async (row, rowIndex) => {
      try { return { row: rowIndex + 1, accepted: true as const, result: await dependencies.leads.intake(domainContext(context), row) }; }
      catch (error) { return { row: rowIndex + 1, accepted: false as const, error: error instanceof ApiError ? { code: error.code, fields: error.fields } : { code: "INVALID_ROW" } }; }
    }));
    return response(context, { rows, accepted: rows.filter((row) => row.accepted).length, rejected: rows.filter((row) => !row.accepted).length }, 202);
  }
  const match = path.match(leadPath);
  if (!match) return undefined;
  const [, leadId, action] = match;
  if (action === "dedup-candidates") {
    if (request.method !== "GET") return methodNotAllowed(context.requestId, ["GET"]);
    // Candidate details remain tenant-scoped and contain no identifiers.
    return response(context, await dependencies.leads.candidates(domainContext(context), leadId));
  }
  if (action === "merge") {
    if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]);
    const body = parse(leadMergeSchema, await readJsonBody(request));
    await dependencies.leads.merge(domainContext(context), leadId, body.canonicalLeadId, body.expectedVersion, body.reason);
    return response(context, { mergedLeadId: leadId, canonicalLeadId: body.canonicalLeadId });
  }
  return undefined;
}

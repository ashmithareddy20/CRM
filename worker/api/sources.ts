import { and, eq } from "drizzle-orm";
import { campaigns, sourceTaxonomy } from "../../db/schema";
import { campaignSchema, sourceSchema } from "../../lib/api/leads";
import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { parse, readJsonBody } from "./validation";

const success = <T>(context: RequestContext, data: T, status = 200) => Response.json({ success: true, data }, { status, headers: { "X-Request-Id": context.requestId } });
function actor(context: RequestContext) { if (!context.actor || !context.db) throw new ApiError(context.actor ? "SERVICE_UNAVAILABLE" : "AUTHENTICATION_REQUIRED", context.actor ? 503 : 401, context.actor ? "Database binding is unavailable" : "Authentication is required"); return context.actor; }

/** Source/campaign attribution routes. They require a verified tenant context and never infer missing provenance. */
export async function handleSourceRoutes(request: Request, context: RequestContext): Promise<Response | undefined> {
  const path = new URL(request.url).pathname;
  if (path === "/api/v1/sources") {
    const current = actor(context);
    if (request.method === "GET") return success(context, await context.db!.select().from(sourceTaxonomy).where(eq(sourceTaxonomy.tenantId, current.tenantId)).all());
    if (request.method !== "POST") return methodNotAllowed(context.requestId, ["GET", "POST"]);
    const body = parse(sourceSchema, await readJsonBody(request));
    const record = { id: crypto.randomUUID(), tenantId: current.tenantId, key: body.key, label: body.label, createdAt: context.now, createdByMembershipId: current.membershipId };
    await context.db!.insert(sourceTaxonomy).values(record);
    return success(context, record, 201);
  }
  if (path === "/api/v1/campaigns") {
    const current = actor(context);
    if (request.method === "GET") return success(context, await context.db!.select().from(campaigns).where(eq(campaigns.tenantId, current.tenantId)).all());
    if (request.method !== "POST") return methodNotAllowed(context.requestId, ["GET", "POST"]);
    const body = parse(campaignSchema, await readJsonBody(request));
    const source = await context.db!.select({ id: sourceTaxonomy.id }).from(sourceTaxonomy).where(and(eq(sourceTaxonomy.tenantId, current.tenantId), eq(sourceTaxonomy.id, body.sourceId))).get();
    if (!source) throw new ApiError("NOT_FOUND", 404, "Source is unavailable");
    const record = { id: crypto.randomUUID(), tenantId: current.tenantId, sourceId: body.sourceId, provider: body.provider, externalId: body.externalId ?? null, name: body.name, startsAt: body.startsAt ?? null, endsAt: body.endsAt ?? null, createdAt: context.now, createdByMembershipId: current.membershipId };
    await context.db!.insert(campaigns).values(record);
    return success(context, record, 201);
  }
  return undefined;
}

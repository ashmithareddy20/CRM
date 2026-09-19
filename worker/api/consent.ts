import { z } from "zod";
import type { ConsentService } from "../domain/consent/service";
import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { parse, readJsonBody } from "./validation";
const channel = z.enum(["whatsapp", "rcs", "mms", "call"]);
const consent = z.object({ contactId: z.string().min(1).max(128), purpose: z.string().min(1).max(80), channel: channel.optional(), state: z.enum(["granted", "withdrawn", "denied", "unknown"]), occurredAt: z.coerce.date().optional(), expiresAt: z.coerce.date().optional(), evidenceId: z.string().max(128).optional() }).strict();
const suppression = z.object({ contactId: z.string().min(1).max(128), channel: channel.optional(), reason: z.string().min(1).max(160), occurredAt: z.coerce.date().optional() }).strict();
export interface ConsentRouteDependencies { consents: ConsentService; }
function actor(context: RequestContext) { if (!context.actor) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required"); return context.actor; }
function response(context: RequestContext, data: unknown, status = 200) { return Response.json({ success: true, data }, { status, headers: { "X-Request-Id": context.requestId } }); }
export async function handleConsentRoutes(request: Request, context: RequestContext, dependencies: ConsentRouteDependencies): Promise<Response | undefined> {
  const path = new URL(request.url).pathname; if (path !== "/api/v1/consents" && path !== "/api/v1/suppressions") return undefined;
  if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]);
  const authenticated = actor(context);
  if (path.endsWith("consents")) { const body = parse(consent, await readJsonBody(request)); return response(context, await dependencies.consents.record({ tenantId: authenticated.tenantId, contactId: body.contactId, purpose: body.purpose, ...(body.channel ? { channel: body.channel } : {}), state: body.state, occurredAt: body.occurredAt ?? context.now, ...(body.expiresAt ? { expiresAt: body.expiresAt } : {}), ...(body.evidenceId ? { evidenceId: body.evidenceId } : {}), actorMembershipId: authenticated.membershipId }), 201); }
  const body = parse(suppression, await readJsonBody(request)); return response(context, await dependencies.consents.suppress({ tenantId: authenticated.tenantId, contactId: body.contactId, ...(body.channel ? { channel: body.channel } : {}), reason: body.reason, active: true, occurredAt: body.occurredAt ?? context.now }), 201);
}

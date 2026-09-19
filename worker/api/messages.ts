import { z } from "zod";
import type { CommunicationService } from "../domain/communication/service";
import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { parse, readJsonBody } from "./validation";
const event = z.object({ providerEventId: z.string().min(1).max(200), type: z.enum(["sent", "delivered", "failed", "read", "replied", "clicked", "delivery_unknown"]), occurredAt: z.coerce.date().optional() }).strict();
export interface MessageRouteDependencies { communications: CommunicationService; }
const eventPath = /^\/api\/v1\/messages\/([^/]+)\/events$/;
function actor(context: RequestContext) { if (!context.actor) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required"); return context.actor; }
export async function handleMessageRoutes(request: Request, context: RequestContext, dependencies: MessageRouteDependencies): Promise<Response | undefined> {
  const match = new URL(request.url).pathname.match(eventPath); if (!match) return undefined; if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]); const authenticated = actor(context); const body = parse(event, await readJsonBody(request)); const inserted = await dependencies.communications.recordEvent({ tenantId: authenticated.tenantId, attemptId: match[1], providerEventId: body.providerEventId, type: body.type, occurredAt: body.occurredAt ?? context.now }); if (body.type === "replied") await dependencies.communications.pauseForAttempt(authenticated.tenantId, match[1], "reply"); return Response.json({ success: true, data: { accepted: inserted, duplicate: !inserted } }, { status: inserted ? 201 : 200, headers: { "X-Request-Id": context.requestId } });
}

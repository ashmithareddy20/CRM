import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { D1EvidenceMetadataRegistry, privateEvidenceResponseFor, type PrivateObjectStore } from "../security/evidence";
/** Registrar seam for a proxied, per-request-authorized private evidence download. */
export async function handleEvidenceRoutes(request: Request, context: RequestContext, store?: PrivateObjectStore): Promise<Response | undefined> {
  const match = new URL(request.url).pathname.match(/^\/api\/v1\/evidence\/([^/]+)$/u); if (!match) return undefined;
  if (request.method !== "GET") return methodNotAllowed(context.requestId, ["GET"]);
  if (!context.actor || !context.env.DB || !store) throw new ApiError("NOT_FOUND", 404, "Resource not found");
  const actor = context.actor; const permitted = actor.roles.includes("decryptor") || actor.roles.includes("clinician") || actor.roles.includes("financial_counselor");
  return privateEvidenceResponseFor(new D1EvidenceMetadataRegistry(context.env.DB), store, { tenantId: actor.tenantId, evidenceId: match[1], permitted, expiresAt: new Date(context.now.getTime() + 60_000) }, context.now);
}

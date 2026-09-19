import { z } from "zod";
import type { ContentService } from "../domain/content/service";
import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { parse, readJsonBody } from "./validation";
const template = z.object({ key: z.string().min(1).max(100), purpose: z.string().min(1).max(80), channel: z.enum(["whatsapp", "rcs", "mms", "call"]) }).strict();
const version = z.object({ contentCiphertext: z.string().min(1).max(32_000), contentHash: z.string().min(1).max(256), variables: z.array(z.string()).max(30).optional(), assetIds: z.array(z.string()).max(10).optional() }).strict();
const asset = z.object({ objectKey: z.string().min(3).max(512), contentHash: z.string().min(1).max(256), mediaType: z.string().min(1).max(100), status: z.literal("quarantined") }).strict();
export interface TemplateRouteDependencies { content: ContentService; }
const templatePath = /^\/api\/v1\/templates\/([^/]+)(?:\/(versions|approvals|activate))?$/;
function actor(context: RequestContext) { if (!context.actor) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required"); return context.actor; }
function response(context: RequestContext, data: unknown, status = 200) { return Response.json({ success: true, data }, { status, headers: { "X-Request-Id": context.requestId } }); }
export async function handleTemplateRoutes(request: Request, context: RequestContext, dependencies: TemplateRouteDependencies): Promise<Response | undefined> {
  const path = new URL(request.url).pathname;
  if (path !== "/api/v1/templates" && path !== "/api/v1/assets" && !templatePath.test(path)) return undefined;
  const authenticated = actor(context);
  if (path === "/api/v1/templates") { if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]); return response(context, await dependencies.content.createTemplate({ tenantId: authenticated.tenantId, createdByMembershipId: authenticated.membershipId, ...parse(template, await readJsonBody(request)) }), 201); }
  if (path === "/api/v1/assets") { if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]); return response(context, await dependencies.content.registerPrivateAsset({ tenantId: authenticated.tenantId, ...parse(asset, await readJsonBody(request)) }), 201); }
  const match = path.match(templatePath)!; const [, templateId, action] = match;
  if (action === "versions") { if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]); return response(context, await dependencies.content.addVersion({ tenantId: authenticated.tenantId, templateId, authorMembershipId: authenticated.membershipId, ...parse(version, await readJsonBody(request)) }), 201); }
  if (action === "approvals") { if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]); const versionId = parse(z.object({ versionId: z.string().min(1).max(128) }).strict(), await readJsonBody(request)).versionId; return response(context, await dependencies.content.approve({ tenantId: authenticated.tenantId, templateId, versionId, approverMembershipId: authenticated.membershipId, at: context.now })); }
  if (action === "activate") { if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]); const versionId = parse(z.object({ versionId: z.string().min(1).max(128) }).strict(), await readJsonBody(request)).versionId; await dependencies.content.activate(authenticated.tenantId, templateId, versionId); return response(context, { activated: true }); }
  return undefined;
}

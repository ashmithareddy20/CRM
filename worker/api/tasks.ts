import { taskChangeSchema, taskCreateSchema } from "../../lib/api/lifecycle";
import { TaskService } from "../domain/tasks/service";
import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { parse, readJsonBody } from "./validation";

export interface TaskRouteDependencies { tasks: TaskService; }
const taskPath = /^\/api\/v1\/tasks\/([^/]+)$/;
function contextFor(context: RequestContext) { if (!context.actor) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required"); return { tenantId: context.actor.tenantId, actorMembershipId: context.actor.membershipId, now: context.now, roles: context.actor.roles }; }
const success = (context: RequestContext, data: unknown, status = 200) => Response.json({ success: true, data }, { status, headers: { "X-Request-Id": context.requestId } });

export async function handleTaskRoutes(request: Request, context: RequestContext, dependencies: TaskRouteDependencies): Promise<Response | undefined> {
  const path = new URL(request.url).pathname;
  if (path === "/api/v1/tasks") {
    if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]);
    return success(context, await dependencies.tasks.create(contextFor(context), parse(taskCreateSchema, await readJsonBody(request))), 201);
  }
  if (path === "/api/v1/work-queues/overdue") {
    if (request.method !== "GET") return methodNotAllowed(context.requestId, ["GET"]);
    const assignee = new URL(request.url).searchParams.get("assigneeMembershipId") ?? undefined;
    return success(context, await dependencies.tasks.overdueQueue(contextFor(context), assignee));
  }
  const task = path.match(taskPath);
  if (!task) return undefined;
  if (request.method !== "POST") return methodNotAllowed(context.requestId, ["POST"]);
  return success(context, await dependencies.tasks.change(contextFor(context), task[1], parse(taskChangeSchema, await readJsonBody(request))));
}

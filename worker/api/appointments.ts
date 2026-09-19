import { z } from "zod";
import { AppointmentService } from "../domain/appointments/service";
import type { RequestContext } from "./context";
import { ApiError, methodNotAllowed } from "./errors";
import { parse, readJsonBody } from "./validation";

const instant = z.string().datetime({ offset: true }).transform((value) => new Date(value));
const createSchema = z.object({ leadId: z.string().min(1), doctorId: z.string().min(1), branchId: z.string().min(1), startsAt: instant, durationMinutes: z.number().int(), status: z.enum(["suggested", "considering", "booked", "confirmation_pending"]).optional(), patientPreference: z.string().max(500).optional() }).strict();
const transitionSchema = z.object({ expectedVersion: z.number().int().positive(), reason: z.string().trim().min(1).max(500).optional() }).strict();
const rescheduleSchema = createSchema.omit({ leadId: true }).extend({ expectedVersion: z.number().int().positive() }).strict();
const route = /^\/api\/v1\/appointments\/([^/]+)(?:\/(confirm|cancel|no-show|arrive|consultation|reschedule))?$/;
export interface AppointmentRouteDependencies { appointments: AppointmentService; }
function context(value: RequestContext) { if (!value.actor) throw new ApiError("AUTHENTICATION_REQUIRED", 401, "Authentication is required"); if (!value.actor.roles.some((role) => ["operations", "scheduler", "manager"].includes(role))) throw new ApiError("FORBIDDEN", 403, "Appointment management permission is required"); return { tenantId: value.actor.tenantId, actorMembershipId: value.actor.membershipId, now: value.now }; }
const response = <T>(context: RequestContext, data: T, status = 200) => Response.json({ success: true, data }, { status, headers: { "X-Request-Id": context.requestId } });

export async function handleAppointmentRoutes(request: Request, requestContext: RequestContext, dependencies: AppointmentRouteDependencies): Promise<Response | undefined> {
  const path = new URL(request.url).pathname;
  if (path === "/api/v1/appointments") { if (request.method !== "POST") return methodNotAllowed(requestContext.requestId, ["POST"]); return response(requestContext, await dependencies.appointments.book(context(requestContext), parse(createSchema as z.ZodTypeAny, await readJsonBody(request)) as z.infer<typeof createSchema>), 201); }
  const match = path.match(route); if (!match) return undefined; const [, appointmentId, action] = match;
  if (!action) return undefined;
  if (action === "reschedule") { if (request.method !== "POST") return methodNotAllowed(requestContext.requestId, ["POST"]); const body = parse(rescheduleSchema as z.ZodTypeAny, await readJsonBody(request)) as z.infer<typeof rescheduleSchema>; return response(requestContext, await dependencies.appointments.reschedule(context(requestContext), appointmentId, body.expectedVersion, body)); }
  if (request.method !== "POST") return methodNotAllowed(requestContext.requestId, ["POST"]);
  const body = parse(transitionSchema, await readJsonBody(request));
  const status = ({ confirm: "confirmed", cancel: "cancelled", "no-show": "no_show", arrive: "arrived", consultation: "consultation_completed" } as const)[action];
  await dependencies.appointments.transition(context(requestContext), appointmentId, body.expectedVersion, status!, body.reason);
  return response(requestContext, { appointmentId, status });
}

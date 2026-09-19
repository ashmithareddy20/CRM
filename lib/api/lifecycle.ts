import { z } from "zod";

const id = z.string().trim().min(1).max(128);
const dueDate = z.coerce.date();

export const lifecycleStageSchema = z.enum([
  "received", "source_identified", "assigned", "contact_attempted", "meaningful_connection",
  "requirement_identified", "qualified", "follow_up_active", "appointment_suggested",
  "appointment_booked", "appointment_confirmed", "arrived", "consultation", "treatment_advised",
  "financial_counseling", "procedure_booked", "admission", "treatment_completed", "revenue_recorded",
  "closed",
]);
export type LifecycleStage = z.infer<typeof lifecycleStageSchema>;

export const transitionCommandSchema = z.object({
  toStage: lifecycleStageSchema,
  expectedVersion: z.number().int().positive(),
  reasonId: id.optional(),
  evidenceId: id.optional(),
  nextAction: z.object({ action: z.string().trim().min(3).max(500), ownerMembershipId: id, dueAt: dueDate }).optional(),
  commandId: id.optional(),
}).strict();

export const callAttemptSchema = z.object({
  leadId: id,
  direction: z.enum(["outbound", "inbound"]),
  provider: z.string().trim().min(1).max(80).optional(),
  externalId: id.optional(),
  dialedAt: dueDate.optional(),
  connectedAt: dueDate.optional(),
  endedAt: dueDate.optional(),
  disposition: z.enum(["pending", "answered", "no_answer", "busy", "switched_off", "out_of_network", "rejected", "invalid_number", "wrong_number", "unavailable", "repeatedly_unreachable"]).default("pending"),
  pairId: id.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.connectedAt && value.dialedAt && value.connectedAt < value.dialedAt) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["connectedAt"], message: "Connection time cannot precede dial time" });
  if (value.endedAt && value.dialedAt && value.endedAt < value.dialedAt) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endedAt"], message: "End time cannot precede dial time" });
});

export const callEventSchema = z.object({
  provider: z.string().trim().min(1).max(80).optional(),
  externalId: id.optional(),
  disposition: z.enum(["pending", "answered", "no_answer", "busy", "switched_off", "out_of_network", "rejected", "invalid_number", "wrong_number", "unavailable", "repeatedly_unreachable"]),
  dialedAt: dueDate.optional(),
  connectedAt: dueDate.optional(),
  endedAt: dueDate.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.connectedAt && value.dialedAt && value.connectedAt < value.dialedAt) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["connectedAt"], message: "Connection time cannot precede dial time" });
  if (value.endedAt && value.dialedAt && value.endedAt < value.dialedAt) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endedAt"], message: "End time cannot precede dial time" });
});

export const callRemarkSchema = z.object({
  disposition: z.enum(["meaningful_connection", "no_answer", "busy", "switched_off", "out_of_network", "rejected", "invalid_number", "wrong_number", "unavailable", "repeatedly_unreachable", "not_interested"]),
  patientStatement: z.string().trim().min(2).max(4000).optional(),
  agentExplanation: z.string().trim().min(2).max(4000).optional(),
  objection: z.string().trim().min(2).max(1000).optional(),
  materialShared: z.string().trim().min(2).max(1000).optional(),
  nextAction: z.string().trim().min(2).max(500).optional(),
  nextActionOwnerMembershipId: id.optional(),
  nextActionDueAt: dueDate.optional(),
  notApplicableReason: z.string().trim().min(3).max(1000).optional(),
}).strict().superRefine((value, ctx) => {
  const nextActionComplete = Boolean(value.nextAction && value.nextActionOwnerMembershipId && value.nextActionDueAt);
  if (value.nextAction && !nextActionComplete) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nextAction"], message: "Next action requires owner and due date" });
  if (value.disposition === "meaningful_connection" && !value.patientStatement) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["patientStatement"], message: "Meaningful contact requires a patient or decision-maker statement" });
  if (!value.notApplicableReason && !nextActionComplete && !value.patientStatement && !value.agentExplanation && !value.objection && !value.materialShared) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["notApplicableReason"], message: "Structured remark details or a reason they are not applicable is required" });
  }
});

export const taskCreateSchema = z.object({ leadId: id.optional(), assigneeMembershipId: id.optional(), title: z.string().trim().min(3).max(500), dueAt: dueDate, priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"), slaPolicyKey: z.string().trim().min(2).max(120).optional() }).strict();
export const taskChangeSchema = z.object({ expectedVersion: z.number().int().positive(), status: z.enum(["completed", "cancelled", "open"]), reason: z.string().trim().min(3).max(1000).optional(), dueAt: dueDate.optional() }).strict();

export const policyVersionSchema = z.object({ key: z.string().trim().regex(/^[a-z0-9._-]+$/).min(2).max(100), version: z.string().trim().min(1).max(80), effectiveAt: dueDate, definition: z.record(z.unknown()), approvalReason: z.string().trim().min(3).max(1000) }).strict();

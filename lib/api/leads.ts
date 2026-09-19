import { z } from "zod";

const identifierSchema = z.string().trim().min(3).max(254);
const optionalText = z.string().trim().min(1).max(256).optional();

export const leadOriginSchema = z.enum(["manual", "import", "provider_form", "non_campaign"]);
export const leadIntakeSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  phone: identifierSchema.optional(),
  email: z.string().trim().email().max(254).optional(),
  countryCallingCode: z.string().regex(/^\d{1,3}$/).optional(),
  sourceId: z.string().trim().min(1).max(128),
  platform: z.string().trim().min(1).max(80),
  origin: leadOriginSchema,
  campaignId: optionalText,
  adSetId: optionalText,
  creativeId: optionalText,
  formId: optionalText,
  landingPage: z.string().url().max(2048).optional(),
  utm: z.record(z.string().trim().max(256)).optional(),
  referrer: z.string().url().max(2048).optional(),
  externalSubmissionId: z.string().trim().min(1).max(256).optional(),
  generatedAt: z.coerce.date().optional(),
  receivedAt: z.coerce.date().optional(),
  branchId: optionalText,
  diseaseId: optionalText,
  serviceArea: optionalText,
  repeatOfLeadId: optionalText,
}).superRefine((value, context) => {
  if (!value.phone && !value.email) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "A phone number or email is required" });
  }
  if (value.origin !== "non_campaign" && !value.campaignId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["campaignId"], message: "Campaign is required unless origin is explicitly non-campaign" });
  }
  if (value.origin === "provider_form" && !value.formId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["formId"], message: "Provider-form intake requires form provenance" });
  }
});

export const leadImportSchema = z.object({
  rows: z.array(leadIntakeSchema).min(1).max(500),
});

export const leadMergeSchema = z.object({
  canonicalLeadId: z.string().trim().min(1).max(128),
  reason: z.string().trim().min(3).max(1000),
  expectedVersion: z.number().int().positive(),
});

export const sourceSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9_-]+$/).min(2).max(80),
  label: z.string().trim().min(1).max(120),
});

export const campaignSchema = z.object({
  sourceId: z.string().trim().min(1).max(128),
  provider: z.string().trim().min(1).max(80),
  externalId: z.string().trim().min(1).max(256).optional(),
  name: z.string().trim().min(1).max(200),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
}).refine((value) => !value.startsAt || !value.endsAt || value.endsAt >= value.startsAt, {
  message: "Campaign end time must be after its start time", path: ["endsAt"],
});

export const assignmentCommandSchema = z.object({
  expectedVersion: z.number().int().positive(),
  overrideMembershipId: z.string().trim().min(1).max(128).optional(),
  reason: z.string().trim().min(3).max(1000).optional(),
});

export const qualificationAnswersSchema = z.object({
  symptomSeverity: z.enum(["none", "mild", "moderate", "severe"]).optional(),
  duration: z.enum(["under_2_weeks", "2_to_12_weeks", "over_12_weeks"]).optional(),
  urgency: z.enum(["routine", "soon", "urgent", "emergency"]).optional(),
  distance: z.enum(["near", "regional", "remote"]).optional(),
  financialReadiness: z.enum(["ready", "planning", "unknown", "not_ready"]).optional(),
  appointmentReadiness: z.enum(["ready", "considering", "not_ready"]).optional(),
  decisionAuthority: z.enum(["self", "shared", "needs_decision_maker"]).optional(),
  previousTreatment: z.enum(["none", "tried", "ongoing"]).optional(),
  insurance: z.enum(["approved", "available", "unknown", "none"]).optional(),
  consultationInterest: z.enum(["high", "medium", "low"]).optional(),
  surgeryInterest: z.enum(["high", "medium", "low", "not_applicable"]).optional(),
}).strict();

export const qualificationCommandSchema = z.object({
  questionnaireId: z.string().trim().min(1).max(128),
  policyId: z.string().trim().min(1).max(128).optional(),
  answers: qualificationAnswersSchema,
  override: z.object({
    classification: z.enum(["hot", "warm", "cold"]),
    reason: z.string().trim().min(3).max(1000),
  }).optional(),
});

export type LeadIntakeInput = z.infer<typeof leadIntakeSchema>;
export type QualificationAnswers = z.infer<typeof qualificationAnswersSchema>;

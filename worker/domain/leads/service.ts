import type { LeadIntakeInput } from "../../../lib/api/leads";
import { ApiError } from "../../api/errors";
import { normalizedIdentifiers } from "./normalization";
import type { LeadRepository } from "./repository";

export interface SensitiveDataProtector {
  encrypt(tenantId: string, recordId: string, purpose: string, plaintext: string): Promise<string>;
  blindIndex(tenantId: string, purpose: string, normalized: string): Promise<string>;
}

export interface LeadServiceContext {
  tenantId: string;
  actorMembershipId: string;
  now: Date;
  requestId: string;
}

export interface IntakeResult {
  leadId: string;
  duplicateDelivery: boolean;
  candidateLeadIds: string[];
  provenanceStatus: "complete" | "review_required";
}

const id = () => crypto.randomUUID();

export class LeadIntakeService {
  constructor(private readonly repository: LeadRepository, private readonly protector: SensitiveDataProtector) {}

  async intake(context: LeadServiceContext, input: LeadIntakeInput): Promise<IntakeResult> {
    const provider = input.platform.toLowerCase();
    if (input.externalSubmissionId) {
      const accepted = await this.repository.findExternalSubmission(context.tenantId, provider, input.externalSubmissionId);
      if (accepted) return { leadId: accepted.leadId ?? "", duplicateDelivery: true, candidateLeadIds: [], provenanceStatus: "complete" };
    }
    if (!await this.repository.findSource(context.tenantId, input.sourceId)) {
      throw new ApiError("NOT_FOUND", 404, "Source is unavailable");
    }

    const identifiers = normalizedIdentifiers(input);
    const [phoneBlindIndex, emailBlindIndex] = await Promise.all([
      identifiers.phone ? this.protector.blindIndex(context.tenantId, "contact-phone", identifiers.phone) : undefined,
      identifiers.email ? this.protector.blindIndex(context.tenantId, "contact-email", identifiers.email) : undefined,
    ]);
    const matches = await this.repository.findContactMatches(context.tenantId, phoneBlindIndex, emailBlindIndex);
    const contactId = id();
    const leadId = id();
    const now = context.now;
    const generatedAt = input.generatedAt ?? now;
    const provenanceStatus = input.origin === "import" && (!input.campaignId || !input.formId) ? "review_required" : "complete";

    await this.repository.createIntake({
      contact: {
        id: contactId, tenantId: context.tenantId, createdAt: now, createdByMembershipId: context.actorMembershipId,
        nameCiphertext: input.name ? await this.protector.encrypt(context.tenantId, contactId, "contact-name", input.name.trim()) : null,
        phoneCiphertext: identifiers.phone ? await this.protector.encrypt(context.tenantId, contactId, "contact-phone", identifiers.phone) : null,
        phoneBlindIndex: phoneBlindIndex ?? null,
        emailCiphertext: identifiers.email ? await this.protector.encrypt(context.tenantId, contactId, "contact-email", identifiers.email) : null,
        emailBlindIndex: emailBlindIndex ?? null,
      },
      lead: {
        id: leadId, tenantId: context.tenantId, contactId, sourceId: input.sourceId, campaignId: input.campaignId ?? null,
        branchId: input.branchId ?? null, lifecycleStage: "received", receivedAt: input.receivedAt ?? now, generatedAt,
        createdAt: now, createdByMembershipId: context.actorMembershipId,
      },
      touch: {
        id: id(), tenantId: context.tenantId, leadId, campaignId: input.campaignId ?? null, formId: input.formId ?? null,
        occurredAt: generatedAt, utmJson: input.utm ? JSON.stringify(input.utm) : null, referrer: input.referrer ?? input.landingPage ?? null,
        createdAt: now, createdByMembershipId: context.actorMembershipId,
      },
      ...(input.externalSubmissionId ? {
        submission: {
          id: id(), tenantId: context.tenantId, leadId, provider, externalId: input.externalSubmissionId,
          // Provider body stays in its durable secured inbox; this table stores only an opaque provenance marker.
          payloadCiphertext: null, receivedAt: input.receivedAt ?? now, createdAt: now, createdByMembershipId: context.actorMembershipId,
        },
      } : {}),
      candidates: matches.flatMap((match) => {
        if (input.repeatOfLeadId) return [];
        // A matching identifier is deliberately only a candidate: shared family numbers and repeat enquiries are valid.
        return [{ id: id(), tenantId: context.tenantId, leadId, candidateLeadId: match.id, reason: phoneBlindIndex ? "matching_phone" : "matching_email", createdAt: now, createdByMembershipId: context.actorMembershipId }];
      }),
    });

    return { leadId, duplicateDelivery: false, candidateLeadIds: matches.map((match) => match.id), provenanceStatus };
  }

  async candidates(context: LeadServiceContext, leadId: string) {
    if (!await this.repository.findLead(context.tenantId, leadId)) throw new ApiError("NOT_FOUND", 404, "Lead is unavailable");
    return this.repository.listCandidates(context.tenantId, leadId);
  }

  async merge(context: LeadServiceContext, mergedLeadId: string, canonicalLeadId: string, expectedVersion: number, reason: string): Promise<void> {
    if (mergedLeadId === canonicalLeadId) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { canonicalLeadId: "A lead cannot merge into itself" });
    const [merged, canonical] = await Promise.all([
      this.repository.findLead(context.tenantId, mergedLeadId), this.repository.findLead(context.tenantId, canonicalLeadId),
    ]);
    if (!merged || !canonical || merged.archivedReason || canonical.archivedReason) throw new ApiError("NOT_FOUND", 404, "Lead is unavailable");
    if (merged.version !== expectedVersion) throw new ApiError("PRECONDITION_FAILED", 412, "Lead was changed by another request");
    const success = await this.repository.createMerge({
      link: { id: id(), tenantId: context.tenantId, canonicalLeadId, mergedLeadId, reason, createdAt: context.now, createdByMembershipId: context.actorMembershipId },
      mergedLeadId, expectedVersion, now: context.now,
    });
    if (!success) throw new ApiError("PRECONDITION_FAILED", 412, "Lead was changed by another request");
  }
}

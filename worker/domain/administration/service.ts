import type { z } from "zod";
import { policyVersionSchema } from "../../../lib/api/lifecycle";
import { ApiError } from "../../api/errors";

export interface AdministrationContext { tenantId: string; actorMembershipId: string; now: Date; roles: readonly string[]; }
export interface PolicyRepository { save(version: { id: string; tenantId: string; key: string; version: string; effectiveAt: Date; definition: Record<string, unknown>; approvedByMembershipId: string; approvalReason: string; createdAt: Date }): Promise<void>; list(tenantId: string, key?: string): Promise<unknown[]>; }
const protectedKeys = new Set(["consent", "audit", "mandatory_closure_evidence", "routine_message_minimum_interval"]);
const id = () => crypto.randomUUID();

/** Configuration is append-only and effective-dated; active journeys retain their captured version. */
export class AdministrationService {
  constructor(private readonly repository: PolicyRepository) {}
  async publish(context: AdministrationContext, rawInput: z.input<typeof policyVersionSchema>) {
    if (!context.roles.includes("tenant_administrator")) throw new ApiError("FORBIDDEN", 403, "Only a tenant administrator can publish policy versions");
    const input = policyVersionSchema.parse(rawInput);
    if (protectedKeys.has(input.key) && input.definition.enabled === false) throw new ApiError("VALIDATION_FAILED", 422, "This mandatory control cannot be disabled", { definition: "Protected policy controls cannot be disabled" });
    if (input.key === "routine_message_minimum_interval" && typeof input.definition.minimumHours === "number" && input.definition.minimumHours < 48) throw new ApiError("VALIDATION_FAILED", 422, "Routine messages require at least 48 elapsed hours", { definition: "minimumHours cannot be less than 48" });
    const version = { id: id(), tenantId: context.tenantId, key: input.key, version: input.version, effectiveAt: input.effectiveAt, definition: input.definition, approvedByMembershipId: context.actorMembershipId, approvalReason: input.approvalReason, createdAt: context.now };
    await this.repository.save(version);
    return version;
  }
  list(context: AdministrationContext, key?: string) { if (!context.roles.includes("tenant_administrator")) throw new ApiError("FORBIDDEN", 403, "Only a tenant administrator can view policy versions"); return this.repository.list(context.tenantId, key); }
}

import type { ActorContext } from "../api/context";

export type Capability =
  | "lead:read:assigned" | "lead:write:assigned" | "care:read:assigned" | "clinical:write:assigned"
  | "finance:read" | "finance:write" | "appointment:manage" | "report:read:aggregate"
  | "membership:manage" | "configuration:manage" | "audit:read" | "integration:ingest"
  | "export:run" | "field:decrypt" | "discount:approve" | "emergency:access";

const grants: Readonly<Record<string, readonly Capability[]>> = {
  agent: ["lead:read:assigned", "lead:write:assigned", "care:read:assigned"],
  manager: ["lead:read:assigned", "lead:write:assigned", "care:read:assigned", "appointment:manage", "report:read:aggregate"],
  clinician: ["lead:read:assigned", "care:read:assigned", "clinical:write:assigned"],
  financial_counselor: ["lead:read:assigned", "finance:read", "finance:write"],
  operations: ["lead:read:assigned", "appointment:manage"],
  scheduler: ["lead:read:assigned", "appointment:manage"],
  leadership: ["report:read:aggregate"],
  tenant_administrator: ["membership:manage", "configuration:manage"],
  auditor: ["audit:read"],
  integration_principal: ["integration:ingest"],
  discount_approver: ["discount:approve"],
  export_officer: ["export:run"],
  decryptor: ["field:decrypt"],
};

export function capabilitiesFor(roles: readonly string[]): ReadonlySet<Capability> { return new Set(roles.flatMap((role) => grants[role] ?? [])); }
export function hasCapability(actor: ActorContext, capability: Capability): boolean { return capabilitiesFor(actor.roles).has(capability); }
export function requireCapability(actor: ActorContext, capability: Capability, options: { maxSessionAgeMs?: number; now?: Date } = {}): void {
  if (!hasCapability(actor, capability)) throw new Error("Forbidden");
  if (options.maxSessionAgeMs !== undefined && (!actor.authenticatedAt || (options.now?.getTime() ?? Date.now()) - actor.authenticatedAt.getTime() > options.maxSessionAgeMs)) throw new Error("Step-up authentication is required");
}
export function canReadField(actor: ActorContext, field: "identity" | "clinical" | "finance"): boolean {
  if (field === "identity") return hasCapability(actor, "field:decrypt");
  if (field === "clinical") return actor.roles.includes("clinician") || hasCapability(actor, "field:decrypt");
  return actor.roles.includes("financial_counselor") || hasCapability(actor, "field:decrypt");
}

import type { ActorContext } from "../api/context";

/** Builds parameterized tenant predicates. IDs never become authorization by themselves. */
export function tenantScope(actor: ActorContext, aliases: { tenant?: string; id?: string } = {}): { sql: string; values: string[] } {
  const tenant = aliases.tenant ?? "tenant_id";
  return { sql: `${tenant} = ?`, values: [actor.tenantId] };
}

export function scopedResource(actor: ActorContext, id: string, aliases: { tenant?: string; id?: string } = {}): { sql: string; values: string[] } {
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(id)) throw new Error("Invalid resource ID");
  const tenant = aliases.tenant ?? "tenant_id";
  const identifier = aliases.id ?? "id";
  return { sql: `${tenant} = ? AND ${identifier} = ?`, values: [actor.tenantId, id] };
}

import type { Env } from "../env";

export interface ResolvedMembership { id: string; tenantId: string; userId: string; roles: readonly string[]; branchId?: string; teamId?: string }

/** All identity lookups constrain active membership and tenant before returning it. */
export class IdentityRepository {
  constructor(private readonly db?: D1Database) {}

  async membershipForOidc(issuer: string, subject: string, tenantId?: string): Promise<ResolvedMembership | undefined> {
    if (!this.db) return undefined;
    const whereTenant = tenantId ? "AND membership.tenant_id = ?" : "";
    const bindings = tenantId ? [issuer, subject, tenantId] : [issuer, subject];
    const result = await this.db.prepare(`
      SELECT membership.id, membership.tenant_id, membership.user_id, membership.branch_id, membership.team_id, role.key AS role_key
      FROM crm_oidc_identities identity
      JOIN crm_memberships membership ON membership.user_id = identity.user_id
      JOIN crm_roles role ON role.id = membership.role_id AND role.tenant_id = membership.tenant_id
      WHERE identity.issuer = ? AND identity.subject = ? AND membership.status = 'active' ${whereTenant}
    `).bind(...bindings).all<Record<string, string | null>>();
    return this.toMembership(result.results ?? []);
  }

  async membershipById(membershipId: string, tenantId?: string): Promise<ResolvedMembership | undefined> {
    if (!this.db) return undefined;
    const result = await this.db.prepare(`
      SELECT membership.id, membership.tenant_id, membership.user_id, membership.branch_id, membership.team_id, role.key AS role_key
      FROM crm_memberships membership JOIN crm_roles role ON role.id = membership.role_id AND role.tenant_id = membership.tenant_id
      WHERE membership.id = ? AND membership.status = 'active' ${tenantId ? "AND membership.tenant_id = ?" : ""}
    `).bind(...(tenantId ? [membershipId, tenantId] : [membershipId])).all<Record<string, string | null>>();
    return this.toMembership(result.results ?? []);
  }

  async revokeSession(sessionId: string, membershipId: string, tenantId: string, now: Date): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db.prepare("UPDATE crm_sessions SET revoked_at = ? WHERE id = ? AND membership_id = ? AND tenant_id = ? AND revoked_at IS NULL")
      .bind(now.getTime(), sessionId, membershipId, tenantId).run();
    return result.meta.changes === 1;
  }

  async activeSession(sessionId: string, membershipId: string, tenantId: string, now: Date): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db.prepare("SELECT id FROM crm_sessions WHERE id = ? AND membership_id = ? AND tenant_id = ? AND revoked_at IS NULL AND expires_at > ?")
      .bind(sessionId, membershipId, tenantId, now.getTime()).first();
    return Boolean(result);
  }

  private toMembership(rows: Record<string, string | null>[]): ResolvedMembership | undefined {
    if (rows.length === 0) return undefined;
    const first = rows[0];
    const roles = [...new Set(rows.map((row) => row.role_key).filter((role): role is string => Boolean(role)))];
    return { id: first.id!, tenantId: first.tenant_id!, userId: first.user_id!, roles, ...(first.branch_id ? { branchId: first.branch_id } : {}), ...(first.team_id ? { teamId: first.team_id } : {}) };
  }
}

export function identityRepository(env: Env): IdentityRepository { return new IdentityRepository(env.DB); }

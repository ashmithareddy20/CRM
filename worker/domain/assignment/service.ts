import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../../../db";
import { assignmentHistory, assignmentRules, leadEpisodes, memberships } from "../../../db/schema";
import { ApiError } from "../../api/errors";

export interface AssignmentContext { tenantId: string; actorMembershipId: string; now: Date; }
export interface AssignmentCriteria { diseaseId?: string; branchId?: string; serviceArea?: string; }
interface RuleDefinition { diseaseIds?: string[]; branchIds?: string[]; serviceAreas?: string[]; membershipIds?: string[]; capacity?: number; }
interface Candidate { id: string; workload: number; capacity: number; }
const id = () => crypto.randomUUID();

/** Stable, workload-balanced assignment. Rule configuration must name real membership IDs, never display names. */
export class AssignmentService {
  constructor(private readonly db: Database) {}

  async assign(context: AssignmentContext, leadId: string, expectedVersion: number, criteria: AssignmentCriteria, overrideMembershipId?: string, reason?: string): Promise<{ membershipId?: string; unassigned: boolean }> {
    const lead = await this.db.select().from(leadEpisodes).where(and(eq(leadEpisodes.tenantId, context.tenantId), eq(leadEpisodes.id, leadId))).get();
    if (!lead || lead.archivedReason) throw new ApiError("NOT_FOUND", 404, "Lead is unavailable");
    if (lead.version !== expectedVersion) throw new ApiError("PRECONDITION_FAILED", 412, "Lead was changed by another request");

    let ruleId: string | undefined;
    let selected: Candidate | undefined;
    if (overrideMembershipId) {
      const membership = await this.db.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.tenantId, context.tenantId), eq(memberships.id, overrideMembershipId), eq(memberships.status, "active"))).get();
      if (!membership) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { overrideMembershipId: "Assignee is unavailable" });
      selected = { id: membership.id, workload: 0, capacity: Number.MAX_SAFE_INTEGER };
    } else {
      const rules = await this.db.select().from(assignmentRules).where(and(eq(assignmentRules.tenantId, context.tenantId), eq(assignmentRules.active, true))).orderBy(asc(assignmentRules.priority)).all();
      for (const rule of rules) {
        const definition = parseRule(rule.definitionJson);
        if (!matches(definition, criteria) || !definition.membershipIds?.length) continue;
        const candidates = await this.availableCandidates(context.tenantId, definition.membershipIds, definition.capacity ?? 25);
        if (candidates.length) {
          selected = candidates.sort((a, b) => a.workload - b.workload || a.id.localeCompare(b.id))[0];
          ruleId = rule.id;
          break;
        }
      }
    }

    const membershipId = selected?.id ?? null;
    const result = await this.db.batch([
      this.db.update(leadEpisodes).set({ assignedMembershipId: membershipId, lifecycleStage: membershipId ? "assigned" : lead.lifecycleStage, updatedAt: context.now, updatedByMembershipId: context.actorMembershipId, version: sql`${leadEpisodes.version} + 1` })
        .where(and(eq(leadEpisodes.tenantId, context.tenantId), eq(leadEpisodes.id, leadId), eq(leadEpisodes.version, expectedVersion))),
      this.db.insert(assignmentHistory).values({ id: id(), tenantId: context.tenantId, leadId, fromMembershipId: lead.assignedMembershipId, toMembershipId: membershipId, ruleId: ruleId ?? null, reason: reason ?? (membershipId ? "workload_balanced" : "unassigned_capacity"), assignedAt: context.now, createdAt: context.now, createdByMembershipId: context.actorMembershipId }),
    ]);
    if ((result[0] as { meta?: { changes?: number } }).meta?.changes !== 1) throw new ApiError("PRECONDITION_FAILED", 412, "Lead was changed by another request");
    return membershipId ? { membershipId, unassigned: false } : { unassigned: true };
  }

  private async availableCandidates(tenantId: string, ids: string[], capacity: number): Promise<Candidate[]> {
    const active = await this.db.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.tenantId, tenantId), eq(memberships.status, "active"), inArray(memberships.id, ids))).all();
    const result: Candidate[] = [];
    for (const member of active) {
      const workload = await this.db.select({ count: sql<number>`count(*)` }).from(leadEpisodes).where(and(eq(leadEpisodes.tenantId, tenantId), eq(leadEpisodes.assignedMembershipId, member.id), sql`${leadEpisodes.archivedReason} IS NULL`)).get();
      const count = Number(workload?.count ?? 0);
      if (count < capacity) result.push({ id: member.id, workload: count, capacity });
    }
    return result;
  }
}

function parseRule(value: string): RuleDefinition { try { return JSON.parse(value) as RuleDefinition; } catch { return {}; } }
function matches(rule: RuleDefinition, criteria: AssignmentCriteria): boolean {
  return (!rule.diseaseIds?.length || (!!criteria.diseaseId && rule.diseaseIds.includes(criteria.diseaseId)))
    && (!rule.branchIds?.length || (!!criteria.branchId && rule.branchIds.includes(criteria.branchId)))
    && (!rule.serviceAreas?.length || (!!criteria.serviceArea && rule.serviceAreas.includes(criteria.serviceArea)));
}

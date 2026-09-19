import { and, asc, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "../../../db";
import {
  acquisitionTouches, campaigns, contacts, dedupCandidates, externalSubmissions, leadEpisodes,
  leadMergeLinks, sourceTaxonomy,
} from "../../../db/schema";

export interface LeadRepository {
  findSource(tenantId: string, sourceId: string): Promise<{ id: string } | undefined>;
  findExternalSubmission(tenantId: string, provider: string, externalId: string): Promise<{ id: string; leadId: string | null } | undefined>;
  findContactMatches(tenantId: string, phoneIndex?: string, emailIndex?: string): Promise<Array<{ id: string }>>;
  findLead(tenantId: string, leadId: string): Promise<{ id: string; contactId: string; version: number; archivedReason: string | null; assignedMembershipId: string | null; branchId: string | null } | undefined>;
  createSource(values: typeof sourceTaxonomy.$inferInsert): Promise<void>;
  createCampaign(values: typeof campaigns.$inferInsert): Promise<void>;
  createIntake(values: {
    contact: typeof contacts.$inferInsert;
    lead: typeof leadEpisodes.$inferInsert;
    touch: typeof acquisitionTouches.$inferInsert;
    submission?: typeof externalSubmissions.$inferInsert;
    candidates: Array<typeof dedupCandidates.$inferInsert>;
  }): Promise<void>;
  createMerge(values: { link: typeof leadMergeLinks.$inferInsert; mergedLeadId: string; expectedVersion: number; now: Date }): Promise<boolean>;
  listCandidates(tenantId: string, leadId: string): Promise<Array<{ id: string; candidateLeadId: string; reason: string; status: string }>>;
}

export function createLeadRepository(db: Database): LeadRepository {
  return {
    async findSource(tenantId, sourceId) {
      return db.select({ id: sourceTaxonomy.id }).from(sourceTaxonomy).where(and(eq(sourceTaxonomy.tenantId, tenantId), eq(sourceTaxonomy.id, sourceId), eq(sourceTaxonomy.active, true))).get();
    },
    async findExternalSubmission(tenantId, provider, externalId) {
      return db.select({ id: externalSubmissions.id, leadId: externalSubmissions.leadId }).from(externalSubmissions)
        .where(and(eq(externalSubmissions.tenantId, tenantId), eq(externalSubmissions.provider, provider), eq(externalSubmissions.externalId, externalId))).get();
    },
    async findContactMatches(tenantId, phoneIndex, emailIndex) {
      if (!phoneIndex && !emailIndex) return [];
      const matches = [
        phoneIndex ? eq(contacts.phoneBlindIndex, phoneIndex) : undefined,
        emailIndex ? eq(contacts.emailBlindIndex, emailIndex) : undefined,
      ].filter((term): term is SQL => Boolean(term));
      return db.select({ id: leadEpisodes.id }).from(contacts)
        .innerJoin(leadEpisodes, and(eq(leadEpisodes.contactId, contacts.id), eq(leadEpisodes.tenantId, contacts.tenantId)))
        .where(and(eq(contacts.tenantId, tenantId), or(...matches), isNull(leadEpisodes.archivedReason))).all();
    },
    async findLead(tenantId, leadId) {
      return db.select({ id: leadEpisodes.id, contactId: leadEpisodes.contactId, version: leadEpisodes.version, archivedReason: leadEpisodes.archivedReason, assignedMembershipId: leadEpisodes.assignedMembershipId, branchId: leadEpisodes.branchId })
        .from(leadEpisodes).where(and(eq(leadEpisodes.tenantId, tenantId), eq(leadEpisodes.id, leadId))).get();
    },
    async createSource(values) { await db.insert(sourceTaxonomy).values(values).run(); },
    async createCampaign(values) { await db.insert(campaigns).values(values).run(); },
    async createIntake(values) {
      // D1 batch preserves the all-or-nothing intake and candidate records.
      const statements = [
        db.insert(contacts).values(values.contact),
        db.insert(leadEpisodes).values(values.lead),
        db.insert(acquisitionTouches).values(values.touch),
        ...(values.submission ? [db.insert(externalSubmissions).values(values.submission)] : []),
        ...values.candidates.map((candidate) => db.insert(dedupCandidates).values(candidate).onConflictDoNothing()),
      ];
      await db.batch(statements as [typeof statements[number], ...typeof statements[number][]]);
    },
    async createMerge({ link, mergedLeadId, expectedVersion, now }) {
      // The conditional link sees the preceding guarded update in this atomic D1 batch.
      // A stale update therefore cannot produce an unrelated merge-history row.
      const update = db.update(leadEpisodes).set({ archivedReason: "merged", updatedAt: now, version: sql`${leadEpisodes.version} + 1` })
        .where(and(eq(leadEpisodes.tenantId, link.tenantId), eq(leadEpisodes.id, mergedLeadId), eq(leadEpisodes.version, expectedVersion), isNull(leadEpisodes.archivedReason)));
      const insertLink = db.run(sql`INSERT INTO crm_lead_merge_links (id, tenant_id, created_at, created_by_membership_id, version, canonical_lead_id, merged_lead_id, reason)
        SELECT ${link.id}, ${link.tenantId}, ${link.createdAt.getTime()}, ${link.createdByMembershipId}, 1, ${link.canonicalLeadId}, ${link.mergedLeadId}, ${link.reason}
        WHERE EXISTS (SELECT 1 FROM crm_lead_episodes WHERE tenant_id = ${link.tenantId} AND id = ${mergedLeadId} AND version = ${expectedVersion + 1} AND archived_reason = 'merged')`);
      const result = await db.batch([update, insertLink]);
      return (result[0] as { meta?: { changes?: number } }).meta?.changes === 1
        && (result[1] as { meta?: { changes?: number } }).meta?.changes === 1;
    },
    async listCandidates(tenantId, leadId) {
      return db.select({ id: dedupCandidates.id, candidateLeadId: dedupCandidates.candidateLeadId, reason: dedupCandidates.reason, status: dedupCandidates.status })
        .from(dedupCandidates).where(and(eq(dedupCandidates.tenantId, tenantId), eq(dedupCandidates.leadId, leadId))).orderBy(asc(dedupCandidates.createdAt)).all();
    },
  };
}

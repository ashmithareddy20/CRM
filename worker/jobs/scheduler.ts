import type { OpaqueWorkReference, WorkQueue } from "./contracts";

export interface JobSchedulerOptions { readonly leaseMs?: number; readonly limit?: number; readonly workerId: string; readonly now?: () => Date; }
export interface ClaimedJob { readonly id: string; readonly tenantId: string; }
const defaults = { leaseMs: 5 * 60_000, limit: 100 };

/** D1 holds delayed work; Queue is only a short-lived wake-up transport. */
export async function claimDueJobs(db: D1Database, options: JobSchedulerOptions): Promise<ClaimedJob[]> {
  const now = options.now?.() ?? new Date();
  const leaseExpiresAt = now.getTime() + (options.leaseMs ?? defaults.leaseMs);
  const rows = await db.prepare(`SELECT id, tenant_id AS tenantId FROM crm_durable_jobs
    WHERE state = 'pending' AND due_at <= ? AND (lease_expires_at IS NULL OR lease_expires_at < ?)
    ORDER BY due_at ASC LIMIT ?`).bind(now.getTime(), now.getTime(), options.limit ?? defaults.limit).all<ClaimedJob>();
  const claimed: ClaimedJob[] = [];
  for (const row of rows.results) {
    const result = await db.prepare(`UPDATE crm_durable_jobs SET state = 'leased', lease_owner = ?, lease_expires_at = ?, attempts = attempts + 1, updated_at = ?
      WHERE id = ? AND state = 'pending' AND (lease_expires_at IS NULL OR lease_expires_at < ?)`)
      .bind(options.workerId, leaseExpiresAt, now.getTime(), row.id, now.getTime()).run();
    if (result.meta.changes === 1) claimed.push(row);
  }
  return claimed;
}

export async function releaseExpiredLeases(db: D1Database, now = new Date()): Promise<number> {
  const result = await db.prepare(`UPDATE crm_durable_jobs SET state = 'pending', lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
    WHERE state = 'leased' AND lease_expires_at < ?`).bind(now.getTime(), now.getTime()).run();
  return result.meta.changes;
}

export async function enqueueClaimedJobs(queue: WorkQueue, jobs: readonly ClaimedJob[]): Promise<void> {
  for (const job of jobs) await queue.send({ kind: "job", id: job.id });
}

export async function scheduleDueJobs(db: D1Database, queue: WorkQueue, options: JobSchedulerOptions): Promise<number> {
  await releaseExpiredLeases(db, options.now?.() ?? new Date());
  const jobs = await claimDueJobs(db, options);
  await enqueueClaimedJobs(queue, jobs);
  return jobs.length;
}

export function opaqueJobReference(id: string): OpaqueWorkReference { return { kind: "job", id }; }

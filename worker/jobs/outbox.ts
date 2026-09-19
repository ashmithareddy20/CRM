import type { OpaqueWorkReference, WorkQueue } from "./contracts";

export interface OutboxRecord { id: string; tenantId: string; type: string; payloadCiphertext: string; }

/** A failed publish leaves the durable outbox pending and is safe to sweep later. */
export async function publishPendingOutbox(db: D1Database, queue: WorkQueue, now = new Date(), limit = 100): Promise<number> {
  const rows = await db.prepare(`SELECT id, tenant_id AS tenantId, type, payload_ciphertext AS payloadCiphertext FROM crm_transactional_outbox
    WHERE status = 'pending' AND available_at <= ? ORDER BY available_at ASC LIMIT ?`).bind(now.getTime(), limit).all<OutboxRecord>();
  let published = 0;
  for (const row of rows.results) {
    await queue.send({ kind: "outbox", id: row.id });
    // A crash before this update merely sends the same opaque reference again.
    const updated = await db.prepare(`UPDATE crm_transactional_outbox SET status = 'published', published_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'`)
      .bind(now.getTime(), now.getTime(), row.id).run();
    published += updated.meta.changes;
  }
  return published;
}

export function opaqueOutboxReference(id: string): OpaqueWorkReference { return { kind: "outbox", id }; }

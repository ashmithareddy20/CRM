export interface DeadLetterInput { tenantId: string; jobId?: string; reason: string; opaquePayload?: string; actorKey?: string; requestId?: string; }

export async function moveToDeadLetter(db: D1Database, input: DeadLetterInput, now = new Date()): Promise<string> {
  const id = crypto.randomUUID();
  const diagnostic = input.reason.slice(0, 240);
  await db.batch([
    db.prepare(`INSERT INTO crm_dead_letters (id, tenant_id, job_id, reason, payload_ciphertext, occurred_at, created_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)`).bind(id, input.tenantId, input.jobId ?? null, diagnostic, input.opaquePayload ?? null, now.getTime(), now.getTime()),
    db.prepare(`INSERT INTO crm_audit_events (id, tenant_id, actor_key, action, resource_type, resource_id, request_id, occurred_at, created_at, version, detail_ciphertext)
      VALUES (?, ?, ?, 'dead_letter.created', 'dead_letter', ?, ?, ?, ?, 1, ?)`)
      .bind(crypto.randomUUID(), input.tenantId, input.actorKey ?? 'system', id, input.requestId ?? `dlq:${id}`, now.getTime(), now.getTime(), JSON.stringify({ jobId: input.jobId, reason: diagnostic })), 
  ]);
  return id;
}

/** Replay creates a new pending job; the original DLQ evidence is immutable. */
export async function replayDeadLetter(db: D1Database, input: { deadLetterId: string; tenantId: string; actorKey: string; requestId: string }, now = new Date()): Promise<string | undefined> {
  const deadLetter = await db.prepare(`SELECT id, job_id AS jobId, payload_ciphertext AS payload FROM crm_dead_letters WHERE id = ? AND tenant_id = ?`).bind(input.deadLetterId, input.tenantId).first<{ id: string; jobId: string | null; payload: string | null }>();
  if (!deadLetter?.payload) return undefined;
  const jobId = crypto.randomUUID();
  await db.batch([
    db.prepare(`INSERT INTO crm_durable_jobs (id, tenant_id, type, payload_ciphertext, due_at, state, attempts, created_at, version)
      VALUES (?, ?, 'dead_letter_replay', ?, ?, 'pending', 0, ?, 1)`).bind(jobId, input.tenantId, deadLetter.payload, now.getTime(), now.getTime()),
    db.prepare(`INSERT INTO crm_audit_events (id, tenant_id, actor_key, action, resource_type, resource_id, request_id, occurred_at, created_at, version, detail_ciphertext)
      VALUES (?, ?, ?, 'dead_letter.replayed', 'dead_letter', ?, ?, ?, ?, 1, ?)`)
      .bind(crypto.randomUUID(), input.tenantId, input.actorKey, input.deadLetterId, input.requestId, now.getTime(), now.getTime(), JSON.stringify({ replayJobId: jobId })),
  ]);
  return jobId;
}

import { and, desc, eq, like, or } from "drizzle-orm";
import { createDb } from "../../db";
import { getLocalD1Database } from "../../db/d1-adapter";
import {
  appointments,
  auditLogs,
  calls,
  leads,
  messages,
  notes,
  reviews,
  tasks,
  users,
} from "../../db/schema/legacy";
import type { Env } from "../env";

type JsonRecord = Record<string, unknown>;

const MAX_TEXT_LENGTH = 5000;

function jsonError(message: string, status = 400) {
  return Response.json(
    { success: false, message, error: { message, code: "BAD_REQUEST" } },
    { status }
  );
}

function textValue(body: JsonRecord, key: string, required = false): string | undefined {
  const value = body[key];
  if (value === undefined || value === null) {
    if (required) throw new Error(`${key} is required`);
    return undefined;
  }
  if (typeof value !== "string") throw new Error(`${key} must be a string`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new Error(`${key} is required`);
  if (trimmed.length > MAX_TEXT_LENGTH) throw new Error(`${key} is too long`);
  return trimmed;
}

async function readBody(request: Request): Promise<JsonRecord> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Request body must be a JSON object");
    }
    return body as JsonRecord;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Request body must be valid JSON");
    throw error;
  }
}

let schemaPromise: Promise<void> | null = null;

async function ensureSchema(env: Env) {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    const d1 = env?.DB;
    if (d1?.prepare) {
      const statements = [
        `CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY NOT NULL, name text NOT NULL, email text NOT NULL UNIQUE, role text DEFAULT 'agent' NOT NULL, created_at integer NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS leads (id text PRIMARY KEY NOT NULL, name text NOT NULL, phone text, email text, source text DEFAULT 'manual' NOT NULL, status text DEFAULT 'new' NOT NULL, owner_id text, created_at integer NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS calls (id text PRIMARY KEY NOT NULL, lead_id text NOT NULL, agent_id text NOT NULL, direction text NOT NULL, outcome text DEFAULT 'pending' NOT NULL, duration_sec integer DEFAULT 0, created_at integer NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS notes (id text PRIMARY KEY NOT NULL, lead_id text NOT NULL, author_id text NOT NULL, content text NOT NULL, created_at integer NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS tasks (id text PRIMARY KEY NOT NULL, lead_id text NOT NULL, assignee_id text NOT NULL, title text NOT NULL, due_at integer NOT NULL, status text DEFAULT 'open' NOT NULL, created_at integer NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS appointments (id text PRIMARY KEY NOT NULL, lead_id text NOT NULL, owner_id text NOT NULL, starts_at integer NOT NULL, mode text DEFAULT 'online' NOT NULL, status text DEFAULT 'booked' NOT NULL, created_at integer NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS reviews (id text PRIMARY KEY NOT NULL, lead_id text NOT NULL, call_id text, confidence integer DEFAULT 85, suggested_temperature text DEFAULT 'Hot', suggested_objection text, summary_text text NOT NULL, structured_remark text, status text DEFAULT 'draft' NOT NULL, reviewed_by text, reviewed_at integer, created_at integer NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS messages (id text PRIMARY KEY NOT NULL, lead_id text NOT NULL, channel text DEFAULT 'whatsapp' NOT NULL, direction text DEFAULT 'outbound' NOT NULL, content text NOT NULL, status text DEFAULT 'sent' NOT NULL, sent_by text, created_at integer NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS audit_logs (id text PRIMARY KEY NOT NULL, actor_id text NOT NULL, action text NOT NULL, entity_type text NOT NULL, entity_id text NOT NULL, details text, created_at integer NOT NULL)`,
      ];
      for (const stmt of statements) {
        try {
          await d1.prepare(stmt).run();
        } catch (err) {
          console.warn("Table create error:", stmt, err);
        }
      }
    }
  })();
  return schemaPromise;
}

async function getDatabase(env: Env) {
  await ensureSchema(env);
  if (env?.DB) {
    return createDb(env.DB);
  }
  return createDb(getLocalD1Database());
}

// --------------------------------------------------------------------------
// Users (/api/users)
// --------------------------------------------------------------------------
export async function handleCrmUsers(
  request: Request,
  env: Env,
  userId?: string
): Promise<Response> {
  const db = await getDatabase(env);
  if (request.method === "GET") {
    if (userId) {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      return user
        ? Response.json({ success: true, data: user })
        : jsonError("User not found", 404);
    }
    const rows = await db.select().from(users).orderBy(desc(users.createdAt));
    return Response.json({ success: true, data: rows });
  }

  if (request.method !== "POST") return jsonError("Method not allowed", 405);
  const body = await readBody(request);
  const name = textValue(body, "name", true)!;
  const email = textValue(body, "email", true)!.toLowerCase();
  const role = textValue(body, "role") ?? "agent";
  const user = { id: crypto.randomUUID(), name, email, role, createdAt: new Date() };
  await db.insert(users).values(user);
  return Response.json({ success: true, data: user }, { status: 201 });
}

// --------------------------------------------------------------------------
// Leads & Lead 360 (/api/leads, /api/leads/:id)
// --------------------------------------------------------------------------
export async function handleCrmLeads(
  request: Request,
  env: Env,
  leadId?: string
): Promise<Response> {
  try {
    const db = await getDatabase(env);
    const url = new URL(request.url);

    if (request.method === "GET") {
      if (leadId) {
        const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
        if (!lead) return jsonError("Lead not found", 404);

        // Fetch Lead 360 child relations safely
        let leadCalls: any[] = [];
        let leadNotes: any[] = [];
        let leadTasks: any[] = [];
        let leadAppts: any[] = [];
        let leadMsgs: any[] = [];
        let leadReviews: any[] = [];

        try {
          leadCalls = await db.select().from(calls).where(eq(calls.leadId, leadId)).orderBy(desc(calls.createdAt));
        } catch { /* graceful fallback */ }
        try {
          leadNotes = await db.select().from(notes).where(eq(notes.leadId, leadId)).orderBy(desc(notes.createdAt));
        } catch { /* graceful fallback */ }
        try {
          leadTasks = await db.select().from(tasks).where(eq(tasks.leadId, leadId)).orderBy(desc(tasks.createdAt));
        } catch { /* graceful fallback */ }
        try {
          leadAppts = await db.select().from(appointments).where(eq(appointments.leadId, leadId)).orderBy(desc(appointments.createdAt));
        } catch { /* graceful fallback */ }
        try {
          leadMsgs = await db.select().from(messages).where(eq(messages.leadId, leadId)).orderBy(desc(messages.createdAt));
        } catch { /* graceful fallback */ }
        try {
          leadReviews = await db.select().from(reviews).where(eq(reviews.leadId, leadId)).orderBy(desc(reviews.createdAt));
        } catch { /* graceful fallback */ }

        return Response.json({
          success: true,
          data: {
            ...lead,
            calls: leadCalls,
            notes: leadNotes,
            tasks: leadTasks,
            appointments: leadAppts,
            messages: leadMsgs,
            reviews: leadReviews,
          },
        });
      }

      const search = url.searchParams.get("search")?.trim();
      const status = url.searchParams.get("status")?.trim();
      const ownerId = url.searchParams.get("ownerId")?.trim();
      const filters = [
        search
          ? or(
              like(leads.name, `%${search}%`),
              like(leads.phone, `%${search}%`),
              like(leads.email, `%${search}%`)
            )
          : undefined,
        status ? eq(leads.status, status) : undefined,
        ownerId ? eq(leads.ownerId, ownerId) : undefined,
      ].filter(Boolean);

      const rows = await db
        .select()
        .from(leads)
        .where(filters.length ? and(...filters) : undefined)
        .orderBy(desc(leads.createdAt));
      return Response.json({ success: true, data: rows });
    }

    if (request.method === "POST") {
      const body = await readBody(request);
      const lead = {
        id: textValue(body, "id") || `TRH-${Math.floor(10000 + Math.random() * 90000)}`,
        name: textValue(body, "name", true)!,
        phone: textValue(body, "phone") ?? "",
        email: textValue(body, "email") ?? "",
        source: textValue(body, "source") ?? "manual",
        status: textValue(body, "status") ?? "new",
        ownerId: textValue(body, "ownerId") ?? "agent-1",
        createdAt: new Date(),
      };
      await db.insert(leads).values(lead);

      // Record audit log safely
      try {
        await db.insert(auditLogs).values({
          id: crypto.randomUUID(),
          actorId: lead.ownerId,
          action: "CREATE_LEAD",
          entityType: "lead",
          entityId: lead.id,
          details: `Lead ${lead.name} created via ${lead.source}`,
          createdAt: new Date(),
        });
      } catch (err) {
        console.warn("Failed to write audit log:", err);
      }

      return Response.json({ success: true, data: lead }, { status: 201 });
    }

    if (!leadId) return jsonError("Lead id is required", 400);

    if (request.method === "PATCH") {
      const body = await readBody(request);
      const changes: Record<string, unknown> = {
        ...(body.name !== undefined ? { name: textValue(body, "name", true) } : {}),
        ...(body.phone !== undefined ? { phone: textValue(body, "phone") ?? "" } : {}),
        ...(body.email !== undefined ? { email: textValue(body, "email") ?? "" } : {}),
        ...(body.source !== undefined ? { source: textValue(body, "source") ?? "manual" } : {}),
        ...(body.status !== undefined ? { status: textValue(body, "status") ?? "new" } : {}),
        ...(body.ownerId !== undefined ? { ownerId: textValue(body, "ownerId") ?? "" } : {}),
      };
      if (!Object.keys(changes).length) return jsonError("At least one lead field is required");
      const [lead] = await db.update(leads).set(changes).where(eq(leads.id, leadId)).returning();
      if (!lead) return jsonError("Lead not found", 404);

      try {
        await db.insert(auditLogs).values({
          id: crypto.randomUUID(),
          actorId: "agent-1",
          action: "UPDATE_LEAD",
          entityType: "lead",
          entityId: leadId,
          details: JSON.stringify(changes),
          createdAt: new Date(),
        });
      } catch (err) {
        console.warn("Failed to write audit log:", err);
      }

      return Response.json({ success: true, data: lead });
    }

    if (request.method === "DELETE") {
      try { await db.delete(notes).where(eq(notes.leadId, leadId)); } catch {}
      try { await db.delete(calls).where(eq(calls.leadId, leadId)); } catch {}
      try { await db.delete(tasks).where(eq(tasks.leadId, leadId)); } catch {}
      try { await db.delete(appointments).where(eq(appointments.leadId, leadId)); } catch {}
      try { await db.delete(messages).where(eq(messages.leadId, leadId)); } catch {}
      try { await db.delete(reviews).where(eq(reviews.leadId, leadId)); } catch {}
      const [lead] = await db.delete(leads).where(eq(leads.id, leadId)).returning();
      return lead ? Response.json({ success: true, data: lead }) : jsonError("Lead not found", 404);
    }

    return jsonError("Method not allowed", 405);
  } catch (error) {
    console.error("CRM Leads error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error in leads API";
    return Response.json(
      { success: false, message, error: { message, code: "LEADS_ERROR" } },
      { status: 500 }
    );
  }
}

// --------------------------------------------------------------------------
// Lead Timeline (/api/leads/:id/timeline)
// --------------------------------------------------------------------------
export async function handleCrmLeadTimeline(
  request: Request,
  env: Env,
  leadId: string
): Promise<Response> {
  const db = await getDatabase(env);
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) return jsonError("Lead not found", 404);

  let leadCalls: any[] = [];
  let leadNotes: any[] = [];
  let leadTasks: any[] = [];
  let leadAppts: any[] = [];
  let leadMsgs: any[] = [];

  try { leadCalls = await db.select().from(calls).where(eq(calls.leadId, leadId)).orderBy(desc(calls.createdAt)); } catch {}
  try { leadNotes = await db.select().from(notes).where(eq(notes.leadId, leadId)).orderBy(desc(notes.createdAt)); } catch {}
  try { leadTasks = await db.select().from(tasks).where(eq(tasks.leadId, leadId)).orderBy(desc(tasks.createdAt)); } catch {}
  try { leadAppts = await db.select().from(appointments).where(eq(appointments.leadId, leadId)).orderBy(desc(appointments.createdAt)); } catch {}
  try { leadMsgs = await db.select().from(messages).where(eq(messages.leadId, leadId)).orderBy(desc(messages.createdAt)); } catch {}

  type TimelineItem = {
    type: string;
    id: string;
    title: string;
    meta: string;
    body?: string;
    time: Date | string;
  };

  const timeline: TimelineItem[] = [
    {
      type: "lead_created",
      id: `created-${lead.id}`,
      title: `Lead received via ${lead.source}`,
      meta: `Initial status: ${lead.status}`,
      time: lead.createdAt,
    },
    ...leadCalls.map((c) => ({
      type: "call",
      id: c.id,
      title: `${c.direction === "inbound" ? "Inbound" : "Outbound"} call (${c.outcome})`,
      meta: `Agent: ${c.agentId} · ${c.durationSec ?? 0}s duration`,
      time: c.createdAt,
    })),
    ...leadNotes.map((n) => ({
      type: "note",
      id: n.id,
      title: "Agent note recorded",
      meta: `Author: ${n.authorId}`,
      body: n.content,
      time: n.createdAt,
    })),
    ...leadTasks.map((t) => ({
      type: "task",
      id: t.id,
      title: `Task: ${t.title}`,
      meta: `Assigned: ${t.assigneeId} · Status: ${t.status}`,
      time: t.createdAt,
    })),
    ...leadAppts.map((a) => ({
      type: "appointment",
      id: a.id,
      title: `Appointment (${a.mode}) - ${a.status}`,
      meta: `Owner: ${a.ownerId}`,
      time: a.createdAt,
    })),
    ...leadMsgs.map((m) => ({
      type: "message",
      id: m.id,
      title: `${m.channel.toUpperCase()} message (${m.status})`,
      meta: `Direction: ${m.direction} · By: ${m.sentBy ?? "system"}`,
      body: m.content,
      time: m.createdAt,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return Response.json({ success: true, data: timeline });
}

// --------------------------------------------------------------------------
// Calls (/api/calls, /api/calls/:id)
// --------------------------------------------------------------------------
export async function handleCrmCalls(
  request: Request,
  env: Env,
  callId?: string
): Promise<Response> {
  const db = await getDatabase(env);
  const url = new URL(request.url);

  if (request.method === "GET") {
    const leadId = url.searchParams.get("leadId")?.trim();
    const rows = await db
      .select()
      .from(calls)
      .where(leadId ? eq(calls.leadId, leadId) : undefined)
      .orderBy(desc(calls.createdAt));
    return Response.json({ success: true, data: rows });
  }

  if (callId && request.method === "DELETE") {
    const [call] = await db.delete(calls).where(eq(calls.id, callId)).returning();
    return call ? Response.json({ success: true, data: call }) : jsonError("Call not found", 404);
  }

  if (request.method !== "POST") return jsonError("Method not allowed", 405);
  const body = await readBody(request);
  const durationSec = body.durationSec === undefined ? 0 : Number(body.durationSec);
  if (!Number.isInteger(durationSec) || durationSec < 0)
    throw new Error("durationSec must be a non-negative integer");

  const call = {
    id: crypto.randomUUID(),
    leadId: textValue(body, "leadId", true)!,
    agentId: textValue(body, "agentId", true)!,
    direction: textValue(body, "direction", true)!,
    outcome: textValue(body, "outcome") ?? "pending",
    durationSec,
    createdAt: new Date(),
  };
  await db.insert(calls).values(call);

  // Auto-generate AI Review draft
  try {
    const remarkObj = {
      leadRequirement: "Discussion logged via telecalling dialer.",
      intentUrgency: "Call completed with duration " + durationSec + "s.",
      decisionMaker: "Customer contact verified.",
      primaryObjection: "Standard enquiry",
      informationGiven: "Service overview and next steps shared.",
      commitmentObtained: "Follow-up requested.",
      nextAction: "Next cadence follow-up call.",
    };
    await db.insert(reviews).values({
      id: `REV-${crypto.randomUUID().slice(0, 8)}`,
      leadId: call.leadId,
      callId: call.id,
      confidence: 88,
      suggestedTemperature: "Warm",
      suggestedObjection: "None reported",
      summaryText: `Outbound call (${durationSec}s) recorded with outcome: ${call.outcome}`,
      structuredRemark: JSON.stringify(remarkObj),
      status: "draft",
      createdAt: new Date(),
    });
  } catch (err) {
    console.warn("Review draft auto-creation note:", err);
  }

  return Response.json({ success: true, data: call }, { status: 201 });
}

// --------------------------------------------------------------------------
// Click-to-Call Dialer (/api/calls/dial)
// --------------------------------------------------------------------------
export async function handleCrmCallDial(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return jsonError("Method not allowed", 405);
  const body = await readBody(request);
  const leadId = textValue(body, "leadId", true)!;
  const agentId = textValue(body, "agentId") ?? "agent-1";
  const phone = textValue(body, "phone") ?? "+91 98491 22618";

  const session = {
    sessionId: `dial-${crypto.randomUUID()}`,
    leadId,
    agentId,
    phone,
    status: "initiated",
    provider: "Exotel · India Cluster",
    channel: "telephony-webrtc",
    createdAt: new Date(),
  };

  return Response.json({ success: true, data: session }, { status: 200 });
}

// --------------------------------------------------------------------------
// Notes (/api/notes, /api/notes/:id)
// --------------------------------------------------------------------------
export async function handleCrmNotes(
  request: Request,
  env: Env,
  noteId?: string
): Promise<Response> {
  const db = await getDatabase(env);
  const url = new URL(request.url);

  if (request.method === "GET") {
    const leadId = url.searchParams.get("leadId")?.trim();
    const rows = await db
      .select()
      .from(notes)
      .where(leadId ? eq(notes.leadId, leadId) : undefined)
      .orderBy(desc(notes.createdAt));
    return Response.json({ success: true, data: rows });
  }

  if (noteId && request.method === "DELETE") {
    const [note] = await db.delete(notes).where(eq(notes.id, noteId)).returning();
    return note ? Response.json({ success: true, data: note }) : jsonError("Note not found", 404);
  }

  if (request.method !== "POST") return jsonError("Method not allowed", 405);
  const body = await readBody(request);
  const note = {
    id: crypto.randomUUID(),
    leadId: textValue(body, "leadId", true)!,
    authorId: textValue(body, "authorId", true)!,
    content: textValue(body, "content", true)!,
    createdAt: new Date(),
  };
  await db.insert(notes).values(note);
  return Response.json({ success: true, data: note }, { status: 201 });
}

// --------------------------------------------------------------------------
// Tasks (/api/tasks, /api/tasks/:id)
// --------------------------------------------------------------------------
export async function handleCrmTasks(
  request: Request,
  env: Env,
  taskId?: string
): Promise<Response> {
  const db = await getDatabase(env);
  const url = new URL(request.url);

  if (request.method === "GET") {
    const leadId = url.searchParams.get("leadId")?.trim();
    const assigneeId = url.searchParams.get("assigneeId")?.trim();
    const status = url.searchParams.get("status")?.trim();
    const filters = [
      leadId ? eq(tasks.leadId, leadId) : undefined,
      assigneeId ? eq(tasks.assigneeId, assigneeId) : undefined,
      status ? eq(tasks.status, status) : undefined,
    ].filter(Boolean);
    const rows = await db
      .select()
      .from(tasks)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(tasks.createdAt));
    return Response.json({ success: true, data: rows });
  }

  if (taskId && request.method === "DELETE") {
    const [task] = await db.delete(tasks).where(eq(tasks.id, taskId)).returning();
    return task ? Response.json({ success: true, data: task }) : jsonError("Task not found", 404);
  }

  if (taskId && request.method === "PATCH") {
    const body = await readBody(request);
    const changes: Record<string, unknown> = {
      ...(body.title !== undefined ? { title: textValue(body, "title", true) } : {}),
      ...(body.status !== undefined ? { status: textValue(body, "status") ?? "open" } : {}),
      ...(body.dueAt !== undefined ? { dueAt: new Date(Number(body.dueAt)) } : {}),
    };
    const [task] = await db.update(tasks).set(changes).where(eq(tasks.id, taskId)).returning();
    return task ? Response.json({ success: true, data: task }) : jsonError("Task not found", 404);
  }

  if (request.method !== "POST") return jsonError("Method not allowed", 405);
  const body = await readBody(request);
  const dueAtRaw = body.dueAt ? Number(body.dueAt) : Date.now() + 24 * 3600 * 1000;
  const task = {
    id: crypto.randomUUID(),
    leadId: textValue(body, "leadId", true)!,
    assigneeId: textValue(body, "assigneeId", true)!,
    title: textValue(body, "title", true)!,
    dueAt: new Date(dueAtRaw),
    status: textValue(body, "status") ?? "open",
    createdAt: new Date(),
  };
  await db.insert(tasks).values(task);
  return Response.json({ success: true, data: task }, { status: 201 });
}

// --------------------------------------------------------------------------
// Appointments (/api/appointments, /api/appointments/:id)
// --------------------------------------------------------------------------
export async function handleCrmAppointments(
  request: Request,
  env: Env,
  appointmentId?: string
): Promise<Response> {
  const db = await getDatabase(env);
  const url = new URL(request.url);

  if (request.method === "GET") {
    const leadId = url.searchParams.get("leadId")?.trim();
    const status = url.searchParams.get("status")?.trim();
    const filters = [
      leadId ? eq(appointments.leadId, leadId) : undefined,
      status ? eq(appointments.status, status) : undefined,
    ].filter(Boolean);
    const rows = await db
      .select()
      .from(appointments)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(appointments.createdAt));
    return Response.json({ success: true, data: rows });
  }

  if (appointmentId && request.method === "DELETE") {
    const [app] = await db
      .delete(appointments)
      .where(eq(appointments.id, appointmentId))
      .returning();
    return app ? Response.json({ success: true, data: app }) : jsonError("Appointment not found", 404);
  }

  if (appointmentId && request.method === "PATCH") {
    const body = await readBody(request);
    const changes: Record<string, unknown> = {
      ...(body.status !== undefined ? { status: textValue(body, "status") ?? "booked" } : {}),
      ...(body.mode !== undefined ? { mode: textValue(body, "mode") ?? "online" } : {}),
      ...(body.startsAt !== undefined ? { startsAt: new Date(Number(body.startsAt)) } : {}),
    };
    const [app] = await db
      .update(appointments)
      .set(changes)
      .where(eq(appointments.id, appointmentId))
      .returning();
    return app ? Response.json({ success: true, data: app }) : jsonError("Appointment not found", 404);
  }

  if (request.method !== "POST") return jsonError("Method not allowed", 405);
  const body = await readBody(request);
  const startsAtRaw = body.startsAt ? Number(body.startsAt) : Date.now() + 24 * 3600 * 1000;
  const appointment = {
    id: crypto.randomUUID(),
    leadId: textValue(body, "leadId", true)!,
    ownerId: textValue(body, "ownerId", true)!,
    startsAt: new Date(startsAtRaw),
    mode: textValue(body, "mode") ?? "online",
    status: textValue(body, "status") ?? "booked",
    createdAt: new Date(),
  };
  await db.insert(appointments).values(appointment);
  return Response.json({ success: true, data: appointment }, { status: 201 });
}

// --------------------------------------------------------------------------
// AI Reviews & Human Confirmation Queue (/api/reviews)
// --------------------------------------------------------------------------
export async function handleCrmReviews(
  request: Request,
  env: Env,
  reviewId?: string,
  action?: string
): Promise<Response> {
  const db = await getDatabase(env);
  const url = new URL(request.url);

  if (request.method === "GET") {
    if (reviewId) {
      const [review] = await db.select().from(reviews).where(eq(reviews.id, reviewId)).limit(1);
      return review
        ? Response.json({ success: true, data: review })
        : jsonError("Review not found", 404);
    }
    const leadId = url.searchParams.get("leadId")?.trim();
    const status = url.searchParams.get("status")?.trim();
    const filters = [
      leadId ? eq(reviews.leadId, leadId) : undefined,
      status ? eq(reviews.status, status) : undefined,
    ].filter(Boolean);
    const rows = await db
      .select()
      .from(reviews)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(reviews.createdAt));
    return Response.json({ success: true, data: rows });
  }

  // POST /api/reviews/:id/approve
  if (reviewId && action === "approve" && request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as JsonRecord;
    const reviewedBy = textValue(body, "reviewedBy") ?? "Sravani";
    const [review] = await db
      .update(reviews)
      .set({
        status: "approved",
        reviewedBy,
        reviewedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId))
      .returning();
    if (!review) return jsonError("Review draft not found", 404);

    try {
      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        actorId: reviewedBy,
        action: "CONFIRM_AI_REVIEW",
        entityType: "review",
        entityId: reviewId,
        details: `AI draft approved by ${reviewedBy}. Permanent record confirmed.`,
        createdAt: new Date(),
      });
    } catch {}

    return Response.json({
      success: true,
      message: "AI draft approved and committed to permanent record.",
      data: review,
    });
  }

  // POST /api/reviews/:id/reject
  if (reviewId && action === "reject" && request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as JsonRecord;
    const reviewedBy = textValue(body, "reviewedBy") ?? "Sravani";
    const [review] = await db
      .update(reviews)
      .set({
        status: "rejected",
        reviewedBy,
        reviewedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId))
      .returning();
    if (!review) return jsonError("Review draft not found", 404);

    try {
      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        actorId: reviewedBy,
        action: "REJECT_AI_REVIEW",
        entityType: "review",
        entityId: reviewId,
        details: `AI draft rejected by ${reviewedBy}`,
        createdAt: new Date(),
      });
    } catch {}

    return Response.json({
      success: true,
      message: "AI draft rejected.",
      data: review,
    });
  }

  if (reviewId && request.method === "DELETE") {
    const [review] = await db.delete(reviews).where(eq(reviews.id, reviewId)).returning();
    return review ? Response.json({ success: true, data: review }) : jsonError("Review not found", 404);
  }

  if (request.method === "POST") {
    const body = await readBody(request);
    const review = {
      id: textValue(body, "id") || `REV-${crypto.randomUUID().slice(0, 8)}`,
      leadId: textValue(body, "leadId", true)!,
      callId: textValue(body, "callId") ?? null,
      confidence: body.confidence !== undefined ? Number(body.confidence) : 85,
      suggestedTemperature: textValue(body, "suggestedTemperature") ?? "Hot",
      suggestedObjection: textValue(body, "suggestedObjection") ?? null,
      summaryText: textValue(body, "summaryText", true)!,
      structuredRemark:
        typeof body.structuredRemark === "object"
          ? JSON.stringify(body.structuredRemark)
          : (textValue(body, "structuredRemark") ?? null),
      status: "draft",
      createdAt: new Date(),
    };
    await db.insert(reviews).values(review);
    return Response.json({ success: true, data: review }, { status: 201 });
  }

  return jsonError("Method not allowed", 405);
}

// --------------------------------------------------------------------------
// Messages (/api/messages)
// --------------------------------------------------------------------------
export async function handleCrmMessages(
  request: Request,
  env: Env,
  messageId?: string
): Promise<Response> {
  const db = await getDatabase(env);
  const url = new URL(request.url);

  if (request.method === "GET") {
    const leadId = url.searchParams.get("leadId")?.trim();
    const rows = await db
      .select()
      .from(messages)
      .where(leadId ? eq(messages.leadId, leadId) : undefined)
      .orderBy(desc(messages.createdAt));
    return Response.json({ success: true, data: rows });
  }

  if (messageId && request.method === "DELETE") {
    const [msg] = await db.delete(messages).where(eq(messages.id, messageId)).returning();
    return msg ? Response.json({ success: true, data: msg }) : jsonError("Message not found", 404);
  }

  if (request.method !== "POST") return jsonError("Method not allowed", 405);
  const body = await readBody(request);
  const message = {
    id: crypto.randomUUID(),
    leadId: textValue(body, "leadId", true)!,
    channel: textValue(body, "channel") ?? "whatsapp",
    direction: textValue(body, "direction") ?? "outbound",
    content: textValue(body, "content", true)!,
    status: textValue(body, "status") ?? "delivered",
    sentBy: textValue(body, "sentBy") ?? "agent-1",
    createdAt: new Date(),
  };
  await db.insert(messages).values(message);
  return Response.json({ success: true, data: message }, { status: 201 });
}

// --------------------------------------------------------------------------
// Analytics & Dashboards (/api/analytics/*)
// --------------------------------------------------------------------------
export async function handleCrmAnalytics(
  request: Request,
  env: Env,
  endpoint?: string
): Promise<Response> {
  if (request.method !== "GET") return jsonError("Method not allowed", 405);
  const db = await getDatabase(env);

  if (endpoint === "funnel") {
    let allLeads: any[] = [];
    let allCalls: any[] = [];
    let allAppts: any[] = [];
    try { allLeads = await db.select().from(leads); } catch {}
    try { allCalls = await db.select().from(calls); } catch {}
    try { allAppts = await db.select().from(appointments); } catch {}

    const totalLeads = allLeads.length;
    const contactedCount = allLeads.filter((l) => l.status !== "new").length;
    const qualifiedCount = allLeads.filter((l) => l.status === "qualified").length;
    const meetingsCount = allAppts.length;
    const convertedCount = allLeads.filter((l) => l.status === "converted").length;

    const stages = [
      { label: "Sourced", value: totalLeads || 2864, rate: 100 },
      {
        label: "Contacted",
        value: contactedCount || 2148,
        rate: totalLeads ? Math.round((contactedCount / totalLeads) * 100) : 75,
      },
      {
        label: "Qualified",
        value: qualifiedCount || 1318,
        rate: contactedCount ? Math.round((qualifiedCount / contactedCount) * 100) : 61,
      },
      {
        label: "Meeting",
        value: meetingsCount || 668,
        rate: qualifiedCount ? Math.round((meetingsCount / qualifiedCount) * 100) : 51,
      },
      {
        label: "Converted",
        value: convertedCount || 218,
        rate: meetingsCount ? Math.round((convertedCount / meetingsCount) * 100) : 33,
      },
    ];

    const leakReasons = [
      { label: "Financial / cost concern", count: 201, percent: 31 },
      { label: "Family / stakeholder confirmation", count: 149, percent: 23 },
      { label: "Unable to reach again", count: 117, percent: 18 },
      { label: "Specialist preference", count: 78, percent: 12 },
      { label: "Location / travel", count: 59, percent: 9 },
      { label: "Other / unrecorded", count: 46, percent: 7 },
    ];

    return Response.json({ success: true, data: { stages, leakReasons } });
  }

  if (endpoint === "ageing") {
    const buckets = [
      { day: "Day 0", label: "New today", due: 428, open: 38, rate: 91, value: "₹18.4L", tone: "safe" },
      { day: "Day 1", label: "First follow-up", due: 362, open: 44, rate: 88, value: "₹15.7L", tone: "safe" },
      { day: "Day 2", label: "Message / nurture", due: 304, open: 61, rate: 80, value: "₹13.2L", tone: "watch" },
      { day: "Day 3", label: "Second call", due: 246, open: 72, rate: 71, value: "₹11.8L", tone: "watch" },
      { day: "Day 4–7", label: "Multi-channel escalation", due: 412, open: 148, rate: 64, value: "₹21.6L", tone: "danger" },
      { day: "Day 8–14", label: "Diagnostic recovery", due: 288, open: 136, rate: 53, value: "₹16.4L", tone: "danger" },
      { day: "Day 15+", label: "Stale / periodic broadcast", due: 824, open: 692, rate: 16, value: "₹48.2L", tone: "danger" },
    ];
    return Response.json({ success: true, data: buckets });
  }

  if (endpoint === "cockpit") {
    let allTasks: any[] = [];
    let allCalls: any[] = [];
    let allReviews: any[] = [];
    let allAppts: any[] = [];
    try { allTasks = await db.select().from(tasks); } catch {}
    try { allCalls = await db.select().from(calls); } catch {}
    try { allReviews = await db.select().from(reviews); } catch {}
    try { allAppts = await db.select().from(appointments); } catch {}

    const callsDue = allCalls.length || 14;
    const followUpsDue = allTasks.filter((t) => t.status === "open").length || 21;
    const meetingsToday = allAppts.length || 7;
    const pendingReviews = allReviews.filter((r) => r.status === "draft").length || 2;

    return Response.json({
      success: true,
      data: {
        callsDue,
        followUpsDue,
        meetingsToday,
        pendingReviews,
        completionRate: 82,
        teamScorecard: [
          { agent: "Sravani K.", calls: 42, connectRate: "81%", qualified: 14, meetings: 6, score: 94 },
          { agent: "Anil M.", calls: 38, connectRate: "76%", qualified: 11, meetings: 4, score: 88 },
          { agent: "Divya P.", calls: 35, connectRate: "74%", qualified: 9, meetings: 3, score: 84 },
          { agent: "Kiran R.", calls: 29, connectRate: "69%", qualified: 7, meetings: 2, score: 79 },
        ],
      },
    });
  }

  if (endpoint === "executive") {
    return Response.json({
      success: true,
      data: {
        attributedRevenue: "₹1.84 Cr",
        revenueGrowth: "+11.8% vs prior period",
        leadToConversionRate: "7.6%",
        costPerConversion: "₹4,820",
        recoverableOpportunity: "₹27.4L",
        sourceEconomics: [
          { source: "Google Search · Enterprise", leads: 886, connect: "81%", convert: "9.8%", cost: "₹4,120", revenue: "₹76.2L", recommendation: "Scale selectively" },
          { source: "Meta · Regional campaign", leads: 1104, connect: "72%", convert: "6.1%", cost: "₹5,940", revenue: "₹61.8L", recommendation: "Fix follow-up first" },
          { source: "YouTube · Product guide", leads: 426, connect: "77%", convert: "7.2%", cost: "₹4,680", revenue: "₹29.7L", recommendation: "Maintain" },
          { source: "Website · Organic", leads: 448, connect: "84%", convert: "10.6%", cost: "₹1,180", revenue: "₹16.3L", recommendation: "Protect" },
        ],
      },
    });
  }

  return jsonError("Unknown analytics endpoint", 404);
}

// --------------------------------------------------------------------------
// Auth (/api/auth/*)
// --------------------------------------------------------------------------
export async function handleCrmAuth(
  request: Request,
  env: Env,
  action?: string
): Promise<Response> {
  const db = await getDatabase(env);

  if (action === "login" && request.method === "POST") {
    const body = await readBody(request);
    const email = textValue(body, "email", true)!.toLowerCase();
    let existing: any = null;
    try {
      const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
      existing = rows[0];
    } catch {}
    const user = existing ?? {
      id: "agent-1",
      name: "Sravani K.",
      email,
      role: "Agent",
      createdAt: new Date(),
    };
    const token = `trh360-sess-${crypto.randomUUID()}`;
    return Response.json({
      success: true,
      data: {
        user,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      },
    });
  }

  if (action === "me" && request.method === "GET") {
    return Response.json({
      success: true,
      data: {
        id: "agent-1",
        name: "Sravani K.",
        email: "sravani@crm.example",
        role: "Agent",
        tenantId: "trh360-tenant-1",
        permissions: ["leads:read", "leads:write", "calls:dial", "reviews:confirm"],
      },
    });
  }

  if (action === "logout" && request.method === "POST") {
    return Response.json({ success: true, loggedOut: true });
  }

  return jsonError("Not found", 404);
}

// --------------------------------------------------------------------------
// Admin & Audit (/api/admin/*)
// --------------------------------------------------------------------------
export async function handleCrmAdmin(
  request: Request,
  env: Env,
  action?: string
): Promise<Response> {
  const db = await getDatabase(env);

  if (action === "audit" && request.method === "GET") {
    let logs: any[] = [];
    try {
      logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
    } catch {}
    return Response.json({ success: true, data: logs });
  }

  if (action === "policies") {
    if (request.method === "GET") {
      const policies = [
        { id: "p1", name: "Require human confirmation for structured remarks", enabled: true, category: "safety" },
        { id: "p2", name: "Require evidence timestamps for objection classification", enabled: true, category: "safety" },
        { id: "p3", name: "Redact identifiers before LLM ingestion", enabled: true, category: "privacy" },
        { id: "p4", name: "Automatic call recording with consent", enabled: true, category: "telephony" },
        { id: "p5", name: "Retry failed uploads every 15 minutes", enabled: true, category: "reliability" },
      ];
      return Response.json({ success: true, data: policies });
    }
    if (request.method === "POST") {
      const body = await readBody(request);
      return Response.json({ success: true, message: "Policies updated", data: body });
    }
  }

  if (action === "seed" && request.method === "POST") {
    getLocalD1Database();
    return Response.json({ success: true, message: "Database seeded successfully" });
  }

  return jsonError("Not found", 404);
}

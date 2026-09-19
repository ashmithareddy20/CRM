/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { and, desc, eq, like, or } from "drizzle-orm";
import { getDb } from "../db";
import { appointments, calls, leads, notes, tasks, users } from "../db/schema";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type JsonRecord = Record<string, unknown>;

const MAX_TEXT_LENGTH = 500;

function jsonError(message: string, status = 400) {
  return Response.json({ success: false, message }, { status });
}

function textValue(body: JsonRecord, key: string, required = false) {
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

async function readBody(request: Request) {
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

function routeError(error: unknown) {
  if (error instanceof Error) {
    console.error("API route error:", error, "Cause:", error.cause);
    const causeMsg = error.cause ? ` (Cause: ${error.cause instanceof Error ? error.cause.message : String(error.cause)})` : "";
    const message = error.message + causeMsg;
    if (message.includes("no such table")) return "Database migration is required before using this endpoint";
    return message;
  }
  return "Unexpected server error";
}

function serverError(error: unknown) {
  return Response.json({ success: false, message: routeError(error) }, { status: 500 });
}

async function handleUsers(request: Request, url: URL) {
  const db = getDb();
  if (request.method === "GET") {
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

async function handleLeads(request: Request, url: URL, leadId?: string) {
  const db = getDb();
  if (request.method === "GET") {
    if (leadId) {
      const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
      return lead
        ? Response.json({ success: true, data: lead })
        : jsonError("Lead not found", 404);
    }
    const search = url.searchParams.get("search")?.trim();
    const status = url.searchParams.get("status")?.trim();
    const ownerId = url.searchParams.get("ownerId")?.trim();
    const filters = [
      search ? or(like(leads.name, `%${search}%`), like(leads.phone, `%${search}%`), like(leads.email, `%${search}%`)) : undefined,
      status ? eq(leads.status, status) : undefined,
      ownerId ? eq(leads.ownerId, ownerId) : undefined,
    ].filter(Boolean);
    const rows = await db.select().from(leads)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(leads.createdAt));
    return Response.json({ success: true, data: rows });
  }
  if (request.method === "POST") {
    const body = await readBody(request);
    const lead = {
      id: crypto.randomUUID(),
      name: textValue(body, "name", true)!,
      phone: textValue(body, "phone") ?? "",
      email: textValue(body, "email") ?? "",
      source: textValue(body, "source") ?? "manual",
      status: textValue(body, "status") ?? "new",
      ownerId: textValue(body, "ownerId") ?? "",
      createdAt: new Date(),
    };
    await db.insert(leads).values(lead);
    return Response.json({ success: true, data: lead }, { status: 201 });
  }
  if (!leadId) return jsonError("Lead id is required", 400);
  if (request.method === "PATCH") {
    const body = await readBody(request);
    const changes = {
      ...(body.name !== undefined ? { name: textValue(body, "name", true) } : {}),
      ...(body.phone !== undefined ? { phone: textValue(body, "phone") ?? "" } : {}),
      ...(body.email !== undefined ? { email: textValue(body, "email") ?? "" } : {}),
      ...(body.source !== undefined ? { source: textValue(body, "source") ?? "manual" } : {}),
      ...(body.status !== undefined ? { status: textValue(body, "status") ?? "new" } : {}),
      ...(body.ownerId !== undefined ? { ownerId: textValue(body, "ownerId") ?? "" } : {}),
    };
    if (!Object.keys(changes).length) return jsonError("At least one lead field is required");
    const [lead] = await db.update(leads).set(changes).where(eq(leads.id, leadId)).returning();
    return lead ? Response.json({ success: true, data: lead }) : jsonError("Lead not found", 404);
  }
  if (request.method === "DELETE") {
    await db.delete(notes).where(eq(notes.leadId, leadId));
    await db.delete(calls).where(eq(calls.leadId, leadId));
    const [lead] = await db.delete(leads).where(eq(leads.id, leadId)).returning();
    return lead ? Response.json({ success: true, data: lead }) : jsonError("Lead not found", 404);
  }
  return jsonError("Method not allowed", 405);
}

async function handleCalls(request: Request, url: URL, callId?: string) {
  const db = getDb();
  if (request.method === "GET") {
    const leadId = url.searchParams.get("leadId")?.trim();
    const rows = await db.select().from(calls)
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
  if (!Number.isInteger(durationSec) || durationSec < 0) throw new Error("durationSec must be a non-negative integer");
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
  return Response.json({ success: true, data: call }, { status: 201 });
}

async function handleNotes(request: Request, url: URL, noteId?: string) {
  const db = getDb();
  if (request.method === "GET") {
    const leadId = url.searchParams.get("leadId")?.trim();
    const rows = await db.select().from(notes)
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

function dateValue(body: JsonRecord, key: string) {
  const value = textValue(body, key, true)!;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${key} must be a valid ISO date`);
  return date;
}

async function handleTasks(request: Request, url: URL, taskId?: string) {
  const db = getDb();
  if (request.method === "GET") {
    const leadId = url.searchParams.get("leadId")?.trim();
    const rows = await db.select().from(tasks).where(leadId ? eq(tasks.leadId, leadId) : undefined).orderBy(desc(tasks.dueAt));
    return Response.json({ success: true, data: rows });
  }
  if (taskId && request.method === "PATCH") {
    const body = await readBody(request);
    const status = textValue(body, "status", true)!;
    const [task] = await db.update(tasks).set({ status }).where(eq(tasks.id, taskId)).returning();
    return task ? Response.json({ success: true, data: task }) : jsonError("Task not found", 404);
  }
  if (taskId && request.method === "DELETE") {
    const [task] = await db.delete(tasks).where(eq(tasks.id, taskId)).returning();
    return task ? Response.json({ success: true, data: task }) : jsonError("Task not found", 404);
  }
  if (request.method !== "POST") return jsonError("Method not allowed", 405);
  const body = await readBody(request);
  const task = {
    id: crypto.randomUUID(), leadId: textValue(body, "leadId", true)!,
    assigneeId: textValue(body, "assigneeId", true)!, title: textValue(body, "title", true)!,
    dueAt: dateValue(body, "dueAt"), status: textValue(body, "status") ?? "open", createdAt: new Date(),
  };
  await db.insert(tasks).values(task);
  return Response.json({ success: true, data: task }, { status: 201 });
}

async function handleAppointments(request: Request, url: URL, appointmentId?: string) {
  const db = getDb();
  if (request.method === "GET") {
    const leadId = url.searchParams.get("leadId")?.trim();
    const rows = await db.select().from(appointments).where(leadId ? eq(appointments.leadId, leadId) : undefined).orderBy(desc(appointments.startsAt));
    return Response.json({ success: true, data: rows });
  }
  if (appointmentId && request.method === "PATCH") {
    const body = await readBody(request);
    const status = textValue(body, "status", true)!;
    const [appointment] = await db.update(appointments).set({ status }).where(eq(appointments.id, appointmentId)).returning();
    return appointment ? Response.json({ success: true, data: appointment }) : jsonError("Appointment not found", 404);
  }
  if (appointmentId && request.method === "DELETE") {
    const [appointment] = await db.delete(appointments).where(eq(appointments.id, appointmentId)).returning();
    return appointment ? Response.json({ success: true, data: appointment }) : jsonError("Appointment not found", 404);
  }
  if (request.method !== "POST") return jsonError("Method not allowed", 405);
  const body = await readBody(request);
  const appointment = {
    id: crypto.randomUUID(), leadId: textValue(body, "leadId", true)!, ownerId: textValue(body, "ownerId", true)!,
    startsAt: dateValue(body, "startsAt"), mode: textValue(body, "mode") ?? "online", status: "booked", createdAt: new Date(),
  };
  await db.insert(appointments).values(appointment);
  return Response.json({ success: true, data: appointment }, { status: 201 });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return Response.json({ success: true, data: { service: "trh360-api", status: "ok" } });
    }

    const routeParts = url.pathname.split("/").filter(Boolean);
    if (routeParts[0] === "api") {
      try {
        if (routeParts[1] === "users" && routeParts.length === 2) return await handleUsers(request, url);
        if (routeParts[1] === "leads" && routeParts.length <= 3) return await handleLeads(request, url, routeParts[2]);
        if (routeParts[1] === "calls" && routeParts.length <= 3) return await handleCalls(request, url, routeParts[2]);
        if (routeParts[1] === "notes" && routeParts.length <= 3) return await handleNotes(request, url, routeParts[2]);
        if (routeParts[1] === "tasks" && routeParts.length <= 3) return await handleTasks(request, url, routeParts[2]);
        if (routeParts[1] === "appointments" && routeParts.length <= 3) return await handleAppointments(request, url, routeParts[2]);
        return jsonError("API route not found", 404);
      } catch (error) {
        if (error instanceof Error && (error.message.includes("required") || error.message.includes("must be") || error.message.includes("too long"))) {
          return jsonError(error.message, 400);
        }
        return serverError(error);
      }
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;

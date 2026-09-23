import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  vertical: text("vertical").notNull(),
  departments: text("departments").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull().default("password"),
  role: text("role").notNull().default("agent"),
  department: text("department").notNull().default("Telecalling"),
  branch: text("branch").notNull().default("Hyderabad Central"),
  tenantId: text("tenant_id").notNull().default("trh-hospital"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  source: text("source").notNull().default("manual"),
  campaign: text("campaign"),
  creative: text("creative"),
  sourceTimestamp: integer("source_timestamp", { mode: "timestamp" }),
  status: text("status").notNull().default("new"),
  qualification: text("qualification").notNull().default("Warm"),
  department: text("department").notNull().default("General"),
  branch: text("branch").notNull().default("Hyderabad Central"),
  tenantId: text("tenant_id").notNull().default("trh-hospital"),
  ownerId: text("owner_id"),
  lastCallAt: integer("last_call_at", { mode: "timestamp" }),
  uncalledSince: integer("uncalled_since", { mode: "timestamp" }),
  isRecoverable: integer("is_recoverable").default(1),
  closePrimaryReason: text("close_primary_reason"),
  closeSecondaryReason: text("close_secondary_reason"),
  closeEvidence: text("close_evidence"),
  closedAt: integer("closed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const calls = sqliteTable("calls", {
  id: text("id").primaryKey(),
  leadId: text("lead_id").notNull(),
  agentId: text("agent_id").notNull(),
  direction: text("direction").notNull(),
  outcome: text("outcome").notNull().default("pending"),
  durationSec: integer("duration_sec").default(0),
  recordingUrl: text("recording_url"),
  language: text("language").default("telugu"),
  transcript: text("transcript"),
  aiSuggestedTemp: text("ai_suggested_temp"),
  agentTemp: text("agent_temp"),
  tempDisagreement: integer("temp_disagreement").default(0),
  isMeaningful: integer("is_meaningful").default(1),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  leadId: text("lead_id").notNull(),
  authorId: text("author_id").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  leadId: text("lead_id").notNull(),
  assigneeId: text("assignee_id").notNull(),
  title: text("title").notNull(),
  dueAt: integer("due_at", { mode: "timestamp" }).notNull(),
  status: text("status").notNull().default("open"),
  touchType: text("touch_type").default("call"),
  channel: text("channel").default("call"),
  purpose: text("purpose").default("action"),
  isMissed: integer("is_missed").default(0),
  escalatedAt: integer("escalated_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const appointments = sqliteTable("appointments", {
  id: text("id").primaryKey(),
  leadId: text("lead_id").notNull(),
  ownerId: text("owner_id").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
  mode: text("mode").notNull().default("online"),
  status: text("status").notNull().default("booked"),
  remindedAt: integer("reminded_at", { mode: "timestamp" }),
  isNoShow: integer("is_no_show").default(0),
  recoveredAt: integer("recovered_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  leadId: text("lead_id").notNull(),
  callId: text("call_id"),
  confidence: integer("confidence").default(85),
  suggestedTemperature: text("suggested_temperature").default("Hot"),
  suggestedObjection: text("suggested_objection"),
  summaryText: text("summary_text").notNull(),
  structuredRemark: text("structured_remark"),
  status: text("status").notNull().default("draft"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  leadId: text("lead_id").notNull(),
  channel: text("channel").notNull().default("whatsapp"),
  direction: text("direction").notNull().default("outbound"),
  content: text("content").notNull(),
  purpose: text("purpose").notNull().default("acknowledge"),
  sequenceNumber: integer("sequence_number").notNull().default(1),
  status: text("status").notNull().default("sent"),
  sentBy: text("sent_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  details: text("details"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

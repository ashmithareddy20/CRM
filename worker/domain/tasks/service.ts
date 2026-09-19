import type { z } from "zod";
import { taskChangeSchema, taskCreateSchema } from "../../../lib/api/lifecycle";
import { ApiError } from "../../api/errors";

export interface TaskContext { tenantId: string; actorMembershipId: string; now: Date; roles: readonly string[]; }
export interface BusinessCalendar { timezone: string; schedule: Record<string, Array<{ start: string; end: string }>>; holidays?: string[]; }
const id = () => crypto.randomUUID();

export function isBusinessInstant(date: Date, calendar: BusinessCalendar): boolean {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: calendar.timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = (part: string) => parts.find((item) => item.type === part)?.value ?? "";
  const weekday = value("weekday").toLowerCase(); const time = `${value("hour")}:${value("minute")}`;
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: calendar.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return !calendar.holidays?.includes(localDate) && (calendar.schedule[weekday] ?? []).some((slot) => slot.start <= time && time < slot.end);
}

export class TaskService {
  constructor(private readonly db: D1Database) {}

  async create(context: TaskContext, rawInput: z.input<typeof taskCreateSchema>) {
    if (!context.roles.some((role) => ["agent", "manager", "operations", "scheduler", "clinician", "financial_counselor"].includes(role))) throw new ApiError("FORBIDDEN", 403, "You are not permitted to create tasks");
    const input = taskCreateSchema.parse(rawInput); const taskId = id(); const now = context.now.getTime();
    if (input.leadId) {
      const pending = await this.db.prepare("SELECT id FROM crm_tasks WHERE tenant_id = ? AND lead_id = ? AND status = 'open' AND title LIKE 'Complete mandatory call remarks:%' LIMIT 1").bind(context.tenantId, input.leadId).first();
      if (pending) throw new ApiError("CONFLICT", 409, "Complete pending mandatory call remarks before creating new lead work");
    }
    const task = { id: taskId, tenantId: context.tenantId, leadId: input.leadId ?? null, assigneeMembershipId: input.assigneeMembershipId ?? context.actorMembershipId, title: input.title, dueAt: input.dueAt.getTime(), priority: input.priority, createdAt: now, createdByMembershipId: context.actorMembershipId };
    const writes: D1PreparedStatement[] = [this.db.prepare("INSERT INTO crm_tasks (id, tenant_id, lead_id, assignee_membership_id, title, due_at, status, priority, created_at, created_by_membership_id, version) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, 1)").bind(task.id, task.tenantId, task.leadId, task.assigneeMembershipId, task.title, task.dueAt, task.priority, task.createdAt, task.createdByMembershipId)];
    if (input.slaPolicyKey) writes.push(this.db.prepare("INSERT INTO crm_sla_clocks (id, tenant_id, lead_id, task_id, policy_key, due_at, status, created_at, created_by_membership_id, version) VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, 1)").bind(id(), context.tenantId, task.leadId, taskId, input.slaPolicyKey, task.dueAt, now, context.actorMembershipId));
    await this.db.batch(writes);
    return { taskId, status: "open", dueAt: input.dueAt };
  }

  async change(context: TaskContext, taskId: string, rawInput: z.input<typeof taskChangeSchema>) {
    const input = taskChangeSchema.parse(rawInput);
    const updated = await this.db.prepare("UPDATE crm_tasks SET status = ?, due_at = COALESCE(?, due_at), version = version + 1, updated_at = ?, updated_by_membership_id = ? WHERE tenant_id = ? AND id = ? AND version = ? AND status != 'cancelled'")
      .bind(input.status, input.dueAt?.getTime() ?? null, context.now.getTime(), context.actorMembershipId, context.tenantId, taskId, input.expectedVersion).run();
    if (!updated.meta.changes) throw new ApiError("PRECONDITION_FAILED", 412, "Task was changed by another request");
    await this.db.prepare("UPDATE crm_sla_clocks SET status = CASE WHEN ? IN ('completed', 'cancelled') THEN 'stopped' ELSE status END, updated_at = ?, updated_by_membership_id = ? WHERE tenant_id = ? AND task_id = ? AND status = 'running'").bind(input.status, context.now.getTime(), context.actorMembershipId, context.tenantId, taskId).run();
    return { taskId, status: input.status, version: input.expectedVersion + 1 };
  }

  async overdueQueue(context: TaskContext, assigneeMembershipId?: string) {
    const query = assigneeMembershipId
      ? this.db.prepare("SELECT id, lead_id AS leadId, assignee_membership_id AS assigneeMembershipId, title, due_at AS dueAt, priority, version FROM crm_tasks WHERE tenant_id = ? AND assignee_membership_id = ? AND status = 'open' AND due_at < ? ORDER BY due_at ASC LIMIT 100") .bind(context.tenantId, assigneeMembershipId, context.now.getTime())
      : this.db.prepare("SELECT id, lead_id AS leadId, assignee_membership_id AS assigneeMembershipId, title, due_at AS dueAt, priority, version FROM crm_tasks WHERE tenant_id = ? AND status = 'open' AND due_at < ? ORDER BY due_at ASC LIMIT 100").bind(context.tenantId, context.now.getTime());
    return query.all();
  }

  /** Cron-safe escalation creation. The table's unique key prevents repeated Cron runs from duplicating alerts. */
  async escalateOverdue(tenantId: string, now: Date): Promise<number> {
    const rules = await this.db.prepare("SELECT id, threshold_seconds AS thresholdSeconds FROM crm_escalation_rules WHERE tenant_id = ?").bind(tenantId).all<{ id: string; thresholdSeconds: number }>();
    let created = 0;
    for (const rule of rules.results) {
      const overdue = await this.db.prepare("SELECT id FROM crm_tasks WHERE tenant_id = ? AND status = 'open' AND due_at <= ? LIMIT 200").bind(tenantId, now.getTime() - rule.thresholdSeconds * 1000).all<{ id: string }>();
      for (const task of overdue.results) {
        const inserted = await this.db.prepare("INSERT OR IGNORE INTO crm_escalation_events (id, tenant_id, task_id, rule_id, threshold, occurred_at, created_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, 1)").bind(id(), tenantId, task.id, rule.id, rule.thresholdSeconds, now.getTime(), now.getTime()).run();
        created += inserted.meta.changes;
      }
    }
    return created;
  }
}

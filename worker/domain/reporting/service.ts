import { ApiError } from "../../api/errors";

/** Reporting facts intentionally contain only operational identifiers and evidence references, never PHI. */
export type ReportingFactType =
  | "lead.received" | "lead.assigned" | "call.attempted" | "call.meaningful_connection"
  | "qualification.completed" | "qualification.hot" | "follow_up.completed" | "appointment.booked"
  | "appointment.arrived" | "consultation.completed" | "treatment.advised" | "procedure.booked"
  | "treatment.completed" | "conversion.completed" | "lead.final_loss" | "message.scheduled"
  | "message.accepted" | "message.delivered" | "message.failed" | "message.replied"
  | "message.read" | "message.opt_out" | "recovery.enrolled" | "recovery.converted"
  | "revenue.recognized" | "revenue.reversed" | string;

export interface FactDimensions {
  leadId?: string;
  branchId?: string;
  sourceId?: string;
  campaignId?: string;
  creativeId?: string;
  assignedMembershipId?: string;
  originalAssignedMembershipId?: string;
  diseaseId?: string;
  treatmentId?: string;
  doctorId?: string;
  channel?: string;
  evidenceId?: string;
  outcome?: string;
  qualification?: string;
  [key: string]: string | number | boolean | undefined;
}
export interface ReportingFact { sourceEventId: string; type: ReportingFactType; occurredAt: Date; dimensions: FactDimensions; valueMinor?: number; }
export interface ReportScope { tenantId: string; actorMembershipId: string; roles: readonly string[]; branchIds?: readonly string[]; }
export interface ReportFilters { from?: Date; to?: Date; branchId?: string; sourceId?: string; campaignId?: string; assignedMembershipId?: string; channel?: string; diseaseId?: string; treatmentId?: string; }
export interface MetricValue { key: string; version: string; numerator: number; denominator: number; value: number | null; notApplicable: boolean; unknown: number; sampleSize: number; asOf: string; cohortBasis: string; filters: ReportFilters; }
export interface ReportDefinition { key: string; version: string; formula: string; numerator: string; denominator: string; unknownRule: string; }
export interface DrillDownRow { leadId?: string; factType: string; occurredAt: string; evidenceId?: string; dimensions: FactDimensions; valueMinor?: number; }

const METRIC_DEFINITIONS: readonly ReportDefinition[] = [
  { key: "connected_rate", version: "2026-09-19.1", formula: "meaningfully connected / received", numerator: "distinct lead episodes with meaningful connection", denominator: "distinct received lead episodes", unknownRule: "received leads without a call attempt" },
  { key: "qualified_rate", version: "2026-09-19.1", formula: "qualified / connected", numerator: "distinct qualified lead episodes", denominator: "distinct meaningfully connected lead episodes", unknownRule: "connected leads without qualification evidence" },
  { key: "hot_rate", version: "2026-09-19.1", formula: "Hot / qualified", numerator: "distinct Hot qualification episodes", denominator: "distinct qualified lead episodes", unknownRule: "qualified leads without reviewed Hot/Warm/Cold evidence" },
  { key: "booking_rate", version: "2026-09-19.1", formula: "booked / Hot", numerator: "actual appointment bookings", denominator: "distinct Hot qualification episodes", unknownRule: "Hot leads without booking evidence" },
  { key: "arrival_rate", version: "2026-09-19.1", formula: "arrived / booked", numerator: "distinct arrived appointments", denominator: "distinct booked episodes", unknownRule: "booked episodes without completed appointment status" },
  { key: "consultation_rate", version: "2026-09-19.1", formula: "consulted / arrived", numerator: "completed consultations", denominator: "distinct arrived episodes", unknownRule: "arrivals without consultation evidence" },
  { key: "treatment_completion_rate", version: "2026-09-19.1", formula: "treatment completed / procedure booked", numerator: "evidence-backed completed treatment", denominator: "distinct procedure booked episodes", unknownRule: "booked procedures without completion evidence" },
  { key: "conversion_rate", version: "2026-09-19.1", formula: "converted / received", numerator: "evidence-backed unique converted episodes", denominator: "distinct received episodes", unknownRule: "received episodes without a final conversion or final loss" },
  { key: "not_connected_recovery_rate", version: "2026-09-19.1", formula: "later connected initial not-connected / initial not-connected", numerator: "initially attempted then later meaningfully connected", denominator: "initial attempted but not meaningfully connected episodes", unknownRule: "attempt records without an initial classification" },
  { key: "delivery_rate", version: "2026-09-19.1", formula: "delivered / accepted", numerator: "delivered message attempts", denominator: "accepted message attempts", unknownRule: "accepted messages with no provider telemetry" },
  { key: "reply_rate", version: "2026-09-19.1", formula: "replied / delivered", numerator: "messages with replies", denominator: "delivered message attempts", unknownRule: "delivery telemetry unavailable" },
  { key: "recovery_conversion_rate", version: "2026-09-19.1", formula: "recovery converted / enrolled", numerator: "enrolled recovery episodes later converted", denominator: "recovery enrollments", unknownRule: "enrollment without outcome after observation cutoff" },
];
const privilegedRoles = new Set(["manager", "operations", "tenant_administrator", "financial_counselor", "clinician"]);
const allowedDimensionKeys = new Set(["leadId", "branchId", "sourceId", "campaignId", "creativeId", "assignedMembershipId", "originalAssignedMembershipId", "diseaseId", "treatmentId", "doctorId", "channel", "evidenceId", "outcome", "qualification", "attemptId", "messageAttemptId", "reason", "touchNumber", "contentVersion", "currency"]);
const isoDate = (date: Date, timezone = "UTC") => new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const id = () => crypto.randomUUID();

function sanitizeDimensions(dimensions: FactDimensions): FactDimensions {
  const clean: FactDimensions = {};
  for (const [key, value] of Object.entries(dimensions)) if (allowedDimensionKeys.has(key) && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")) clean[key] = value;
  return clean;
}
function isPrivileged(scope: ReportScope) { return scope.roles.some((role) => privilegedRoles.has(role)); }
function authorizes(scope: ReportScope, dimensions: FactDimensions): boolean {
  if (scope.branchIds?.length && (!dimensions.branchId || !scope.branchIds.includes(String(dimensions.branchId)))) return false;
  return isPrivileged(scope) || dimensions.assignedMembershipId === scope.actorMembershipId || dimensions.originalAssignedMembershipId === scope.actorMembershipId;
}
function matchesFilters(fact: LoadedFact, filters: ReportFilters) {
  const d = fact.dimensions;
  return (!filters.from || fact.occurredAt >= filters.from) && (!filters.to || fact.occurredAt <= filters.to)
    && (!filters.branchId || d.branchId === filters.branchId) && (!filters.sourceId || d.sourceId === filters.sourceId)
    && (!filters.campaignId || d.campaignId === filters.campaignId) && (!filters.assignedMembershipId || d.assignedMembershipId === filters.assignedMembershipId || d.originalAssignedMembershipId === filters.assignedMembershipId)
    && (!filters.channel || d.channel === filters.channel) && (!filters.diseaseId || d.diseaseId === filters.diseaseId) && (!filters.treatmentId || d.treatmentId === filters.treatmentId);
}
type LoadedFact = ReportingFact & { id: string };
function distinctLeadIds(facts: readonly LoadedFact[], type: string) { return new Set(facts.filter((fact) => fact.type === type).map((fact) => String(fact.dimensions.leadId ?? fact.sourceEventId))); }
function metric(definition: ReportDefinition, numeratorSet: Set<string>, denominatorSet: Set<string>, unknown: number, asOf: Date, filters: ReportFilters): MetricValue {
  const denominator = denominatorSet.size; const numerator = [...numeratorSet].filter((lead) => denominatorSet.has(lead)).length;
  return { key: definition.key, version: definition.version, numerator, denominator, value: denominator ? numerator / denominator : null, notApplicable: denominator === 0, unknown, sampleSize: denominator, asOf: asOf.toISOString(), cohortBasis: definition.denominator, filters };
}

/** D1 projection/query service. All report queries first apply the caller's tenant and branch/owner scope. */
export class ReportingService {
  constructor(private readonly db: D1Database, private readonly now: () => Date = () => new Date()) {}
  definitions(): readonly ReportDefinition[] { return METRIC_DEFINITIONS; }

  async registerDefinitions(scope: ReportScope): Promise<number> {
    this.requireManager(scope);
    const at = this.now().getTime(); let written = 0;
    for (const definition of METRIC_DEFINITIONS) {
      const result = await this.db.prepare("INSERT OR IGNORE INTO crm_kpi_definitions (id, tenant_id, key, version_label, definition_json, created_at, created_by_membership_id, version) VALUES (?, ?, ?, ?, ?, ?, ?, 1)")
        .bind(id(), scope.tenantId, definition.key, definition.version, JSON.stringify(definition), at, scope.actorMembershipId).run();
      written += result.meta.changes;
    }
    return written;
  }

  /** The unique tenant/source event key is the idempotency boundary for at-least-once projection consumers. */
  async project(scope: Pick<ReportScope, "tenantId" | "actorMembershipId">, fact: ReportingFact): Promise<boolean> {
    if (!fact.sourceEventId || !fact.type || Number.isNaN(fact.occurredAt.getTime())) throw new ApiError("VALIDATION_FAILED", 422, "Reporting fact is incomplete");
    const at = this.now().getTime();
    const result = await this.db.prepare("INSERT OR IGNORE INTO crm_reporting_facts (id, tenant_id, source_event_id, fact_type, occurred_at, dimensions_json, value_minor, created_at, created_by_membership_id, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)")
      .bind(id(), scope.tenantId, fact.sourceEventId, fact.type, fact.occurredAt.getTime(), JSON.stringify(sanitizeDimensions(fact.dimensions)), fact.valueMinor ?? null, at, scope.actorMembershipId).run();
    return result.meta.changes === 1;
  }

  async rebuildDailyAggregate(scope: ReportScope, localDate: string, timezone = "UTC"): Promise<{ localDate: string; watermark: string; facts: number }> {
    this.requireManager(scope);
    const facts = await this.load(scope, {});
    const dayFacts = facts.filter((fact) => isoDate(fact.occurredAt, timezone) === localDate);
    const summary = { received: distinctLeadIds(dayFacts, "lead.received").size, converted: distinctLeadIds(dayFacts, "conversion.completed").size, finalLoss: distinctLeadIds(dayFacts, "lead.final_loss").size, facts: dayFacts.length, timezone };
    const watermark = dayFacts.map((fact) => fact.sourceEventId).sort().at(-1) ?? "none";
    await this.db.prepare("INSERT INTO crm_daily_aggregates (id, tenant_id, metric_key, local_date, dimensions_hash, value_json, watermark, created_at, created_by_membership_id, updated_at, updated_by_membership_id, version) VALUES (?, ?, 'daily_funnel', ?, 'all', ?, ?, ?, ?, ?, ?, 1) ON CONFLICT(tenant_id, metric_key, local_date, dimensions_hash) DO UPDATE SET value_json = excluded.value_json, watermark = excluded.watermark, updated_at = excluded.updated_at, updated_by_membership_id = excluded.updated_by_membership_id, version = crm_daily_aggregates.version + 1")
      .bind(id(), scope.tenantId, localDate, JSON.stringify(summary), watermark, this.now().getTime(), scope.actorMembershipId, this.now().getTime(), scope.actorMembershipId).run();
    return { localDate, watermark, facts: dayFacts.length };
  }

  async funnel(scope: ReportScope, filters: ReportFilters = {}): Promise<MetricValue[]> {
    const facts = await this.load(scope, filters); const asOf = this.now();
    const received = distinctLeadIds(facts, "lead.received"); const connected = distinctLeadIds(facts, "call.meaningful_connection"); const qualified = distinctLeadIds(facts, "qualification.completed"); const hot = distinctLeadIds(facts, "qualification.hot"); const booked = distinctLeadIds(facts, "appointment.booked"); const arrived = distinctLeadIds(facts, "appointment.arrived"); const consulted = distinctLeadIds(facts, "consultation.completed"); const procedure = distinctLeadIds(facts, "procedure.booked"); const completed = new Set([...distinctLeadIds(facts, "treatment.completed"), ...distinctLeadIds(facts, "conversion.completed")]);
    const attempted = distinctLeadIds(facts, "call.attempted"); const losses = distinctLeadIds(facts, "lead.final_loss");
    const defs = Object.fromEntries(METRIC_DEFINITIONS.map((item) => [item.key, item]));
    return [
      metric(defs.connected_rate, connected, received, [...received].filter((lead) => !attempted.has(lead)).length, asOf, filters),
      metric(defs.qualified_rate, qualified, connected, [...connected].filter((lead) => !qualified.has(lead)).length, asOf, filters),
      metric(defs.hot_rate, hot, qualified, [...qualified].filter((lead) => !hot.has(lead)).length, asOf, filters),
      metric(defs.booking_rate, booked, hot, [...hot].filter((lead) => !booked.has(lead)).length, asOf, filters),
      metric(defs.arrival_rate, arrived, booked, [...booked].filter((lead) => !arrived.has(lead)).length, asOf, filters),
      metric(defs.consultation_rate, consulted, arrived, [...arrived].filter((lead) => !consulted.has(lead)).length, asOf, filters),
      metric(defs.treatment_completion_rate, completed, procedure, [...procedure].filter((lead) => !completed.has(lead)).length, asOf, filters),
      metric(defs.conversion_rate, completed, received, [...received].filter((lead) => !completed.has(lead) && !losses.has(lead)).length, asOf, filters),
    ];
  }

  async communication(scope: ReportScope, filters: ReportFilters = {}) {
    const facts = await this.load(scope, filters); const attempts = (type: string) => new Set(facts.filter((item) => item.type === type).map((item) => String(item.dimensions.messageAttemptId ?? item.sourceEventId)));
    const accepted = attempts("message.accepted"), delivered = attempts("message.delivered"), replied = attempts("message.replied");
    const unknown = [...accepted].filter((item) => !delivered.has(item) && !attempts("message.failed").has(item)).length;
    const defs = Object.fromEntries(METRIC_DEFINITIONS.map((item) => [item.key, item]));
    return { counts: Object.fromEntries(["message.scheduled", "message.accepted", "message.delivered", "message.failed", "message.read", "message.replied", "message.opt_out"].map((type) => [type, attempts(type).size])), metrics: [metric(defs.delivery_rate, delivered, accepted, unknown, this.now(), filters), metric(defs.reply_rate, replied, delivered, unknown, this.now(), filters)] };
  }

  async sources(scope: ReportScope, filters: ReportFilters = {}) { return this.breakdown(scope, filters, "sourceId"); }
  async agents(scope: ReportScope, filters: ReportFilters = {}) { return this.breakdown(scope, filters, "originalAssignedMembershipId"); }
  async channels(scope: ReportScope, filters: ReportFilters = {}) { return this.breakdown(scope, filters, "channel"); }
  async finance(scope: ReportScope, filters: ReportFilters = {}) {
    const facts = await this.load(scope, filters); const values: Record<string, number> = {};
    for (const fact of facts.filter((item) => item.type === "revenue.recognized" || item.type === "revenue.reversed")) { const currency = String(fact.dimensions.currency ?? "unknown"); values[currency] = (values[currency] ?? 0) + (fact.valueMinor ?? 0); }
    return { recognizedNetMinorByCurrency: values, revenueBearingLeads: distinctLeadIds(facts, "revenue.recognized").size, receivedLeads: distinctLeadIds(facts, "lead.received").size, asOf: this.now().toISOString(), filters };
  }
  async recovery(scope: ReportScope, filters: ReportFilters = {}) {
    const facts = await this.load(scope, filters); const defs = Object.fromEntries(METRIC_DEFINITIONS.map((item) => [item.key, item])); const enrolled = distinctLeadIds(facts, "recovery.enrolled");
    return metric(defs.recovery_conversion_rate, distinctLeadIds(facts, "recovery.converted"), enrolled, [...enrolled].filter((lead) => !distinctLeadIds(facts, "recovery.converted").has(lead)).length, this.now(), filters);
  }

  /** Comparison intentionally excludes active leads: only mature conversion vs final-loss cohorts are comparable. */
  async cohorts(scope: ReportScope, filters: ReportFilters = {}) {
    const facts = await this.load(scope, filters); const byLead = new Map<string, LoadedFact[]>();
    for (const fact of facts) { const lead = String(fact.dimensions.leadId ?? ""); if (lead) byLead.set(lead, [...(byLead.get(lead) ?? []), fact]); }
    const summarize = (name: string, predicate: (items: LoadedFact[]) => boolean) => {
      const cohort = [...byLead.entries()].filter(([, items]) => predicate(items));
      const evidence = (type: string) => cohort.filter(([, items]) => items.some((item) => item.type === type)).length;
      const conversionTimes = cohort.map(([, items]) => { const received = items.find((item) => item.type === "lead.received")?.occurredAt; const converted = items.find((item) => item.type === "conversion.completed")?.occurredAt; return received && converted ? converted.getTime() - received.getTime() : undefined; }).filter((value): value is number => value !== undefined);
      return { cohort: name, size: cohort.length, firstResponse: evidence("call.attempted"), connected: evidence("call.meaningful_connection"), followUpCompleted: evidence("follow_up.completed"), delivered: evidence("message.delivered"), replied: evidence("message.replied"), booked: evidence("appointment.booked"), visited: evidence("appointment.arrived"), doctorInteraction: evidence("consultation.completed"), counseling: evidence("counseling.completed"), package: evidence("package.accepted"), insurance: evidence("insurance.approved"), medianConversionMs: conversionTimes.length ? conversionTimes.sort((a, b) => a - b)[Math.floor(conversionTimes.length / 2)] : null, missingEvidence: cohort.filter(([, items]) => !items.some((item) => item.dimensions.evidenceId)).length };
    };
    return { basis: "same entry filters and observation cutoff; active/pending excluded", converted: summarize("converted", (items) => items.some((item) => item.type === "conversion.completed")), finalLoss: summarize("final_loss", (items) => items.some((item) => item.type === "lead.final_loss")), activeOrUnmatured: summarize("active_or_unmatured", (items) => !items.some((item) => item.type === "conversion.completed" || item.type === "lead.final_loss")), asOf: this.now().toISOString(), filters };
  }

  async drillDown(scope: ReportScope, filters: ReportFilters = {}): Promise<{ rows: DrillDownRow[]; asOf: string; filters: ReportFilters }> {
    const facts = await this.load(scope, filters);
    return { rows: facts.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()).slice(0, 500).map((fact) => ({ leadId: typeof fact.dimensions.leadId === "string" ? fact.dimensions.leadId : undefined, factType: fact.type, occurredAt: fact.occurredAt.toISOString(), evidenceId: typeof fact.dimensions.evidenceId === "string" ? fact.dimensions.evidenceId : undefined, dimensions: fact.dimensions, valueMinor: fact.valueMinor })), asOf: this.now().toISOString(), filters };
  }

  async diagnostic(scope: ReportScope, days: 1 | 7 | 15 | 30, filters: ReportFilters = {}) {
    this.requireManager(scope); const end = this.now(); const start = new Date(end.getTime() - days * 86_400_000); const scoped = { ...filters, from: filters.from ?? start, to: filters.to ?? end }; const funnel = await this.funnel(scope, scoped);
    const byKey = Object.fromEntries(funnel.map((item) => [item.key, item])); const findings: Array<{ rule: string; evidence: string; proposedRootCause: string; correctiveAction: string; expectedTarget: string; reviewAt: string }> = [];
    if ((byKey.connected_rate?.value ?? 1) < 0.5) findings.push({ rule: "low_connection", evidence: `connected ${byKey.connected_rate.numerator}/${byKey.connected_rate.denominator}`, proposedRootCause: "contactability or first-attempt delay requires review", correctiveAction: "Review untouched and not-connected queue with owner", expectedTarget: "documented first-attempt coverage", reviewAt: new Date(end.getTime() + 86_400_000).toISOString() });
    if ((byKey.booking_rate?.value ?? 1) < 0.25) findings.push({ rule: "hot_to_booking_drop", evidence: `booked ${byKey.booking_rate.numerator}/${byKey.booking_rate.denominator}`, proposedRootCause: "appointment or counseling process drop", correctiveAction: "Review objection and counseling evidence", expectedTarget: "improve evidenced booking completion", reviewAt: new Date(end.getTime() + 86_400_000).toISOString() });
    const segments = days === 15 ? [{ name: "days_1_7", from: new Date(start), to: new Date(start.getTime() + 7 * 86_400_000 - 1) }, { name: "days_8_14", from: new Date(start.getTime() + 7 * 86_400_000), to: new Date(start.getTime() + 14 * 86_400_000 - 1) }, { name: "day_15", from: new Date(start.getTime() + 14 * 86_400_000), to: end }] : [];
    return { period: { days, from: scoped.from!.toISOString(), to: scoped.to!.toISOString() }, funnel, segments, findings, delayedFreshnessDisclosure: "Facts are projected asynchronously; as-of reflects the latest query time and projection watermark is available in daily aggregates." };
  }

  async managementQueue(scope: ReportScope, period: "morning" | "day" | "end") {
    this.requireManager(scope); const now = this.now().getTime(); const leadScope = this.branchSql(scope, "l.branch_id"); const taskScope = this.branchSql(scope, "l.branch_id");
    const [newLeads, overdue, appointments, failures] = await Promise.all([
      this.db.prepare(`SELECT l.id, l.assigned_membership_id AS assignedMembershipId, l.lifecycle_stage AS stage, l.received_at AS receivedAt FROM crm_lead_episodes l WHERE l.tenant_id = ? AND l.archived_at IS NULL ${leadScope.sql} AND (l.assigned_membership_id IS NULL OR l.lifecycle_stage = 'received') ORDER BY l.received_at ASC LIMIT 100`).bind(scope.tenantId, ...leadScope.values).all(),
      this.db.prepare(`SELECT t.id, t.lead_id AS leadId, t.assignee_membership_id AS assigneeMembershipId, t.title, t.due_at AS dueAt, t.priority FROM crm_tasks t LEFT JOIN crm_lead_episodes l ON l.id = t.lead_id AND l.tenant_id = t.tenant_id WHERE t.tenant_id = ? AND t.status = 'open' AND t.due_at < ? ${taskScope.sql} ORDER BY t.due_at ASC LIMIT 100`).bind(scope.tenantId, now, ...taskScope.values).all(),
      this.db.prepare(`SELECT a.id, a.lead_id AS leadId, a.doctor_id AS doctorId, a.starts_at AS startsAt, a.status FROM crm_appointments a WHERE a.tenant_id = ? AND a.starts_at >= ? AND a.starts_at < ? ORDER BY a.starts_at ASC LIMIT 100`).bind(scope.tenantId, now, now + 86_400_000).all(),
      this.db.prepare("SELECT source_event_id AS sourceEventId, dimensions_json AS dimensionsJson, occurred_at AS occurredAt FROM crm_reporting_facts WHERE tenant_id = ? AND fact_type = 'message.failed' AND occurred_at >= ? ORDER BY occurred_at DESC LIMIT 100").bind(scope.tenantId, now - 86_400_000).all(),
    ]);
    return { period, generatedAt: new Date(now).toISOString(), queues: { newUnassignedOrUntouched: newLeads.results, overdueWork: overdue.results, todayAppointments: appointments.results, deliveryFailures: failures.results }, disclosure: period === "end" ? "End-of-day review separates outcome evidence from process compliance; inspect final-loss/recovery and quality evidence in drill-down." : "Queue is live operational state, not delayed report aggregate." };
  }

  async requestExport(scope: ReportScope, type: "funnel" | "cohorts" | "drill-down", filters: ReportFilters = {}): Promise<{ operationId: string; reportRunId: string; status: "pending"; expiresAt: string }> {
    this.requireManager(scope); this.assertFilterScope(scope, filters); const now = this.now(); const reportRunId = id(); const operationId = `export:${reportRunId}`; const filtersJson = JSON.stringify({ type, filters, scope: { branchIds: scope.branchIds ?? [], actorMembershipId: scope.actorMembershipId }, expiresAt: new Date(now.getTime() + 24 * 60 * 60_000).toISOString(), identifiers: "suppressed_by_default" });
    await this.db.batch([
      this.db.prepare("INSERT INTO crm_report_runs (id, tenant_id, type, filters_json, status, created_at, created_by_membership_id, version) VALUES (?, ?, ?, ?, 'pending', ?, ?, 1)").bind(reportRunId, scope.tenantId, `export:${type}`, filtersJson, now.getTime(), scope.actorMembershipId),
      this.db.prepare("INSERT INTO crm_durable_jobs (id, tenant_id, type, payload_ciphertext, due_at, state, created_at, created_by_membership_id, version) VALUES (?, ?, 'report.export', ?, ?, 'pending', ?, ?, 1)").bind(id(), scope.tenantId, JSON.stringify({ operationId, reportRunId }), now.getTime(), now.getTime(), scope.actorMembershipId),
      this.db.prepare("INSERT INTO crm_audit_events (id, tenant_id, actor_key, action, resource_type, resource_id, request_id, occurred_at, detail_ciphertext, created_at, created_by_membership_id, version) VALUES (?, ?, ?, 'export.requested', 'report_run', ?, ?, ?, ?, ?, ?, 1)").bind(id(), scope.tenantId, scope.actorMembershipId, reportRunId, operationId, now.getTime(), JSON.stringify({ type, identifiers: "suppressed_by_default" }), now.getTime(), scope.actorMembershipId),
    ]);
    return { operationId, reportRunId, status: "pending", expiresAt: new Date(now.getTime() + 24 * 60 * 60_000).toISOString() };
  }

  private async breakdown(scope: ReportScope, filters: ReportFilters, dimension: keyof FactDimensions) {
    const facts = await this.load(scope, filters); const values = new Map<string, { received: Set<string>; converted: Set<string>; finalLoss: Set<string> }>();
    for (const fact of facts) { const key = String(fact.dimensions[dimension] ?? "unknown"); const row = values.get(key) ?? { received: new Set(), converted: new Set(), finalLoss: new Set() }; const lead = String(fact.dimensions.leadId ?? fact.sourceEventId); if (fact.type === "lead.received") row.received.add(lead); if (fact.type === "conversion.completed") row.converted.add(lead); if (fact.type === "lead.final_loss") row.finalLoss.add(lead); values.set(key, row); }
    return { dimension, rows: [...values].map(([key, row]) => ({ key, received: row.received.size, converted: row.converted.size, finalLoss: row.finalLoss.size, conversionRate: row.received.size ? row.converted.size / row.received.size : null })), asOf: this.now().toISOString(), filters };
  }
  private async load(scope: ReportScope, filters: ReportFilters): Promise<LoadedFact[]> {
    this.assertFilterScope(scope, filters);
    const rows = await this.db.prepare("SELECT id, source_event_id AS sourceEventId, fact_type AS factType, occurred_at AS occurredAt, dimensions_json AS dimensionsJson, value_minor AS valueMinor FROM crm_reporting_facts WHERE tenant_id = ? AND occurred_at >= COALESCE(?, occurred_at) AND occurred_at <= COALESCE(?, occurred_at) ORDER BY occurred_at ASC LIMIT 20000")
      .bind(scope.tenantId, filters.from?.getTime() ?? null, filters.to?.getTime() ?? null).all<{ id: string; sourceEventId: string; factType: string; occurredAt: number; dimensionsJson: string; valueMinor: number | null }>();
    return rows.results.map((row) => ({ id: row.id, sourceEventId: row.sourceEventId, type: row.factType, occurredAt: new Date(row.occurredAt), dimensions: JSON.parse(row.dimensionsJson) as FactDimensions, ...(row.valueMinor === null ? {} : { valueMinor: row.valueMinor }) })).filter((fact) => authorizes(scope, fact.dimensions) && matchesFilters(fact, filters));
  }
  private assertFilterScope(scope: ReportScope, filters: ReportFilters) {
    if (filters.branchId && scope.branchIds?.length && !scope.branchIds.includes(filters.branchId)) throw new ApiError("FORBIDDEN", 403, "Report scope is unavailable");
    if (!isPrivileged(scope) && filters.assignedMembershipId && filters.assignedMembershipId !== scope.actorMembershipId) throw new ApiError("FORBIDDEN", 403, "Report scope is unavailable");
  }
  private requireManager(scope: ReportScope) { if (!isPrivileged(scope)) throw new ApiError("FORBIDDEN", 403, "Reporting management access is required"); }
  private branchSql(scope: ReportScope, column: string) { return scope.branchIds?.length ? { sql: `AND ${column} IN (${scope.branchIds.map(() => "?").join(",")})`, values: [...scope.branchIds] } : { sql: "", values: [] as string[] }; }
}

/** Spreadsheet cells must never be emitted unescaped from a CRM export. */
export function escapeCsvCell(value: unknown): string {
  const raw = value == null ? "" : String(value); const formulaSafe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(formulaSafe) ? `"${formulaSafe.replaceAll('"', '""')}"` : formulaSafe;
}
export function toSafeCsv(headers: readonly string[], rows: readonly Record<string, unknown>[]): string { return [headers.map(escapeCsvCell).join(","), ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(","))].join("\r\n"); }

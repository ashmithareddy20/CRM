import { ReportingService, type ReportFilters, type ReportingFact, type ReportScope, toSafeCsv } from "../domain/reporting/service";

export interface ReportingJobResult { kind: "projection" | "daily_aggregate" | "export"; status: "completed" | "skipped"; reportRunId?: string; objectKey?: string; }
export interface ReportingJobPayload {
  kind: "projection" | "daily_aggregate" | "export";
  tenantId: string;
  actorMembershipId: string;
  fact?: ReportingFact;
  localDate?: string;
  timezone?: string;
  reportRunId?: string;
}
export interface PrivateExportStore { put(key: string, body: string, options: { contentType: string; expiresAt: Date; metadata: Record<string, string> }): Promise<void>; }
export interface ExportRunRepository {
  get(tenantId: string, reportRunId: string): Promise<{ id: string; type: string; filtersJson: string; status: string } | undefined>;
  complete(tenantId: string, reportRunId: string, result: { objectKey: string; expiresAt: Date; sizeBytes: number }): Promise<void>;
  fail(tenantId: string, reportRunId: string, reason: string): Promise<void>;
}
export interface ReportingJobDependencies { store: PrivateExportStore; runs: ExportRunRepository; now?: () => Date; }
interface StoredExportContract { type: "funnel" | "cohorts" | "drill-down"; filters: ReportFilters; scope: { branchIds: readonly string[]; actorMembershipId: string }; expiresAt: string; identifiers: "suppressed_by_default"; }

/** Queue consumers pass only opaque job IDs; this handler reads a durable run contract and persists the produced object. */
export async function runReportingJob(service: ReportingService, payload: ReportingJobPayload, dependencies?: ReportingJobDependencies): Promise<ReportingJobResult> {
  const scope = { tenantId: payload.tenantId, actorMembershipId: payload.actorMembershipId, roles: ["tenant_administrator"] as const };
  if (payload.kind === "projection") {
    if (!payload.fact) throw new Error("Reporting projection job is missing a fact");
    return { kind: "projection", status: await service.project(scope, payload.fact) ? "completed" : "skipped" };
  }
  if (payload.kind === "daily_aggregate") {
    if (!payload.localDate) throw new Error("Daily aggregate job is missing local date");
    await service.rebuildDailyAggregate(scope, payload.localDate, payload.timezone ?? "UTC");
    return { kind: "daily_aggregate", status: "completed" };
  }
  if (!payload.reportRunId || !dependencies) throw new Error("Export job requires durable run and private object dependencies");
  const run = await dependencies.runs.get(payload.tenantId, payload.reportRunId);
  if (!run || run.status !== "pending") return { kind: "export", status: "skipped", reportRunId: payload.reportRunId };
  let contract: StoredExportContract;
  try { contract = JSON.parse(run.filtersJson) as StoredExportContract; } catch { await dependencies.runs.fail(payload.tenantId, run.id, "invalid_export_contract"); throw new Error("Export run contract is invalid"); }
  const exportScope: ReportScope = { tenantId: payload.tenantId, actorMembershipId: contract.scope.actorMembershipId, roles: ["tenant_administrator"], branchIds: contract.scope.branchIds };
  const csv = await exportCsv(service, exportScope, contract);
  const sizeBytes = new TextEncoder().encode(csv).byteLength;
  if (sizeBytes > 10 * 1024 * 1024) { await dependencies.runs.fail(payload.tenantId, run.id, "export_too_large"); throw new Error("Export exceeds 10 MiB limit"); }
  const expiresAt = new Date(contract.expiresAt); const objectKey = `exports/${payload.tenantId}/${run.id}.csv`;
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= (dependencies.now?.() ?? new Date())) { await dependencies.runs.fail(payload.tenantId, run.id, "export_expired"); throw new Error("Export contract expired"); }
  await dependencies.store.put(objectKey, csv, { contentType: "text/csv; charset=utf-8", expiresAt, metadata: { tenantId: payload.tenantId, reportRunId: run.id, identifiers: "suppressed", contentDisposition: "attachment" } });
  await dependencies.runs.complete(payload.tenantId, run.id, { objectKey, expiresAt, sizeBytes });
  return { kind: "export", status: "completed", reportRunId: run.id, objectKey };
}

async function exportCsv(service: ReportingService, scope: ReportScope, contract: StoredExportContract): Promise<string> {
  if (contract.type === "funnel") {
    const funnel = await service.funnel(scope, contract.filters);
    return toSafeCsv(["key", "version", "numerator", "denominator", "value", "unknown", "asOf"], funnel.map((item) => ({ key: item.key, version: item.version, numerator: item.numerator, denominator: item.denominator, value: item.value ?? "", unknown: item.unknown, asOf: item.asOf })));
  }
  if (contract.type === "cohorts") {
    const cohorts = await service.cohorts(scope, contract.filters);
    return toSafeCsv(["cohort", "size", "firstResponse", "connected", "booked", "visited", "doctorInteraction", "medianConversionMs", "missingEvidence"], [cohorts.converted, cohorts.finalLoss, cohorts.activeOrUnmatured]);
  }
  const drillDown = await service.drillDown(scope, contract.filters);
  return toSafeCsv(["leadId", "factType", "occurredAt", "evidenceId", "valueMinor"], drillDown.rows.map((row) => ({ leadId: row.leadId ?? "", factType: row.factType, occurredAt: row.occurredAt, evidenceId: row.evidenceId ?? "", valueMinor: row.valueMinor ?? "" })));
}

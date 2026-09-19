import { ReportingService, type ReportingFact, toSafeCsv } from "../domain/reporting/service";

export interface ReportingJobResult { kind: "projection" | "daily_aggregate" | "export"; status: "completed" | "skipped"; reportRunId?: string; }
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

/** Queue consumers pass only opaque job IDs; payloads are read from D1 by the consumer before calling this handler. */
export async function runReportingJob(service: ReportingService, payload: ReportingJobPayload, store?: PrivateExportStore): Promise<ReportingJobResult> {
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
  if (!payload.reportRunId || !store) throw new Error("Export job requires a report run and private export store");
  // The report-run filters are loaded by the owning queue processor; this executor only writes a bounded, private artifact.
  const funnel = await service.funnel(scope);
  const csv = toSafeCsv(["key", "version", "numerator", "denominator", "value", "unknown", "asOf"], funnel.map((item) => ({ key: item.key, version: item.version, numerator: item.numerator, denominator: item.denominator, value: item.value ?? "", unknown: item.unknown, asOf: item.asOf })));
  if (new TextEncoder().encode(csv).byteLength > 10 * 1024 * 1024) throw new Error("Export exceeds 10 MiB limit");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);
  await store.put(`exports/${payload.tenantId}/${payload.reportRunId}.csv`, csv, { contentType: "text/csv; charset=utf-8", expiresAt, metadata: { tenantId: payload.tenantId, reportRunId: payload.reportRunId, identifiers: "suppressed" } });
  return { kind: "export", status: "completed", reportRunId: payload.reportRunId };
}

import { processDeletionRequest, type DeletionExecutor, type DeletionRequest, type LegalHoldRegistry, type PolicyRegistry } from "../security/retention";
import type { MetricSink } from "../observability/metrics";
import { metric } from "../observability/metrics";
export async function runRetentionJob(input: { request: DeletionRequest; registry: PolicyRegistry; holds: LegalHoldRegistry; executor: DeletionExecutor; metrics?: MetricSink; now?: Date }) {
  try { return await processDeletionRequest(input); } catch (error) { metric(input.metrics ?? noMetrics, "retention_failures", 1, { outcome: "failed" }); throw error; }
}
const noMetrics: MetricSink = { increment() {}, observe() {} };

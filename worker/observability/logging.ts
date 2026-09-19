export type LogLevel = "debug" | "info" | "warn" | "error";
export interface OperationalLog { level: LogLevel; event: string; requestId?: string; correlationId?: string; jobId?: string; provider?: string; tenantId?: string; detail?: Record<string, unknown>; at?: string; }
const sensitive = /(?:phone|email|name|remark|note|body|payload|cipher|token|secret|authorization|address|message|content)/iu;
export function redactOperationalValue(value: unknown): unknown {
  if (typeof value === "string") return "[redacted]";
  if (Array.isArray(value)) return value.map(redactOperationalValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, sensitive.test(key) ? "[redacted]" : redactOperationalValue(nested)]));
  return value;
}
export function structuredLog(log: OperationalLog): string {
  const safe = { ts: log.at ?? new Date().toISOString(), level: log.level, event: log.event, requestId: log.requestId, correlationId: log.correlationId, jobId: log.jobId, provider: log.provider, tenantId: log.tenantId, detail: redactOperationalValue(log.detail) };
  return JSON.stringify(Object.fromEntries(Object.entries(safe).filter(([, value]) => value !== undefined)));
}

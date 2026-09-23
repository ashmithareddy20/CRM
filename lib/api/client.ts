import type { ApiEnvelope, CommandPreconditions } from "./contracts";
import {
  ApiClientError,
  type ApiList,
  type AuthenticatedMembership,
  type CallAttemptInput,
  type CallRemarkInput,
  type LeadCreateInput,
  type LeadSummary,
  type SourceOption,
} from "./types";

export interface ApiClientOptions {
  baseUrl?: string;
  accessToken?: string;
  csrfToken?: string;
  fetch?: typeof fetch;
}

type RequestOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: HeadersInit;
  idempotencyKey?: string;
  ifMatch?: number | string;
};

function normalizedBaseUrl(value = ""): string {
  return value.replace(/\/$/u, "");
}

function errorKind(status?: number): ApiClientError["kind"] {
  if (status === 401) return "authentication";
  if (status === 403) return "authorization";
  if (status === 409 || status === 412) return "conflict";
  if (status === 422 || status === 400) return "validation";
  return "server";
}

export function newIdempotencyKey(prefix = "trh360"): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

/** Typed v1 client. Callers must explicitly decide how to present each failure kind. */
export class ApiClient {
  private readonly baseUrl: string;
  private accessToken?: string;
  private readonly csrfToken?: string;
  private readonly requestFetch: typeof fetch;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = normalizedBaseUrl(options.baseUrl);
    this.accessToken = options.accessToken;
    this.csrfToken = options.csrfToken;
    this.requestFetch = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));
  }

  setAccessToken(token?: string): void {
    this.accessToken = token;
  }

  getAccessToken(): string | undefined {
    return this.accessToken;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    if (this.accessToken) headers.set("Authorization", `Bearer ${this.accessToken}`);
    if (this.csrfToken && options.method && options.method !== "GET") headers.set("X-CSRF-Token", this.csrfToken);
    if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey);
    if (options.ifMatch !== undefined) headers.set("If-Match", String(options.ifMatch));
    if (options.body !== undefined) headers.set("Content-Type", "application/json");

    let response: Response;
    try {
      const doFetch = this.requestFetch ?? globalThis.fetch;
      response = await doFetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
        credentials: "same-origin",
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch (networkError) {
      console.error("CRM service network fetch error:", path, networkError);
      throw new ApiClientError("Unable to reach the CRM service. Your entry is still on this device.", "network");
    }

    let result: ApiEnvelope<T> | undefined;
    try {
      result = await response.json() as ApiEnvelope<T>;
    } catch {
      throw new ApiClientError("The CRM service returned an invalid response.", errorKind(response.status), response.status);
    }
    if (!response.ok || !result.success) {
      const failure = result && !result.success ? result.error : undefined;
      throw new ApiClientError(
        failure?.message ?? "The CRM request was not accepted.",
        errorKind(response.status),
        response.status,
        failure?.code,
        failure?.fields,
        failure?.requestId ?? response.headers.get("X-Request-Id") ?? undefined,
      );
    }
    return result.data;
  }

  async list<T>(path: string): Promise<ApiList<T>> {
    const response = await this.request<T[] | { items: T[] }>(path);
    return { items: Array.isArray(response) ? response : response.items };
  }

  async login(email: string, password = "password"): Promise<any> {
    const res = await this.request<any>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    return res?.data || res;
  }
  async tenants(): Promise<any[]> {
    const res = await this.request<any>("/api/tenants");
    return res?.data || res || [];
  }
  async ask(query: string): Promise<any> {
    const res = await this.request<any>("/api/ask", {
      method: "POST",
      body: { query },
    });
    return res?.data || res;
  }
  async analyticsQuality(): Promise<any> {
    const res = await this.request<any>("/api/analytics/quality-qa");
    return res?.data || res;
  }
  async analyticsOwnerCockpit(): Promise<any> {
    const res = await this.request<any>("/api/analytics/owner-cockpit");
    return res?.data || res;
  }
  async updateLead(leadId: string, changes: Record<string, any>): Promise<any> {
    return this.request(`/api/leads/${encodeURIComponent(leadId)}`, {
      method: "PATCH",
      body: changes,
    });
  }
  async updateLeadTemperature(leadId: string, qualification: string): Promise<any> {
    return this.request(`/api/leads/${encodeURIComponent(leadId)}`, {
      method: "PATCH",
      body: { qualification },
    });
  }
  async closeLead(leadId: string, primaryReason: string, secondaryReason?: string, evidence?: string, isRecoverable = 1): Promise<any> {
    return this.request(`/api/leads/${encodeURIComponent(leadId)}`, {
      method: "PATCH",
      body: {
        status: "closed",
        closePrimaryReason: primaryReason,
        closeSecondaryReason: secondaryReason,
        closeEvidence: evidence,
        isRecoverable,
      },
    });
  }
  async logCall(input: {
    leadId: string;
    agentId: string;
    durationSec: number;
    outcome?: string;
    language?: string;
    transcript?: string;
    agentTemp?: string;
    aiSuggestedTemp?: string;
  }): Promise<any> {
    return this.request("/api/calls", {
      method: "POST",
      body: input,
    });
  }
  async transcribeAudio(input: {
    audioBase64?: string;
    mimeType?: string;
    apiKey?: string;
    language?: string;
    leadName?: string;
  }): Promise<any> {
    return this.request("/api/calls/transcribe", {
      method: "POST",
      body: input,
    });
  }
  me(): Promise<AuthenticatedMembership> { return this.request<AuthenticatedMembership>("/api/auth/me").catch(() => this.request<AuthenticatedMembership>("/api/v1/me")); }
  logout(): Promise<{ loggedOut: boolean }> { return this.request<{ loggedOut: boolean }>("/api/auth/logout", { method: "POST", idempotencyKey: newIdempotencyKey("logout") }).catch(() => this.request<{ loggedOut: boolean }>("/api/v1/auth/logout", { method: "POST", idempotencyKey: newIdempotencyKey("logout") })); }
  async leads(cursor?: string, limit = 25): Promise<ApiList<LeadSummary>> {
    const params = new URLSearchParams({ limit: String(limit), ...(cursor ? { cursor } : {}) });
    try {
      const res = await this.request<any>(`/api/leads?${params}`);
      const items = Array.isArray(res) ? res : res?.data || res?.items || [];
      return { items };
    } catch {
      return this.list(`/api/v1/leads?${params}`);
    }
  }
  sources(): Promise<ApiList<SourceOption>> { return this.list("/api/v1/sources"); }
  async createLead(input: LeadCreateInput, idempotencyKey = newIdempotencyKey("lead")): Promise<LeadSummary> {
    try {
      const res = await this.request<any>("/api/leads", {
        method: "POST",
        body: {
          name: input.name,
          phone: input.phone,
          email: input.email,
          source: input.sourceId || input.origin || "manual",
          department: (input as any).department || "General Surgery",
          status: "new",
          ownerId: (input as any).ownerId || "Sravani",
          forceNew: (input as any).forceNew || false,
        },
        idempotencyKey,
      });
      return (res?.data || res) as LeadSummary;
    } catch {
      return this.request("/api/v1/leads", { method: "POST", body: input, idempotencyKey });
    }
  }
  async leadTimeline(leadId: string): Promise<any[]> {
    const res = await this.request<any>(`/api/leads/${encodeURIComponent(leadId)}/timeline`);
    return res?.data || res || [];
  }
  async tasks(params?: { leadId?: string; assigneeId?: string; status?: string }): Promise<any[]> {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    const res = await this.request<any>(`/api/tasks${query ? `?${query}` : ""}`);
    return res?.data || res || [];
  }
  async appointments(params?: { leadId?: string; status?: string }): Promise<any[]> {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    const res = await this.request<any>(`/api/appointments${query ? `?${query}` : ""}`);
    return res?.data || res || [];
  }
  async reviews(params?: { leadId?: string; status?: string }): Promise<any[]> {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    const res = await this.request<any>(`/api/reviews${query ? `?${query}` : ""}`);
    return res?.data || res || [];
  }
  async approveReview(reviewId: string, reviewedBy = "Sravani"): Promise<any> {
    return this.request(`/api/reviews/${encodeURIComponent(reviewId)}/approve`, { method: "POST", body: { reviewedBy } });
  }
  async rejectReview(reviewId: string, reviewedBy = "Sravani"): Promise<any> {
    return this.request(`/api/reviews/${encodeURIComponent(reviewId)}/reject`, { method: "POST", body: { reviewedBy } });
  }
  async analyticsFunnel(): Promise<any> {
    const res = await this.request<any>("/api/analytics/funnel");
    return res?.data || res;
  }
  async analyticsAgeing(): Promise<any> {
    const res = await this.request<any>("/api/analytics/ageing");
    return res?.data || res;
  }
  async analyticsCockpit(): Promise<any> {
    const res = await this.request<any>("/api/analytics/cockpit");
    return res?.data || res;
  }
  async analyticsExecutive(): Promise<any> {
    const res = await this.request<any>("/api/analytics/executive");
    return res?.data || res;
  }
  async dialCall(leadId: string, phone?: string, agentId = "agent-1"): Promise<any> {
    return this.request("/api/calls/dial", { method: "POST", body: { leadId, phone, agentId } });
  }
  recordCall(input: CallAttemptInput, idempotencyKey = newIdempotencyKey("call")): Promise<{ callAttemptId: string }> {
    return this.request("/api/v1/calls", { method: "POST", body: input, idempotencyKey });
  }
  saveCallRemark(callId: string, input: CallRemarkInput, preconditions: CommandPreconditions): Promise<unknown> {
    return this.request(`/api/v1/calls/${encodeURIComponent(callId)}/remarks`, { method: "POST", body: input, idempotencyKey: preconditions.idempotencyKey, ifMatch: preconditions.ifMatch });
  }

  // Thesis Endpoints
  async voiceAiOverview(): Promise<any> {
    const res = await this.request<any>("/api/voice-ai/overview");
    return res?.data || res;
  }
  async voiceAiCampaigns(): Promise<any[]> {
    const res = await this.request<any>("/api/voice-ai/campaigns");
    return res?.data || res || [];
  }
  async voiceAiAgents(): Promise<any[]> {
    const res = await this.request<any>("/api/voice-ai/agents");
    return res?.data || res || [];
  }
  async voiceAiRuns(): Promise<any[]> {
    const res = await this.request<any>("/api/voice-ai/runs");
    return res?.data || res || [];
  }
  async voiceAiLiveMonitor(): Promise<any[]> {
    const res = await this.request<any>("/api/voice-ai/live-monitor");
    return res?.data || res || [];
  }

  async clinicalAppointments(): Promise<any[]> {
    const res = await this.request<any>("/api/clinical/appointments");
    return res?.data || res || [];
  }
  async clinicalDoctorAllocation(): Promise<any[]> {
    const res = await this.request<any>("/api/clinical/doctor-allocation");
    return res?.data || res || [];
  }
  async clinicalNoShows(): Promise<any[]> {
    const res = await this.request<any>("/api/clinical/no-shows");
    return res?.data || res || [];
  }
  async clinicalFinancialQueue(): Promise<any[]> {
    const res = await this.request<any>("/api/clinical/financial-queue");
    return res?.data || res || [];
  }
  async clinicalAdmissions(): Promise<any[]> {
    const res = await this.request<any>("/api/clinical/admissions");
    return res?.data || res || [];
  }
  async clinicalHandoffs(): Promise<any[]> {
    const res = await this.request<any>("/api/clinical/handoffs");
    return res?.data || res || [];
  }

  async managerConversionStats(): Promise<any> {
    const res = await this.request<any>("/api/manager/conversion-stats");
    return res?.data || res;
  }
  async managerAgentScorecards(): Promise<any[]> {
    const res = await this.request<any>("/api/manager/agent-scorecards");
    return res?.data || res || [];
  }
  async managerEscalations(): Promise<any> {
    const res = await this.request<any>("/api/manager/escalations");
    return res?.data || res;
  }

  async founderSourceRoi(): Promise<any[]> {
    const res = await this.request<any>("/api/founder/source-roi");
    return res?.data || res || [];
  }
  async founderCohortsComparison(): Promise<any[]> {
    const res = await this.request<any>("/api/founder/cohorts-comparison");
    return res?.data || res || [];
  }
  async founderDiagnostic15day(): Promise<any> {
    const res = await this.request<any>("/api/founder/diagnostic-15day");
    return res?.data || res;
  }

  async adminSources(): Promise<any[]> {
    const res = await this.request<any>("/api/admin/sources");
    return res?.data || res || [];
  }
  async adminTelephony(): Promise<any> {
    const res = await this.request<any>("/api/admin/telephony");
    return res?.data || res;
  }
  async adminAuditLogs(): Promise<any[]> {
    const res = await this.request<any>("/api/admin/audit");
    return res?.data || res || [];
  }
}

export function apiErrorMessage(error: unknown): string {
  if (!(error instanceof ApiClientError)) return "The CRM request could not be completed.";
  if (error.kind === "authentication") return "Your session has expired. Sign in again to continue.";
  if (error.kind === "authorization") return "You do not have permission for this workspace action.";
  if (error.kind === "conflict") return "This record changed elsewhere. Review the latest record before trying again.";
  if (error.kind === "validation") return error.message;
  return error.message;
}

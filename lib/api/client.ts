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
  private readonly accessToken?: string;
  private readonly csrfToken?: string;
  private readonly requestFetch: typeof fetch;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = normalizedBaseUrl(options.baseUrl);
    this.accessToken = options.accessToken;
    this.csrfToken = options.csrfToken;
    this.requestFetch = options.fetch ?? fetch;
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
      response = await this.requestFetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
        credentials: "include",
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch {
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

  me(): Promise<AuthenticatedMembership> { return this.request("/api/v1/me"); }
  logout(): Promise<{ loggedOut: boolean }> { return this.request("/api/v1/auth/logout", { method: "POST", idempotencyKey: newIdempotencyKey("logout") }); }
  leads(cursor?: string, limit = 25): Promise<ApiList<LeadSummary>> {
    const params = new URLSearchParams({ limit: String(limit), ...(cursor ? { cursor } : {}) });
    return this.list(`/api/v1/leads?${params}`);
  }
  sources(): Promise<ApiList<SourceOption>> { return this.list("/api/v1/sources"); }
  createLead(input: LeadCreateInput, idempotencyKey = newIdempotencyKey("lead")): Promise<LeadSummary> {
    return this.request("/api/v1/leads", { method: "POST", body: input, idempotencyKey });
  }
  recordCall(input: CallAttemptInput, idempotencyKey = newIdempotencyKey("call")): Promise<{ callAttemptId: string }> {
    return this.request("/api/v1/calls", { method: "POST", body: input, idempotencyKey });
  }
  saveCallRemark(callId: string, input: CallRemarkInput, preconditions: CommandPreconditions): Promise<unknown> {
    return this.request(`/api/v1/calls/${encodeURIComponent(callId)}/remarks`, { method: "POST", body: input, idempotencyKey: preconditions.idempotencyKey, ifMatch: preconditions.ifMatch });
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

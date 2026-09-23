import type { ApiEnvelope, ErrorEnvelope, PageMeta } from "./contracts";

export type ApiErrorKind = "authentication" | "authorization" | "conflict" | "validation" | "network" | "server";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly kind: ApiErrorKind,
    public readonly status?: number,
    public readonly code?: string,
    public readonly fields?: Record<string, string>,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export type ApiList<T> = { items: T[]; meta?: PageMeta };

export interface AuthenticatedMembership {
  subject: string;
  tenantId: string;
  membershipId: string;
  roles: string[];
  capabilities: string[];
}

export interface LeadSummary {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  sourceId?: string | null;
  source?: string | null;
  lifecycleStage?: string | null;
  qualification?: "hot" | "warm" | "cold" | "incomplete" | null;
  nextAction?: { action: string; ownerMembershipId: string; dueAt: string } | null;
  assignedMembershipId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  version?: number;
}

export interface SourceOption { id: string; key: string; label: string; }

export interface LeadCreateInput {
  name?: string;
  phone?: string;
  email?: string;
  sourceId: string;
  platform: string;
  origin: "manual" | "import" | "provider_form" | "non_campaign";
  campaignId?: string;
  formId?: string;
  department?: string;
  ownerId?: string;
}

export interface CallAttemptInput {
  leadId: string;
  direction: "outbound" | "inbound";
  disposition?: "pending" | "answered" | "no_answer" | "busy" | "switched_off" | "out_of_network" | "rejected" | "invalid_number" | "wrong_number" | "unavailable" | "repeatedly_unreachable";
  dialedAt?: string;
  connectedAt?: string;
  endedAt?: string;
}

export interface CallRemarkInput {
  disposition: "meaningful_connection" | "no_answer" | "busy" | "switched_off" | "out_of_network" | "rejected" | "invalid_number" | "wrong_number" | "unavailable" | "repeatedly_unreachable" | "not_interested";
  patientStatement?: string;
  agentExplanation?: string;
  objection?: string;
  materialShared?: string;
  nextAction?: string;
  nextActionOwnerMembershipId?: string;
  nextActionDueAt?: string;
  notApplicableReason?: string;
}

export type ApiResponse<T> = ApiEnvelope<T>;
export type ApiFailure = ErrorEnvelope;

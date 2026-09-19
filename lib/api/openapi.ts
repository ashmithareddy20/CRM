/** Minimal, generated-from-contracts OpenAPI seed extended as endpoint groups land. */
export const openApiDocument = {
  openapi: "3.1.0",
  info: { title: "TRH360 Healthcare CRM API", version: "1.0.0" },
  paths: {
    "/api/v1/health": { get: { summary: "Public liveness" } },
    "/api/v1/ready": { get: { summary: "Protected readiness" } },
    "/api/v1/_fixtures/echo": { get: { summary: "Test-only contract fixture" } },
    "/api/v1/leads": { post: { summary: "Create a manually entered or normalized lead episode" } },
    "/api/v1/lead-imports": { post: { summary: "Validate and accept import rows with per-row results" } },
    "/api/v1/leads/{leadId}/merge": { post: { summary: "Human-approved lead merge" } },
    "/api/v1/leads/{leadId}/qualifications": { post: { summary: "Versioned explainable qualification assessment" } },
    "/api/v1/sources": { get: { summary: "List tenant sources" }, post: { summary: "Create tenant source" } },
    "/api/v1/campaigns": { get: { summary: "List tenant campaigns" }, post: { summary: "Create campaign attribution" } },
  },
} as const;

# API contract and legacy client inventory

## Canonical v1 contract

Use `/api/v1`. All responses are enveloped as documented in `lib/api/contracts.ts`; list endpoints use `limit` (1–100) and opaque cursor pagination. `400` indicates malformed requests, `401` missing identity, `403` insufficient scope, `404` non-enumerating resource absence, `409` idempotency/version conflict, `422` validation failure, `429` rate limit, and `503` unavailable dependency. Commands use `Idempotency-Key`, and guarded changes use `If-Match`. See `/api/v1/openapi.json` (authenticated) for the generated seed document.

Public `GET /api/health` and `/api/v1/health` are liveness-only. Protected `GET /api/v1/ready` confirms configuration without returning secrets. `_fixtures/records` is test-only transport coverage and not a supported customer API.

## Legacy-to-v1 inventory

| Client | Current legacy request | v1 destination | Compatibility/known fabrication |
|---|---|---|---|
| `app/page.tsx` | `GET/POST/PATCH /api/leads`; task, appointment, call routes | `/api/v1/leads`, `/tasks`, `/appointments`, `/calls` | List filters use hardcoded `agent-1`; UI maps API values into invented city, score, temperature, concern, last touch, next commitment, and display agent. |
| `mobile-app/src/App.tsx` | `GET/POST /api/leads`, `POST /api/calls`, appointments | same v1 groups | Maps every fetched lead to `city: Unassigned` and `concern: New CRM lead`; call submits a hardcoded lead and agent, maps temperature to outcome, omits the entered remark, and advances after failure. |
| `mobile-react-native/App.tsx` | `http://localhost:5173/api/leads` | configured HTTPS `/api/v1/leads` client | Has demo fallback records, hardcoded `ownerId: agent-1`, and client-generated Hot/Mobile Enquiry fields after network failure. |

Legacy adapters may later preserve camelCase and `{success,data,message}` only after authenticating and delegating to the same v1/domain services. They must not restore public CRUD, trust filter/owner IDs for authorization, accept arbitrary status PATCHes, or silently fabricate required source, consent, qualification, clinical, or remark facts.

## Runtime composition

`worker/api/router.ts` composes every v1 registrar after resolving the verified actor and tenant context. It injects the D1 repository/service adapters for lead intake and qualification, lifecycle/calls/tasks, policy administration, consent/content/communication, appointments/clinical/finance, diagnosis/recovery, and reporting. Missing D1 or encryption-key bindings return `503`; the runtime never switches to in-memory services for customer requests.

`POST /api/v1/webhooks/:provider/:integrationId` is intentionally dispatched **before** user-session authentication. It verifies an exact raw request signature and timestamp against the private integration registry, determines the tenant from that registry (not the payload), stores the encrypted durable inbox event, then enqueues only its opaque ID. It is not a public lead intake bypass: unconfigured, invalid, stale, or unsigned ingress is rejected.

Every other `/api/v1` domain route requires a verified OIDC/session actor or the constrained non-production test identity. Legacy `/api/*` data routes return `410 LEGACY_CONTRACT_UNSUPPORTED`; they cannot bypass that protection. Public health is limited to liveness. Readiness is authenticated and reports only binding/configuration state.

The Worker `scheduled` handler publishes pending outbox records and claims due D1 jobs to the Queue. The Queue consumer receives opaque references only and marks durable inbox/outbox/jobs processed; failures return to D1 retry/DLQ flow. This preserves long delays across Worker restarts without embedding patient data in queue messages.

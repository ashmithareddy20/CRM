# Backend architecture

The Worker has a narrow runtime boundary:

- `worker/index.ts` owns only `fetch` dispatch and preserves Vinext/image optimization fallback.
- `worker/api/router.ts` owns `/api` routing. Canonical endpoints live at `/api/v1`; phase-A legacy data routes return a safe compatibility error rather than preserving unauthenticated CRUD.
- `worker/api/context.ts` builds request-scoped time, request ID, optional injected database, and actor context. Request payloads cannot choose an actor, tenant, or role.
- `db/index.ts` exposes `createDb(binding)` for isolated D1 injection plus the compatible Worker-global `getDb()` wrapper.
- `lib/api` contains shared envelope, pagination, enum, optimistic-version, idempotency, and OpenAPI seed contracts.

## Runtime invariants

Each response has `X-Request-Id`. Successful responses use `{ success: true, data, meta? }`; failures use `{ success: false, error: { code, message, fields?, requestId }, message }`. Internal causes and SQL details are never returned. Body size is limited to 64 KiB at this boundary. Commands require a bounded `Idempotency-Key`; future domain handlers persist request hash/result with tenant and actor scope. Mutations requiring concurrency control accept `If-Match` through the shared contract.

Phase B replaces the test-only identity bridge with verified OIDC and membership lookup. The readiness endpoint is deliberately protected, and public health leaks no binding/configuration detail.

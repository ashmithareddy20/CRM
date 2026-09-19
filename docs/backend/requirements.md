# Backend requirements

## Runtime and test requirements

Use Node 22+ and `npm ci --legacy-peer-deps` when the npm peer resolver encounters the known Arborist failure in this dependency graph. Run `npm run test:backend` for the isolated Workers Vitest pool; it does not start Vite, depend on port 5173, or require a local SQLite file. The fixture routes verify transport behavior only and must not become domain endpoints.

Future domain tests must inject D1/Queue bindings through Miniflare, use deterministic clocks and identities, and validate tenant-negative cases. Keep browser/render tests separate from the Worker suite.

## Security requirements

Production must not set `ALLOW_TEST_IDENTITY=true`. No dispatch header, body field, display role, `ownerId`, or `assigneeId` authorizes a request. OIDC verification, membership selection, tenant-scoped repositories, audit persistence, idempotency persistence, schema readiness checks, and queues are Phase B+ requirements before clinical or patient data routes are enabled.

`tests/backend/support/runtime.ts` provides fixed request IDs/clocks, test-only tenant identity headers, and direct Cron/Queue invocation helpers. Once the schema migration lane supplies a test D1 binding, configure that binding in the same Workers Vitest plugin and apply its verified baseline/forward migrations through `readD1Migrations`; do not depend on pre-existing `.wrangler`/SQLite state.

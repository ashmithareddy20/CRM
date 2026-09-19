# Backend security controls

## Authentication and tenant boundaries

The Worker accepts only bearer JWTs verified with Web Crypto against the configured OIDC issuer JWKS, or an opaque signed browser session checked against an active, unrevoked D1 session. JWT verification requires an exact HTTPS issuer, expected audience, configured allow-listed asymmetric algorithm, key ID, valid signature, expiration, and not-before claim. A request's tenant header can select only an already active membership and does not grant a membership.

`X-Test-Identity` is accepted exclusively when `DEPLOYMENT_ENV=test` and `ALLOW_TEST_IDENTITY=true`; production and development fail closed. Unsigned email, role, tenant, or dispatch headers are never identities.

All repositories receive an authenticated actor and bind both tenant and resource IDs in query predicates. IDs alone never authorize an operation. Unknown cross-tenant resources must return the normal non-enumerating resource result.

## Browser and API safety

Browser sessions are HttpOnly, Secure (on HTTPS), SameSite=Lax signed cookies with expiry. Cookie-authenticated state-changing endpoints must use the double-submit CSRF token helper. Native clients use PKCE with short-lived bearer tokens; do not embed client secrets. CORS permits only exact configured HTTPS origins and credentials; a missing or unlisted origin receives no allow-origin header. Privileged actions must request fresh/step-up authentication through `requireCapability` session-age checks.

## Encryption, indexing, and auditing

Sensitive fields use AES-256-GCM with a fresh 96-bit nonce and AAD `crm:v1:tenant:record:purpose`. Ciphertext records carry a key version, so old records remain readable during a two-key rotation. Keys, blind-index key, and audit anchor key are Worker secrets/KMS references, never D1 data. Production deployment must reject missing key material before it serves protected data.

Exact phone/email lookup uses a tenant- and purpose-separated HMAC-SHA-256 blind index after normalization. There is no plaintext name/identifier substring search and no full-table decryption fallback.

Audit events are append-only commands. They record actor, tenant, request ID, resource/action/time, opaque evidence reference, constrained reason codes, and a strict allow-list of primitive operational before/after fields. They never copy identifiers, free text, tokens, ciphertext, or raw request data. Each record hashes the previous tenant anchor and may publish the result through the independent `AuditAnchorStore` seam. Corrections append a new event; they never overwrite old evidence.

Evidence upload/download helpers use tenant-prefixed private R2 keys, repository ownership/existence checks, malware-clean status, content/type limits, and authorization on every proxied download. Domain commands requiring evidence must call `requireEvidenceOwnership`; non-empty evidence IDs are not proof.

# Identity and membership

OIDC `issuer + subject` identifies a CRM user. Access is invitation/membership based: an identity obtains tenant access only through an active `crm_memberships` row joined to an active tenant role. Revoking the membership or session takes effect on the next request.

A user can hold memberships in multiple tenants. `X-Tenant-Id` is a selection hint, never an assertion; the server resolves the membership for that tenant. The first tenant administrator must be created through a controlled bootstrap/invitation operation, not request-body role fields.

Service principals use scoped credentials and may receive only the `integration:ingest` family of capabilities. They cannot impersonate a user or become an administrator.

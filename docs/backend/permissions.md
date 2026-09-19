# Permissions baseline

Permissions are deny-by-default and server-derived. The role baseline is intentionally narrow:

| Role | Scope |
| --- | --- |
| agent | Assigned lead and minimum care context |
| manager | Team/branch operational work and aggregates |
| clinician | Assigned clinical decisions |
| financial counselor | Permitted financial records |
| operations/scheduler | Appointment operations |
| leadership | Scoped aggregates only |
| tenant administrator | Membership/configuration, not automatic clinical narrative |
| auditor | Read-only authorized audit evidence |
| integration principal | Explicit ingest/event scopes |

`discount:approve`, `export:run`, and `field:decrypt` are separate grants. An emergency-access grant must be explicit, expiring, reasoned, and audited; it is not a universal admin bypass. Field capabilities remain separate from record visibility so a user can see a masked record without decrypting identity, clinical, or financial text.

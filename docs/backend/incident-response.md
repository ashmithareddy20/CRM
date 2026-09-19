# Incident response

1. Establish an incident owner and preserve redacted logs, request/job/provider correlation IDs, deployment version, and timestamps. Do not collect PHI in tickets.
2. Stop outbound dispatch first for suspected privacy, consent, provider, or abuse events. Revoke integration credentials or evidence access where necessary.
3. Scope with tenant-safe audit events and metrics. Do not replay ambiguous sends; reconcile provider acceptance first.
4. Escalate suspected exposure to security/privacy leadership under the applicable jurisdiction and contractual timeline. This repository does not determine legal notification periods.
5. Recover using a clean deployment or isolated verified restore. Replay suppression/DNC before any jobs resume, reconcile queued/outbox work, rotate compromised keys, and document decisions.
6. Complete a redacted post-incident review with control changes and restore/replay verification.

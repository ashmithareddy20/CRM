# Reporting metrics and exports

Reporting is evidence-based and tenant-scoped. Facts contain event identifiers, timestamps, operational dimensions, and evidence references—not patient names, contact details, remarks, or unbounded provider payloads. A `(tenant_id, source_event_id)` uniqueness constraint makes projection safe under at-least-once queue delivery. The projector retains source events and supports deterministic daily aggregate rebuilds, so late conversions and revenue reversals correct prior days rather than inflating totals.

## Versioned metric contract

Every response identifies its metric-definition version, cohort basis, numerator, denominator, unknown count, sample size, filters, and `asOf` time. A zero denominator is `notApplicable` with `value: null`; it is never reported as zero percent. Definitions are stored in `crm_kpi_definitions` before use.

| Metric | Numerator | Denominator | Unknown / exclusion |
| --- | --- | --- | --- |
| Connected | unique meaningfully connected lead episodes | unique received episodes | received without a call attempt is unknown, not not-connected |
| Qualified | unique qualified episodes | unique connected episodes | connection without qualification evidence |
| Hot | unique reviewed Hot episodes | unique qualified episodes | qualified without reviewed classification |
| Booked / arrived / consulted | actual booking / arrival / consultation | Hot / booked / arrived | suggested appointments are not bookings |
| Treatment completion | evidence-backed completed treatment | procedure booked | booking without completion evidence |
| Conversion | evidence-backed unique converted episodes | received episodes | active/non-final episodes remain unknown; quote and booking are not conversion |
| Delivery / reply | delivered / replied attempts | accepted / delivered attempts | absent provider telemetry is explicit unknown |
| Recovery conversion | recovery-enrolled leads later converted | recovery enrollments | enrollment without mature outcome |

Revenue is reported in integer minor units by currency. Reversals reduce net recognized revenue. The service never combines currencies without an explicit dated FX source. Source reports retain original source attribution; assignment changes do not rewrite attribution.

## Cohorts, diagnostics, and drill-down

Converted and final-loss cohorts use identical entry filters and observation cutoff. Active or not-yet-matured episodes are returned separately. Comparison covers first attempt, connection, follow-up, delivery/reply, booking/visit, consultation, counseling, package/insurance observations, source/agent, conversion time, and missing evidence. Observations are not causal claims.

Drill-down retains all report filters and returns only authorized event evidence (lead IDs, fact type/time, allowed dimensions, and evidence IDs). The 15-day diagnostic explicitly returns days 1–7, days 8–14, day 15, and the full period. Findings are deterministic rules with evidence, proposed root cause, corrective action, target, owner/review workflow; they make no AI inference or revenue promise.

Morning/day/end queues are live operational queries for unassigned/untouched leads, overdue work, appointments, and delivery failures. Outcome reporting is separate from process-compliance review.

## Scope and exports

All queries apply tenant scope before filters. Branch-limited actors cannot request another branch; non-manager users can only see their assigned/originally assigned evidence. Export requests are asynchronous `202` report runs, are audit logged, tenant/branch scoped, private, encrypted-store compatible, size-bounded to 10 MiB, and expire after 24 hours. Direct identifiers are suppressed by default. CSV values beginning with `=`, `+`, `-`, `@`, tab, or carriage return are prefixed with an apostrophe and CSV-quoted to prevent formula injection. Download authorization must be checked again by the private-object delivery endpoint.

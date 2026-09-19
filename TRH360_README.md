# TRH360 Human + AI CRM

Interactive source code for the TRH360 universal CRM product prototype. The application covers desktop and mobile experiences for telecalling agents, managers, leadership, operations, system administrators, and Voice AI teams.

## Included

- 108 mapped CRM screen states in a searchable Screen Atlas
- simplified telecalling-agent workspace and mobile click-to-call flow
- call recording, transcription, AI extraction, and human confirmation states
- Lead 360 with permanent journey, evidence, commitments, and audit history
- manager funnel, agent health, SLA, recovery, and conversation intelligence
- administrator control tower with day-by-day follow-up ageing
- cadence compliance, overdue ledgers, response SLA, data integrity, costs, and capacity views
- Voice AI API-ingestion, campaign, review, and human-handoff states
- universal terminology suitable for sales, services, renewals, education, real estate, healthcare, finance, and other lead-driven businesses
- Poppins interface typography with EB Garamond display accents

## Technology

- React 19
- Next.js-compatible Vinext runtime
- TypeScript
- Tailwind CSS 4 and custom CSS design system
- shadcn/base-ui components
- Lucide icons
- Cloudflare Worker deployment scaffold
- optional Cloudflare D1 and Drizzle scaffold

## Run locally

Prerequisite: Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Open the local URL shown in the terminal.

## Validate

```bash
npm test
npm run lint
```

## Backend API

The Cloudflare Worker exposes the D1-backed CRM API under `/api`:

- `GET /api/health`
- `GET|POST /api/users`
- `GET|POST /api/leads`
- `GET|PATCH|DELETE /api/leads/:id`
- `GET|POST /api/calls`
- `DELETE /api/calls/:id`
- `GET|POST /api/notes`
- `DELETE /api/notes/:id`
- `GET|POST /api/tasks`
- `PATCH|DELETE /api/tasks/:id`
- `GET|POST /api/appointments`
- `PATCH|DELETE /api/appointments/:id`

Lead list requests support `search`, `status`, and `ownerId` query parameters. Deleting a lead also removes its calls and notes. Tasks and appointments use ISO-8601 dates and return timestamps that the web and mobile clients display in India Standard Time (`Asia/Kolkata`). The local Vite server provisions the D1 binding from `.openai/hosting.json`; apply all migrations in `drizzle/` to both local and deployed D1 databases before use.

## Production build

```bash
npm run build
```

## Important implementation boundary

This ZIP contains the complete interactive frontend prototype and the full-stack runtime scaffold. Its sample records, call events, transcripts, dashboards, and actions are currently demonstration data.

A production backend should connect the existing UI contracts to:

- authentication, organizations, roles, and permissions
- lead, activity, task, meeting, and pipeline persistence
- telephony provider webhooks and mobile dialer integration
- consent-aware recording storage and signed playback
- speech-to-text, speaker diarization, and transcript processing
- AI extraction with human approval and versioned audit logs
- WhatsApp/SMS providers, templates, opt-outs, and cost ledger
- Voice AI ingestion APIs, idempotency, retries, and dead-letter handling
- campaign attribution, business-unit configuration, and configurable cadence policies
- analytics warehouse or materialized reporting tables

Do not put provider secrets in client-side code. Store credentials as server-side environment variables and verify every webhook signature.

## Primary source files

- `app/page.tsx` — interactive desktop/mobile product states
- `app/crm-data.ts` — screen registry and demonstration records
- `app/globals.css` — design system, typography, responsive behavior
- `db/` and `drizzle/` — database scaffold
- `worker/` — deployment runtime
- `tests/` — build and rendering checks


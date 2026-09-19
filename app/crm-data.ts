export type Experience = "desktop" | "mobile";
export type ScreenKind =
  | "dashboard"
  | "list"
  | "detail"
  | "form"
  | "analytics"
  | "config"
  | "workflow"
  | "review";

export type ScreenRole =
  | "Shared"
  | "Agent"
  | "Manager"
  | "Leadership"
  | "Operations"
  | "Admin"
  | "Voice AI"
  | "Mobile";

export type CrmScreen = {
  id: string;
  title: string;
  description: string;
  role: ScreenRole;
  module: string;
  experience: Experience;
  kind: ScreenKind;
};

const descriptions: Record<ScreenKind, string> = {
  dashboard: "Live operating view with decisions, exceptions, and next actions.",
  list: "Prioritized work queue with filters, ownership, and accountable next steps.",
  detail: "One complete record with context, evidence, history, and linked work.",
  form: "Structured capture with source, reason, and audit requirements built in.",
  analytics: "Evidence-led analysis with progressive drill-down and export controls.",
  config: "Human-controlled setup with validation, permissions, and change history.",
  workflow: "Guided workflow that preserves context across teams and lifecycle stages.",
  review: "Human review surface for AI proposals, evidence, edits, and confirmation.",
};

function screens(
  role: ScreenRole,
  module: string,
  experience: Experience,
  entries: Array<[string, string, ScreenKind]>,
): CrmScreen[] {
  return entries.map(([id, title, kind]) => ({
    id,
    title,
    kind,
    role,
    module,
    experience,
    description: descriptions[kind],
  }));
}

export const crmScreens: CrmScreen[] = [
  ...screens("Shared", "Workspace", "desktop", [
    ["shared-sign-in", "Secure sign in", "form"],
    ["shared-workspace-setup", "Workspace setup", "workflow"],
    ["shared-integration-wizard", "Integration wizard", "workflow"],
    ["shared-notifications", "Notification centre", "list"],
    ["shared-search", "Universal search", "list"],
    ["shared-profile", "My profile & preferences", "config"],
  ]),
  ...screens("Agent", "Telecalling", "desktop", [
    ["agent-my-day", "My day", "dashboard"],
    ["agent-my-leads", "My leads", "list"],
    ["agent-lead-360", "Lead 360", "detail"],
    ["agent-new-lead", "Create lead", "form"],
    ["agent-dialer", "Desktop dialer", "workflow"],
    ["agent-call-log", "Call logging", "form"],
    ["agent-post-call-review", "Post-call AI review", "review"],
    ["agent-qualification", "Qualification & scoring", "form"],
    ["agent-follow-up", "Follow-up update", "workflow"],
    ["agent-composer", "Communication composer", "workflow"],
    ["agent-tasks", "Daily tasks", "list"],
    ["agent-book-appointment", "Book appointment", "form"],
    ["agent-recovery", "Recovery queue", "list"],
    ["agent-inbox", "Shared inbox", "list"],
    ["agent-calendar", "My calendar", "workflow"],
    ["agent-performance", "My performance", "analytics"],
  ]),
  ...screens("Manager", "Team management", "desktop", [
    ["manager-cockpit", "Manager cockpit", "dashboard"],
    ["manager-daily-conversion", "Daily conversion monitor", "analytics"],
    ["manager-funnel", "Funnel leak dashboard", "analytics"],
    ["manager-follow-up", "Follow-up compliance", "analytics"],
    ["manager-assignment", "Assignment board", "workflow"],
    ["manager-agent-scorecard", "Agent scorecard", "analytics"],
    ["manager-team-capacity", "Team capacity", "dashboard"],
    ["manager-escalations", "Escalation desk", "list"],
    ["manager-sla", "First-touch SLA monitor", "analytics"],
    ["manager-campaign-quality", "Campaign quality", "analytics"],
    ["manager-call-qa", "Call QA workspace", "review"],
    ["manager-conversation", "Conversation intelligence", "analytics"],
    ["manager-communications", "Communication performance", "analytics"],
    ["manager-no-show", "No-show recovery", "list"],
    ["manager-recovery", "Recovery command centre", "dashboard"],
    ["manager-reports", "Manager reports", "list"],
  ]),
  ...screens("Leadership", "Executive intelligence", "desktop", [
    ["owner-founder", "Founder dashboard", "dashboard"],
    ["owner-source-roi", "Source & campaign ROI", "analytics"],
    ["owner-cohort", "Campaign cohort comparison", "analytics"],
    ["owner-trend", "90-day trend", "analytics"],
    ["owner-drill-down", "Nine-level drill-down", "analytics"],
    ["owner-diagnostic", "15-day diagnostic", "review"],
    ["owner-branches", "Business-unit comparison", "analytics"],
    ["owner-departments", "Product & service performance", "analytics"],
    ["owner-revenue", "Revenue forecast", "analytics"],
    ["owner-decision-memo", "AI decision memo", "review"],
    ["owner-report-library", "Report library", "list"],
    ["owner-executive-schedule", "Executive schedule", "workflow"],
  ]),
  ...screens("Operations", "Customer journey", "desktop", [
    ["ops-appointments", "Meetings & appointments", "list"],
    ["ops-appointment-detail", "Meeting detail", "detail"],
    ["ops-doctor-allocation", "Specialist & advisor routing", "workflow"],
    ["ops-no-show", "No-show desk", "list"],
    ["ops-financial-queue", "Commercial decision queue", "list"],
    ["ops-financial-case", "Commercial decision case", "detail"],
    ["ops-eligibility", "Plan & payment eligibility", "workflow"],
    ["ops-admission-queue", "Conversion & onboarding queue", "list"],
    ["ops-admission-detail", "Conversion detail", "detail"],
    ["ops-handoff", "Journey handoff", "workflow"],
  ]),
  ...screens("Admin", "Control centre", "desktop", [
    ["admin-control-tower", "Admin control tower", "dashboard"],
    ["admin-follow-up-ageing", "Follow-up ageing intelligence", "analytics"],
    ["admin-response-sla", "Response-time control", "analytics"],
    ["admin-data-integrity", "Data completeness & integrity", "analytics"],
    ["admin-cost-governance", "Communication cost governance", "analytics"],
    ["admin-automation-monitor", "Automation execution monitor", "dashboard"],
    ["admin-behaviour-audit", "Agent behaviour audit", "analytics"],
    ["admin-capacity-planning", "Capacity & staffing planner", "analytics"],
    ["admin-sources", "Intake & source configuration", "config"],
    ["admin-custom-fields", "Lifecycle & custom field builder", "config"],
    ["admin-assignment-rules", "Assignment rules", "config"],
    ["admin-teams", "Teams & territories", "config"],
    ["admin-roles", "Roles & permissions", "config"],
    ["admin-telephony", "Telephony providers", "config"],
    ["admin-mobile-permissions", "Mobile calling permissions", "config"],
    ["admin-recording-consent", "Recording & consent policy", "config"],
    ["admin-templates", "WhatsApp & SMS templates", "config"],
    ["admin-status-reasons", "Status & reason taxonomy", "config"],
    ["admin-cadence", "48-hour cadence builder", "config"],
    ["admin-ai-models", "AI models & prompts", "config"],
    ["admin-ai-safety", "AI review & safety policy", "config"],
    ["admin-webhooks", "API keys & webhooks", "config"],
    ["admin-imports", "Data import centre", "workflow"],
    ["admin-audit", "Audit log viewer", "list"],
  ]),
  ...screens("Voice AI", "Voice automation", "desktop", [
    ["voice-overview", "Voice AI overview", "dashboard"],
    ["voice-campaigns", "Voice AI campaigns", "list"],
    ["voice-agent-config", "Voice agent configuration", "config"],
    ["voice-runs", "Call runs", "list"],
    ["voice-live-monitor", "Live call monitor", "dashboard"],
    ["voice-call-detail", "Voice AI call detail", "detail"],
    ["voice-api-ingestion", "API ingestion", "config"],
    ["voice-field-mapping", "Field mapping", "config"],
    ["voice-confidence", "Confidence review queue", "review"],
    ["voice-analytics", "Voice AI analytics", "analytics"],
  ]),
  ...screens("Mobile", "TRH360 Mobile", "mobile", [
    ["mobile-sign-in", "Mobile sign in", "form"],
    ["mobile-permissions", "Calling setup", "workflow"],
    ["mobile-home", "Agent home", "dashboard"],
    ["mobile-call-queue", "Call queue", "list"],
    ["mobile-lead-card", "Lead snapshot", "detail"],
    ["mobile-lead-360", "Mobile Lead 360", "detail"],
    ["mobile-inbound-call", "Inbound call", "workflow"],
    ["mobile-active-call", "Active outbound call", "workflow"],
    ["mobile-post-call", "Post-call AI review", "review"],
    ["mobile-follow-up", "Quick follow-up", "form"],
    ["mobile-tasks", "Mobile task list", "list"],
    ["mobile-appointment", "Quick appointment", "form"],
    ["mobile-notifications", "Mobile notifications", "list"],
    ["mobile-manager", "Pocket manager dashboard", "dashboard"],
  ]),
];

export const roleCounts = crmScreens.reduce<Record<string, number>>((acc, screen) => {
  acc[screen.role] = (acc[screen.role] ?? 0) + 1;
  return acc;
}, {});

export const funnelStages = [
  { label: "Received", value: 2864, rate: 100 },
  { label: "Contacted", value: 2176, rate: 76 },
  { label: "Qualified", value: 1392, rate: 64 },
  { label: "Meeting", value: 742, rate: 53 },
  { label: "Proposal", value: 469, rate: 63 },
  { label: "Converted", value: 218, rate: 46 },
];

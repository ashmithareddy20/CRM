"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlarmClock, ArrowDown, ArrowRight, BarChart3, Bell, Bot,
  CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert,
  CircleCheck, Clock3, Download, Edit3, FileAudio, FileText, Filter, GitBranch,
  Headphones, HelpCircle, History, LayoutDashboard, ListFilter,
  LockKeyhole, MessageSquare, Mic, MoreHorizontal, Phone, PhoneCall,
  PhoneOff, Play, Plus, RotateCcw, Search, Settings, ShieldAlert, ShieldCheck,
  SlidersHorizontal, Sparkles, Stethoscope, Target, Upload, UserPlus, UserRound,
  UsersRound, WalletCards, Workflow, X, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  crmScreens, funnelStages, roleCounts,
  type CrmScreen, type Experience, type ScreenRole,
} from "./crm-data";
import { ApiClient, apiErrorMessage, newIdempotencyKey, type LeadSummary } from "@/lib/api";
import {
  BenchmarkStrip,
  OwnerQuestionCockpit,
  PreCallModal,
  ActiveCallModal,
  LeadClosureModal,
  MultilingualAskModal,
  SystemTrainingModal,
  EveningManagerReportModal,
  UserAccountModal,
  WhatsAppConversationModal,
  AddPatientLeadModal,
  EditPatientDetailsModal,
  ManagerAddAgentModal,
  VERTICAL_TENANTS,
  ROLE_USERS,
  type TenantPack,
  type RoleUser,
} from "./crm-modals";
import {
  VoiceCampaignsScreen,
  VoiceAgentConfigScreen,
  VoiceRunsScreen,
  VoiceLiveMonitorScreen,
  VoiceConfidenceScreen,
  VoiceAnalyticsScreen,
  AdminSourcesScreen,
  AdminTelephonyScreen,
  AdminAuditScreen,
  OpsAppointmentsScreen,
  OpsDoctorAllocationScreen,
  OpsNoShowScreen,
  OpsFinancialQueueScreen,
  OpsAdmissionQueueScreen,
  OpsHandoffScreen,
  ManagerDailyConversionScreen,
  ManagerAgentScorecardScreen,
  ManagerEscalationsScreen,
  OwnerCohortScreen,
  OwnerSourceRoiScreen,
  OwnerReportLibraryScreen,
  LeadScoringModal,
  Cadence48hSchedulerModal,
  NineLevelDrillDownModal,
  FifteenDayDiagnosticModal,
  ThesisSection2BusinessProblemCard,
} from "./crm-thesis-screens";

type AppRole = "Leadership" | "Agent" | "Manager" | "Doctor" | "Finance" | "Voice AI" | "Operations" | "Admin";

const roleLanding: Record<AppRole, string> = {
  Leadership: "owner-founder",
  Agent: "agent-my-day",
  Manager: "manager-cockpit",
  Doctor: "ops-doctor-allocation",
  Finance: "ops-financial-queue",
  "Voice AI": "voice-overview",
  Operations: "ops-appointments",
  Admin: "admin-control-tower",
};

const roleLabels: Record<AppRole, string> = {
  Leadership: "👔 Founder / Leadership (Dr. Ramesh)",
  Agent: "🎧 Telecalling Agent (Sravani K.)",
  Manager: "📊 Team Manager (Anil Kumar)",
  Doctor: "🩺 Doctor & Clinical Head (Dr. Radhakrishna)",
  Finance: "💳 Financial Counselor (Radha V.)",
  "Voice AI": "🤖 Voice AI & Admin (Nilesh N.)",
  Operations: "📋 Revenue Operations (Priya Rao)",
  Admin: "⚙️ System Administrator",
};

const roleNav: Record<AppRole, Array<{ label: string; id: string; icon: LucideIcon }>> = {
  Leadership: [
    { label: "Founder dashboard", id: "owner-founder", icon: LayoutDashboard },
    { label: "Pipeline leads", id: "agent-my-leads", icon: UsersRound },
    { label: "Source ROI", id: "owner-source-roi", icon: Target },
    { label: "Cohorts", id: "owner-cohort", icon: BarChart3 },
    { label: "Drill-down", id: "owner-drill-down", icon: GitBranch },
    { label: "15-day diagnostic", id: "owner-diagnostic", icon: Sparkles },
    { label: "Reports", id: "owner-report-library", icon: FileText },
  ],
  Agent: [
    { label: "My day", id: "agent-my-day", icon: LayoutDashboard },
    { label: "My leads", id: "agent-my-leads", icon: UsersRound },
    { label: "Lead 360", id: "agent-lead-360", icon: UserRound },
    { label: "Daily tasks", id: "agent-tasks", icon: CircleCheck },
    { label: "Appointments", id: "agent-calendar", icon: CalendarDays },
    { label: "Recovery", id: "agent-recovery", icon: RotateCcw },
    { label: "My performance", id: "agent-performance", icon: BarChart3 },
  ],
  Manager: [
    { label: "Manager cockpit", id: "manager-cockpit", icon: LayoutDashboard },
    { label: "All leads & queue", id: "agent-my-leads", icon: UsersRound },
    { label: "Conversion", id: "manager-daily-conversion", icon: Target },
    { label: "Funnel leaks", id: "manager-funnel", icon: GitBranch },
    { label: "Assignments", id: "manager-assignment", icon: Workflow },
    { label: "Team & scorecards", id: "manager-agent-scorecard", icon: UsersRound },
    { label: "Call quality", id: "manager-call-qa", icon: Headphones },
    { label: "Escalations", id: "manager-escalations", icon: CircleAlert },
  ],
  Doctor: [
    { label: "Doctor allocation", id: "ops-doctor-allocation", icon: Stethoscope },
    { label: "Appointments", id: "ops-appointments", icon: CalendarDays },
    { label: "Patient leads", id: "agent-my-leads", icon: UsersRound },
    { label: "No-show recovery", id: "ops-no-show", icon: CircleAlert },
    { label: "Admission queue", id: "ops-admission-queue", icon: CircleCheck },
    { label: "Journey handoff", id: "ops-handoff", icon: Workflow },
  ],
  Finance: [
    { label: "Commercial desk", id: "ops-financial-queue", icon: WalletCards },
    { label: "Commercial case", id: "ops-financial-case", icon: FileText },
    { label: "Admission & packages", id: "ops-admission-queue", icon: CircleCheck },
    { label: "All leads", id: "agent-my-leads", icon: UsersRound },
    { label: "Funnel leaks", id: "manager-funnel", icon: GitBranch },
    { label: "30-day recovery", id: "agent-recovery", icon: RotateCcw },
  ],
  "Voice AI": [
    { label: "Overview", id: "voice-overview", icon: LayoutDashboard },
    { label: "Campaigns", id: "voice-campaigns", icon: Target },
    { label: "Voice agents", id: "voice-agent-config", icon: Bot },
    { label: "Call runs", id: "voice-runs", icon: PhoneCall },
    { label: "Live monitor", id: "voice-live-monitor", icon: Activity },
    { label: "Review queue", id: "voice-confidence", icon: ShieldCheck },
    { label: "Analytics", id: "voice-analytics", icon: BarChart3 },
  ],
  Operations: [
    { label: "Appointments", id: "ops-appointments", icon: CalendarDays },
    { label: "Specialist routing", id: "ops-doctor-allocation", icon: UsersRound },
    { label: "No-shows", id: "ops-no-show", icon: CircleAlert },
    { label: "Commercial desk", id: "ops-financial-queue", icon: WalletCards },
    { label: "Conversion & onboarding", id: "ops-admission-queue", icon: CircleCheck },
    { label: "Journey handoff", id: "ops-handoff", icon: Workflow },
  ],
  Admin: [
    { label: "Control tower", id: "admin-control-tower", icon: LayoutDashboard },
    { label: "Follow-up ageing", id: "admin-follow-up-ageing", icon: AlarmClock },
    { label: "Response SLA", id: "admin-response-sla", icon: Activity },
    { label: "Data integrity", id: "admin-data-integrity", icon: ShieldCheck },
    { label: "Cost governance", id: "admin-cost-governance", icon: WalletCards },
    { label: "Lead intake", id: "admin-sources", icon: GitBranch },
    { label: "Assignments", id: "admin-assignment-rules", icon: Workflow },
    { label: "Teams & roles", id: "admin-roles", icon: UsersRound },
    { label: "Telephony", id: "admin-telephony", icon: PhoneCall },
    { label: "Templates", id: "admin-templates", icon: MessageSquare },
    { label: "AI policy", id: "admin-ai-safety", icon: ShieldCheck },
    { label: "API & webhooks", id: "admin-webhooks", icon: Settings },
    { label: "Audit log", id: "admin-audit", icon: History },
  ],
};

const temperatureClass: Record<string, string> = {
  Hot: "status-hot", Warm: "status-warm", Cold: "status-cold", Unknown: "status-neutral",
};

const api = new ApiClient();

const formatDuration = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

const indiaDateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", weekday: "long", day: "2-digit", month: "long", year: "numeric",
});
const indiaDateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
});
const formatIndiaDate = (value = new Date()) => indiaDateFormatter.format(value);
const formatIndiaDateTime = (value: string | Date) => indiaDateTimeFormatter.format(new Date(value));

type DisplayLead = {
  id: string;
  apiId: string;
  name: string;
  phone: string;
  source: string;
  stage: string;
  qualification: string;
  next: string;
  last: string;
  agent: string;
  createdAt?: string | null;
};

const initialSampleLeads: DisplayLead[] = [
  {
    id: "TRH-24190",
    apiId: "lead-1",
    name: "Lakshmi Narayana",
    phone: "+91 98491 22618",
    source: "Google Search · Enterprise",
    stage: "qualified",
    qualification: "hot",
    next: "Call now",
    last: "18 min ago",
    agent: "Sravani",
  },
  {
    id: "TRH-24184",
    apiId: "lead-2",
    name: "Madhavi Rao",
    phone: "+91 99850 41172",
    source: "Meta · Regional campaign",
    stage: "received",
    qualification: "warm",
    next: "Today, 11:30 AM",
    last: "42 min ago",
    agent: "Anil",
  },
  {
    id: "TRH-24179",
    apiId: "lead-3",
    name: "Mohammed Faizal",
    phone: "+91 97011 98420",
    source: "Website · Organic",
    stage: "contacted",
    qualification: "warm",
    next: "Today, 12:15 PM",
    last: "1 hr ago",
    agent: "Divya",
  },
  {
    id: "TRH-24172",
    apiId: "lead-4",
    name: "Sailaja Devi",
    phone: "+91 93920 36442",
    source: "YouTube · Product guide",
    stage: "qualified",
    qualification: "cold",
    next: "Tomorrow, 9:00 AM",
    last: "Yesterday",
    agent: "Sravani",
  },
  {
    id: "TRH-24168",
    apiId: "lead-5",
    name: "Prakash Reddy",
    phone: "+91 90102 78256",
    source: "Incoming call",
    stage: "received",
    qualification: "warm",
    next: "Retry in 23 min",
    last: "2 attempts",
    agent: "Kiran",
  },
];

function mapApiLead(lead: LeadSummary): DisplayLead {
  const rawStatus = String((lead as any).status || lead.lifecycleStage || "received").toLowerCase();
  const stage = rawStatus === "new" ? "received" : rawStatus;
  const rawQual = String((lead as any).qualification || "Warm").toLowerCase();
  const agent = (lead as any).ownerId || lead.assignedMembershipId || "Unassigned";

  return {
    id: lead.id,
    apiId: lead.id,
    name: lead.name?.trim() || "Unnamed lead",
    phone: lead.phone ?? "",
    source: lead.source ?? lead.sourceId ?? "Source not recorded",
    stage,
    qualification: rawQual,
    next: lead.nextAction?.action ?? ((lead as any).uncalledSince ? "Immediate Call Required (SLA 5m)" : "No next commitment"),
    last: lead.updatedAt || lead.createdAt ? formatIndiaDateTime(lead.updatedAt ?? lead.createdAt!) : "Not recorded",
    agent,
    createdAt: lead.createdAt,
  };
}

export default function Home() {
  const [role, setRole] = useState<AppRole>("Agent");
  const [experience, setExperience] = useState<Experience>("desktop");
  const [activeId, setActiveId] = useState("agent-my-day");
  const [atlasOpen, setAtlasOpen] = useState(false);
  const [atlasSearch, setAtlasSearch] = useState("");
  const [callSeconds, setCallSeconds] = useState(278);
  const [notice, setNotice] = useState<string | null>(null);
  const [leads, setLeads] = useState<DisplayLead[]>(initialSampleLeads);
  const [loadError, setLoadError] = useState<string | null>(null);
  const activeScreen = crmScreens.find((screen) => screen.id === activeId) ?? crmScreens[0];

  // PRD Multi-tenant and user session state
  const [currentUser, setCurrentUser] = useState<RoleUser>(ROLE_USERS[0]);
  const [currentTenant, setCurrentTenant] = useState<TenantPack>(VERTICAL_TENANTS[0]);
  const [accountModalOpen, setAccountModalOpen] = useState(false);

  // PRD Modals state
  const [preCallLead, setPreCallLead] = useState<DisplayLead | null>(null);
  const [activeCallLead, setActiveCallLead] = useState<DisplayLead | null>(null);
  const [activeCallLang, setActiveCallLang] = useState<string>("telugu");
  const [closingLead, setClosingLead] = useState<DisplayLead | null>(null);
  const [whatsAppModalLead, setWhatsAppModalLead] = useState<DisplayLead | null>(null);
  const [askModalOpen, setAskModalOpen] = useState(false);
  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [managerReportModalOpen, setManagerReportModalOpen] = useState(false);
  const [scoringLead, setScoringLead] = useState<DisplayLead | null>(null);
  const [cadenceLead, setCadenceLead] = useState<DisplayLead | null>(null);
  const [drillDownModalOpen, setDrillDownModalOpen] = useState(false);
  const [diagnostic15dModalOpen, setDiagnostic15dModalOpen] = useState(false);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [editLead, setEditLead] = useState<DisplayLead | null>(null);
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const [newAgents, setNewAgents] = useState<any[]>([]);
  const [sonioxApiKey, setSonioxApiKey] = useState("43569228c10e9142e5e35a5cf92ab7c488444f97d84e7e6216e99e43c19f831a");

  useEffect(() => {
    try {
      const savedKey = localStorage.getItem("soniox_api_key");
      if (savedKey) {
        setSonioxApiKey(savedKey);
      } else {
        localStorage.setItem("soniox_api_key", "43569228c10e9142e5e35a5cf92ab7c488444f97d84e7e6216e99e43c19f831a");
      }
      const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const urlRole = (params?.get("role") || localStorage.getItem("trh360_user_role")) as AppRole;
      if (urlRole && roleLanding[urlRole]) {
        setRole(urlRole);
        setActiveId(roleLanding[urlRole]);
        const matched = ROLE_USERS.find((u) => u.role.toLowerCase() === urlRole.toLowerCase());
        if (matched) setCurrentUser(matched);
      }
    } catch {}
  }, []);

  const handleSonioxKeyChange = (key: string) => {
    setSonioxApiKey(key);
    try {
      localStorage.setItem("soniox_api_key", key);
    } catch {}
  };

  const loadLeads = async () => {
    try {
      const page = await api.leads();
      if (page?.items && page.items.length > 0) {
        setLeads(page.items.map(mapApiLead));
        setLoadError(null);
      }
    } catch {
      // Keep sample records for UI demonstration
      setLoadError(null);
    }
  };

  useEffect(() => {
    void loadLeads();
    const interval = window.setInterval(() => {
      void loadLeads();
    }, 8000);
    return () => window.clearInterval(interval);
  }, [currentTenant]);

  useEffect(() => {
    if (activeId !== "mobile-active-call") return;
    const timer = window.setInterval(() => setCallSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [activeId]);

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2800);
  };

  const openScreen = (id: string) => {
    if (id === "agent-new-lead") {
      setAddLeadOpen(true);
      return;
    }
    const screen = crmScreens.find((item) => item.id === id);
    if (!screen) return;
    setActiveId(id);
    setExperience(screen.experience);
    if (screen.role !== "Mobile" && screen.role !== "Shared") setRole(screen.role as AppRole);
    setAtlasOpen(false);
  };

  const changeRole = (nextRole: AppRole) => {
    setRole(nextRole);
    setExperience("desktop");
    setActiveId(roleLanding[nextRole]);
    const matchedUser = ROLE_USERS.find((u) => u.role === nextRole);
    if (matchedUser) setCurrentUser(matchedUser);
    try {
      localStorage.setItem("trh360_user_role", nextRole);
    } catch {}
  };

  const handleSelectUser = async (user: RoleUser) => {
    setCurrentUser(user);
    setRole(user.role as AppRole);
    setActiveId(roleLanding[user.role as AppRole] || "agent-my-day");
    try {
      localStorage.setItem("trh360_user_role", user.role);
    } catch {}
    try {
      const authRes = await api.login(user.email, "password");
      if (authRes?.token) {
        api.setAccessToken(authRes.token);
      }
    } catch {}
    void loadLeads();
    notify(`Switched workspace role to ${user.name} (${user.title})`);
  };

  const handleSelectTenant = (tenant: TenantPack) => {
    setCurrentTenant(tenant);
    notify(`Switched vertical tenant to "${tenant.name}"`);
  };

  const handleReassignLead = (leadId: string) => {
    notify(`⚡ Lead SLA breached (15m). Lead automatically reassigned to least-loaded agent.`);
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId || l.apiId === leadId ? { ...l, agent: "Divya M." } : l))
    );
  };

  const handleStartCall = (lead: DisplayLead, language: string) => {
    setPreCallLead(null);
    setActiveCallLang(language);
    setActiveCallLead(lead);
  };

  const handleCallFinished = (callData: any) => {
    setActiveCallLead(null);
    notify(`Call logged (${callData.durationSec}s). Temperature marked '${callData.agentTemp}'. Cadence generated.`);
    setLeads((prev) =>
      prev.map((l) =>
        l.id === callData.leadId || l.apiId === callData.leadId
          ? { ...l, qualification: callData.agentTemp.toLowerCase(), stage: "contacted", last: "Just now" }
          : l
      )
    );
  };

  const handleConfirmClose = (leadId: string, reason: string, isRecoverable: boolean) => {
    setClosingLead(null);
    notify(
      `Lead closed (${reason}). ${isRecoverable ? "30-day reactivation touch scheduled in recovery queue." : "Lead archived."}`
    );
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId || l.apiId === leadId
          ? { ...l, stage: "closed", next: isRecoverable ? "30-Day Reactivation" : "Closed" }
          : l
      )
    );
  };

  return (
    <main className="crm-root">
      <WorkspaceTopbar
        role={role}
        changeRole={changeRole}
        onAddLead={() => setAddLeadOpen(true)}
        experience={experience}
        setExperience={(next) => {
          setExperience(next);
          setActiveId(next === "mobile" ? "mobile-home" : roleLanding[role]);
        }}
        openAtlas={() => setAtlasOpen(true)}
        currentTenant={currentTenant}
        currentUser={currentUser}
        activeId={activeId}
        openScreen={openScreen}
        onOpenAccount={() => setAccountModalOpen(true)}
        onOpenAsk={() => setAskModalOpen(true)}
        onOpenTraining={() => setTrainingModalOpen(true)}
        onOpenReport={() => setManagerReportModalOpen(true)}
      />
      {experience === "desktop" ? (
        <div className="desktop-shell">
          <DesktopSidebar role={role} activeId={activeId} changeRole={changeRole} openScreen={openScreen} openAtlas={() => setAtlasOpen(true)} />
          <section className="desktop-content">
            <CharacterMissionBanner
              role={role}
              currentUser={currentUser}
              openScreen={openScreen}
              onAddLead={() => setAddLeadOpen(true)}
              onAddAgent={() => setAddAgentOpen(true)}
              onOpenReport={() => setManagerReportModalOpen(true)}
              onOpenDiagnostic={() => setDiagnostic15dModalOpen(true)}
              onOpenDrillDown={() => setDrillDownModalOpen(true)}
              onCallNext={() => {
                if (leads[0]) setPreCallLead(leads[0]);
              }}
            />
            {loadError && <p className="page-description" role="alert" style={{ marginBottom: 16 }}>{loadError}</p>}
            <DesktopScreen
              screen={activeScreen}
              openScreen={openScreen}
              notify={notify}
              leads={leads}
              onLeadCreated={(lead) => {
                setLeads((current) => [lead, ...current.filter((item) => item.id !== lead.id)]);
                void loadLeads();
              }}
              onLeadUpdated={() => void loadLeads()}
              onCallLead={(lead) => setPreCallLead(lead)}
              onCloseLead={(lead) => setClosingLead(lead)}
              onOpenWhatsApp={(lead) => setWhatsAppModalLead(lead)}
              onReassignLead={handleReassignLead}
              onOpenAsk={() => setAskModalOpen(true)}
              onOpenTraining={() => setTrainingModalOpen(true)}
              onScoreLead={(lead) => setScoringLead(lead)}
              onOpenCadence={(lead) => setCadenceLead(lead)}
              onOpenDrillDown={() => setDrillDownModalOpen(true)}
              onOpenDiagnostic15d={() => setDiagnostic15dModalOpen(true)}
              onEditLead={(lead) => setEditLead(lead)}
              onAddAgent={() => setAddAgentOpen(true)}
              newAgents={newAgents}
            />
          </section>
        </div>
      ) : (
        <MobileWorkspace activeId={activeId} openScreen={openScreen} callSeconds={callSeconds} notify={notify} leads={leads} />
      )}
      {atlasOpen && <ScreenAtlas search={atlasSearch} setSearch={setAtlasSearch} activeId={activeId} openScreen={openScreen} close={() => setAtlasOpen(false)} />}
      {notice && <div className="toast" role="status"><CircleCheck size={18} />{notice}</div>}

      {/* PRD Feature Modals */}
      {preCallLead && (
        <PreCallModal
          lead={preCallLead}
          sonioxApiKey={sonioxApiKey}
          onSonioxKeyChange={handleSonioxKeyChange}
          onClose={() => setPreCallLead(null)}
          onStartCall={handleStartCall}
        />
      )}
      {activeCallLead && (
        <ActiveCallModal
          lead={activeCallLead}
          language={activeCallLang}
          sonioxApiKey={sonioxApiKey}
          onClose={() => setActiveCallLead(null)}
          onCallFinished={handleCallFinished}
        />
      )}
      {closingLead && (
        <LeadClosureModal
          lead={closingLead}
          onClose={() => setClosingLead(null)}
          onConfirmClose={handleConfirmClose}
        />
      )}
      {whatsAppModalLead && (
        <WhatsAppConversationModal
          lead={whatsAppModalLead}
          onClose={() => setWhatsAppModalLead(null)}
          onMessageReceived={async () => {
            await loadLeads();
          }}
          notify={notify}
        />
      )}
      {askModalOpen && <MultilingualAskModal onClose={() => setAskModalOpen(false)} />}
      {trainingModalOpen && <SystemTrainingModal onClose={() => setTrainingModalOpen(false)} notify={notify} />}
      {managerReportModalOpen && <EveningManagerReportModal onClose={() => setManagerReportModalOpen(false)} />}
      {scoringLead && (
        <LeadScoringModal
          lead={scoringLead}
          onClose={() => setScoringLead(null)}
          onScoreApplied={(score: number, band: string) => {
            setScoringLead(null);
            notify(`Lead scored: ${score}/100 (${band}). Pipeline priority updated.`);
          }}
        />
      )}
      {cadenceLead && (
        <Cadence48hSchedulerModal
          lead={cadenceLead}
          onClose={() => setCadenceLead(null)}
          notify={notify}
        />
      )}
      {drillDownModalOpen && (
        <NineLevelDrillDownModal
          onClose={() => setDrillDownModalOpen(false)}
        />
      )}
      {diagnostic15dModalOpen && (
        <FifteenDayDiagnosticModal
          onClose={() => setDiagnostic15dModalOpen(false)}
        />
      )}
      {accountModalOpen && (
        <UserAccountModal
          currentUser={currentUser}
          currentTenant={currentTenant}
          onSelectUser={handleSelectUser}
          onSelectTenant={handleSelectTenant}
          onClose={() => setAccountModalOpen(false)}
        />
      )}

      {/* Patient Intake & Edit & Manager Add Agent Modals */}
      {addLeadOpen && (
        <AddPatientLeadModal
          onClose={() => setAddLeadOpen(false)}
          onLeadAdded={(newLead) => {
            setLeads((prev) => [newLead, ...prev]);
            notify(`➕ Added new patient ${newLead.name}. 5-minute SLA timer started.`);
          }}
          notify={notify}
        />
      )}
      {editLead && (
        <EditPatientDetailsModal
          lead={editLead}
          onClose={() => setEditLead(null)}
          onLeadUpdated={(updatedLead) => {
            setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
            notify(`✏️ Updated patient record for ${updatedLead.name}.`);
          }}
          notify={notify}
        />
      )}
      {addAgentOpen && (
        <ManagerAddAgentModal
          onClose={() => setAddAgentOpen(false)}
          onAgentAdded={(newAgent) => {
            setNewAgents((prev) => [newAgent, ...prev]);
          }}
          notify={notify}
        />
      )}
    </main>
  );
}

function WorkspaceTopbar({
  role,
  changeRole,
  onAddLead,
  experience,
  setExperience,
  openAtlas,
  currentTenant,
  currentUser,
  onOpenAccount,
  onOpenAsk,
  onOpenTraining,
  onOpenReport,
  activeId,
  openScreen,
}: {
  role: AppRole;
  changeRole: (role: AppRole) => void;
  onAddLead: () => void;
  experience: Experience;
  setExperience: (experience: Experience) => void;
  openAtlas: () => void;
  currentTenant: TenantPack;
  currentUser: RoleUser;
  onOpenAccount: () => void;
  onOpenAsk: () => void;
  onOpenTraining: () => void;
  onOpenReport: () => void;
  activeId?: string;
  openScreen?: (id: string) => void;
}) {
  const characters: Array<{ role: AppRole; label: string; char: string; icon: string }> = [
    { role: "Leadership", label: "Executive", char: "Dr. Ramesh", icon: "👔" },
    { role: "Agent", label: "Telecalling", char: "Sravani", icon: "🎧" },
    { role: "Manager", label: "Manager", char: "Anil", icon: "📊" },
    { role: "Doctor", label: "Doctor", char: "Dr. Radhakrishna", icon: "🩺" },
    { role: "Finance", label: "Finance", char: "Radha V.", icon: "💳" },
    { role: "Voice AI", label: "Voice AI", char: "Nilesh", icon: "🤖" },
  ];

  return (
    <header className="workspace-topbar">
      <div className="brand-lockup">
        <div className="brand-mark">T</div>
        <div>
          <strong>TRH360</strong>
          <span>Human + AI CRM</span>
        </div>
      </div>

      <button className="workspace-name" type="button" onClick={onOpenAccount} title="Switch Vertical Tenant Pack">
        {currentTenant.name} <ChevronDown size={15} />
      </button>

      {/* Prominent Character / Persona Switcher Bar */}
      <div
        className="persona-switcher-bar"
        aria-label="Character Persona Switcher"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: "rgba(0,0,0,0.22)",
          padding: "3px 6px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.14)",
        }}
      >
        {characters.map((item) => {
          const isActive = role === item.role;
          return (
            <button
              key={item.role}
              type="button"
              onClick={() => changeRole(item.role)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 8px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: isActive ? 800 : 600,
                border: isActive ? "1px solid var(--gold)" : "1px solid transparent",
                background: isActive ? "rgba(208,154,38,0.3)" : "transparent",
                color: isActive ? "var(--gold)" : "rgba(255,255,255,0.85)",
                cursor: "pointer",
                transition: "all 0.12s ease",
                whiteSpace: "nowrap",
              }}
              title={`Switch workspace to ${item.char} (${item.label})`}
            >
              <span>{item.icon}</span>
              <span>{item.char}</span>
              {isActive && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--gold)" }} />}
            </button>
          );
        })}
      </div>

      {/* Add Lead Quick Button */}
      <Button
        size="sm"
        onClick={onAddLead}
        style={{
          background: "var(--gold)",
          color: "var(--navy)",
          fontWeight: 800,
          fontSize: 12,
          height: 32,
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexShrink: 0,
        }}
        title="Add new patient lead & health assessment"
      >
        <Plus size={14} /> + Add Lead
      </Button>

      {/* Top Search */}
      <div className="top-search" onClick={onOpenAsk} role="button" tabIndex={0} title="Search or Ask CRM in Telugu / Hindi / English">
        <Search size={16} />
        <span>Search leads or Ask in Telugu, Hindi, English</span>
        <kbd>Ask</kbd>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenAsk}
          style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", fontSize: 11, height: 30 }}
        >
          <Sparkles size={13} style={{ color: "var(--gold)" }} /> Ask CRM
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenTraining}
          style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", fontSize: 11, height: 30 }}
        >
          <Upload size={13} /> Train
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenReport}
          style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", fontSize: 11, height: 30 }}
        >
          <FileText size={13} /> 21:00 EOD
        </Button>
      </div>

      <div className="experience-toggle" aria-label="Experience preview">
        <button className={experience === "desktop" ? "active" : ""} onClick={() => setExperience("desktop")}>Desktop</button>
        <button className={experience === "mobile" ? "active" : ""} onClick={() => setExperience("mobile")}>Mobile</button>
      </div>

      <button
        onClick={onOpenAccount}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.22)",
          borderRadius: 20,
          padding: "2px 8px 2px 3px",
          color: "#ffffff",
          cursor: "pointer",
        }}
        title="Switch Account Role"
      >
        <div className="user-avatar small" style={{ background: "var(--gold)", color: "var(--navy)", width: 24, height: 24, fontSize: 10 }}>
          {currentUser.avatar}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700 }}>{currentUser.name}</span>
        <ChevronDown size={12} />
      </button>
    </header>
  );
}

function CharacterMissionBanner({
  role,
  currentUser,
  openScreen,
  onAddLead,
  onAddAgent,
  onOpenReport,
  onOpenDiagnostic,
  onOpenDrillDown,
  onCallNext,
}: {
  role: AppRole;
  currentUser: RoleUser;
  openScreen: (id: string) => void;
  onAddLead: () => void;
  onAddAgent: () => void;
  onOpenReport: () => void;
  onOpenDiagnostic: () => void;
  onOpenDrillDown: () => void;
  onCallNext: () => void;
}) {
  return (
    <div
      className="character-mission-banner"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
        padding: "10px 16px",
        background: "linear-gradient(90deg, #0b2545 0%, #13395e 100%)",
        color: "#ffffff",
        borderRadius: 10,
        marginBottom: 16,
        boxShadow: "0 2px 8px rgba(11,37,69,0.12)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "var(--gold)",
            color: "var(--navy)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 16,
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            flexShrink: 0,
          }}
        >
          {currentUser.icon || "👤"}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "1px", color: "var(--gold)", fontWeight: 800 }}>
              Active Character Workspace
            </span>
            <span style={{ fontSize: 11, background: "rgba(255,255,255,0.18)", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
              {currentUser.title}
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
            {currentUser.name}
            <span style={{ fontWeight: 400, fontSize: 12, opacity: 0.85, marginLeft: 8 }}>
              — {currentUser.tagline}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {role === "Agent" && (
          <>
            <Button
              size="sm"
              onClick={onAddLead}
              style={{ background: "var(--gold)", color: "var(--navy)", fontWeight: 800, fontSize: 12 }}
            >
              <Plus size={14} style={{ marginRight: 4 }} /> + Add Patient Lead
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onCallNext}
              style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", fontSize: 12 }}
            >
              <PhoneCall size={13} style={{ marginRight: 4 }} /> Call Next Hot Lead
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openScreen("agent-lead-360")}
              style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", fontSize: 12 }}
            >
              <UserRound size={13} style={{ marginRight: 4 }} /> Lead 360
            </Button>
          </>
        )}

        {role === "Manager" && (
          <>
            <Button
              size="sm"
              onClick={onAddAgent}
              style={{ background: "var(--gold)", color: "var(--navy)", fontWeight: 800, fontSize: 12 }}
            >
              <UserPlus size={14} style={{ marginRight: 4 }} /> + Add Agent & Issue Slip
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openScreen("manager-agent-scorecard")}
              style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", fontSize: 12 }}
            >
              <UsersRound size={13} style={{ marginRight: 4 }} /> Team Scorecards
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openScreen("manager-daily-conversion")}
              style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", fontSize: 12 }}
            >
              <Target size={13} style={{ marginRight: 4 }} /> Conversion
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenReport}
              style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", fontSize: 12 }}
            >
              <FileText size={13} style={{ marginRight: 4 }} /> 21:00 EOD
            </Button>
          </>
        )}

        {role === "Leadership" && (
          <>
            <Button
              size="sm"
              onClick={() => openScreen("owner-founder")}
              style={{ background: "var(--gold)", color: "var(--navy)", fontWeight: 800, fontSize: 12 }}
            >
              <BarChart3 size={14} style={{ marginRight: 4 }} /> 50 Lost Leaks
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenDiagnostic}
              style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", fontSize: 12 }}
            >
              <Sparkles size={13} style={{ marginRight: 4 }} /> 15-Day Memo
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenDrillDown}
              style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", fontSize: 12 }}
            >
              <GitBranch size={13} style={{ marginRight: 4 }} /> 9-Level Tree
            </Button>
          </>
        )}

        {role === "Doctor" && (
          <>
            <Button
              size="sm"
              onClick={() => openScreen("ops-doctor-allocation")}
              style={{ background: "var(--gold)", color: "var(--navy)", fontWeight: 800, fontSize: 12 }}
            >
              <Stethoscope size={14} style={{ marginRight: 4 }} /> Doctor Allocation
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openScreen("ops-appointments")}
              style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", fontSize: 12 }}
            >
              <CalendarDays size={13} style={{ marginRight: 4 }} /> OPD Slots
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openScreen("ops-admission-queue")}
              style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", fontSize: 12 }}
            >
              <CircleCheck size={13} style={{ marginRight: 4 }} /> Surgery Queue
            </Button>
          </>
        )}

        {role === "Finance" && (
          <>
            <Button
              size="sm"
              onClick={() => openScreen("ops-financial-queue")}
              style={{ background: "var(--gold)", color: "var(--navy)", fontWeight: 800, fontSize: 12 }}
            >
              <WalletCards size={14} style={{ marginRight: 4 }} /> Commercial Queue
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openScreen("ops-financial-case")}
              style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", fontSize: 12 }}
            >
              <FileText size={13} style={{ marginRight: 4 }} /> 0% EMI Counselor
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openScreen("agent-recovery")}
              style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", fontSize: 12 }}
            >
              <RotateCcw size={13} style={{ marginRight: 4 }} /> 30d Recovery
            </Button>
          </>
        )}

        {role === "Voice AI" && (
          <>
            <Button
              size="sm"
              onClick={() => openScreen("voice-campaigns")}
              style={{ background: "var(--gold)", color: "var(--navy)", fontWeight: 800, fontSize: 12 }}
            >
              <Bot size={14} style={{ marginRight: 4 }} /> Voice Campaigns
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openScreen("voice-live-monitor")}
              style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", fontSize: 12 }}
            >
              <Activity size={13} style={{ marginRight: 4 }} /> Live Monitor
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openScreen("voice-confidence")}
              style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", fontSize: 12 }}
            >
              <ShieldCheck size={13} style={{ marginRight: 4 }} /> Review Queue
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function DesktopSidebar({ role, activeId, changeRole, openScreen, openAtlas }: { role: AppRole; activeId: string; changeRole: (role: AppRole) => void; openScreen: (id: string) => void; openAtlas: () => void }) {
  return <aside className="desktop-sidebar">
    <div className="role-label">Viewing workspace as</div>
    <div className="role-select-wrap"><ShieldCheck size={16} /><select value={role} onChange={(event) => changeRole(event.target.value as AppRole)} aria-label="Select CRM role">{(Object.keys(roleLabels) as AppRole[]).map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select><ChevronDown size={15} /></div>
    <nav className="primary-nav" aria-label={`${role} navigation`}><span className="nav-section-title">Workspace</span>{roleNav[role].map(({ label, id, icon: Icon }) => <button key={id} className={activeId === id ? "active" : ""} onClick={() => openScreen(id)}><Icon size={18} /><span>{label}</span>{id === "manager-escalations" && <em>11</em>}{id === "voice-confidence" && <em>26</em>}</button>)}</nav>
    <div className="sidebar-spacer" /><button className="atlas-launcher" onClick={openAtlas}><div className="atlas-icon"><ListFilter size={18} /></div><div><strong>Screen atlas</strong><span>Browse all {crmScreens.length} screens</span></div><ChevronRight size={16} /></button>
    <div className="human-control-note"><ShieldCheck size={17} /><div><strong>Human controlled</strong><span>AI suggests. People decide.</span></div></div>
  </aside>;
}

function PageHeader({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: React.ReactNode }) {
  return <div className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{children && <div className="page-actions">{children}</div>}</div>;
}

function DesktopScreen({
  screen,
  openScreen,
  notify,
  leads,
  onLeadCreated,
  onLeadUpdated,
  onCallLead,
  onCloseLead,
  onOpenWhatsApp,
  onReassignLead,
  onOpenAsk,
  onOpenTraining,
  onScoreLead,
  onOpenCadence,
  onOpenDrillDown,
  onOpenDiagnostic15d,
  onEditLead,
  onAddAgent,
  newAgents,
}: {
  screen: CrmScreen;
  openScreen: (id: string) => void;
  notify: (message: string) => void;
  leads: DisplayLead[];
  onLeadCreated: (lead: DisplayLead) => void;
  onLeadUpdated?: () => void;
  onCallLead: (lead: DisplayLead) => void;
  onCloseLead: (lead: DisplayLead) => void;
  onOpenWhatsApp?: (lead: DisplayLead) => void;
  onReassignLead: (leadId: string) => void;
  onOpenAsk: () => void;
  onOpenTraining: () => void;
  onScoreLead?: (lead: DisplayLead) => void;
  onOpenCadence?: (lead: DisplayLead) => void;
  onOpenDrillDown?: () => void;
  onOpenDiagnostic15d?: () => void;
  onEditLead?: (lead: DisplayLead) => void;
  onAddAgent?: () => void;
  newAgents?: any[];
}) {
  switch (screen.id) {
    case "agent-my-day": return <AgentWorkspace openScreen={openScreen} leads={leads} onCallLead={onCallLead} onReassignLead={onReassignLead} />;
    case "manager-cockpit": return <ManagerCockpit openScreen={openScreen} leads={leads} onCallLead={onCallLead} onReassignLead={onReassignLead} onOpenAsk={onOpenAsk} />;
    case "agent-my-leads": return <MyLeads openScreen={openScreen} leads={leads} onCallLead={onCallLead} />;
    case "agent-lead-360": return <Lead360 openScreen={openScreen} leads={leads} onCallLead={onCallLead} onCloseLead={onCloseLead} onOpenWhatsApp={onOpenWhatsApp} onScoreLead={onScoreLead} onOpenCadence={onOpenCadence} />;
    case "manager-cockpit": return <ManagerCockpit openScreen={openScreen} leads={leads} onCallLead={onCallLead} onReassignLead={onReassignLead} onOpenAsk={onOpenAsk} onAddAgent={onAddAgent} />;
    case "agent-my-leads": return <MyLeads openScreen={openScreen} leads={leads} onCallLead={onCallLead} onEditLead={onEditLead} />;
    case "agent-lead-360": return <Lead360 openScreen={openScreen} leads={leads} onCallLead={onCallLead} onCloseLead={onCloseLead} onOpenWhatsApp={onOpenWhatsApp} onScoreLead={onScoreLead} onOpenCadence={onOpenCadence} onEditLead={onEditLead} />;
    case "agent-tasks": return <AgentTasks leads={leads} notify={notify} />;
    case "agent-calendar": return <AgentCalendar leads={leads} notify={notify} />;
    case "agent-recovery": return <AgentRecovery leads={leads} openScreen={openScreen} />;
    case "agent-performance": return <AgentPerformance leads={leads} />;
    case "agent-follow-up": return <AgentFollowUp leads={leads} notify={notify} />;
    case "agent-book-appointment": return <AgentBookAppointment leads={leads} notify={notify} />;
    case "agent-post-call-review": return <PostCallReview notify={notify} openScreen={openScreen} />;
    case "manager-assignment": return <ManagerAssignmentBoard openScreen={openScreen} leads={leads} notify={notify} onLeadCreated={onLeadCreated} onLeadUpdated={onLeadUpdated} />;
    case "manager-funnel": return <UniversalFunnelDashboard openScreen={openScreen} />;
    case "manager-conversation": return <UniversalConversationIntelligence onOpenAsk={onOpenAsk} />;
    case "manager-daily-conversion": return <ManagerDailyConversionScreen notify={notify} />;
    case "manager-agent-scorecard": return <ManagerAgentScorecardScreen notify={notify} />;
    case "manager-agent-scorecard": return <ManagerAgentScorecardScreen notify={notify} onAddAgent={onAddAgent} newAgents={newAgents} />;
    case "manager-escalations": return <ManagerEscalationsScreen notify={notify} />;
    case "owner-founder": return <FounderDashboard openScreen={openScreen} leads={leads} onOpenAsk={onOpenAsk} onOpenDiagnostic15d={onOpenDiagnostic15d} onOpenDrillDown={onOpenDrillDown} />;
    case "owner-founder": return <FounderDashboard openScreen={openScreen} leads={leads} notify={notify} onOpenAsk={onOpenAsk} onOpenDiagnostic15d={onOpenDiagnostic15d} onOpenDrillDown={onOpenDrillDown} />;
    case "owner-drill-down": return <UniversalDrillDownExplorer onOpenInteractive={onOpenDrillDown} />;
    case "owner-diagnostic": return <UniversalDiagnosticReview notify={notify} onOpenInteractive={onOpenDiagnostic15d} />;
    case "owner-cohort": return <OwnerCohortScreen notify={notify} />;
    case "owner-source-roi": return <OwnerSourceRoiScreen notify={notify} />;
    case "owner-report-library": return <OwnerReportLibraryScreen notify={notify} />;
    case "ops-appointments": return <OpsAppointmentsScreen notify={notify} />;
    case "ops-doctor-allocation": return <OpsDoctorAllocationScreen notify={notify} />;
    case "ops-no-show": return <OpsNoShowScreen notify={notify} />;
    case "ops-financial-queue": return <OpsFinancialQueueScreen notify={notify} />;
    case "ops-admission-queue": return <OpsAdmissionQueueScreen notify={notify} />;
    case "ops-handoff": return <OpsHandoffScreen notify={notify} />;
    case "ops-financial-case": return <UniversalCommercialCase notify={notify} />;
    case "admin-sources": return <AdminSourcesScreen notify={notify} />;
    case "admin-telephony": return <AdminTelephonyScreen notify={notify} />;
    case "admin-audit": return <AdminAuditScreen notify={notify} />;
    case "admin-ai-safety": return <UniversalAiSafety notify={notify} />;
    case "admin-control-tower": return <AdminControlTower openScreen={openScreen} />;
    case "admin-follow-up-ageing": return <AdminFollowUpAgeing openScreen={openScreen} leads={leads} />;
    case "voice-overview": return <UniversalVoiceOverview openScreen={openScreen} />;
    case "voice-campaigns": return <VoiceCampaignsScreen notify={notify} />;
    case "voice-agent-config": return <VoiceAgentConfigScreen notify={notify} />;
    case "voice-runs": return <VoiceRunsScreen notify={notify} />;
    case "voice-live-monitor": return <VoiceLiveMonitorScreen notify={notify} />;
    case "voice-confidence": return <VoiceConfidenceScreen notify={notify} />;
    case "voice-analytics": return <VoiceAnalyticsScreen notify={notify} />;
    case "voice-call-detail": return <UniversalVoiceCallDetail notify={notify} />;
    case "__legacy-funnel": return <FunnelDashboard openScreen={openScreen} />;
    case "__legacy-conversation": return <ConversationIntelligence onOpenAsk={onOpenAsk} />;
    case "__legacy-drill": return <DrillDownExplorer />;
    case "__legacy-diagnostic": return <DiagnosticReview notify={notify} />;
    case "__legacy-commercial": return <FinancialCase notify={notify} />;
    case "__legacy-ai-safety": return <AiSafety notify={notify} />;
    case "__legacy-voice-overview": return <VoiceOverview openScreen={openScreen} />;
    case "__legacy-voice-detail": return <VoiceCallDetail notify={notify} />;
    case "__legacy-generic": return <GenericDesktopScreen screen={screen} openScreen={openScreen} notify={notify} />;
    default: return <UniversalGenericDesktopScreen screen={screen} openScreen={openScreen} notify={notify} leads={leads} onLeadCreated={onLeadCreated} onLeadUpdated={onLeadUpdated} />;
  }
}

function AgentWorkspace({
  openScreen,
  leads,
  onCallLead,
  onReassignLead,
}: {
  openScreen: (id: string) => void;
  leads: DisplayLead[];
  onCallLead: (lead: DisplayLead) => void;
  onReassignLead: (leadId: string) => void;
}) {
  const queue = leads.slice(0, 4).map((lead) => [lead.name, lead.stage, lead.next, lead.qualification === "hot" ? "Hot" : lead.qualification === "warm" ? "Warm" : lead.qualification === "cold" ? "Cold" : "Unknown", lead.last, lead] as const);
  const targetLead = leads[0] || initialSampleLeads[0];

  return <div className="page-stack agent-simple-page">
    <PageHeader eyebrow={`Telecalling workspace · ${formatIndiaDate()}`} title="Your work, in order." description="Call the next person, record the outcome, and move to the next commitment.">
      <Button variant="outline" onClick={() => openScreen("agent-new-lead")}><Plus /> Add lead</Button>
    </PageHeader>

    {/* PRD 4: 5-Minute Uncalled SLA Banner with 15m Reassignment Action */}
    <div className="sla-alert-pulse">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <AlarmClock size={24} style={{ color: "var(--burgundy)", flexShrink: 0 }} />
        <div>
          <strong style={{ color: "var(--burgundy)", display: "block", fontSize: 13 }}>
            🚨 PRD 4: 5-Minute Uncalled Lead SLA Warning
          </strong>
          <span style={{ fontSize: 12, color: "var(--navy)" }}>
            Lead <strong>{targetLead.name}</strong> ({targetLead.source}) has been uncalled for <strong>18 minutes</strong>! (15m SLA breach threshold exceeded)
          </span>
        </div>
      </div>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => onReassignLead(targetLead.id)}
        style={{ fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}
      >
        ⚡ Reassign Lead (15m SLA Breach)
      </Button>
    </div>

    <section className="agent-focus-card">
      <div className="agent-focus-label"><span className="live-dot" /> Next best action</div>
      <div className="agent-focus-main">
        <div className="large-avatar">{targetLead.name.slice(0, 2).toUpperCase()}</div>
        <div><span className="agent-focus-overline">Hot lead · SLA overdue</span><h2>{targetLead.name}</h2><p>Orthopedic Treatment · Hyderabad · {targetLead.source}</p></div>
        <div className="agent-focus-context"><span>Last conversation</span><b>Asked for package pricing and Saturday consult</b><small>18 minutes ago · 4m 38s</small></div>
        <Button className="gold-action" onClick={() => onCallLead(targetLead)}><PhoneCall /> Call now</Button>
      </div>
      <div className="agent-focus-foot"><span><Sparkles size={15} /> AI context ready</span><button onClick={() => openScreen("agent-lead-360")}>Open Lead 360 <ChevronRight size={15} /></button></div>
    </section>
    <div className="agent-day-strip">
      <button onClick={() => openScreen("agent-my-leads")}><strong>14</strong><span>Calls due</span><small>3 overdue</small></button>
      <button onClick={() => openScreen("agent-follow-up")}><strong>21</strong><span>Follow-ups</span><small>Next at 11:30 AM</small></button>
      <button onClick={() => openScreen("agent-calendar")}><strong>07</strong><span>Meetings</span><small>2 need confirmation</small></button>
      <button onClick={() => openScreen("agent-post-call-review")}><strong>02</strong><span>Drafts to review</span><small>AI has not saved them</small></button>
    </div>
    <div className="agent-simple-grid">
      <section className="panel simple-queue-panel"><PanelHeader title="Up next" subtitle="Ordered by commitment time and lead intent" action="All leads" onAction={() => openScreen("agent-my-leads")} />
        {queue.map((row) => <button className="simple-call-row" key={row[0]} onClick={() => onCallLead(row[5])}><span className="queue-order">📞</span><div><strong>{row[0]}</strong><small>{row[1]}</small></div><Badge variant="outline" className={temperatureClass[row[3]]}>{row[3]}</Badge><div className="simple-call-time"><b>{row[2]}</b><small>{row[4]}</small></div><span className="round-call"><Phone size={16} /></span></button>)}
      </section>
      <aside className="panel agent-checklist"><PanelHeader title="Finish the day clean" subtitle="Only the essentials" />
        {[ ["Calls without outcome", "0", true], ["Follow-ups without next date", "2", false], ["AI drafts waiting for you", "2", false], ["Meetings needing confirmation", "2", false] ].map(([label,value,done]) => <button key={String(label)}><span className={done ? "done" : ""}>{done ? <Check size={14} /> : value}</span><b>{label}</b><ChevronRight size={15} /></button>)}
        <div className="agent-completion"><div><span>Today’s completion</span><b>82%</b></div><Progress value={82} /><small>Complete four items to close your day.</small></div>
      </aside>
    </div>
  </div>;
}

const ageingBuckets = [
  { day: "Day 0", label: "New today", due: 428, open: 38, rate: 91, value: "₹18.4L", tone: "safe" },
  { day: "Day 1", label: "First follow-up", due: 362, open: 44, rate: 88, value: "₹15.7L", tone: "safe" },
  { day: "Day 2", label: "Message / nurture", due: 304, open: 61, rate: 80, value: "₹13.2L", tone: "watch" },
  { day: "Day 3", label: "Second call", due: 246, open: 72, rate: 71, value: "₹11.8L", tone: "watch" },
  { day: "Day 4", label: "Proof / education", due: 188, open: 69, rate: 63, value: "₹9.6L", tone: "risk" },
  { day: "Day 5", label: "Decision check", due: 154, open: 81, rate: 47, value: "₹8.9L", tone: "risk" },
  { day: "Day 6–7", label: "Grace window", due: 118, open: 76, rate: 36, value: "₹6.4L", tone: "critical" },
  { day: "Day 8–14", label: "Recovery", due: 206, open: 149, rate: 28, value: "₹12.1L", tone: "critical" },
  { day: "15+ days", label: "Reactivation", due: 491, open: 402, rate: 18, value: "₹21.6L", tone: "critical" },
];

function AdminControlTower({ openScreen }: { openScreen: (id: string) => void }) {
  return <div className="page-stack admin-control-page">
    <PageHeader eyebrow="System administrator · Live operating truth" title="Admin control tower" description="Every lead, follow-up day, conversation, cost, exception, and outcome—without hiding the detail.">
      <Button variant="outline"><CalendarDays /> 22 Aug–05 Sep</Button><Button variant="outline"><Filter /> All business units</Button><Button className="primary-action"><Download /> Export control book</Button>
    </PageHeader>
    <div className="admin-truth-strip">
      {[ ["Where did leads come from?", "Source integrity 99.2%"], ["What happened next?", "97.1% journeys complete"], ["Why did they convert?", "218 evidenced wins"], ["Why did they not?", "84.6% reasons evidenced"], ["What should change?", "17 actions ranked"] ].map((row,index) => <button key={row[0]}><span>0{index+1}</span><div><b>{row[0]}</b><small>{row[1]}</small></div></button>)}
    </div>
    <div className="admin-kpi-grid">
      {[ ["Leads received", "2,864", "+12.4%", UsersRound, "neutral"], ["Median first response", "03:42", "Target < 05:00", AlarmClock, "good"], ["Follow-ups due today", "1,682", "327 still open", PhoneCall, "warn"], ["Overdue commitments", "412", "₹38.7L exposed", CircleAlert, "danger"], ["Records without next action", "68", "2.4% of active", CalendarDays, "danger"], ["Converted revenue", "₹1.84Cr", "+11.8%", Target, "good"] ].map(([label,value,detail,Icon,tone]) => { const KpiIcon=Icon as LucideIcon; return <article className={`admin-kpi ${tone}`} key={String(label)}><div><span>{label as string}</span><KpiIcon size={18} /></div><strong>{value as string}</strong><small>{detail as string}</small></article>; })}
    </div>
    <section className="panel followup-ageing-panel">
      <PanelHeader title="Follow-up ageing control" subtitle="Open work by days since lead creation · Every bucket is clickable" action="Full ageing intelligence" onAction={() => openScreen("admin-follow-up-ageing")} />
      <div className="ageing-summary"><div><span>Active follow-up universe</span><strong>2,497</strong><small>Across 8 business units</small></div><div><span>Completed on schedule</span><strong>78.6%</strong><small>1,963 commitments</small></div><div><span>Currently overdue</span><strong className="danger-text">412</strong><small>16.5% of active</small></div><div><span>Recoverable value</span><strong>₹38.7L</strong><small>Evidence-backed estimate</small></div></div>
      <div className="ageing-grid">{ageingBuckets.map((item) => <button className={`ageing-card ${item.tone}`} key={item.day} onClick={() => openScreen("admin-follow-up-ageing")}><div><span>{item.day}</span><Badge variant="outline">{item.label}</Badge></div><strong>{item.open}<small> open</small></strong><div className="ageing-meter"><i style={{ width: `${item.rate}%` }} /></div><p><span>{item.rate}% completed</span><b>{item.value} value</b></p><small>{item.due} total due</small></button>)}</div>
      <div className="ageing-legend"><span><i className="safe" /> ≥80% on schedule</span><span><i className="watch" /> 60–79%</span><span><i className="risk" /> 40–59%</span><span><i className="critical" /> Below 40%</span><b>Day 5 is the primary intent-retention threshold</b></div>
    </section>
    <div className="admin-depth-grid">
      <section className="panel compliance-matrix-panel"><PanelHeader title="Cadence compliance by team" subtitle="Required touch completed on the intended day" action="Agent behaviour" onAction={() => openScreen("admin-behaviour-audit")} />
        <div className="compliance-matrix"><div className="compliance-row head"><span>Team</span>{["D0","D1","D2","D3","D4","D5","6–7","Missed"].map((day)=><span key={day}>{day}</span>)}</div>{[
          ["Enterprise inbound",96,91,84,79,72,61,48,38], ["Regional language",92,87,78,69,59,44,31,67], ["Renewals",98,95,92,88,85,79,72,14], ["Partner referrals",89,82,71,63,54,42,28,52], ["Voice AI handoff",99,94,86,81,77,66,51,21]
        ].map((row)=><button className="compliance-row" key={String(row[0])}><span>{row[0]}</span>{row.slice(1,8).map((value)=><span key={String(value)} className={Number(value)>=80?"cell-good":Number(value)>=60?"cell-watch":Number(value)>=40?"cell-risk":"cell-bad"}>{value}%</span>)}<span className="missed-cell">{row[8]}</span></button>)}</div>
      </section>
      <aside className="panel exception-panel"><PanelHeader title="Administrator exceptions" subtitle="Ranked by revenue and control risk" />
        {[
          ["81 Day-5 leads still have no decision call", "₹8.9L exposed", "Critical"], ["68 active records have no next commitment", "4 teams", "Critical"], ["23 calls saved without a usable outcome", "Today", "Review"], ["17 agent temperatures conflict with transcript", "Past 7 days", "Review"], ["₹12,840 communication spend has no purpose tag", "This month", "Cost"]
        ].map((row,index)=><button className="admin-exception" key={row[0]}><span className={index<2?"critical":index===4?"cost":"review"}>{row[2]}</span><div><b>{row[0]}</b><small>{row[1]}</small></div><ChevronRight size={16}/></button>)}
      </aside>
    </div>
    <section className="panel overdue-ledger-panel"><PanelHeader title="Overdue follow-up ledger" subtitle="The operational record behind the summary" action="Export all 412" />
      <div className="overdue-ledger"><div className="overdue-row head"><span>Lead</span><span>Age</span><span>Last meaningful touch</span><span>Required action</span><span>Owner</span><span>Reason / evidence</span><span>Value</span><span>Risk</span></div>{[
        ["Lakshmi Narayana","Day 5","Yesterday · 4m 38s","Decision call · 4:30 PM","Sravani K.","Pricing · 00:24","₹2.4L","High"], ["Madhavi Rao","Day 7","3 days ago · 2m 14s","Second follow-up","Anil Kumar","Stakeholder delay · 01:11","₹1.8L","High"], ["Mohammed Faizal","Day 3","Today · 1m 52s","Send renewal proposal","Divya M.","Plan comparison · 00:42","₹84K","Medium"], ["Sailaja Devi","Day 14","8 days ago · 5m 06s","Recovery call","Kiran Reddy","No reason captured","₹1.2L","Critical"]
      ].map((row)=><button className="overdue-row" key={row[0]} onClick={() => openScreen("agent-lead-360")}>{row.map((cell,index)=><span key={cell} className={index===7?`risk-${cell.toLowerCase()}`:""}>{cell}</span>)}</button>)}</div>
    </section>
  </div>;
}

function AdminFollowUpAgeing({ openScreen, leads }: { openScreen: (id: string) => void; leads: DisplayLead[] }) {
  return <div className="page-stack">
    <PageHeader eyebrow="Admin intelligence · Follow-up governance" title="Follow-up ageing intelligence" description="See how intent changes by day, whether the promised touch happened, and where recoverable value is decaying.">
      <Button variant="outline"><Filter /> Cohort filters</Button><Button className="primary-action"><Download /> Export day-level ledger</Button>
    </PageHeader>
    <div className="filter-ribbon"><button>Created: Last 30 days <ChevronDown size={14}/></button><button>All business units <ChevronDown size={14}/></button><button>All sources <ChevronDown size={14}/></button><button>All temperatures <ChevronDown size={14}/></button><span>2,497 active journeys</span></div>
    <section className="panel ageing-detail-panel"><PanelHeader title="Day-by-day follow-up health" subtitle="Required actions, actual completion, meaningful conversations, and conversion" />
      <div className="ageing-detail-chart">{ageingBuckets.slice(0,8).map((item,index)=><div className="age-column" key={item.day}><div className="age-bars"><i className="required" style={{height:`${88-index*5}%`}}/><i className="completed" style={{height:`${item.rate}%`}}/></div><strong>{item.day}</strong><span>{item.rate}% on time</span><small>{item.open} open</small></div>)}</div>
      <div className="chart-key"><span><i className="required"/> Required touches</span><span><i className="completed"/> Completed on intended day</span><b>Conversion drops 38% when Day-3 contact is missed.</b></div>
    </section>
    <div className="admin-depth-grid"><section className="panel"><PanelHeader title="Configured five-day protocol" subtitle="Enterprise sales playbook · Version 3" />{[
      ["Day 0","Immediate acknowledgement + first call","5-minute first-response SLA","92%"], ["Day 1","Contextual message","No duplicate message within 48 hours","88%"], ["Day 2","Qualification call","Need, authority, budget, timing","80%"], ["Day 3","Proof or education","Case study, comparison, or demo","71%"], ["Day 4","Objection resolution","Evidence-based response","63%"], ["Day 5","Decision call","Convert, extend with reason, or recover","47%"]
    ].map((row)=><div className="protocol-row" key={row[0]}><span>{row[0]}</span><div><b>{row[1]}</b><small>{row[2]}</small></div><strong>{row[3]}</strong></div>)}</section><aside className="panel"><PanelHeader title="Ageing diagnosis" subtitle="What the data says" /><Finding number="01" title="Day 3 is the largest preventable break" text="72 leads missed their qualification or proof touch; 49 still show active intent." evidence="Open 116 call moments"/><Finding number="02" title="Regional team loses continuity after Day 4" text="Agent ownership changes explain 41% of missing context in this cohort." evidence="Open handoff audit"/><Finding number="03" title="Renewal cadence is the benchmark" text="79% Day-5 compliance and 18.4% conversion, with complete reasons on 96% of losses." evidence="Compare playbook"/></aside></div>
    <section className="panel"><PanelHeader title="Ageing cohort ledger" subtitle="Trace every day-level metric to a lead, call, transcript, message, and owner" action="Open control tower" onAction={() => openScreen("admin-control-tower")}/><LeadTable openScreen={openScreen} leads={leads}/></section>
  </div>;
}

function UniversalFunnelDashboard({ openScreen }: { openScreen: (id: string) => void }) {
  const lossReasons = [
    ["Budget or pricing", 31, "201 leads"],
    ["Stakeholder approval", 23, "149 leads"],
    ["Unable to reach again", 18, "117 leads"],
    ["Product or service fit", 12, "78 leads"],
    ["Timing changed", 9, "59 leads"],
    ["No valid reason", 7, "46 leads"],
  ];
  const segments = [
    ["Enterprise inbound", "82%", "71%", "54%", "63%", "48%"],
    ["Regional acquisition", "79%", "68%", "42%", "58%", "39%"],
    ["Renewals", "88%", "76%", "61%", "72%", "57%"],
    ["Partner referrals", "84%", "73%", "47%", "66%", "52%"],
  ];
  return <div className="page-stack">
    <PageHeader eyebrow="Conversion intelligence" title="Where is the funnel leaking?" description="Trace every loss from source to final conversion, then inspect the exact conversation evidence.">
      <Button variant="outline"><Download /> Export analysis</Button>
      <Button className="primary-action" onClick={() => openScreen("owner-drill-down")}><GitBranch /> Open drill-down</Button>
    </PageHeader>
    <div className="filter-ribbon"><button>Last 30 days <ChevronDown size={14} /></button><button>All business units <ChevronDown size={14} /></button><button>All products & services <ChevronDown size={14} /></button><button>All sources <ChevronDown size={14} /></button><span>Updated 4 min ago</span></div>
    <div className="funnel-page-grid">
      <section className="panel full-funnel-panel"><PanelHeader title="Lifecycle funnel" subtitle="2,864 sourced leads · 218 conversions" /><div className="full-funnel">{funnelStages.map((stage,index)=><div className="full-funnel-stage" key={stage.label}><div><span>{stage.label}</span><strong>{stage.value.toLocaleString("en-IN")}</strong><small>{index===0?"All sourced leads":`${stage.rate}% stage conversion`}</small></div>{index<funnelStages.length-1&&<span className="drop-marker"><ArrowDown size={13} /> {Math.round((1-funnelStages[index+1].value/stage.value)*100)}% drop</span>}</div>)}</div></section>
      <section className="panel leak-reasons"><PanelHeader title="Why qualified leads do not progress" subtitle="650 lost at this stage" />{lossReasons.map(([label,value,count])=><div className="reason-bar" key={String(label)}><div><span>{label}</span><b>{count}</b></div><div><i style={{width:`${Number(value)*2.8}%`}} /></div><small>{value}%</small></div>)}<button className="evidence-button" onClick={() => openScreen("manager-conversation")}><Headphones size={16} /> Review calls behind these reasons <ArrowRight size={14} /></button></section>
    </div>
    <section className="panel"><PanelHeader title="Stage leak matrix" subtitle="Click any cell to inspect leads, calls, objections, owners, and follow-up days" /><div className="matrix-table"><div className="matrix-row head"><span>Segment</span><span>Received → Connected</span><span>Connected → Qualified</span><span>Qualified → Meeting</span><span>Meeting → Proposal</span><span>Proposal → Converted</span></div>{segments.map((row)=><div className="matrix-row" key={row[0]}>{row.map((cell,index)=><button key={cell} className={index>0&&Number(cell.replace("%",""))<50?"hot-cell":""}>{cell}</button>)}</div>)}</div></section>
  </div>;
}

function UniversalConversationIntelligence({ onOpenAsk }: { onOpenAsk?: () => void }) {
  return <div className="page-stack">
    <PageHeader eyebrow="Ask your CRM" title="Conversation intelligence" description="Ask plain-language questions across calls, transcripts, outcomes, and complete customer journeys.">
      <Button variant="outline" onClick={onOpenAsk}><Search size={14} style={{ marginRight: 4 }} /> Multilingual Ask</Button>
      <Button variant="outline"><Download /> Export findings</Button>
    </PageHeader>
    <section className="conversation-hero panel"><div className="conversation-prompt"><div className="ai-orb large"><Sparkles size={23} /></div><div><span>Ask TRH360 Intelligence (Telugu · Hindi · English)</span><textarea defaultValue="Why did enterprise conversions fall in Hyderabad during the last 15 days?" rows={2} onClick={() => onOpenAsk?.()} /></div><Button className="primary-action" onClick={() => onOpenAsk?.()}><ArrowRight /></Button></div><div className="prompt-suggestions"><button onClick={() => onOpenAsk?.()}>Which agents misclassified Hot leads?</button><button onClick={() => onOpenAsk?.()}>Show pricing objections with evidence</button><button onClick={() => onOpenAsk?.()}>Compare Google vs Meta lead quality</button></div></section>
    <div className="content-grid intelligence-grid"><section className="panel answer-panel"><div className="answer-heading"><Sparkles size={18} /><div><span>Evidence-backed answer</span><small>Analyzed 418 leads · 1,206 calls</small></div></div><h2>Conversion fell after qualification—not because lead quality declined.</h2><p>Qualified-to-meeting conversion decreased from <b>58% to 41%</b>. The strongest contributing pattern was delayed commercial follow-up after leads asked about pricing and implementation.</p><div className="finding-list"><Finding number="01" title="Pricing follow-up was 19 hours slower" text="31 high-intent leads requested pricing or payment details. Only 12 received them in the same working day." evidence="64 call moments" /><Finding number="02" title="Seven Hot leads were marked Warm" text="Transcript language showed explicit timelines and meeting intent, but agents selected a lower temperature." evidence="7 journeys" /><Finding number="03" title="Campaign promise and opening script diverged" text="The campaign promises a guided implementation review. Agents did not acknowledge it in 68% of connected calls." evidence="46 calls" /></div></section><aside className="panel evidence-rail"><PanelHeader title="Source evidence" subtitle="Open any citation" />{[["Call · Lakshmi N.","00:24","Pricing requested"],["Call · Ramesh K.","01:12","Timeline confirmed"],["WhatsApp · Anitha","18h delay","Proposal sent"],["Campaign · Meta ENT-04","Ad","Implementation review"]].map((row)=><button className="citation-card" key={row[0]}><div><FileAudio size={16} /><span><strong>{row[0]}</strong><small>{row[2]}</small></span></div><b>{row[1]}</b></button>)}<div className="confidence-card"><div><span>Answer confidence</span><strong>92%</strong></div><Progress value={92} /><small>Claims with insufficient evidence are clearly marked.</small></div></aside></div>
  </div>;
}

function UniversalDrillDownExplorer({ onOpenInteractive }: { onOpenInteractive?: () => void }) {
  const levels=["Date","Business unit","Product / service","Source","Campaign","Agent","Stage","Reason","Lead"];
  const campaigns = [
    ["Enterprise CRM · Telugu · 04","286","73%","61%","34%","62%","5.2%","Follow-up leak"],
    ["Growth Operations · Decision Makers","194","79%","68%","51%","67%","8.1%","Healthy"],
    ["Product Demo · Retargeting","118","81%","72%","46%","59%","6.7%","Price friction"],
    ["Weekend Enquiry · South","92","64%","57%","29%","48%","3.2%","SLA breach"],
  ];
  return <div className="page-stack"><PageHeader eyebrow="Evidence explorer" title="Nine-level drill-down" description="Move from business outcome to a single lead, call, and timestamp without losing context."><Button variant="outline"><Download /> Export current view</Button>{onOpenInteractive && <Button className="primary-action" onClick={onOpenInteractive}><GitBranch size={14} style={{ marginRight: 4 }} /> Interactive 9-Level Tree</Button>}</PageHeader><section className="panel drill-panel"><div className="drill-path">{levels.map((level,index)=><button className={index<4?"complete":index===4?"active":""} key={level}><span>{index+1}</span>{level}{index<levels.length-1&&<ChevronRight size={13} />}</button>)}</div><div className="drill-title"><div><span>Current level · Campaign</span><h2>Meta South · Enterprise CRM</h2><p>Business unit: Enterprise sales · Service: CRM implementation · 22 Aug–05 Sep</p></div><div><span>Conversion</span><strong>5.8%</strong><small>-2.1 pts vs benchmark</small></div></div><div className="drill-table"><div className="drill-row head"><span>Campaign / ad set</span><span>Leads</span><span>Connect</span><span>Qualified</span><span>Meetings</span><span>Proposals</span><span>Converted</span><span>Signal</span></div>{campaigns.map((row,index)=><button className="drill-row" key={row[0]}>{row.slice(0,7).map((cell)=><span key={cell}>{cell}</span>)}<span><Badge variant="outline" className={index===1?"status-positive":"status-warm"}>{row[7]}</Badge></span></button>)}</div></section><div className="drill-footnote"><ShieldCheck size={16} /><span>Every metric is reversible: click through to exact lead records and conversation evidence.</span></div></div>;
}

function UniversalDiagnosticReview({ notify, onOpenInteractive }: { notify: (message: string) => void; onOpenInteractive?: () => void }) {
  return <div className="page-stack"><PageHeader eyebrow="AI-prepared · Human approved" title="15-day diagnostic memo" description="A decision-ready summary of what changed, why it changed, and what to do next."><Badge variant="outline" className="ai-draft-badge"><Sparkles /> Draft · Not shared</Badge>{onOpenInteractive && <Button className="primary-action" onClick={onOpenInteractive} style={{ marginLeft: 8 }}><Sparkles size={14} style={{ marginRight: 4 }} /> Interactive 15-Day Model</Button>}</PageHeader><div className="memo-layout"><article className="memo-paper"><div className="memo-head"><div><span>TRH360 DIAGNOSTIC</span><h1>Lead Conversion Review</h1><p>22 August–05 September 2026 · Northstar Growth Workspace</p></div><div className="brand-mark">T</div></div><hr /><section><span className="memo-section-no">01</span><h2>Executive conclusion</h2><p>Demand quality remained stable, while conversion weakened at the qualified-to-meeting stage. The decline is operational and recoverable; increasing acquisition spend now would amplify leakage.</p></section><section><span className="memo-section-no">02</span><h2>Material findings</h2><ol><li><b>Commercial follow-up delay:</b> 31 high-intent leads waited a median of 19 hours for pricing or payment information.</li><li><b>Temperature mismatch:</b> Seven calls expressed clear timelines but were recorded as Warm rather than Hot.</li><li><b>Weekend SLA:</b> Sunday leads had a 12m 42s median first-touch time versus 3m 18s on weekdays.</li></ol></section><section><span className="memo-section-no">03</span><h2>Recommended decisions</h2><div className="memo-action"><strong>Within 24 hours</strong><p>Run a recovery queue for 84 leads with resolvable, evidenced objections.</p></div><div className="memo-action"><strong>Within 7 days</strong><p>Add weekend commercial-support coverage and align the opening script to campaign promises.</p></div><div className="memo-action"><strong>Before scaling spend</strong><p>Restore qualified-to-meeting conversion above 52% for seven consecutive days.</p></div></section><footer>Generated from 2,864 lead journeys, 4,912 call attempts, and 1,206 transcripts. Every material claim links to evidence.</footer></article><aside className="memo-review panel"><h2>Review & publish</h2><p>AI can prepare this memo. Only an authorized leader can publish or schedule it.</p><div className="review-check"><Check size={15} /><span>All material claims have evidence</span></div><div className="review-check"><Check size={15} /><span>Personally identifying data is redacted</span></div><div className="review-check"><Check size={15} /><span>Recommendations do not change CRM records</span></div><label>Reviewer note<textarea rows={4} placeholder="Add context before publishing…" /></label><Button variant="outline" className="full-width" onClick={() => notify("Memo downloaded as PDF")}>Download PDF</Button><Button className="primary-action full-width" onClick={() => notify("Diagnostic memo approved and published")}>Approve & publish</Button></aside></div></div>;
}

function UniversalCommercialCase({ notify }: { notify: (message: string) => void }) {
  return <div className="page-stack"><div className="back-row"><button><ChevronLeft size={16} /> Commercial decision queue</button><span>COM-01942</span></div><PageHeader eyebrow="Customer journey · Commercial decision" title="Lakshmi Narayana" description="Enterprise CRM rollout · Solution review 07 Sep, 11:30 AM · Online"><Button variant="outline"><Phone /> Call lead</Button><Button className="primary-action" onClick={() => notify("Commercial outcome saved")}>Save outcome</Button></PageHeader><div className="journey-stepper">{[["Lead","complete"],["Qualified","complete"],["Meeting","complete"],["Commercial","active"],["Contract",""],["Onboarding",""]].map(([label,state],index)=><div className={state} key={label}><span>{state==="complete"?<Check size={13}/>:index+1}</span><b>{label}</b></div>)}</div><div className="financial-grid"><section className="panel"><PanelHeader title="Commercial assessment" subtitle="All decisions remain editable until handoff" /><div className="form-grid"><Field label="Estimated contract value" value="₹3,20,000" /><Field label="Approved budget" value="₹1,20,000" /><Field label="Preferred payment model" value="Annual plan + implementation" /><Field label="Procurement status" value="Security review pending" /><Field label="Payment term discussed" value="Annual · 18-month option" /><Field label="Decision-maker" value="Finance director · Priya" /></div><label className="wide-field">Commercial note<textarea rows={5} defaultValue="Explained plan inclusions and annual payment options. Finance needs the written scope and security note before approval. The lead can proceed within the current quarter." /></label><div className="document-drop"><Upload size={19} /><div><strong>Attach proposal or approval evidence</strong><span>PDF, JPG or PNG · up to 10 MB</span></div><Button variant="outline" size="sm">Browse</Button></div></section><aside className="page-stack tight"><section className="panel"><PanelHeader title="AI preparation" /><div className="ai-insight"><Sparkles size={17} /><p><b>Likely decision-ready.</b> Budget and timeline are explicit; procurement evidence is the remaining dependency.</p></div><KeyValue label="Commercial confidence" value="78%" /><KeyValue label="Missing evidence" value="Finance approval" /><KeyValue label="Next commitment" value="Send scope by 2:00 PM" /></section><section className="panel"><PanelHeader title="Handoff" /><label className="option-card"><input type="radio" name="outcome" defaultChecked /><span><b>Ready for contracting</b><small>Commercial path agreed</small></span></label><label className="option-card"><input type="radio" name="outcome" /><span><b>Follow-up required</b><small>A question or document is pending</small></span></label><label className="option-card"><input type="radio" name="outcome" /><span><b>Not feasible now</b><small>Mandatory reason and evidence</small></span></label></section></aside></div></div>;
}

function UniversalAiSafety({ notify }: { notify: (message: string) => void }) {
  const [controls, setControls] = useState([true,true,true,true,false]);
  const rows = [
    ["Require agent confirmation for structured remarks","AI drafts cannot enter the permanent timeline until a person confirms them."],
    ["Require evidence timestamps for reason classification","Every objection and non-conversion reason must link to a transcript moment."],
    ["Redact identifiers before model processing","Names, phone numbers, and sensitive identifiers are removed from model payloads."],
    ["Detect remark-to-transcript mismatch","Managers receive a review item when a remark contradicts the recording."],
    ["Allow AI to change lead status automatically","Not recommended. This bypasses human accountability and audit controls."],
  ];
  return <div className="page-stack"><PageHeader eyebrow="Admin control centre" title="AI review & safety policy" description="Set the boundaries for transcription, extraction, suggestions, and automated actions."><Button variant="outline"><History /> Version history</Button><Button className="primary-action" onClick={() => notify("AI policy changes published")}>Publish policy</Button></PageHeader><div className="policy-banner"><ShieldCheck size={23} /><div><strong>Human authority is enforced workspace-wide</strong><p>AI may transcribe, extract, classify, summarize, and draft. It cannot send, close, reassign, or change status without confirmation.</p></div><Badge variant="outline" className="status-positive">Protected</Badge></div><div className="settings-grid"><section className="panel"><PanelHeader title="Decision boundaries" subtitle="Applies to human and Voice AI call records" />{rows.map((row,index)=><div className={`policy-row ${index===4?"sensitive":""}`} key={row[0]}><div><strong>{row[0]}</strong><p>{row[1]}</p></div><Switch checked={controls[index]} onCheckedChange={(checked)=>setControls((current)=>current.map((value,idx)=>idx===index?checked:value))} /></div>)}</section><aside className="page-stack tight"><section className="panel"><PanelHeader title="Model processing" /><KeyValue label="Transcription" value="Soniox · speaker labels" /><KeyValue label="Extraction" value="TRH Structured v3" /><KeyValue label="Region" value="India" /><KeyValue label="Retention" value="30 days" /><button className="text-action">Edit model routing</button></section><section className="panel"><PanelHeader title="Review thresholds" /><Signal label="Auto-draft confidence" strength={80} /><Signal label="Manager review below" strength={72} /><Signal label="Mismatch alert above" strength={65} /></section><section className="panel warning-card"><CircleAlert size={18} /><div><strong>1 unpublished risk</strong><p>Voice AI campaign “Renewal Outreach Telugu” uses an older consent message.</p><button>Review campaign</button></div></section></aside></div></div>;
}

function UniversalVoiceOverview({ openScreen }: { openScreen: (id: string) => void }) {
  const campaigns = [["Renewal Outreach Telugu","Live","628 / 1,200",52,"18 handoffs"],["Dormant-lead recovery","Live","318 / 480",66,"41 recovered"],["Proposal document reminder","Paused","204 / 620",33,"8 handoffs"]];
  return <div className="page-stack"><PageHeader eyebrow="Voice automation · Human governed" title="Voice AI overview" description="Bring every AI call into the same lead journey, evidence model, and management view."><Button variant="outline"><Settings /> API setup</Button><Button className="primary-action" onClick={() => openScreen("voice-agent-config")}><Plus /> New voice agent</Button></PageHeader><div className="metric-grid four"><MetricCard label="AI calls today" value="1,248" delta="78.4%" detail="connected" icon={Bot} /><MetricCard label="Qualified by AI" value="286" delta="22.9%" detail="of attempted" icon={Target} /><MetricCard label="Human handoffs" value="94" delta="7.5%" detail="accepted by agents" icon={UsersRound} /><MetricCard label="Review required" value="26" delta="2.1%" detail="low confidence" icon={ShieldCheck} /></div><div className="voice-grid"><section className="panel"><PanelHeader title="Live campaigns" subtitle="Outbound Voice AI activity" action="View all campaigns" onAction={()=>openScreen("voice-campaigns")} />{campaigns.map((row,index)=><div className="campaign-row" key={row[0]}><div className={`campaign-icon ${index===2?"paused":""}`}><Bot size={17} /></div><div><strong>{row[0]}</strong><span>{row[1]} · {row[2]} calls</span></div><div><span>Progress</span><Progress value={Number(row[3])} /></div><b>{row[4]}</b><Button variant="outline" size="sm" onClick={()=>openScreen("voice-call-detail")}>Inspect</Button></div>)}</section><section className="panel integration-health"><PanelHeader title="CRM ingestion health" subtitle="Last event 11 seconds ago" /><div className="ingestion-ring"><div><strong>99.96%</strong><span>accepted</span></div></div><KeyValue label="Calls ingested" value="12,486" /><KeyValue label="Recordings attached" value="12,481" /><KeyValue label="Transcripts parsed" value="12,472" /><KeyValue label="Needs mapping" value="5" /><button onClick={()=>openScreen("voice-api-ingestion")}>Open API monitor <ArrowRight size={14} /></button></section></div><section className="panel"><PanelHeader title="Human + Voice AI performance" subtitle="Same definitions, same evidence, comparable outcomes" /><div className="comparison-table"><div className="compare-row head"><span>Channel</span><span>Attempts</span><span>Connected</span><span>Qualified</span><span>Meetings</span><span>Human handoff</span><span>Cost / qualified</span></div><div className="compare-row"><span><UserRound size={16} /> Human agents</span><span>4,912</span><span>72%</span><span>31%</span><span>16%</span><span>—</span><span>₹184</span></div><div className="compare-row"><span><Bot size={16} /> Voice AI</span><span>8,406</span><span>78%</span><span>23%</span><span>11%</span><span>7.5%</span><span>₹68</span></div></div></section></div>;
}

function UniversalVoiceCallDetail({ notify }: { notify: (message: string) => void }) {
  return <div className="page-stack"><div className="back-row"><button><ChevronLeft size={16} /> Voice AI calls</button><span>VAI-929184</span></div><section className="voice-call-hero"><div className="voice-call-title"><div className="ai-orb large"><Bot size={22} /></div><div><span className="eyebrow">Completed · Today, 11:08 AM</span><h1>Voice AI call with Ramesh Kumar</h1><p>+91 97042 61829 · Telugu · 6m 12s · Renewal Outreach Telugu</p></div></div><div><Badge variant="outline" className="status-positive">Qualified</Badge><Button variant="outline"><Download /> Export</Button></div></section><div className="review-grid"><section className="panel transcript-panel"><PanelHeader title="Recording & transcript" subtitle="Voice agent: Asha · Speaker-labelled" /><AudioPlayer /><div className="transcript-body"><TranscriptLine speaker="Asha · AI" time="00:06" text="Namaste Ramesh garu. You asked about renewing your annual service plan. May I record this call so our team can support you?" /><TranscriptLine speaker="Lead" time="00:18" text="Yes. Our plan expires this month and I need the updated pricing before Friday." evidence /><TranscriptLine speaker="Asha · AI" time="01:04" text="Would a plan comparison help, or would you prefer to speak with a product specialist?" /><TranscriptLine speaker="Lead" time="01:18" text="A competitor sent a quote. I want to compare coverage with your specialist tomorrow." evidence /><TranscriptLine speaker="Asha · AI" time="04:46" text="I can ask a human account coordinator to call today and arrange that review. Is 3:00 PM convenient?" /></div></section><aside className="panel structured-remark"><div className="remark-heading"><div><span className="card-kicker">AI extraction</span><h2>Review before CRM update</h2></div><Badge variant="outline" className="ai-draft-badge">94% confidence</Badge></div><RemarkField number="01" label="Need" value="Renew annual service plan with updated coverage." /><RemarkField number="02" label="Urgency" value="Decision required before Friday." evidence="Lead · 00:18" /><RemarkField number="03" label="Primary objection" value="Competitor quote requires a value comparison." /><RemarkField number="04" label="Handoff commitment" value="Human account coordinator callback today at 3:00 PM." /><div className="extraction-flags"><span><Check size={13} /> Consent captured · 00:18</span><span><Check size={13} /> Phone mapped to existing lead</span><span><Check size={13} /> No conflicting fields detected</span></div><div className="review-actions"><Button variant="outline" onClick={()=>notify("Voice AI call sent to manager review")}>Escalate</Button><Button className="primary-action" onClick={()=>notify("Voice AI extraction accepted into Lead 360")}><Check /> Accept into CRM</Button></div></aside></div></div>;
}

function UniversalGenericDesktopScreen({ screen, openScreen, notify, leads, onLeadCreated, onLeadUpdated }: { screen: CrmScreen; openScreen: (id: string) => void; notify: (message: string) => void; leads: DisplayLead[]; onLeadCreated: (lead: DisplayLead) => void; onLeadUpdated?: () => void }) {
  const iconByKind: Record<string,LucideIcon>={dashboard:LayoutDashboard,list:ListFilter,detail:FileText,form:Plus,analytics:BarChart3,config:Settings,workflow:Workflow,review:ShieldCheck};
  const Icon=iconByKind[screen.kind];
  if(screen.kind==="config") return <UniversalGenericConfig screen={screen} notify={notify}/>;
  if(screen.kind==="analytics") return <UniversalGenericAnalytics screen={screen}/>;
  if(screen.kind==="form"||screen.kind==="workflow") return <UniversalGenericWorkflow screen={screen} notify={notify} openScreen={openScreen} leads={leads} onLeadCreated={onLeadCreated} onLeadUpdated={onLeadUpdated}/>;
  return <div className="page-stack"><PageHeader eyebrow={`${screen.role} · ${screen.module}`} title={screen.title} description={screen.description}><Button variant="outline"><Download /> Export</Button><Button className="primary-action" onClick={()=>notify(`${screen.title} action completed`)}><Plus /> New action</Button></PageHeader>{screen.kind==="dashboard"&&<div className="metric-grid four"><MetricCard label="In scope" value="2,864" delta="+8.2%" detail="current period" icon={Icon}/><MetricCard label="Needs action" value="84" delta="2.9%" detail="of total records" icon={CircleAlert}/><MetricCard label="On track" value="91.4%" delta="+3.1%" detail="vs benchmark" icon={CircleCheck}/><MetricCard label="Evidence coverage" value="96%" delta="Strong" detail="auditable records" icon={ShieldCheck}/></div>}<section className="panel"><PanelHeader title={screen.kind==="detail"?"Complete record":"Prioritized worklist"} subtitle="Context, ownership, and next actions stay visible" />{screen.kind==="detail"?<div className="generic-detail"><div><span className="card-kicker">Record overview</span><h2>One permanent journey</h2><p>This view links source, calls, messages, commitments, status changes, meetings, commercial work, and outcomes into one auditable chain.</p><div className="fact-grid"><KeyValue label="Source" value="Google · Campaign 04"/><KeyValue label="Owner" value="Sravani K."/><KeyValue label="Last meaningful touch" value="Today · 10:42 AM"/><KeyValue label="Next commitment" value="Today · 4:30 PM"/></div></div><div className="generic-activity"><TimelineItem icon={PhoneCall} tone="navy" title="Meaningful call" time="Today · 10:42 AM" meta="Recorded · Transcript ready" body="Intent, objection, and commitment captured." action="Open evidence"/><TimelineItem icon={History} tone="muted" title="Status updated" time="Yesterday · 5:16 PM" meta="Warm → Hot · Sravani K." body="Reason and human author preserved in audit trail." action="View change"/></div></div>:<LeadTable openScreen={openScreen} leads={leads}/>}</section></div>;
}

function UniversalGenericAnalytics({ screen }: { screen: CrmScreen }) {
  const rows=[["Enterprise inbound","486","68%","74%","-6 pts","194 calls"],["Regional acquisition","318","79%","72%","+7 pts","122 calls"],["Annual renewals","284","71%","76%","-5 pts","98 calls"],["Partner referrals","261","82%","78%","+4 pts","106 calls"]];
  return <div className="page-stack"><PageHeader eyebrow={`${screen.role} · Intelligence`} title={screen.title} description={screen.description}><Button variant="outline"><SlidersHorizontal /> Filters</Button><Button className="primary-action"><Download /> Export evidence</Button></PageHeader><div className="metric-grid four"><MetricCard label="Current result" value="76.0%" delta="+4.2%" detail="vs prior period" icon={Target}/><MetricCard label="Records analyzed" value="2,864" delta="100%" detail="source attributed" icon={UsersRound}/><MetricCard label="Exceptions" value="84" delta="-12" detail="since last review" icon={CircleAlert}/><MetricCard label="Evidence coverage" value="96%" delta="Strong" detail="calls and events linked" icon={ShieldCheck}/></div><div className="content-grid analytics-template"><section className="panel"><PanelHeader title="Trend and variance" subtitle="Last 30 days · Daily"/><div className="bar-chart">{[42,55,49,67,58,72,61,78,75,84,70,88,82,92].map((height,index)=><div key={index}><i style={{height:`${height}%`}}/><span>{index%3===0?`${index+1} Sep`:""}</span></div>)}</div></section><section className="panel"><PanelHeader title="Intervention signals" subtitle="Ranked by business impact"/>{[["Delayed second follow-up","31 records",84],["Reason lacks evidence","18 records",62],["Temperature mismatch","9 records",43],["Source promise mismatch","6 records",31]].map((item)=><div className="signal-row" key={String(item[0])}><div><strong>{item[0]}</strong><span>{item[1]}</span></div><Progress value={Number(item[2])}/><button><ChevronRight size={15}/></button></div>)}</section></div><section className="panel"><PanelHeader title="Evidence table" subtitle="Click a row to trace the metric to its underlying records"/><div className="generic-table"><div className="generic-row head"><span>Segment</span><span>Volume</span><span>Rate</span><span>Benchmark</span><span>Variance</span><span>Evidence</span></div>{rows.map((row)=><button className="generic-row" key={row[0]}>{row.map((cell)=><span key={cell}>{cell}</span>)}</button>)}</div></section></div>;
}

function UniversalGenericConfig({ screen, notify }: { screen: CrmScreen; notify: (message: string) => void }) {
  const settings=screen.id.includes("telephony")||screen.id.includes("mobile")?[["Default outbound provider","Exotel · India cluster"],["Automatic call recording","Enabled with consent"],["Phone number masking","Enabled for agents"],["Retry failed uploads","Every 15 minutes"]]:screen.id.includes("webhook")?[["Lead created","https://api.example.com/trh/leads"],["Call completed","https://api.example.com/trh/calls"],["Transcript ready","https://api.example.com/trh/transcript"],["Meeting updated","https://api.example.com/trh/meetings"]]:[["Workspace default","Enabled"],["Manager approval","Required"],["Audit retention","7 years"],["Last published","04 Sep 2026 · Nilesh N."]];
  return <div className="page-stack"><PageHeader eyebrow="Admin control centre" title={screen.title} description={screen.description}><Button variant="outline"><History /> Change log</Button><Button className="primary-action" onClick={()=>notify(`${screen.title} settings published`)}>Publish changes</Button></PageHeader><div className="settings-grid"><section className="panel"><PanelHeader title="Workspace settings" subtitle="Changes are versioned and reversible"/>{settings.map((row,index)=><div className="config-row" key={row[0]}><div><strong>{row[0]}</strong><p>{row[1]}</p></div>{index%2===0?<Switch defaultChecked/>:<Button variant="outline" size="sm">Configure</Button>}</div>)}</section><aside className="page-stack tight"><section className="panel"><PanelHeader title="Control summary"/><KeyValue label="Status" value="Active"/><KeyValue label="Applies to" value="All business units"/><KeyValue label="Owners" value="2 admins"/><KeyValue label="Pending changes" value="3"/></section><section className="panel warning-card"><ShieldCheck size={18}/><div><strong>Safe publishing</strong><p>A validation check runs before any configuration becomes active.</p><button>View safeguards</button></div></section></aside></div></div>;
}

function CreateLeadWorkflow({ openScreen, onLeadCreated, notify }: { openScreen: (id: string) => void; onLeadCreated: (lead: DisplayLead) => void; notify?: (message: string) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("manual");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveLocally = () => {
    const fallbackId = `TRH-${Math.floor(10000 + Math.random() * 90000)}`;
    const fallbackLead: DisplayLead = {
      id: fallbackId,
      apiId: fallbackId,
      name: name.trim(),
      phone: phone.trim(),
      stage: "received",
      qualification: "warm",
      agent: "Sravani K.",
      source: source.trim() || "Manual",
      next: "First call pending",
      last: "Just now",
      createdAt: new Date().toISOString(),
    };
    onLeadCreated(fallbackLead);
    notify?.(`Lead "${name.trim()}" saved locally to device queue.`);
    openScreen("agent-my-leads");
  };

  const saveLead = async () => {
    if (!name.trim()) {
      setError("Enter the lead name before saving.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await api.createLead({
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        sourceId: source.trim(),
        platform: "web",
        origin: "manual",
      }, newIdempotencyKey("lead"));
      onLeadCreated(mapApiLead(result));
      notify?.(`Lead "${result.name ?? "record"}" created and saved.`);
      openScreen("agent-my-leads");
    } catch (error) {
      setError(apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return <div className="page-stack"><PageHeader eyebrow="Telecalling workspace · New record" title="Create lead" description="Add a lead to the shared CRM queue."><Button variant="outline" onClick={() => openScreen("agent-my-leads")}>Cancel</Button><Button className="primary-action" onClick={saveLead} disabled={saving}><Check /> {saving ? "Saving..." : "Save lead"}</Button></PageHeader><div className="workflow-layout"><section className="panel form-panel"><div className="form-section"><span>01</span><div><h2>Lead identity</h2><p>Enter the contact details required for the first follow-up.</p></div></div><div className="form-grid"><label className="field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" /></label><label className="field"><span>Mobile number</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number" /></label><label className="field"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" /></label><label className="field"><span>Source</span><input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Manual, website, campaign" /></label></div>{error && <div style={{ marginTop: 14, padding: "12px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}><span style={{ color: "#991b1b", fontSize: 13, fontWeight: 600 }}>{error}</span><div style={{ display: "flex", gap: 8 }}><Button size="sm" variant="outline" type="button" onClick={saveLead}>Retry server save</Button><Button size="sm" type="button" onClick={saveLocally}>Save locally & proceed</Button></div></div>}</section><aside className="panel workflow-check"><div className="ai-orb"><Sparkles size={18}/></div><h2>Before you save</h2><p>The lead will be saved to the backend and appear in My Leads.</p><div><Check size={14}/><span>Name is required</span></div><div><Check size={14}/><span>Source is preserved</span></div><div><Check size={14}/><span>Audit-ready created timestamp</span></div></aside></div></div>;
}

function ManagerAssignmentBoard({
  openScreen,
  leads = [],
  notify,
  onLeadCreated,
  onLeadUpdated,
}: {
  openScreen: (id: string) => void;
  leads?: DisplayLead[];
  notify: (message: string) => void;
  onLeadCreated: (lead: DisplayLead) => void;
  onLeadUpdated?: () => void;
}) {
  const lakshmiLead = leads.find((l) => l.id === "TRH-24190" || l.name.toLowerCase().includes("lakshmi"));
  const initialLead = lakshmiLead || leads[0] || null;
  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialLead?.id || "TRH-24190");
  const [name, setName] = useState(initialLead ? `${initialLead.name} · ${initialLead.id}` : "Lakshmi · TRH-24190");
  const [phone, setPhone] = useState(initialLead?.phone || "+91 98491 22618");
  const [department, setDepartment] = useState("Enterprise sales");
  const [productService, setProductService] = useState(initialLead?.source || "Enterprise CRM");
  const [status, setStatus] = useState("Follow-up required");
  const [reason, setReason] = useState("Stakeholder confirmation pending");
  const [nextDate, setNextDate] = useState("05 Sep 2026 · 4:30 PM");
  const [owner, setOwner] = useState(initialLead?.agent || "Sravani K.");
  const [note, setNote] = useState(
    "Finance director Priya is the final decision-maker. Confirm her availability and send the written commercial scope before the next call."
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectLead = (id: string) => {
    setSelectedLeadId(id);
    if (id === "new") {
      setName("");
      setPhone("");
      setDepartment("Enterprise sales");
      setProductService("Enterprise CRM");
      setStatus("received");
      setOwner("Sravani K.");
      setReason("New patient registration");
      setNote("");
    } else {
      const match = leads.find((l) => l.id === id);
      if (match) {
        setName(`${match.name} · ${match.id}`);
        setPhone(match.phone || "");
        setDepartment((match as any).department || "Enterprise sales");
        setProductService(match.source || "Enterprise CRM");
        setStatus(match.stage === "received" ? "received" : "Follow-up required");
        setOwner(match.agent || "Sravani K.");
      }
    }
  };

  useEffect(() => {
    if (selectedLeadId && selectedLeadId !== "new") {
      const match = leads.find((l) => l.id === selectedLeadId);
      if (match && (!name || name === "Lakshmi · TRH-24190")) {
        setName(`${match.name} · ${match.id}`);
        setPhone(match.phone || "");
        setDepartment((match as any).department || "Enterprise sales");
        setProductService(match.source || "Enterprise CRM");
        setStatus(match.stage === "received" ? "received" : "Follow-up required");
        setOwner(match.agent || "Sravani K.");
      }
    }
  }, [leads, selectedLeadId]);

  const handleAutoAssign = (mode: "round-robin" | "least-loaded") => {
    const agents = ["Sravani K.", "Anil Kumar", "Divya M.", "Kiran Reddy"];
    if (mode === "least-loaded") {
      const counts: Record<string, number> = {};
      agents.forEach((a) => {
        const firstName = a.split(" ")[0].toLowerCase();
        counts[a] = leads.filter((l) => l.agent.toLowerCase().includes(firstName)).length;
      });
      const sorted = [...agents].sort((a, b) => counts[a] - counts[b]);
      setOwner(sorted[0]);
      notify(`Least-loaded agent selected: ${sorted[0]} (${counts[sorted[0]]} active leads)`);
    } else {
      const currIdx = agents.findIndex((a) => a.toLowerCase().includes(owner.toLowerCase()));
      const nextIdx = (currIdx + 1) % agents.length;
      setOwner(agents[nextIdx]);
      notify(`Round-robin assigned to: ${agents[nextIdx]}`);
    }
  };

  const handleSaveAndContinue = async () => {
    if (!name.trim()) {
      setError("Please enter the patient / lead name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const idMatch = name.match(/TRH-\d+/i)?.[0] || name.match(/[a-f0-9-]{36}/i)?.[0];
      const matchById = idMatch ? leads.find((l) => l.id.toLowerCase() === idMatch.toLowerCase()) : null;

      const cleanDigits = phone.replace(/\D/g, "");
      const matchByPhone = cleanDigits.length >= 7
        ? leads.find((l) => {
            const lDigits = l.phone.replace(/\D/g, "");
            return lDigits.length >= 7 && (lDigits.includes(cleanDigits) || cleanDigits.includes(lDigits));
          })
        : null;

      const targetLead = (selectedLeadId && selectedLeadId !== "new" && leads.find((l) => l.id === selectedLeadId))
        || matchById
        || matchByPhone;

      const cleanName = name.replace(/·?\s*TRH-\d+/i, "").trim() || (targetLead ? targetLead.name : name.trim());
      const cleanOwner = owner.split(" ")[0]; // "Sravani", "Anil", etc.

      if (targetLead) {
        await api.updateLead(targetLead.id, {
          name: cleanName,
          phone: phone.trim(),
          ownerId: cleanOwner,
          department: department.trim(),
          source: productService.trim(),
          status: status === "Follow-up required" ? "contacted" : status,
          qualification: "Hot",
        });
        notify(`Lead "${cleanName}" (${targetLead.id}) successfully updated and assigned to ${owner}!`);
      } else {
        const res = await api.createLead({
          name: cleanName,
          phone: phone.trim() || undefined,
          department: department.trim(),
          sourceId: productService.trim() || "Manual",
          ownerId: cleanOwner,
          platform: "web",
          origin: "manual",
        });
        onLeadCreated(mapApiLead(res));
        notify(`New patient "${cleanName}" registered and assigned to ${owner}!`);
      }

      if (onLeadUpdated) {
        await onLeadUpdated();
      }
      openScreen("agent-my-leads");
    } catch (err: any) {
      setError(err?.message || "Failed to update lead. Check network.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="MANAGER · GUIDED WORKFLOW"
        title="Assignment board"
        description="Guided workflow that preserves context across teams and lifecycle stages."
      >
        <Button variant="outline" onClick={() => openScreen("manager-cockpit")}>
          Cancel
        </Button>
        <Button variant="outline" onClick={() => notify(`Draft saved locally for ${name}`)}>
          Save draft
        </Button>
        <Button className="primary-action" onClick={handleSaveAndContinue} disabled={saving}>
          <Check /> {saving ? "Saving to database..." : "Save & continue"}
        </Button>
      </PageHeader>

      <div className="workflow-layout">
        <section className="panel form-panel">
          <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(11,37,69,0.04)", borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>Choose Patient Record:</span>
            <select
              style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 600, background: "#ffffff" }}
              value={selectedLeadId}
              onChange={(e) => handleSelectLead(e.target.value)}
            >
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {l.id} ({l.phone || "No phone"}) — Assigned: {l.agent}
                </option>
              ))}
              <option value="new">+ Register & Assign New Patient</option>
            </select>
          </div>

          <div className="form-section">
            <span>01</span>
            <div>
              <h2>Identity & context</h2>
              <p>Keep this work connected to the permanent lead record.</p>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Lead / customer</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full patient name" />
            </label>
            <label className="field">
              <span>Mobile number</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
            </label>
            <label className="field">
              <span>Business unit</span>
              <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Enterprise sales, Cardiology, etc." />
            </label>
            <label className="field">
              <span>Product / service</span>
              <input value={productService} onChange={(e) => setProductService(e.target.value)} placeholder="Enterprise CRM, Consultation" />
            </label>
          </div>

          <div className="form-section second">
            <span>02</span>
            <div>
              <h2>Decision & next action</h2>
              <p>A reason and accountable next commitment are mandatory.</p>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Outcome / status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="received">New / Received</option>
                <option value="Follow-up required">Follow-up required</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="appointed">Appointment booked</option>
              </select>
            </label>
            <label className="field">
              <span>Reason</span>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for this decision" />
            </label>
            <label className="field">
              <span>Next action date</span>
              <input value={nextDate} onChange={(e) => setNextDate(e.target.value)} placeholder="Date & time" />
            </label>
            <label className="field">
              <span>Owner</span>
              <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                <option value="Sravani K.">Sravani K. (Telecalling)</option>
                <option value="Anil Kumar">Anil Kumar (Manager Queue)</option>
                <option value="Divya M.">Divya M. (Senior Telecaller)</option>
                <option value="Kiran Reddy">Kiran Reddy (Specialist Intake)</option>
              </select>
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, margin: "14px 0", padding: "10px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>PRD 3 Auto-Assignment:</span>
            <Button size="sm" variant="outline" type="button" onClick={() => handleAutoAssign("round-robin")}>
              ⚡ Round-Robin
            </Button>
            <Button size="sm" variant="outline" type="button" onClick={() => handleAutoAssign("least-loaded")}>
              ⚖️ Least-Loaded
            </Button>
          </div>

          <label className="wide-field">
            <span>Structured note</span>
            <textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Structured manager note..."
            />
          </label>

          {error && <p role="alert" style={{ color: "var(--burgundy)", marginTop: 8, fontWeight: 600 }}>{error}</p>}
        </section>

        <aside className="panel workflow-check">
          <div className="ai-orb"><Sparkles size={18} /></div>
          <h2>Before you save</h2>
          <p>TRH360 checks that the record is complete and evidence-led.</p>
          <div><Check size={14} /><span>Source is preserved</span></div>
          <div><Check size={14} /><span>Reason is selected</span></div>
          <div><Check size={14} /><span>Next commitment has owner and time</span></div>
          <div><Check size={14} /><span>No duplicate message inside 48 hours</span></div>
          <div><Check size={14} /><span>Audit trail will record this change</span></div>
          <hr />
          <small>AI checks completeness. You own the decision.</small>
        </aside>
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <PanelHeader title="Active team leads in central database" subtitle="Select any patient above or inspect below" action="View all leads" onAction={() => openScreen("agent-my-leads")} />
        <LeadTable openScreen={openScreen} leads={leads.slice(0, 6)} />
      </section>
    </div>
  );
}

function UniversalGenericWorkflow({
  screen,
  notify,
  openScreen,
  leads = [],
  onLeadCreated,
  onLeadUpdated,
}: {
  screen: CrmScreen;
  notify: (message: string) => void;
  openScreen: (id: string) => void;
  leads?: DisplayLead[];
  onLeadCreated: (lead: DisplayLead) => void;
  onLeadUpdated?: () => void;
}) {
  if (screen.id === "agent-new-lead") return <CreateLeadWorkflow openScreen={openScreen} onLeadCreated={onLeadCreated} notify={notify} />;
  if (screen.id === "manager-assignment") {
    return <ManagerAssignmentBoard openScreen={openScreen} leads={leads} notify={notify} onLeadCreated={onLeadCreated} onLeadUpdated={onLeadUpdated} />;
  }

  const [leadVal, setLeadVal] = useState("Lakshmi Narayana · TRH-24190");
  const [phoneVal, setPhoneVal] = useState("+91 98491 22618");
  const [unitVal, setUnitVal] = useState("Enterprise sales");
  const [prodVal, setProdVal] = useState("Enterprise CRM");
  const [statusVal, setStatusVal] = useState("Follow-up required");
  const [reasonVal, setReasonVal] = useState("Stakeholder confirmation pending");
  const [ownerVal, setOwnerVal] = useState("Sravani K.");
  const [noteVal, setNoteVal] = useState("Finance director Priya is the final decision-maker. Confirm her availability and send the written commercial scope before the next call.");

  return (
    <div className="page-stack">
      <PageHeader eyebrow={`${screen.role} · Guided workflow`} title={screen.title} description={screen.description}>
        <Button variant="outline" onClick={() => notify("Draft saved")}>Save draft</Button>
        <Button
          className="primary-action"
          onClick={async () => {
            try {
              const cleanDigits = phoneVal.replace(/\D/g, "");
              const idMatch = leadVal.match(/TRH-\d+/i)?.[0];
              const matched = idMatch
                ? leads.find((l) => l.id.toLowerCase() === idMatch.toLowerCase())
                : cleanDigits.length >= 7
                ? leads.find((l) => l.phone.replace(/\D/g, "").includes(cleanDigits))
                : null;
              const cleanName = leadVal.replace(/·?\s*TRH-\d+/i, "").trim() || leadVal.trim();
              const cleanOwner = ownerVal.split(" ")[0];

              if (matched) {
                await api.updateLead(matched.id, {
                  name: cleanName,
                  phone: phoneVal.trim(),
                  ownerId: cleanOwner,
                  department: unitVal.trim(),
                  source: prodVal.trim(),
                  status: statusVal === "Follow-up required" ? "contacted" : statusVal,
                });
                notify(`${screen.title} updated record for ${cleanName}`);
              } else {
                const res = await api.createLead({
                  name: cleanName,
                  phone: phoneVal.trim() || undefined,
                  department: unitVal.trim(),
                  sourceId: prodVal.trim() || "Manual",
                  ownerId: cleanOwner,
                  platform: "web",
                  origin: "manual",
                });
                onLeadCreated(mapApiLead(res));
                notify(`${screen.title} saved new record for ${cleanName}`);
              }
              if (onLeadUpdated) await onLeadUpdated();
              openScreen("agent-my-leads");
            } catch (err: any) {
              notify(`Saved: ${err?.message || "Updated successfully"}`);
              openScreen("agent-my-leads");
            }
          }}
        >
          <Check /> Save & continue
        </Button>
      </PageHeader>
      <div className="workflow-layout">
        <section className="panel form-panel">
          <div className="form-section"><span>01</span><div><h2>Identity & context</h2><p>Keep this work connected to the permanent lead record.</p></div></div>
          <div className="form-grid">
            <label className="field"><span>Lead / customer</span><input value={leadVal} onChange={(e) => setLeadVal(e.target.value)} /></label>
            <label className="field"><span>Mobile number</span><input value={phoneVal} onChange={(e) => setPhoneVal(e.target.value)} /></label>
            <label className="field"><span>Business unit</span><input value={unitVal} onChange={(e) => setUnitVal(e.target.value)} /></label>
            <label className="field"><span>Product / service</span><input value={prodVal} onChange={(e) => setProdVal(e.target.value)} /></label>
          </div>
          <div className="form-section second"><span>02</span><div><h2>Decision & next action</h2><p>A reason and accountable next commitment are mandatory.</p></div></div>
          <div className="form-grid">
            <label className="field"><span>Outcome / status</span><input value={statusVal} onChange={(e) => setStatusVal(e.target.value)} /></label>
            <label className="field"><span>Reason</span><input value={reasonVal} onChange={(e) => setReasonVal(e.target.value)} /></label>
            <label className="field"><span>Owner</span><input value={ownerVal} onChange={(e) => setOwnerVal(e.target.value)} /></label>
          </div>
          <label className="wide-field">Structured note<textarea rows={5} value={noteVal} onChange={(e) => setNoteVal(e.target.value)} /></label>
        </section>
        <aside className="panel workflow-check">
          <div className="ai-orb"><Sparkles size={18} /></div>
          <h2>Before you save</h2>
          <p>TRH360 checks that the record is complete and evidence-led.</p>
          {["Source is preserved", "Reason is selected", "Next commitment has owner and time", "No duplicate message inside 48 hours", "Audit trail will record this change"].map((item) => (
            <div key={item}><Check size={14} /><span>{item}</span></div>
          ))}
          <hr />
          <small>AI checks completeness. You own the decision.</small>
        </aside>
      </div>
    </div>
  );
}

function ManagerCockpit({
  openScreen,
  leads = [],
  onCallLead,
  onReassignLead,
  onOpenAsk,
  onAddAgent,
}: {
  openScreen: (id: string) => void;
  leads?: DisplayLead[];
  onCallLead?: (lead: DisplayLead) => void;
  onReassignLead?: (leadId: string) => void;
  onOpenAsk?: () => void;
  onAddAgent?: () => void;
}) {
  return <div className="page-stack">
    <PageHeader eyebrow={formatIndiaDate()} title="Good morning, Nilesh." description="Your team has 17 priority actions before the next appointment window.">
      <Button variant="outline" onClick={onOpenAsk}><Search size={14} style={{ marginRight: 4 }} /> Ask TRH</Button>
      {onAddAgent && (
        <Button variant="outline" onClick={onAddAgent} style={{ border: "1px solid var(--gold)", color: "var(--navy)", fontWeight: 700 }}>
          <UserPlus size={14} style={{ marginRight: 4 }} /> + Add Telecaller & Issue Slip
        </Button>
      )}
      <Button variant="outline"><Download /> Export brief</Button>
      <Button className="primary-action" onClick={() => openScreen("manager-assignment")}><Plus /> Assign leads</Button>
    </PageHeader>
    <div className="sla-banner" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "default" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => openScreen("manager-sla")}>
        <div className="sla-icon"><AlarmClock size={20} /></div>
        <div>
          <strong>11 leads crossed the 5-minute first-touch SLA</strong>
          <span>Highest exposure: Regional acquisition campaign · 6 leads</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Button
          size="sm"
          variant="outline"
          style={{ borderColor: "rgba(220,38,38,0.4)", color: "var(--burgundy)", background: "#fff", fontWeight: 600 }}
          onClick={() => onReassignLead?.("lead-1")}
          title="PRD 4: At 15 minutes, offer or trigger auto-reassignment"
        >
          <RotateCcw size={13} style={{ marginRight: 4 }} /> Reassign 15m uncalled (4)
        </Button>
        <button className="sla-link" onClick={() => openScreen("manager-sla")}>
          Review now <ArrowRight size={15} />
        </button>
      </div>
    </div>
    <div className="metric-grid four"><MetricCard label="Leads received" value={String(leads.length > 0 ? leads.length : 2864)} delta="+12.4%" detail="in central database" icon={UsersRound} /><MetricCard label="Meaningful connections" value="2,176" delta="76.0%" detail="688 still untouched" icon={PhoneCall} /><MetricCard label="Appointments booked" value="742" delta="+8.1%" detail="469 visits completed" icon={CalendarDays} /><MetricCard label="Conversions" value="218" delta="7.6%" detail="₹1.84 Cr attributed" icon={Target} /></div>
    <div className="content-grid manager-main-grid"><section className="panel funnel-panel"><PanelHeader title="Conversion funnel" subtitle="All business units · Last 30 days" action="Open analysis" onAction={() => openScreen("manager-funnel")} /><div className="compact-funnel">{funnelStages.map((stage, index) => <div className="compact-funnel-row" key={stage.label}><div className="funnel-label"><span>{stage.label}</span><strong>{stage.value.toLocaleString("en-IN")}</strong></div><div className="funnel-track"><span style={{ width: `${Math.max(21, 100 - index * 13)}%` }} /></div>{index > 0 && <small>{stage.rate}% from previous</small>}</div>)}</div><div className="leak-callout"><div><CircleAlert size={18} /><strong>Largest leak</strong></div><p>Qualified → Meeting loses <b>650 leads</b>. Pricing concern and stakeholder approval account for 61% of evidenced objections.</p><button onClick={() => openScreen("owner-drill-down")}>Trace the evidence <ArrowRight size={14} /></button></div></section>
      <section className="panel ai-brief-panel"><div className="ai-brief-heading"><div className="ai-orb"><Sparkles size={19} /></div><div><span>TRH360 Intelligence</span><h2>What needs attention?</h2></div></div><p className="ai-brief-text">Warm enterprise leads from Hyderabad are waiting <b>2.4× longer</b> for a second call than other cohorts. 18 are still recoverable today.</p><div className="evidence-list"><div><span>18</span><p><strong>Recoverable now</strong>Pricing interest and decision timelines are already recorded.</p></div><div><span>09</span><p><strong>Possible misclassification</strong>Transcript indicates stronger intent than agent status.</p></div><div><span>06</span><p><strong>Campaign mismatch</strong>Ad promise does not match the opening script.</p></div></div><div className="ask-box" onClick={() => onOpenAsk?.()} style={{ cursor: "pointer" }}><Input aria-label="Ask TRH360" placeholder="Ask why conversions fell this week (Telugu · Hindi · English)…" readOnly onClick={() => onOpenAsk?.()} /><Button size="icon" className="primary-action" onClick={() => onOpenAsk?.()}><ArrowRight /></Button></div><small>Every answer links back to calls, timestamps, and CRM events.</small></section></div>
    <section className="panel"><PanelHeader title="Agent operating health" subtitle="Sorted by intervention required" action="View scorecards" onAction={() => openScreen("manager-agent-scorecard")} /><div className="data-table compact"><div className="table-row table-head"><span>Agent</span><span>Assigned</span><span>First touch</span><span>Meaningful calls</span><span>Follow-up</span><span>Conversion</span><span>Manager action</span></div>{[["Sravani K.","82","3m 12s","71%","94%","10.8%","Coach opening"],["Anil Kumar","78","6m 48s","66%","79%","8.2%","SLA review"],["Divya M.","74","2m 41s","76%","91%","11.4%","No action"],["Kiran Reddy","69","9m 16s","52%","68%","5.9%","Intervene"]].map((row, index) => <div className="table-row" key={row[0]}><span className="person-cell"><span className="mini-avatar">{row[0].split(" ").map((part) => part[0]).join("").slice(0,2)}</span><b>{row[0]}</b></span>{row.slice(1,6).map((cell) => <span key={cell}>{cell}</span>)}<span><button className={index === 3 ? "text-action urgent" : "text-action"}>{row[6]}</button></span></div>)}</div></section>
    <section className="panel"><PanelHeader title="Team live leads queue" subtitle="All leads in central database across agents" action="Open all leads" onAction={() => openScreen("agent-my-leads")} /><LeadTable openScreen={openScreen} leads={leads.slice(0, 6)} onCallLead={onCallLead} /></section>
  </div>;
}

function AgentTasks({ leads }: { leads: DisplayLead[]; notify?: (message: string) => void }) {
  return <div className="page-stack"><PageHeader eyebrow={`Telecalling workspace · ${formatIndiaDate()}`} title="Daily tasks" description="Task actions appear here when the authenticated task queue is available." /><section className="panel"><PanelHeader title="My task queue" subtitle="No task list contract is available for this workspace." /><p>{leads.length ? "Select a lead and save its next commitment from a structured call remark." : "No accessible leads are available."}</p></section></div>;
}

function AgentCalendar({ leads }: { leads: DisplayLead[]; notify?: (message: string) => void }) {
  return <div className="page-stack"><PageHeader eyebrow="Telecalling workspace" title="Appointments" description="Appointments are shown after a permitted schedule query is available." /><section className="panel"><PanelHeader title="Upcoming appointments" subtitle="No appointment list contract is available for this workspace." /><p>{leads.length ? "Choose an accessible lead before booking an appointment." : "No accessible leads are available."}</p></section></div>;
}

function AgentRecovery({ leads, openScreen }: { leads: DisplayLead[]; openScreen: (id: string) => void }) {
  const recoveryLeads = leads.filter((lead) => lead.next === "No next commitment");
  return <div className="page-stack"><PageHeader eyebrow="Telecalling workspace · Recovery" title="Recovery queue" description="Records without a next commitment need review." /><section className="panel"><PanelHeader title="Needs review" subtitle="From authenticated lead summaries" />{recoveryLeads.length ? recoveryLeads.map((lead) => <button className="simple-call-row" key={lead.id} onClick={() => openScreen("agent-lead-360")}><span className="queue-order"><CircleAlert size={16} /></span><div><strong>{lead.name}</strong><small>{lead.source}</small></div><span className="danger-text">{lead.next}</span></button>) : <p>No accessible records need a new commitment.</p>}</section></div>;
}

function AgentPerformance({ leads }: { leads: DisplayLead[] }) {
  return <div className="page-stack"><PageHeader eyebrow={`Agent workspace · ${formatIndiaDate()}`} title="My performance" description="Performance metrics are available from authorized reporting endpoints." /><section className="panel"><PanelHeader title="Accessible lead scope" subtitle="Current authenticated data" /><p>{leads.length} lead summaries currently available.</p></section></div>;
}

function AgentFollowUp({ leads, notify }: { leads: DisplayLead[]; notify: (message: string) => void }) {
  const lead = leads[0];
  return <div className="page-stack"><PageHeader eyebrow="Telecalling workspace · Follow-up" title="Complete follow-up" description="Use the structured call remark to save a next commitment." ><Button className="primary-action" disabled={!lead} onClick={() => notify("Open the selected lead's call review to save its structured remark.")}><Check /> Open call review</Button></PageHeader><section className="panel form-panel"><div className="form-grid"><Field label="Lead" value={lead?.name ?? "No lead selected"} /><Field label="Owner" value={lead?.agent ?? "Unassigned"} /></div></section></div>;
}

function AgentBookAppointment({ leads, notify }: { leads: DisplayLead[]; notify: (message: string) => void }) {
  const lead = leads[0];
  return <div className="page-stack"><PageHeader eyebrow="Telecalling workspace · Booking" title="Book appointment" description="Booking needs a server-provided doctor, branch, and available slot." ><Button className="primary-action" disabled={!lead} onClick={() => notify("Select a server-provided doctor and availability before booking.")}><CalendarDays /> Review availability</Button></PageHeader><section className="panel form-panel"><Field label="Lead" value={lead?.name ?? "No lead selected"} /></section></div>;
}


function MetricCard({ label, value, delta, detail, icon: Icon }: { label: string; value: string; delta: string; detail: string; icon: LucideIcon }) { return <article className="metric-card"><div className="metric-top"><span>{label}</span><div className="metric-icon"><Icon size={17} /></div></div><strong className="metric-value">{value}</strong><div className="metric-bottom"><b>{delta}</b><span>{detail}</span></div></article>; }
function PanelHeader({ title, subtitle, action, onAction }: { title: string; subtitle?: string; action?: string; onAction?: () => void }) { return <div className="panel-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action && <button onClick={onAction}>{action} <ChevronRight size={15} /></button>}</div>; }
function Field({ label, value }: { label: string; value: string }) { return <label className="field"><span>{label}</span><input defaultValue={value} /></label>; }
function Finding({ number, title, text, evidence }: { number: string; title: string; text: string; evidence: string }) { return <div className="finding"><span>{number}</span><div><strong>{title}</strong><p>{text}</p><button>{evidence} <ChevronRight size={13} /></button></div></div>; }
function Decision({ priority, title, detail }: { priority: string; title: string; detail: string }) { return <div className="decision"><span>{priority}</span><div><strong>{title}</strong><p>{detail}</p></div></div>; }

function MyLeads({ openScreen, leads, onCallLead, onEditLead }: { openScreen: (id: string) => void; leads: DisplayLead[]; onCallLead?: (lead: DisplayLead) => void; onEditLead?: (lead: DisplayLead) => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "qualified" | "contacted">("all");
  const visibleLeads = leads.filter((lead) => {
    const haystack = `${lead.name} ${lead.phone} ${lead.source} ${lead.agent}`.toLowerCase();
    const matchesSearch = haystack.includes(search.trim().toLowerCase());
    const matchesFilter = filter === "all" || (filter === "new" && lead.stage === "received") || (filter === "qualified" && lead.qualification === "hot") || (filter === "contacted" && lead.stage !== "received");
    return matchesSearch && matchesFilter;
  });

  return <div className="page-stack"><PageHeader eyebrow="Telecalling workspace" title="My leads" description="A prioritized queue based on intent, SLA risk, and next commitment."><Button variant="outline"><Upload /> Import</Button><Button className="primary-action" onClick={() => openScreen("agent-new-lead")}><Plus /> Create lead</Button></PageHeader><div className="summary-strip">{[["Assigned today",String(leads.length)],["Call now",String(leads.filter((lead) => lead.next === "Call now").length)],["Follow-ups due","0"],["Appointments","0"],["SLA at risk","0"]].map(([label,value],index) => <div key={label} className={index===4?"danger":""}><span>{label}</span><strong>{value}</strong></div>)}</div><section className="panel leads-panel"><div className="filter-toolbar"><div className="table-tabs"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All leads <span>{leads.length}</span></button><button className={filter === "new" ? "active" : ""} onClick={() => setFilter("new")}>Uncontacted <span>{leads.filter((lead) => lead.stage === "received").length}</span></button></div><div className="toolbar-actions"><div className="mini-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or mobile" /></div><select aria-label="Filter leads" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">All statuses</option><option value="new">New</option><option value="qualified">Hot / qualified</option><option value="contacted">Contacted</option></select><Button variant="outline" size="sm" onClick={() => { setSearch(""); setFilter("all"); }}><RotateCcw /> Reset</Button></div></div><LeadTable openScreen={openScreen} leads={visibleLeads} onCallLead={onCallLead} onEditLead={onEditLead} /></section></div>;
}

function LeadTable({ openScreen, leads = [], onCallLead, onEditLead }: { openScreen: (id: string) => void; leads?: DisplayLead[]; onCallLead?: (lead: DisplayLead) => void; onEditLead?: (lead: DisplayLead) => void }) {
  return (
    <div className="lead-table">
      <div className="lead-row lead-head">
        <span>Lead</span>
        <span>Need & source</span>
        <span>Intent</span>
        <span>Last touch</span>
        <span>Next commitment</span>
        <span>Owner</span>
        <span />
      </div>
      {leads.map((lead) => {
        const qual = lead.qualification?.toLowerCase() || "warm";
        const qualKey = qual === "hot" ? "Hot" : qual === "cold" ? "Cold" : qual === "warm" ? "Warm" : "Unknown";
        const qualBadge = qual.charAt(0).toUpperCase() + qual.slice(1);
        return (
          <div className="lead-row" key={lead.id} onClick={() => openScreen("agent-lead-360")}>
            <span className="lead-identity">
              <span className="mini-avatar">{lead.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
              <span><b>{lead.name}</b><small>{lead.id}</small></span>
            </span>
            <span><b>{lead.stage}</b><small>{lead.source}</small></span>
            <span>
              <Badge variant="outline" className={temperatureClass[qualKey] || "status-neutral"}>{qualBadge}</Badge>
              <small>Server classification</small>
            </span>
            <span><b>{lead.last}</b><small>Timeline active</small></span>
            <span>
              <b className={lead.next === "No next commitment" ? "danger-text" : ""}>{lead.next}</b>
              <small>{lead.next === "No next commitment" ? "Needs explicit commitment" : "Committed follow-up"}</small>
            </span>
            <span className="owner-cell">
              <span className="mini-avatar pale">{(lead.agent || "Un").slice(0, 2).toUpperCase()}</span>
              <b>{lead.agent}</b>
            </span>
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {onEditLead && (
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label={`Edit ${lead.name}`}
                  title="Edit patient details"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditLead(lead);
                  }}
                >
                  <Edit3 size={13} />
                </Button>
              )}
              <Button
                size="icon-sm"
                className="call-action"
                aria-label={`Call ${lead.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  if (onCallLead) {
                    onCallLead(lead);
                  } else {
                    openScreen("mobile-active-call");
                  }
                }}
              >
                <Phone size={15} />
              </Button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Lead360({
  openScreen,
  leads = [],
  onCallLead,
  onCloseLead,
  onOpenWhatsApp,
  onScoreLead,
  onOpenCadence,
  onEditLead,
}: {
  openScreen: (id: string) => void;
  leads?: DisplayLead[];
  onCallLead?: (lead: DisplayLead) => void;
  onCloseLead?: (lead: DisplayLead) => void;
  onOpenWhatsApp?: (lead: DisplayLead) => void;
  onScoreLead?: (lead: DisplayLead) => void;
  onOpenCadence?: (lead: DisplayLead) => void;
  onEditLead?: (lead: DisplayLead) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const effectiveLeads = leads.length > 0 ? leads : initialSampleLeads;
  const currentLead = effectiveLeads[Math.min(currentIndex, effectiveLeads.length - 1)] || effectiveLeads[0];

  return <div className="page-stack">
    <div className="back-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => openScreen("agent-my-day")} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <ChevronLeft size={16} /> My day
        </button>
        <button onClick={() => openScreen("agent-my-leads")} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          All leads
        </button>
        <span style={{ fontWeight: 600, color: "var(--navy)" }}>{currentLead.id}</span>
      </div>

      {/* Patient Switcher Carousel Navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#ffffff", borderRadius: 8, border: "1px solid var(--border)", padding: "3px 8px" }}>
        <Button
          variant="outline"
          size="sm"
          disabled={currentIndex <= 0}
          onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          style={{ height: 26, padding: "0 8px", fontSize: 11 }}
        >
          <ChevronLeft size={13} /> Prev
        </Button>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "0 6px", color: "var(--navy)" }}>
          Lead {currentIndex + 1} of {effectiveLeads.length}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={currentIndex >= effectiveLeads.length - 1}
          onClick={() => setCurrentIndex((prev) => Math.min(effectiveLeads.length - 1, prev + 1))}
          style={{ height: 26, padding: "0 8px", fontSize: 11 }}
        >
          Next <ChevronRight size={13} />
        </Button>
      </div>
    </div>
    <section className="lead-hero">
      <div className="lead-hero-person">
        <div className="large-avatar">{currentLead.name.split(" ").map(p=>p[0]).join("").slice(0,2)}</div>
        <div>
          <div className="lead-title-row">
            <h1>{currentLead.name}</h1>
            <Badge variant="outline" className="status-hot">{currentLead.qualification === "hot" ? "Hot" : currentLead.qualification === "warm" ? "Warm" : currentLead.qualification === "cold" ? "Cold" : "Lead"} · 86</Badge>
          </div>
          <p><Phone size={14} /> {currentLead.phone} <span /> {currentLead.source}</p>
        </div>
      </div>
      <div className="lead-hero-actions">
        {onEditLead && (
          <Button
            variant="outline"
            onClick={() => onEditLead(currentLead)}
            style={{ border: "1px solid var(--gold)", color: "var(--navy)", fontWeight: 700 }}
            title="Edit patient details, health condition, and symptoms"
          >
            <Edit3 size={14} style={{ marginRight: 4 }} /> Edit Patient Details
          </Button>
        )}
        <Button variant="outline" onClick={() => onScoreLead?.(currentLead)} title="Thesis Section 7: 11-Factor Objective Scoring">
          <Target size={14} style={{ marginRight: 4 }} /> 11-Pt Score
        </Button>
        <Button variant="outline" onClick={() => onOpenCadence?.(currentLead)} title="Thesis Section 8: 48h Alternating Journey">
          <RotateCcw size={14} style={{ marginRight: 4 }} /> 48h Cadence
        </Button>
        <Button variant="outline" onClick={() => onOpenWhatsApp?.(currentLead)}>
          <MessageSquare size={14} style={{ marginRight: 4 }} /> WhatsApp & Inbound
        </Button>
        <Button className="primary-action" onClick={() => onCallLead ? onCallLead(currentLead) : openScreen("mobile-active-call")}>
          <PhoneCall size={14} style={{ marginRight: 4 }} /> Call now
        </Button>
        <Button variant="outline" style={{ borderColor: "rgba(220,38,38,0.4)", color: "#dc2626" }} onClick={() => onCloseLead?.(currentLead)} title="PRD 15: Lead Closure Governance">
          <ShieldAlert size={14} style={{ marginRight: 4 }} /> Close / Mark Lost
        </Button>
        <Button size="icon" variant="outline"><MoreHorizontal /></Button>
      </div>
    </section>
    <div className="record-tabs"><button className="active">Overview</button><button>Conversations <span>8</span></button><button>Appointments <span>2</span></button><button>Commercial</button><button>Documents</button><button>Audit trail</button></div>
    <div className="lead-detail-grid"><div className="page-stack tight"><section className="panel ai-summary-card"><div className="ai-summary-title"><Sparkles size={18} /><strong>AI journey summary</strong><span>Checked 18 min ago</span></div><p>Lakshmi wants an enterprise CRM rollout before the festive sales cycle. Finance director Priya is the final approver. Implementation price is the main concern; the annual payment plan was explained and a solution review was accepted for Saturday.</p><div className="summary-evidence"><span><Check size={13} /> Based on 4 calls</span><span><Check size={13} /> 3 WhatsApp replies</span><button>View evidence</button></div></section><section className="panel"><PanelHeader title="Journey timeline" subtitle="Every attempt, conversation, commitment, and handoff" /><div className="timeline"><TimelineItem icon={PhoneCall} tone="navy" title="Meaningful outbound call" time="Today · 10:42 AM · 4m 38s" meta="Sravani K. · Recorded" body="Lead confirmed interest. Finance director will join Saturday’s review. Annual pricing details requested on WhatsApp." action="Play call & transcript" /><TimelineItem icon={MessageSquare} tone="gold" title="WhatsApp delivered" time="Today · 10:49 AM" meta="Purpose: Commercial clarity" body="Pricing explainer, case study, and meeting link shared. The lead opened all three." action="View message" /><TimelineItem icon={CalendarDays} tone="green" title="Meeting booked" time="Yesterday · 5:14 PM" meta="Maya Rao · Solution consulting" body="07 September, 11:30 AM · Online product review." action="View meeting" /><TimelineItem icon={History} tone="muted" title="Lead received from Google" time="03 September · 9:12 AM" meta="Campaign: Enterprise CRM Telugu · Ad group 04" body="First-touch response completed in 2m 14s." action="View attribution" /></div></section></div>
      <aside className="lead-facts page-stack tight"><section className="panel next-action-card"><span className="card-kicker">Next commitment</span><h3>Confirm finance director availability</h3><p>Today at 4:30 PM</p><div className="countdown"><Clock3 size={15} /> Due in 2h 18m</div><Button className="primary-action full-width" onClick={() => openScreen("agent-follow-up")}>Complete follow-up</Button></section><section className="panel fact-card"><PanelHeader title="Lead facts" action="Edit" /><KeyValue label="Requirement" value="Enterprise CRM rollout" /><KeyValue label="Business unit" value="Enterprise sales" /><KeyValue label="Source" value="Google · CRM Telugu" /><KeyValue label="Commercial model" value="Annual payment plan" /><KeyValue label="Decision-maker" value="Finance director · Priya" /><KeyValue label="Assigned to" value="Sravani K." /></section><section className="panel fact-card"><PanelHeader title="Conversion signals" /><Signal label="Meeting accepted" strength={92} /><Signal label="Commercial clarity" strength={62} /><Signal label="Stakeholder alignment" strength={54} /><Signal label="Implementation urgency" strength={81} /></section></aside>
      <aside className="lead-facts page-stack tight"><section className="panel next-action-card"><span className="card-kicker">Next commitment</span><h3>Confirm finance director availability</h3><p>Today at 4:30 PM</p><div className="countdown"><Clock3 size={15} /> Due in 2h 18m</div><Button className="primary-action full-width" onClick={() => openScreen("agent-follow-up")}>Complete follow-up</Button></section><section className="panel fact-card"><PanelHeader title="Lead facts" action="Edit" onAction={() => onEditLead?.(currentLead)} /><KeyValue label="Requirement" value="Enterprise CRM rollout" /><KeyValue label="Business unit" value="Enterprise sales" /><KeyValue label="Source" value="Google · CRM Telugu" /><KeyValue label="Commercial model" value="Annual payment plan" /><KeyValue label="Decision-maker" value="Finance director · Priya" /><KeyValue label="Assigned to" value="Sravani K." /></section><section className="panel fact-card"><PanelHeader title="Conversion signals" /><Signal label="Meeting accepted" strength={92} /><Signal label="Commercial clarity" strength={62} /><Signal label="Stakeholder alignment" strength={54} /><Signal label="Implementation urgency" strength={81} /></section></aside>
    </div>
  </div>;
}

function TimelineItem({ icon: Icon, tone, title, time, meta, body, action }: { icon: LucideIcon; tone: string; title: string; time: string; meta: string; body: string; action: string }) { return <div className="timeline-item"><div className={`timeline-icon ${tone}`}><Icon size={16} /></div><div><div className="timeline-title"><strong>{title}</strong><span>{time}</span></div><small>{meta}</small><p>{body}</p><button>{action} <ChevronRight size={14} /></button></div></div>; }
function KeyValue({ label, value }: { label: string; value: string }) { return <div className="key-value"><span>{label}</span><b>{value}</b></div>; }
function Signal({ label, strength }: { label: string; strength: number }) { return <div className="signal"><div><span>{label}</span><b>{strength}%</b></div><Progress value={strength} /></div>; }

function PostCallReview({ notify, openScreen }: { notify: (message: string) => void; openScreen: (id: string) => void }) {
  const [temperature, setTemperature] = useState("Hot");
  return <div className="page-stack"><PageHeader eyebrow="Call ended · 4m 38s" title="Review before saving" description="TRH360 drafted this record from the transcript. Nothing changes until you confirm it."><Badge variant="outline" className="ai-draft-badge"><Sparkles /> AI draft · 91% confidence</Badge></PageHeader><div className="review-grid"><section className="panel transcript-panel"><PanelHeader title="Recording & transcript" subtitle="Lakshmi Narayana · Outbound · Today, 10:42 AM" action="Full screen" /><AudioPlayer /><div className="transcript-search"><Search size={15} /><input placeholder="Search transcript" /><button><Download size={15} /> Export</button></div><div className="transcript-body"><TranscriptLine speaker="Sravani" time="00:12" text="Namaste, Lakshmi garu. You had asked about the enterprise CRM rollout. Is now a good time?" /><TranscriptLine speaker="Lead" time="00:24" text="Yes. We want this ready before the festive sales cycle, but I first need clarity on the total implementation cost." evidence /><TranscriptLine speaker="Sravani" time="01:17" text="We can arrange a solution review with Maya. There is an annual payment plan too. Who else should join the decision?" /><TranscriptLine speaker="Lead" time="01:42" text="Our finance director Priya approves it. Saturday morning works if she can join. Send the pricing information first." evidence /><TranscriptLine speaker="Sravani" time="03:51" text="I have booked 11:30 AM on Saturday. I will call today at 4:30 PM to confirm Priya's availability." /></div></section><section className="panel structured-remark"><div className="remark-heading"><div><span className="card-kicker">Seven-part structured remark</span><h2>Human confirmation required</h2></div><ShieldCheck size={21} /></div><RemarkField number="01" label="Lead requirement" value="Enterprise CRM rollout before the festive sales cycle." /><RemarkField number="02" label="Intent & urgency" value="High intent. Time-bound need within the next 4–6 weeks." /><RemarkField number="03" label="Decision-maker" value="Finance director, Priya. Must join the review and approve spend." /><RemarkField number="04" label="Primary objection" value="Implementation cost and annual payment terms." evidence="Lead · 00:24" /><RemarkField number="05" label="Information given" value="Specialist availability, Saturday slot, and annual payment plan." /><RemarkField number="06" label="Commitment obtained" value="Solution review accepted for 07 Sep, 11:30 AM." evidence="Lead · 01:42" /><RemarkField number="07" label="Next action" value="Call today at 4:30 PM to confirm finance director availability." /><div className="temperature-confirm"><div><span>Lead temperature</span><small>AI suggests Hot from urgency + meeting acceptance.</small></div><div className="segmented mini">{["Hot","Warm","Cold"].map((item) => <button key={item} className={temperature===item?"active":""} onClick={() => setTemperature(item)}>{item}</button>)}</div></div><div className="review-actions"><Button variant="outline" onClick={() => notify("Draft kept for later review")}>Save draft</Button><Button className="primary-action" onClick={() => { notify("Call record confirmed and saved"); openScreen("agent-lead-360"); }}><Check /> Confirm & save</Button></div></section></div></div>;
}

function AudioPlayer() { return <div className="audio-player"><button><Play size={16} fill="currentColor" /></button><span>00:00</span><div className="waveform">{Array.from({length:55},(_,index)=><i key={index} style={{height:`${7+((index*13)%22)}px`}} />)}</div><span>04:38</span><button className="rate">1×</button></div>; }
function TranscriptLine({ speaker, time, text, evidence }: { speaker: string; time: string; text: string; evidence?: boolean }) { return <div className="transcript-line"><div className={`speaker-dot ${speaker === "Lead" ? "patient" : ""}`}>{speaker.slice(0,1)}</div><div><div className="speaker-meta"><strong>{speaker}</strong><button>{time}</button>{evidence && <Badge variant="outline">Evidence</Badge>}</div><p>{text}</p></div></div>; }
function RemarkField({ number, label, value, evidence }: { number: string; label: string; value: string; evidence?: string }) { return <div className="remark-field"><span>{number}</span><div><label>{label}</label><textarea defaultValue={value} rows={2} />{evidence && <button><Play size={11} /> {evidence}</button>}</div></div>; }

function FunnelDashboard({ openScreen }: { openScreen: (id: string) => void }) { return <div className="page-stack"><PageHeader eyebrow="Conversion intelligence" title="Where is the funnel leaking?" description="Trace every loss from source to final conversion, then inspect the evidence."><Button variant="outline"><Download /> Export analysis</Button><Button className="primary-action" onClick={() => openScreen("owner-drill-down")}><GitBranch /> Open drill-down</Button></PageHeader><div className="filter-ribbon"><button>Last 30 days <ChevronDown size={14} /></button><button>All branches <ChevronDown size={14} /></button><button>All departments <ChevronDown size={14} /></button><button>All sources <ChevronDown size={14} /></button><span>Updated 4 min ago</span></div><div className="funnel-page-grid"><section className="panel full-funnel-panel"><PanelHeader title="Lifecycle funnel" subtitle="2,864 sourced leads · 218 conversions" /><div className="full-funnel">{funnelStages.map((stage,index)=><div className="full-funnel-stage" key={stage.label}><div><span>{stage.label}</span><strong>{stage.value.toLocaleString("en-IN")}</strong><small>{index===0?"All sourced leads":`${stage.rate}% stage conversion`}</small></div>{index<funnelStages.length-1&&<span className="drop-marker"><ArrowDown size={13} /> {Math.round((1-funnelStages[index+1].value/stage.value)*100)}% drop</span>}</div>)}</div></section><section className="panel leak-reasons"><PanelHeader title="Why qualified leads do not book" subtitle="650 lost at this stage" />{[["Financial concern",31,"201 leads"],["Family confirmation",23,"149 leads"],["Unable to reach again",18,"117 leads"],["Doctor preference",12,"78 leads"],["Location / travel",9,"59 leads"],["No valid reason",7,"46 leads"]].map(([label,value,count])=><div className="reason-bar" key={label}><div><span>{label}</span><b>{count}</b></div><div><i style={{width:`${Number(value)*2.8}%`}} /></div><small>{value}%</small></div>)}<button className="evidence-button" onClick={() => openScreen("manager-conversation")}><Headphones size={16} /> Review calls behind these reasons <ArrowRight size={14} /></button></section></div><section className="panel"><PanelHeader title="Stage leak matrix" subtitle="Click any cell to inspect leads, calls, objections, and owners" /><div className="matrix-table"><div className="matrix-row head"><span>Segment</span><span>Received → Connected</span><span>Connected → Qualified</span><span>Qualified → Appt.</span><span>Appt. → Visit</span><span>Visit → Convert</span></div>{[["Orthopaedics","18%","29%","51%","31%","48%"],["Cardiology","21%","32%","42%","34%","39%"],["IVF","16%","24%","38%","29%","35%"],["General surgery","27%","36%","47%","41%","52%"]].map((row)=><div className="matrix-row" key={row[0]}>{row.map((cell,index)=><button key={cell} className={index>0&&Number(cell.replace("%",""))>40?"hot-cell":""}>{cell}</button>)}</div>)}</div></section></div>; }

function ConversationIntelligence({ onOpenAsk }: { onOpenAsk?: () => void }) { return <div className="page-stack"><PageHeader eyebrow="Ask your CRM" title="Conversation intelligence" description="Ask plain-language questions across calls, transcripts, outcomes, and patient journeys."><Button variant="outline" onClick={onOpenAsk}><Search size={14} style={{ marginRight: 4 }} /> Multilingual Ask</Button><Button variant="outline"><Download /> Export findings</Button></PageHeader><section className="conversation-hero panel"><div className="conversation-prompt"><div className="ai-orb large"><Sparkles size={23} /></div><div><span>Ask TRH360 Intelligence</span><textarea defaultValue="Why did orthopaedic conversions fall in Warangal during the last 15 days?" rows={2} onClick={() => onOpenAsk?.()} /></div><Button className="primary-action" onClick={() => onOpenAsk?.()}><ArrowRight /></Button></div><div className="prompt-suggestions"><button onClick={() => onOpenAsk?.()}>Which agents misclassified Hot leads?</button><button onClick={() => onOpenAsk?.()}>Show price objections with evidence</button><button onClick={() => onOpenAsk?.()}>Compare Google vs Meta lead quality</button></div></section><div className="content-grid intelligence-grid"><section className="panel answer-panel"><div className="answer-heading"><Sparkles size={18} /><div><span>Evidence-backed answer</span><small>Analyzed 418 leads · 1,206 calls</small></div></div><h2>Conversion fell mainly after qualification—not because lead quality declined.</h2><p>Qualified-to-appointment conversion decreased from <b>58% to 41%</b>. The strongest contributing pattern was delayed financial follow-up after patients asked about surgery cost.</p><div className="finding-list"><Finding number="01" title="Financial follow-up was 19 hours slower" text="31 high-intent patients asked for cost or EMI details. Only 12 received information in the same working day." evidence="64 call moments" /><Finding number="02" title="Seven Hot leads were marked Warm" text="Transcript language showed explicit timelines and appointment intent, but agents selected a lower temperature." evidence="7 journeys" /><Finding number="03" title="Meta promise and call script diverged" text="The ad mentions a free second opinion. Agents did not acknowledge it in 68% of connected calls." evidence="46 calls" /></div></section><aside className="panel evidence-rail"><PanelHeader title="Source evidence" subtitle="Open any citation" />{[["Call · Lakshmi N.","00:24","Cost before Dasara"],["Call · Ramesh K.","01:12","EMI requested"],["WhatsApp · Anitha","18h delay","Brochure sent"],["Campaign · Meta OR-04","Ad","Free second opinion"]].map((row)=><button className="citation-card" key={row[0]}><div><FileAudio size={16} /><span><strong>{row[0]}</strong><small>{row[2]}</small></span></div><b>{row[1]}</b></button>)}<div className="confidence-card"><div><span>Answer confidence</span><strong>92%</strong></div><Progress value={92} /><small>Claims with insufficient evidence are clearly marked.</small></div></aside></div></div>; }

function FounderDashboard({
  openScreen,
  leads = [],
  notify,
  onOpenAsk,
  onOpenDiagnostic15d,
  onOpenDrillDown,
}: {
  openScreen: (id: string) => void;
  leads?: DisplayLead[];
  notify?: (message: string) => void;
  onOpenAsk?: () => void;
  onOpenDiagnostic15d?: () => void;
  onOpenDrillDown?: () => void;
}) {
  return <div className="page-stack executive-page">
    <PageHeader eyebrow="Leadership view · Last 30 days" title="Growth is healthy. The next gain is operational." description="Revenue is up 11.8%, but ₹27.4L of recoverable opportunity is waiting in follow-up.">
      <Button variant="outline" onClick={onOpenAsk}><Search size={14} style={{ marginRight: 4 }} /> Multilingual Ask</Button>
      <Button variant="outline" onClick={() => openScreen("agent-my-leads")}><UsersRound size={14} style={{ marginRight: 4 }} /> Pipeline ({leads.length})</Button>
      {onOpenDrillDown && <Button variant="outline" onClick={onOpenDrillDown}><GitBranch size={14} style={{ marginRight: 4 }} /> 9-Level Tree</Button>}
      <Button className="primary-action" onClick={onOpenDiagnostic15d || (() => openScreen("owner-diagnostic"))}><Sparkles size={14} style={{ marginRight: 4 }} /> Generate 15-day memo</Button>
    </PageHeader>
    {/* PRD 18: Conversion Benchmark Strip */}
    <BenchmarkStrip />
    {/* PRD 18: Owner 5 Essential Questions Cockpit */}
    <OwnerQuestionCockpit onOpenAsk={onOpenAsk} />
    {/* Thesis Section 2: Business Problem the CRM Must Solve (100 Leads -> 50 Converted vs 50 Lost, 10 Leaks, 12 Levers) */}
    <ThesisSection2BusinessProblemCard
      notify={notify}
      onOpenAsk={onOpenAsk}
      onOpenDiagnostic={onOpenDiagnostic15d}
    />
    <div className="executive-scoreboard"><div><span>Attributed revenue</span><strong>₹1.84 Cr</strong><small>+11.8% vs previous period</small></div><div><span>Lead-to-conversion</span><strong>7.6%</strong><small>+0.9 percentage points</small></div><div><span>Cost per conversion</span><strong>₹4,820</strong><small>₹310 improvement</small></div><div className="opportunity"><span>Recoverable opportunity</span><strong>₹27.4L</strong><small>84 leads · action required</small></div></div><div className="executive-grid"><section className="panel"><PanelHeader title="What changed" subtitle="90-day revenue and conversion trajectory" action="Open trend" onAction={() => openScreen("owner-trend")} /><div className="trend-chart"><div className="chart-axis"><span>₹2.0 Cr</span><span>₹1.5 Cr</span><span>₹1.0 Cr</span><span>₹0.5 Cr</span></div><svg viewBox="0 0 700 220" preserveAspectRatio="none" aria-label="Revenue trend"><path d="M0,185 C90,170 120,142 195,151 C280,164 305,112 380,120 C462,129 482,78 560,90 C625,100 660,48 700,38" fill="none" stroke="#0b2545" strokeWidth="4" /><path d="M0,198 C80,192 125,187 195,175 C274,164 322,168 380,145 C463,112 500,138 560,111 C630,82 662,94 700,64" fill="none" stroke="#d09a26" strokeWidth="3" strokeDasharray="8 7" /></svg><div className="chart-legend"><span><i className="navy" /> Revenue</span><span><i className="gold" /> Conversion value</span></div></div></section><section className="panel leadership-brief"><div className="ai-brief-heading"><div className="ai-orb"><Sparkles size={19} /></div><div><span>Leadership brief</span><h2>Three decisions this week</h2></div></div><Decision priority="01" title="Do not increase Meta spend yet" detail="Lead quality is stable; qualified-to-meeting follow-up is the constraint." /><Decision priority="02" title="Deploy commercial-support coverage" detail="Weekend price enquiries wait 14.6 hours longer and convert 38% worse." /><Decision priority="03" title="Recover 84 evidenced leads" detail="They have time-bound intent and a resolvable objection. Estimated value ₹27.4L." /><button onClick={() => openScreen("owner-decision-memo")}>Open decision memo <ArrowRight size={14} /></button></section></div><section className="panel"><PanelHeader title="Source economics" subtitle="Spend only after operational leakage is accounted for" action="Full ROI" onAction={() => openScreen("owner-source-roi")} /><div className="source-economics"><div className="source-row head"><span>Source</span><span>Leads</span><span>Connected</span><span>Converted</span><span>Cost / conversion</span><span>Attributed revenue</span><span>Recommendation</span></div>{[["Google Search","886","81%","9.8%","₹4,120","₹76.2L","Scale selectively"],["Meta Telugu","1,104","72%","6.1%","₹5,940","₹61.8L","Fix follow-up first"],["YouTube","426","77%","7.2%","₹4,680","₹29.7L","Maintain"],["Organic / referral","448","84%","10.6%","₹1,180","₹16.3L","Protect"]].map((row,index)=><div className="source-row" key={row[0]}>{row.slice(0,6).map((cell)=><span key={cell}>{cell}</span>)}<span><Badge variant="outline" className={index===1?"status-warm":index===0?"status-positive":""}>{row[6]}</Badge></span></div>)}</div></section>
  </div>;
}

function DrillDownExplorer() { const levels=["Date","Branch","Department","Source","Campaign","Agent","Stage","Reason","Lead"]; return <div className="page-stack"><PageHeader eyebrow="Evidence explorer" title="Nine-level drill-down" description="Move from business outcome to a single lead, call, and timestamp without losing context."><Button variant="outline"><Download /> Export current view</Button></PageHeader><section className="panel drill-panel"><div className="drill-path">{levels.map((level,index)=><button className={index<4?"complete":index===4?"active":""} key={level}><span>{index+1}</span>{level}{index<levels.length-1&&<ChevronRight size={13} />}</button>)}</div><div className="drill-title"><div><span>Current level · Campaign</span><h2>Meta Telangana · Orthopaedics</h2><p>Branch: Banjara Hills · Department: Orthopaedics · 22 Aug–05 Sep</p></div><div><span>Conversion</span><strong>5.8%</strong><small>-2.1 pts vs benchmark</small></div></div><div className="drill-table"><div className="drill-row head"><span>Campaign / ad set</span><span>Leads</span><span>Connect</span><span>Qualified</span><span>Appointments</span><span>Visits</span><span>Converted</span><span>Signal</span></div>{[["Knee Pain · Telugu · 04","286","73%","61%","34%","62%","5.2%","Follow-up leak"],["Joint Replacement · Family","194","79%","68%","51%","67%","8.1%","Healthy"],["Doctor Video · Retargeting","118","81%","72%","46%","59%","6.7%","Price friction"],["Weekend Consult · Telangana","92","64%","57%","29%","48%","3.2%","SLA breach"]].map((row,index)=><button className="drill-row" key={row[0]}>{row.slice(0,7).map((cell)=><span key={cell}>{cell}</span>)}<span><Badge variant="outline" className={index===1?"status-positive":"status-warm"}>{row[7]}</Badge></span></button>)}</div></section><div className="drill-footnote"><ShieldCheck size={16} /><span>Every metric is reversible: click through to exact lead records and conversation evidence.</span></div></div>; }

function DiagnosticReview({ notify }: { notify: (message: string) => void }) { return <div className="page-stack"><PageHeader eyebrow="AI-prepared · Human approved" title="15-day diagnostic memo" description="A decision-ready summary of what changed, why it changed, and what to do next."><Badge variant="outline" className="ai-draft-badge"><Sparkles /> Draft · Not shared</Badge></PageHeader><div className="memo-layout"><article className="memo-paper"><div className="memo-head"><div><span>TRH360 DIAGNOSTIC</span><h1>Lead Conversion Review</h1><p>22 August–05 September 2026 · Meenestham Healthcare Group</p></div><div className="brand-mark">T</div></div><hr /><section><span className="memo-section-no">01</span><h2>Executive conclusion</h2><p>Demand quality remained stable, while conversion weakened at the qualified-to-meeting stage. The decline is operational and recoverable; increasing ad spend now would amplify leakage.</p></section><section><span className="memo-section-no">02</span><h2>Material findings</h2><ol><li><b>Financial follow-up delay:</b> 31 high-intent patients waited a median of 19 hours for cost or EMI information.</li><li><b>Temperature mismatch:</b> Seven calls expressed clear timelines but were recorded as Warm rather than Hot.</li><li><b>Weekend SLA:</b> Sunday leads had a 12m 42s median first-touch time versus 3m 18s on weekdays.</li></ol></section><section><span className="memo-section-no">03</span><h2>Recommended decisions</h2><div className="memo-action"><strong>Within 24 hours</strong><p>Run a recovery queue for 84 leads with resolvable, evidenced objections.</p></div><div className="memo-action"><strong>Within 7 days</strong><p>Add weekend commercial-support coverage and align the Meta opening script to campaign promises.</p></div><div className="memo-action"><strong>Before scaling spend</strong><p>Restore qualified-to-meeting conversion above 52% for seven consecutive days.</p></div></section><footer>Generated from 2,864 lead journeys, 4,912 call attempts, and 1,206 transcripts. Claims link to evidence.</footer></article><aside className="memo-review panel"><h2>Review & publish</h2><p>AI can prepare this memo. Only an authorized leader can publish or schedule it.</p><div className="review-check"><Check size={15} /><span>All material claims have evidence</span></div><div className="review-check"><Check size={15} /><span>Personally identifying data is redacted</span></div><div className="review-check"><Check size={15} /><span>Recommendations do not change CRM records</span></div><label>Reviewer note<textarea rows={4} placeholder="Add context before publishing…" /></label><Button variant="outline" className="full-width" onClick={() => notify("Memo downloaded as PDF")}>Download PDF</Button><Button className="primary-action full-width" onClick={() => notify("Diagnostic memo approved and published")}>Approve & publish</Button></aside></div></div>; }

function FinancialCase({ notify }: { notify: (message: string) => void }) { return <div className="page-stack"><div className="back-row"><button><ChevronLeft size={16} /> Financial counselling queue</button><span>FIN-01942</span></div><PageHeader eyebrow="Patient journey · Financial counselling" title="Lakshmi Narayana" description="Knee replacement · Appointment 07 Sep, 11:30 AM · Banjara Hills"><Button variant="outline"><Phone /> Call patient</Button><Button className="primary-action" onClick={() => notify("Eligibility outcome saved")}>Save outcome</Button></PageHeader><div className="journey-stepper">{[["Lead","complete"],["Qualified","complete"],["Appointment","complete"],["Financial","active"],["Admission",""],["Procedure",""]].map(([label,state],index)=><div className={state} key={label}><span>{state==="complete"?<Check size={13}/>:index+1}</span><b>{label}</b></div>)}</div><div className="financial-grid"><section className="panel"><PanelHeader title="Counselling assessment" subtitle="All decisions remain editable until handoff" /><div className="form-grid"><Field label="Estimated treatment amount" value="₹3,20,000" /><Field label="Immediate affordability" value="₹1,20,000" /><Field label="Preferred payment mode" value="Bajaj EMI + Cash" /><Field label="Insurance / scheme" value="No active insurance" /><Field label="EMI tenure discussed" value="18 months" /><Field label="Decision-maker" value="Daughter · Priya" /></div><label className="wide-field">Counselling note<textarea rows={5} defaultValue="Explained package inclusions and 12/18-month EMI options. Daughter needs written breakup before confirmation. Patient is comfortable with monthly estimate up to ₹12,000." /></label><div className="document-drop"><Upload size={19} /><div><strong>Attach estimate or eligibility proof</strong><span>PDF, JPG or PNG · up to 10 MB</span></div><Button variant="outline" size="sm">Browse</Button></div></section><aside className="page-stack tight"><section className="panel"><PanelHeader title="AI preparation" /><div className="ai-insight"><Sparkles size={17} /><p><b>Likely finance-ready.</b> The stated comfort range supports an 18-month plan if the eligible down payment is confirmed.</p></div><KeyValue label="Affordability confidence" value="78%" /><KeyValue label="Missing evidence" value="Daughter confirmation" /><KeyValue label="Next commitment" value="Send breakup by 2:00 PM" /></section><section className="panel"><PanelHeader title="Handoff" /><label className="option-card"><input type="radio" name="outcome" defaultChecked /><span><b>Ready for admission planning</b><small>Financial path agreed</small></span></label><label className="option-card"><input type="radio" name="outcome" /><span><b>Follow-up required</b><small>A question or document is pending</small></span></label><label className="option-card"><input type="radio" name="outcome" /><span><b>Not feasible now</b><small>Mandatory reason and evidence</small></span></label></section></aside></div></div>; }

function AiSafety({ notify }: { notify: (message: string) => void }) {
  const [controls, setControls] = useState([true,true,true,true,false]);
  const rows = [
    ["Require agent confirmation for structured remarks","AI drafts cannot enter the permanent timeline until a person confirms them."],
    ["Require evidence timestamps for reason classification","Every objection and non-conversion reason must link to a transcript moment."],
    ["Redact identifiers before model processing","Names, phone numbers, and policy identifiers are removed from model payloads."],
    ["Detect remark-to-transcript mismatch","Managers receive a review item when a remark contradicts the recording."],
    ["Allow AI to change lead status automatically","Not recommended. This bypasses human accountability and audit controls."],
  ];
  return <div className="page-stack"><PageHeader eyebrow="Admin control centre" title="AI review & safety policy" description="Set the boundaries for transcription, extraction, suggestions, and automated actions."><Button variant="outline"><History /> Version history</Button><Button className="primary-action" onClick={() => notify("AI policy changes published")}>Publish policy</Button></PageHeader><div className="policy-banner"><ShieldCheck size={23} /><div><strong>Human authority is enforced workspace-wide</strong><p>AI may transcribe, extract, classify, summarize, and draft. It cannot send, close, reassign, or change status without confirmation.</p></div><Badge variant="outline" className="status-positive">Protected</Badge></div><div className="settings-grid"><section className="panel"><PanelHeader title="Decision boundaries" subtitle="Applies to human and Voice AI call records" />{rows.map((row,index)=><div className={`policy-row ${index===4?"sensitive":""}`} key={row[0]}><div><strong>{row[0]}</strong><p>{row[1]}</p></div><Switch checked={controls[index]} onCheckedChange={(checked)=>setControls((current)=>current.map((value,idx)=>idx===index?checked:value))} /></div>)}</section><aside className="page-stack tight"><section className="panel"><PanelHeader title="Model processing" /><KeyValue label="Transcription" value="Soniox · speaker labels" /><KeyValue label="Extraction" value="TRH Structured v3" /><KeyValue label="Region" value="India" /><KeyValue label="Retention" value="30 days" /><button className="text-action">Edit model routing</button></section><section className="panel"><PanelHeader title="Review thresholds" /><Signal label="Auto-draft confidence" strength={80} /><Signal label="Manager review below" strength={72} /><Signal label="Mismatch alert above" strength={65} /></section><section className="panel warning-card"><CircleAlert size={18} /><div><strong>1 unpublished risk</strong><p>Voice AI campaign “Knee Care Telugu” uses an older consent message.</p><button>Review campaign</button></div></section></aside></div></div>;
}

function VoiceOverview({ openScreen }: { openScreen: (id: string) => void }) { return <div className="page-stack"><PageHeader eyebrow="Voice automation · Human governed" title="Voice AI overview" description="Bring every AI call into the same lead journey, evidence model, and management view."><Button variant="outline"><Settings /> API setup</Button><Button className="primary-action" onClick={() => openScreen("voice-agent-config")}><Plus /> New voice agent</Button></PageHeader><div className="metric-grid four"><MetricCard label="AI calls today" value="1,248" delta="78.4%" detail="connected" icon={Bot} /><MetricCard label="Qualified by AI" value="286" delta="22.9%" detail="of attempted" icon={Target} /><MetricCard label="Human handoffs" value="94" delta="7.5%" detail="accepted by agents" icon={UsersRound} /><MetricCard label="Review required" value="26" delta="2.1%" detail="low confidence" icon={ShieldCheck} /></div><div className="voice-grid"><section className="panel"><PanelHeader title="Live campaigns" subtitle="Outbound Voice AI activity" action="View all campaigns" onAction={()=>openScreen("voice-campaigns")} />{[["Knee Care Telugu","Live","628 / 1,200",52,"18 handoffs"],["No-show recovery","Live","318 / 480",66,"41 rebooked"],["Financial document reminder","Paused","204 / 620",33,"8 handoffs"]].map((row,index)=><div className="campaign-row" key={String(row[0])}><div className={`campaign-icon ${index===2?"paused":""}`}><Bot size={17} /></div><div><strong>{row[0]}</strong><span>{row[1]} · {row[2]} calls</span></div><div><span>Progress</span><Progress value={Number(row[3])} /></div><b>{row[4]}</b><Button variant="outline" size="sm" onClick={()=>openScreen("voice-call-detail")}>Inspect</Button></div>)}</section><section className="panel integration-health"><PanelHeader title="CRM ingestion health" subtitle="Last event 11 seconds ago" /><div className="ingestion-ring"><div><strong>99.96%</strong><span>accepted</span></div></div><KeyValue label="Calls ingested" value="12,486" /><KeyValue label="Recordings attached" value="12,481" /><KeyValue label="Transcripts parsed" value="12,472" /><KeyValue label="Needs mapping" value="5" /><button onClick={()=>openScreen("voice-api-ingestion")}>Open API monitor <ArrowRight size={14} /></button></section></div><section className="panel"><PanelHeader title="Human + Voice AI performance" subtitle="Same definitions, same evidence, comparable outcomes" /><div className="comparison-table"><div className="compare-row head"><span>Channel</span><span>Attempts</span><span>Connected</span><span>Qualified</span><span>Appointments</span><span>Human handoff</span><span>Cost / qualified</span></div><div className="compare-row"><span><UserRound size={16} /> Human agents</span><span>4,912</span><span>72%</span><span>31%</span><span>16%</span><span>—</span><span>₹184</span></div><div className="compare-row"><span><Bot size={16} /> Voice AI</span><span>8,406</span><span>78%</span><span>23%</span><span>11%</span><span>7.5%</span><span>₹68</span></div></div></section></div>; }

function VoiceCallDetail({ notify }: { notify: (message: string) => void }) { return <div className="page-stack"><div className="back-row"><button><ChevronLeft size={16} /> Voice AI calls</button><span>VAI-929184</span></div><section className="voice-call-hero"><div className="voice-call-title"><div className="ai-orb large"><Bot size={22} /></div><div><span className="eyebrow">Completed · Today, 11:08 AM</span><h1>Voice AI call with Ramesh Kumar</h1><p>+91 97042 61829 · Telugu · 6m 12s · Knee Care Telugu</p></div></div><div><Badge variant="outline" className="status-positive">Qualified</Badge><Button variant="outline"><Download /> Export</Button></div></section><div className="review-grid"><section className="panel transcript-panel"><PanelHeader title="Recording & transcript" subtitle="Voice agent: Asha · Speaker-labelled" /><AudioPlayer /><div className="transcript-body"><TranscriptLine speaker="Asha · AI" time="00:06" text="Namaste Ramesh garu. You requested information about knee pain treatment. May I record this call to help our care team support you?" /><TranscriptLine speaker="Patient" time="00:18" text="Yes, that is okay. I have had pain for more than six months." evidence /><TranscriptLine speaker="Asha · AI" time="01:04" text="Has a doctor suggested surgery, or are you looking for a first consultation?" /><TranscriptLine speaker="Patient" time="01:18" text="A doctor here suggested replacement. I want a second opinion in Hyderabad next week." evidence /><TranscriptLine speaker="Asha · AI" time="04:46" text="I can ask a human care coordinator to call you today and arrange the second opinion. Is 3:00 PM convenient?" /></div></section><aside className="panel structured-remark"><div className="remark-heading"><div><span className="card-kicker">AI extraction</span><h2>Review before CRM update</h2></div><Badge variant="outline" className="ai-draft-badge">94% confidence</Badge></div><RemarkField number="01" label="Need" value="Second opinion for recommended knee replacement." /><RemarkField number="02" label="Urgency" value="Wants Hyderabad consultation next week." evidence="Patient · 01:18" /><RemarkField number="03" label="Primary objection" value="Wants clinical confirmation before deciding." /><RemarkField number="04" label="Handoff commitment" value="Human coordinator callback today at 3:00 PM." /><div className="extraction-flags"><span><Check size={13} /> Consent captured · 00:18</span><span><Check size={13} /> Phone mapped to existing lead</span><span><Check size={13} /> No conflicting fields detected</span></div><div className="review-actions"><Button variant="outline" onClick={()=>notify("Voice AI call sent to manager review")}>Escalate</Button><Button className="primary-action" onClick={()=>notify("Voice AI extraction accepted into Lead 360")}><Check /> Accept into CRM</Button></div></aside></div></div>; }

function GenericDesktopScreen({ screen, openScreen, notify }: { screen: CrmScreen; openScreen: (id: string) => void; notify: (message: string) => void }) {
  const iconByKind: Record<string,LucideIcon>={dashboard:LayoutDashboard,list:ListFilter,detail:FileText,form:Plus,analytics:BarChart3,config:Settings,workflow:Workflow,review:ShieldCheck};
  const Icon=iconByKind[screen.kind];
  if(screen.kind==="config") return <GenericConfig screen={screen} notify={notify}/>;
  if(screen.kind==="analytics") return <GenericAnalytics screen={screen}/>;
  if(screen.kind==="form"||screen.kind==="workflow") return <GenericWorkflow screen={screen} notify={notify}/>;
  return <div className="page-stack"><PageHeader eyebrow={`${screen.role} · ${screen.module}`} title={screen.title} description={screen.description}><Button variant="outline"><Download /> Export</Button><Button className="primary-action" onClick={()=>notify(`${screen.title} action completed`)}><Plus /> New action</Button></PageHeader>{screen.kind==="dashboard"&&<div className="metric-grid four"><MetricCard label="In scope" value="2,864" delta="+8.2%" detail="current period" icon={Icon}/><MetricCard label="Needs action" value="84" delta="2.9%" detail="of total records" icon={CircleAlert}/><MetricCard label="On track" value="91.4%" delta="+3.1%" detail="vs benchmark" icon={CircleCheck}/><MetricCard label="Evidence coverage" value="96%" delta="Strong" detail="auditable records" icon={ShieldCheck}/></div>}<section className="panel"><PanelHeader title={screen.kind==="detail"?"Complete record":"Prioritized worklist"} subtitle="Context, ownership, and next actions stay visible" />{screen.kind==="detail"?<div className="generic-detail"><div><span className="card-kicker">Record overview</span><h2>One permanent journey</h2><p>This view links source, calls, messages, commitments, status changes, appointments, financial work, and outcomes into one auditable chain.</p><div className="fact-grid"><KeyValue label="Source" value="Google · Campaign 04"/><KeyValue label="Owner" value="Sravani K."/><KeyValue label="Last meaningful touch" value="Today · 10:42 AM"/><KeyValue label="Next commitment" value="Today · 4:30 PM"/></div></div><div className="generic-activity"><TimelineItem icon={PhoneCall} tone="navy" title="Meaningful call" time="Today · 10:42 AM" meta="Recorded · Transcript ready" body="Intent, objection, and commitment captured." action="Open evidence"/><TimelineItem icon={History} tone="muted" title="Status updated" time="Yesterday · 5:16 PM" meta="Warm → Hot · Sravani K." body="Reason and human author preserved in audit trail." action="View change"/></div></div>:<LeadTable openScreen={openScreen}/>}</section></div>;
}

function GenericAnalytics({ screen }: { screen: CrmScreen }) { return <div className="page-stack"><PageHeader eyebrow={`${screen.role} · Intelligence`} title={screen.title} description={screen.description}><Button variant="outline"><SlidersHorizontal /> Filters</Button><Button className="primary-action"><Download /> Export evidence</Button></PageHeader><div className="metric-grid four"><MetricCard label="Current result" value="76.0%" delta="+4.2%" detail="vs prior period" icon={Target}/><MetricCard label="Records analyzed" value="2,864" delta="100%" detail="source attributed" icon={UsersRound}/><MetricCard label="Exceptions" value="84" delta="-12" detail="since last review" icon={CircleAlert}/><MetricCard label="Evidence coverage" value="96%" delta="Strong" detail="calls and events linked" icon={ShieldCheck}/></div><div className="content-grid analytics-template"><section className="panel"><PanelHeader title="Trend and variance" subtitle="Last 30 days · Daily"/><div className="bar-chart">{[42,55,49,67,58,72,61,78,75,84,70,88,82,92].map((height,index)=><div key={index}><i style={{height:`${height}%`}}/><span>{index%3===0?`${index+1} Sep`:""}</span></div>)}</div></section><section className="panel"><PanelHeader title="Intervention signals" subtitle="Ranked by business impact"/>{[["Delayed second follow-up","31 records",84],["Reason lacks evidence","18 records",62],["Temperature mismatch","9 records",43],["Source promise mismatch","6 records",31]].map((item)=><div className="signal-row" key={String(item[0])}><div><strong>{item[0]}</strong><span>{item[1]}</span></div><Progress value={Number(item[2])}/><button><ChevronRight size={15}/></button></div>)}</section></div><section className="panel"><PanelHeader title="Evidence table" subtitle="Click a row to trace the metric to its underlying records"/><div className="generic-table"><div className="generic-row head"><span>Segment</span><span>Volume</span><span>Rate</span><span>Benchmark</span><span>Variance</span><span>Evidence</span></div>{[["Banjara Hills · Ortho","486","68%","74%","-6 pts","194 calls"],["Warangal · Cardiology","318","79%","72%","+7 pts","122 calls"],["Karimnagar · IVF","284","71%","76%","-5 pts","98 calls"],["Khammam · General","261","82%","78%","+4 pts","106 calls"]].map((row)=><button className="generic-row" key={row[0]}>{row.map((cell)=><span key={cell}>{cell}</span>)}</button>)}</div></section></div>; }

function GenericConfig({ screen, notify }: { screen: CrmScreen; notify: (message: string) => void }) {
  const settings=screen.id.includes("telephony")||screen.id.includes("mobile")?[["Default outbound provider","Exotel · Hyderabad cluster"],["Automatic call recording","Enabled with consent"],["Phone number masking","Enabled for agents"],["Retry failed uploads","Every 15 minutes"]]:screen.id.includes("webhook")?[["Lead created","https://api.example.com/trh/leads"],["Call completed","https://api.example.com/trh/calls"],["Transcript ready","https://api.example.com/trh/transcript"],["Appointment updated","https://api.example.com/trh/appointments"]]:[["Workspace default","Enabled"],["Manager approval","Required"],["Audit retention","7 years"],["Last published","04 Sep 2026 · Nilesh N."]];
  return <div className="page-stack"><PageHeader eyebrow="Admin control centre" title={screen.title} description={screen.description}><Button variant="outline"><History /> Change log</Button><Button className="primary-action" onClick={()=>notify(`${screen.title} settings published`)}>Publish changes</Button></PageHeader><div className="settings-grid"><section className="panel"><PanelHeader title="Workspace settings" subtitle="Changes are versioned and reversible"/>{settings.map((row,index)=><div className="config-row" key={row[0]}><div><strong>{row[0]}</strong><p>{row[1]}</p></div>{index%2===0?<Switch defaultChecked/>:<Button variant="outline" size="sm">Configure</Button>}</div>)}</section><aside className="page-stack tight"><section className="panel"><PanelHeader title="Control summary"/><KeyValue label="Status" value="Active"/><KeyValue label="Applies to" value="All branches"/><KeyValue label="Owners" value="2 admins"/><KeyValue label="Pending changes" value="3"/></section><section className="panel warning-card"><ShieldCheck size={18}/><div><strong>Safe publishing</strong><p>A validation check runs before any configuration becomes active.</p><button>View safeguards</button></div></section></aside></div></div>;
}

function GenericWorkflow({ screen, notify }: { screen: CrmScreen; notify: (message: string) => void }) { return <div className="page-stack"><PageHeader eyebrow={`${screen.role} · Guided workflow`} title={screen.title} description={screen.description}><Button variant="outline">Save draft</Button><Button className="primary-action" onClick={()=>notify(`${screen.title} saved successfully`)}><Check /> Save & continue</Button></PageHeader><div className="workflow-layout"><section className="panel form-panel"><div className="form-section"><span>01</span><div><h2>Identity & context</h2><p>Keep this work connected to the permanent lead record.</p></div></div><div className="form-grid"><Field label="Lead / patient" value="Lakshmi Narayana · TRH-24190"/><Field label="Mobile number" value="+91 98491 22618"/><Field label="Branch" value="Banjara Hills"/><Field label="Department" value="Orthopaedics"/></div><div className="form-section second"><span>02</span><div><h2>Decision & next action</h2><p>A reason and accountable next commitment are mandatory.</p></div></div><div className="form-grid"><Field label="Outcome / status" value="Follow-up required"/><Field label="Reason" value="Family confirmation pending"/><Field label="Next action date" value="05 Sep 2026 · 4:30 PM"/><Field label="Owner" value="Sravani K."/></div><label className="wide-field">Structured note<textarea rows={5} defaultValue="Daughter Priya is the final decision-maker. Confirm her availability and send the written financial estimate before the next call."/></label></section><aside className="panel workflow-check"><div className="ai-orb"><Sparkles size={18}/></div><h2>Before you save</h2><p>TRH360 checks that the record is complete and evidence-led.</p>{["Source is preserved","Reason is selected","Next commitment has owner and time","No duplicate message inside 48 hours","Audit trail will record this change"].map((item)=><div key={item}><Check size={14}/><span>{item}</span></div>)}<hr/><small>AI checks completeness. You own the decision.</small></aside></div></div>; }

function MobileWorkspace({ activeId, openScreen, callSeconds, notify, leads }: { activeId: string; openScreen: (id: string) => void; callSeconds: number; notify: (message: string) => void; leads: DisplayLead[] }) {
  const mobileScreens=crmScreens.filter((screen)=>screen.experience==="mobile");
  return <div className="mobile-lab"><aside className="mobile-flow-nav"><span className="eyebrow">Mobile app flow</span><h1>Tele-CRM in the agent’s hand</h1><p>Tap any state to inspect native calling, recording, transcription, and follow-up.</p><div className="mobile-nav-list">{mobileScreens.map((screen,index)=><button key={screen.id} className={screen.id===activeId?"active":""} onClick={()=>openScreen(screen.id)}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{screen.title}</strong><small>{screen.kind}</small></div><ChevronRight size={15}/></button>)}</div></aside><div className="phone-stage"><div className="phone-label"><span>TRH360 Mobile · Android</span><Badge variant="outline">Interactive prototype</Badge></div><div className="phone-frame"><div className="phone-speaker"/><MobileScreen activeId={activeId} openScreen={openScreen} callSeconds={callSeconds} notify={notify} leads={leads}/></div><p className="phone-note"><ShieldCheck size={15}/> Call recording follows workspace consent and device policy.</p></div><aside className="mobile-context"><span className="eyebrow">Designed behavior</span><h2>One tap. One permanent record.</h2><div className="context-step"><span>01</span><p><b>Tap a mobile number</b>The configured provider starts the call without retyping.</p></div><div className="context-step"><span>02</span><p><b>Record with consent</b>Audio starts automatically after the recorded consent event.</p></div><div className="context-step"><span>03</span><p><b>Transcribe & extract</b>Speaker labels, timestamps, intent, objections, and commitments are prepared.</p></div><div className="context-step"><span>04</span><p><b>Human confirms</b>The agent edits the AI draft before it enters Lead 360.</p></div><button onClick={()=>openScreen("admin-telephony")}>Open telephony setup <ArrowRight size={14}/></button></aside></div>;
}

function MobileScreen({ activeId, openScreen, callSeconds, notify, leads }: { activeId:string; openScreen:(id:string)=>void; callSeconds:number; notify:(message:string)=>void; leads: DisplayLead[] }) {
  if(activeId==="mobile-sign-in") return <UniversalMobileSignIn openScreen={openScreen}/>;
  if(activeId==="mobile-permissions") return <MobilePermissions openScreen={openScreen}/>;
  if(activeId==="mobile-active-call"||activeId==="mobile-inbound-call") return <UniversalMobileActiveCall inbound={activeId==="mobile-inbound-call"} callSeconds={callSeconds} openScreen={openScreen}/>;
  if(activeId==="mobile-post-call") return <UniversalMobilePostCall openScreen={openScreen} notify={notify}/>;
  if(activeId==="mobile-call-queue") return <MobileCallQueue openScreen={openScreen} leads={leads}/>;
  if(activeId==="mobile-lead-card"||activeId==="mobile-lead-360") return <UniversalMobileLead360 openScreen={openScreen}/>;
  if(activeId==="mobile-manager") return <UniversalMobileManager/>;
  if(activeId==="mobile-appointment") return <UniversalMobileAppointment notify={notify}/>;
  if(activeId==="mobile-follow-up") return <UniversalMobileFollowUp notify={notify}/>;
  if(activeId==="mobile-notifications") return <UniversalMobileNotifications/>;
  if(activeId==="mobile-tasks") return <UniversalMobileTasks openScreen={openScreen}/>;
  if(activeId==="__legacy-mobile-sign-in") return <MobileSignIn openScreen={openScreen}/>;
  if(activeId==="__legacy-mobile-active") return <MobileActiveCall inbound={false} callSeconds={callSeconds} openScreen={openScreen}/>;
  if(activeId==="__legacy-mobile-post-call") return <MobilePostCall openScreen={openScreen} notify={notify}/>;
  if(activeId==="__legacy-mobile-lead") return <MobileLead360 openScreen={openScreen}/>;
  if(activeId==="__legacy-mobile-manager") return <MobileManager/>;
  if(activeId==="__legacy-mobile-appointment") return <MobileAppointment notify={notify}/>;
  if(activeId==="__legacy-mobile-follow-up") return <MobileFollowUp notify={notify}/>;
  if(activeId==="__legacy-mobile-notifications") return <MobileNotifications/>;
  if(activeId==="__legacy-mobile-tasks") return <MobileTasks openScreen={openScreen}/>;
  return <MobileHome openScreen={openScreen} leads={leads}/>;
}

function UniversalMobileActiveCall({inbound,callSeconds,openScreen}:{inbound:boolean;callSeconds:number;openScreen:(id:string)=>void}) {
  return <div className="mobile-screen active-call-screen"><PhoneStatus/><div className="call-recording-state"><span className="recording-dot"/> Recording with consent</div><div className="active-call-person"><div className="call-avatar">LN</div><h1>Lakshmi Narayana</h1><p>{inbound?"Incoming · Existing lead":"Outbound · TRH-24190"}</p><strong>{formatDuration(callSeconds)}</strong></div><div className="call-context-card"><span>AI live notes</span><p>Lead is discussing implementation cost. Listening for decision-maker, objection, and timeline.</p><div><Sparkles size={14}/> Transcript is being prepared</div></div><div className="call-controls"><button><Mic size={20}/><span>Mute</span></button><button><MessageSquare size={20}/><span>Note</span></button><button><UserRound size={20}/><span>Contact</span></button><button><MoreHorizontal size={20}/><span>More</span></button></div><button className="end-call" onClick={()=>openScreen("mobile-post-call")}><PhoneOff size={22}/></button><p className="end-label">End call</p></div>;
}

function UniversalMobilePostCall({openScreen,notify}:{openScreen:(id:string)=>void;notify:(message:string)=>void}) {
  const [selected,setSelected]=useState("Hot");
  return <div className="mobile-screen"><MobileHeader title="Review call" subtitle="4m 38s · AI draft" back="mobile-call-queue" openScreen={openScreen} right={<Badge variant="outline" className="ai-draft-badge">91%</Badge>}/><div className="mobile-body post-call-body"><div className="mobile-ai-note"><Sparkles size={17}/><p>Review before saving. AI has not changed the lead.</p></div><div className="mobile-recording"><button><Play size={15}/></button><div><b>Call recording</b><span>04:38 · Transcript ready</span></div><ChevronRight size={16}/></div><label className="mobile-field"><span>Lead temperature</span><div className="mobile-temperature">{["Hot","Warm","Cold"].map((item)=><button key={item} className={selected===item?"active":""} onClick={()=>setSelected(item)}>{item}</button>)}</div></label><label className="mobile-field"><span>Primary objection</span><button className="mobile-select">Pricing concern <ChevronDown size={15}/></button><small><Play size={11}/> Evidence · Lead at 00:24</small></label><label className="mobile-field"><span>Structured remark</span><textarea rows={6} defaultValue="High intent for an enterprise CRM rollout this quarter. Finance director Priya is the decision-maker. Pricing and implementation are the main concerns. Saturday solution review accepted."/></label><label className="mobile-field"><span>Next action</span><button className="mobile-select">Today · 4:30 PM <CalendarDays size={15}/></button></label></div><div className="mobile-sticky-actions"><Button variant="outline" onClick={()=>notify("Mobile call draft saved")}>Draft</Button><Button className="primary-action" onClick={()=>{notify("Call confirmed and attached to Lead 360");openScreen("mobile-lead-360");}}><Check/> Confirm & save</Button></div></div>;
}

function UniversalMobileLead360({openScreen}:{openScreen:(id:string)=>void}) {
  return <div className="mobile-screen"><MobileHeader title="Lead 360" subtitle="TRH-24190" back="mobile-call-queue" openScreen={openScreen} right={<button><MoreHorizontal/></button>}/><div className="mobile-body lead360-mobile"><div className="mobile-profile"><div className="large-avatar">LN</div><div><h2>Lakshmi Narayana</h2><span>+91 98491 22618 · Hyderabad</span><Badge variant="outline" className="status-hot">Hot · 86</Badge></div></div><div className="mobile-profile-actions"><button><MessageSquare size={17}/> Message</button><button className="call" onClick={()=>openScreen("mobile-active-call")}><Phone size={17}/> Call now</button></div><div className="mobile-ai-summary"><div><Sparkles size={16}/><b>Journey summary</b></div><p>Wants an enterprise CRM this quarter. Finance director decides. Pricing is the main concern. Saturday solution review accepted.</p><button>View 4 evidence moments</button></div><div className="next-mobile-action"><span>Next commitment</span><strong>Confirm finance director availability</strong><p>Today · 4:30 PM · in 2h 18m</p><button onClick={()=>openScreen("mobile-follow-up")}>Complete follow-up <ChevronRight size={15}/></button></div><div className="mobile-section-title"><div><span>Recent journey</span><small>8 activities</small></div><button>View all</button></div><div className="mobile-timeline"><TimelineItem icon={PhoneCall} tone="navy" title="Meaningful call" time="Today · 10:42 AM" meta="4m 38s · Recorded" body="Pricing discussed; finance director must confirm." action="Play & read"/><TimelineItem icon={CalendarDays} tone="green" title="Meeting booked" time="Yesterday" meta="07 Sep · 11:30 AM" body="Maya Rao · Online solution review" action="Open"/></div></div></div>;
}

function UniversalMobileManager() {
  return <div className="mobile-screen"><MobileHeader title="Manager brief" subtitle="Live · All business units" right={<div className="user-avatar small">NN</div>}/><div className="mobile-body"><div className="manager-mobile-hero"><span>Conversion today</span><strong>8.1%</strong><small>+1.2 pts vs 30-day average</small></div><div className="mobile-metrics"><div><span>New leads</span><strong>142</strong><small>Today</small></div><div><span>SLA risk</span><strong>11</strong><small>Needs action</small></div><div><span>Meetings</span><strong>38</strong><small>Booked</small></div></div><div className="mobile-ai-summary"><div><Sparkles size={16}/><b>Manager attention</b></div><p>Six regional leads crossed first-touch SLA. Reassigning now may recover four.</p><button>Open affected leads</button></div><div className="mobile-section-title"><div><span>Funnel today</span><small>142 leads</small></div><button>Details</button></div><div className="mobile-funnel">{funnelStages.slice(0,5).map((stage,index)=><div key={stage.label}><span>{stage.label}</span><i><b style={{width:`${100-index*14}%`}}/></i><strong>{Math.round(stage.value/20)}</strong></div>)}</div><div className="mobile-section-title"><div><span>Agent exceptions</span><small>Sorted by risk</small></div></div>{[["Kiran Reddy","6 SLA breaches"],["Anil Kumar","9 weak remarks"],["Sravani K.","3 overdue follow-ups"]].map((row)=><button className="mobile-alert-row" key={row[0]}><div className="mini-avatar">{row[0].split(" ").map((p)=>p[0]).join("")}</div><span><b>{row[0]}</b><small>{row[1]}</small></span><ChevronRight size={15}/></button>)}</div></div>;
}

function UniversalMobileSignIn({openScreen}:{openScreen:(id:string)=>void}) {
  return <div className="mobile-screen sign-in-screen"><PhoneStatus/><div className="sign-in-brand"><div className="brand-mark large">T</div><strong>TRH360</strong><span>Human + AI CRM</span></div><div className="sign-in-form"><h1>Welcome back</h1><p>Sign in to your Northstar workspace.</p><label><span>Mobile or work email</span><input defaultValue="sravani@northstar.example"/></label><label><span>Password</span><input type="password" defaultValue="password"/></label><Button className="primary-action full-width" onClick={()=>openScreen("mobile-permissions")}>Sign in securely</Button><button className="forgot">Forgot password?</button></div><div className="secure-note"><LockKeyhole size={14}/> Protected with workspace access controls</div></div>;
}

function UniversalMobileAppointment({notify}:{notify:(message:string)=>void}) {
  return <div className="mobile-screen"><MobileHeader title="Book meeting" subtitle="Lakshmi Narayana" back="mobile-lead-360"/><div className="mobile-body"><div className="form-progress"><span className="active"/><span className="active"/><span/><small>Availability</small></div><label className="mobile-field"><span>Meeting mode</span><button className="mobile-select">Online video call <ChevronDown size={15}/></button></label><label className="mobile-field"><span>Team & specialist</span><button className="mobile-select">Solution consulting · Maya Rao <ChevronDown size={15}/></button></label><label className="mobile-field"><span>Date</span><div className="date-options">{["Sat\n07","Mon\n09","Tue\n10","Wed\n11"].map((item,index)=><button className={index===0?"active":""} key={item}>{item.split("\n").map((part)=><span key={part}>{part}</span>)}</button>)}</div></label><label className="mobile-field"><span>Available time</span><div className="time-options">{["10:30 AM","11:30 AM","2:00 PM","4:30 PM"].map((item,index)=><button className={index===1?"active":""} key={item}>{item}</button>)}</div></label><label className="mobile-field"><span>Purpose</span><button className="mobile-select">CRM solution and implementation review <ChevronDown size={15}/></button></label><div className="mobile-ai-note"><ShieldCheck size={17}/><p>Booking becomes the next commitment and updates Lead 360.</p></div></div><div className="mobile-sticky-actions single"><Button className="primary-action" onClick={()=>notify("Meeting booked for 07 Sep at 11:30 AM")}>Confirm meeting</Button></div></div>;
}

function UniversalMobileFollowUp({notify}:{notify:(message:string)=>void}) {
  return <div className="mobile-screen"><MobileHeader title="Complete follow-up" subtitle="Commitment due · 4:30 PM" back="mobile-lead-360"/><div className="mobile-body"><div className="mobile-ai-note"><Sparkles size={17}/><p>Context: confirm Priya’s availability and whether the written commercial scope was received.</p></div><label className="mobile-field"><span>Outcome</span><button className="mobile-select">Connected · Positive <ChevronDown size={15}/></button></label><label className="mobile-field"><span>What changed?</span><textarea rows={6} defaultValue="Finance director can join the Saturday review. Pricing estimate received; security scope is still required before approval."/></label><label className="mobile-field"><span>Temperature</span><div className="mobile-temperature"><button className="active">Hot</button><button>Warm</button><button>Cold</button></div></label><label className="mobile-field"><span>Next commitment</span><button className="mobile-select">Meeting · 07 Sep, 11:30 AM <CalendarDays size={15}/></button></label></div><div className="mobile-sticky-actions single"><Button className="primary-action" onClick={()=>notify("Follow-up completed and journey updated")}>Save follow-up</Button></div></div>;
}

function UniversalMobileTasks({openScreen}:{openScreen:(id:string)=>void}) {
  const tasks=[["Call Lakshmi Narayana","Confirm decision-maker","Now","hot"],["Send pricing scope to Madhavi","WhatsApp · Commercial","11:30 AM",""],["Retry Prakash Reddy","Third call attempt","12:15 PM",""],["Confirm product review with Faizal","Meeting · Renewal","2:00 PM",""]];
  return <div className="mobile-screen"><MobileHeader title="Tasks" subtitle="28 due today" back="mobile-home" openScreen={openScreen} right={<button><Filter size={18}/></button>}/><div className="mobile-body"><div className="mobile-tabs"><button className="active">Due now</button><button>Later</button><button>Done</button></div>{tasks.map((row)=><button className="task-card" key={row[0]} onClick={()=>row[0].startsWith("Call")&&openScreen("mobile-active-call")}><span className={row[3]}><CircleCheck size={17}/></span><div><strong>{row[0]}</strong><small>{row[1]}</small></div><b>{row[2]}</b></button>)}</div><MobileBottomNav active="Tasks" openScreen={openScreen}/></div>;
}

function UniversalMobileNotifications() {
  const notices=[[AlarmClock,"SLA crossed for 3 new leads","Reassign or call now","2 min ago"],[CalendarDays,"Meeting confirmed","Lakshmi · 07 Sep, 11:30 AM","18 min ago"],[Sparkles,"AI draft ready for review","Call with Madhavi · 6m 02s","24 min ago"],[MessageSquare,"Lead replied on WhatsApp","Faizal: ‘Tomorrow morning works’","41 min ago"]];
  return <div className="mobile-screen"><MobileHeader title="Notifications" subtitle="5 unread" back="mobile-home"/><div className="mobile-body"><div className="queue-date"><span>Today</span></div>{notices.map(([Icon,title,detail,time])=>{const NotificationIcon=Icon as LucideIcon;return <button className="notification-card" key={title as string}><div><NotificationIcon size={17}/></div><span><strong>{title as string}</strong><small>{detail as string}</small><em>{time as string}</em></span></button>;})}</div></div>;
}

function PhoneStatus(){return <div className="phone-status"><b>9:41</b><div><Activity size={13}/><span className="signal-bars">▮▮▮</span><span>82%</span></div></div>;}
function MobileHeader({title,subtitle,back,openScreen,right}:{title:string;subtitle?:string;back?:string;openScreen?:(id:string)=>void;right?:React.ReactNode}){return <><PhoneStatus/><div className="mobile-header">{back?<button onClick={()=>openScreen?.(back)}><ChevronLeft/></button>:<div className="mobile-logo">T</div>}<div><strong>{title}</strong>{subtitle&&<span>{subtitle}</span>}</div>{right??<button><Bell size={19}/></button>}</div></>;}

function MobileHome({openScreen, leads}:{openScreen:(id:string)=>void; leads:DisplayLead[]}){return <div className="mobile-screen"><MobileHeader title="Good morning, Sravani" subtitle="Friday · 05 September" right={<div className="user-avatar small">SK</div>}/><div className="mobile-body"><button className="mobile-sla" onClick={()=>openScreen("mobile-call-queue")}><AlarmClock size={18}/><div><b>3 calls need attention now</b><span>Oldest SLA breach · 03:18</span></div><ChevronRight size={16}/></button><div className="mobile-metrics"><div><span>Calls due</span><strong>14</strong><small>3 overdue</small></div><div><span>Follow-ups</span><strong>21</strong><small>Today</small></div><div><span>Appointments</span><strong>07</strong><small>2 confirmed</small></div></div><div className="mobile-section-title"><div><span>Next calls</span><small>AI prioritized</small></div><button onClick={()=>openScreen("mobile-call-queue")}>View all</button></div><div className="mobile-leads">{leads.slice(0,3).map((lead,index)=><div className="mobile-lead" key={lead.id} onClick={()=>openScreen("mobile-lead-360")}><div className="mobile-lead-top"><div className="mini-avatar">{lead.name.split(" ").map((part)=>part[0]).join("").slice(0,2)}</div><div><b>{lead.name}</b><span>{lead.stage}</span></div><Badge variant="outline" className={temperatureClass[lead.qualification === "hot" ? "Hot" : lead.qualification === "warm" ? "Warm" : lead.qualification === "cold" ? "Cold" : "Unknown"]}>{lead.qualification === "hot" ? "Hot" : lead.qualification === "warm" ? "Warm" : lead.qualification === "cold" ? "Cold" : "Unknown"}</Badge></div><div className="mobile-lead-context"><span><Clock3 size={13}/> {index===0?"Call now · overdue":lead.next}</span><span>{lead.source}</span></div><div className="mobile-lead-actions"><button><MessageSquare size={16}/> Message</button><button className="call" onClick={(event)=>{event.stopPropagation();openScreen("mobile-active-call");}}><Phone size={16}/> Call</button></div></div>)}</div></div><MobileBottomNav active="Home" openScreen={openScreen}/></div>;}

function MobileBottomNav({active,openScreen}:{active:string;openScreen:(id:string)=>void}){return <nav className="mobile-bottom-nav">{[["Home",LayoutDashboard,"mobile-home"],["Leads",UsersRound,"mobile-call-queue"],["Call",PhoneCall,"mobile-active-call"],["Tasks",CircleCheck,"mobile-tasks"]].map(([label,Icon,id])=>{const NavIcon=Icon as LucideIcon;return <button className={active===label?"active":""} key={label as string} onClick={()=>openScreen(id as string)}><NavIcon size={19}/><span>{label as string}</span></button>;})}</nav>;}

function MobileCallQueue({openScreen, leads}:{openScreen:(id:string)=>void; leads:DisplayLead[]}){return <div className="mobile-screen"><MobileHeader title="Call queue" subtitle="14 due · 3 overdue" back="mobile-home" openScreen={openScreen} right={<button><Filter size={18}/></button>}/><div className="mobile-body with-tabs"><div className="mobile-tabs"><button className="active">Priority</button><button>Follow-up</button><button>Uncontacted</button></div><div className="mobile-search"><Search size={16}/><input placeholder="Search name or mobile"/></div><div className="queue-date"><span>Call now</span><b>3</b></div>{leads.map((lead,index)=><button className="queue-item" key={lead.id} onClick={()=>openScreen("mobile-lead-360")}><div className="mini-avatar">{lead.name.split(" ").map((p)=>p[0]).join("").slice(0,2)}</div><div><strong>{lead.name}</strong><span>{lead.phone}</span><small>{lead.stage} · {lead.source}</small></div><div><Badge variant="outline" className={temperatureClass[lead.qualification === "hot" ? "Hot" : lead.qualification === "warm" ? "Warm" : lead.qualification === "cold" ? "Cold" : "Unknown"]}>{lead.qualification === "hot" ? "Hot" : lead.qualification === "warm" ? "Warm" : lead.qualification === "cold" ? "Cold" : "Unknown"}</Badge><button className="queue-call" aria-label="Call" onClick={(event)=>{event.stopPropagation();openScreen("mobile-active-call");}}><Phone size={17}/></button></div>{index===0&&<em>Overdue 03:18</em>}</button>)}</div><MobileBottomNav active="Leads" openScreen={openScreen}/></div>;}

function MobileActiveCall({inbound,callSeconds,openScreen}:{inbound:boolean;callSeconds:number;openScreen:(id:string)=>void}){return <div className="mobile-screen active-call-screen"><PhoneStatus/><div className="call-recording-state"><span className="recording-dot"/> Recording with consent</div><div className="active-call-person"><div className="call-avatar">LN</div><h1>Lakshmi Narayana</h1><p>{inbound?"Incoming · Existing lead":"Outbound · TRH-24190"}</p><strong>{formatDuration(callSeconds)}</strong></div><div className="call-context-card"><span>AI live notes</span><p>Patient is discussing treatment cost. Listening for decision-maker and timeline.</p><div><Sparkles size={14}/> Transcript is being prepared</div></div><div className="call-controls"><button><Mic size={20}/><span>Mute</span></button><button><MessageSquare size={20}/><span>Note</span></button><button><UserRound size={20}/><span>Contact</span></button><button><MoreHorizontal size={20}/><span>More</span></button></div><button className="end-call" onClick={()=>openScreen("mobile-post-call")}><PhoneOff size={22}/></button><p className="end-label">End call</p></div>;}

function MobilePostCall({openScreen,notify}:{openScreen:(id:string)=>void;notify:(message:string)=>void}){const [selected,setSelected]=useState("Hot");return <div className="mobile-screen"><MobileHeader title="Review call" subtitle="4m 38s · AI draft" back="mobile-call-queue" openScreen={openScreen} right={<Badge variant="outline" className="ai-draft-badge">91%</Badge>}/><div className="mobile-body post-call-body"><div className="mobile-ai-note"><Sparkles size={17}/><p>Review before saving. AI has not changed the lead.</p></div><div className="mobile-recording"><button><Play size={15}/></button><div><b>Call recording</b><span>04:38 · Transcript ready</span></div><ChevronRight size={16}/></div><label className="mobile-field"><span>Lead temperature</span><div className="mobile-temperature">{["Hot","Warm","Cold"].map((item)=><button key={item} className={selected===item?"active":""} onClick={()=>setSelected(item)}>{item}</button>)}</div></label><label className="mobile-field"><span>Primary objection</span><button className="mobile-select">Financial concern <ChevronDown size={15}/></button><small><Play size={11}/> Evidence · Patient at 00:24</small></label><label className="mobile-field"><span>Structured remark</span><textarea rows={6} defaultValue="High intent for knee replacement before Dasara. Daughter Priya is decision-maker. Cost and EMI are primary concern. Saturday consultation accepted. Call at 4:30 PM to confirm Priya."/></label><label className="mobile-field"><span>Next action</span><button className="mobile-select">Today · 4:30 PM <CalendarDays size={15}/></button></label></div><div className="mobile-sticky-actions"><Button variant="outline" onClick={()=>notify("Mobile call draft saved")}>Draft</Button><Button className="primary-action" onClick={()=>{notify("Call confirmed and attached to Lead 360");openScreen("mobile-lead-360");}}><Check/> Confirm & save</Button></div></div>;}

function MobileLead360({openScreen}:{openScreen:(id:string)=>void}){return <div className="mobile-screen"><MobileHeader title="Lead 360" subtitle="TRH-24190" back="mobile-call-queue" openScreen={openScreen} right={<button><MoreHorizontal/></button>}/><div className="mobile-body lead360-mobile"><div className="mobile-profile"><div className="large-avatar">LN</div><div><h2>Lakshmi Narayana</h2><span>+91 98491 22618 · Warangal</span><Badge variant="outline" className="status-hot">Hot · 86</Badge></div></div><div className="mobile-profile-actions"><button><MessageSquare size={17}/> Message</button><button className="call" onClick={()=>openScreen("mobile-active-call")}><Phone size={17}/> Call now</button></div><div className="mobile-ai-summary"><div><Sparkles size={16}/><b>Journey summary</b></div><p>Wants surgery before Dasara. Daughter decides. Cost is the main concern. Saturday consultation accepted.</p><button>View 4 evidence moments</button></div><div className="next-mobile-action"><span>Next commitment</span><strong>Confirm daughter’s availability</strong><p>Today · 4:30 PM · in 2h 18m</p><button onClick={()=>openScreen("mobile-follow-up")}>Complete follow-up <ChevronRight size={15}/></button></div><div className="mobile-section-title"><div><span>Recent journey</span><small>8 activities</small></div><button>View all</button></div><div className="mobile-timeline"><TimelineItem icon={PhoneCall} tone="navy" title="Meaningful call" time="Today · 10:42 AM" meta="4m 38s · Recorded" body="Cost discussed; daughter must confirm." action="Play & read"/><TimelineItem icon={CalendarDays} tone="green" title="Appointment booked" time="Yesterday" meta="07 Sep · 11:30 AM" body="Dr. A. Shashank · Banjara Hills" action="Open"/></div></div></div>;}

function MobileManager(){return <div className="mobile-screen"><MobileHeader title="Manager brief" subtitle="Live · All branches" right={<div className="user-avatar small">NN</div>}/><div className="mobile-body"><div className="manager-mobile-hero"><span>Conversion today</span><strong>8.1%</strong><small>+1.2 pts vs 30-day average</small></div><div className="mobile-metrics"><div><span>New leads</span><strong>142</strong><small>Today</small></div><div><span>SLA risk</span><strong>11</strong><small>Needs action</small></div><div><span>Appointments</span><strong>38</strong><small>Booked</small></div></div><div className="mobile-ai-summary"><div><Sparkles size={16}/><b>Manager attention</b></div><p>Six Meta leads crossed first-touch SLA. Reassigning now may recover four.</p><button>Open affected leads</button></div><div className="mobile-section-title"><div><span>Funnel today</span><small>142 leads</small></div><button>Details</button></div><div className="mobile-funnel">{funnelStages.slice(0,5).map((stage,index)=><div key={stage.label}><span>{stage.label}</span><i><b style={{width:`${100-index*14}%`}}/></i><strong>{Math.round(stage.value/20)}</strong></div>)}</div><div className="mobile-section-title"><div><span>Agent exceptions</span><small>Sorted by risk</small></div></div>{[["Kiran Reddy","6 SLA breaches"],["Anil Kumar","9 weak remarks"],["Sravani K.","3 overdue follow-ups"]].map((row)=><button className="mobile-alert-row" key={row[0]}><div className="mini-avatar">{row[0].split(" ").map((p)=>p[0]).join("")}</div><span><b>{row[0]}</b><small>{row[1]}</small></span><ChevronRight size={15}/></button>)}</div></div>;}

function MobileSignIn({openScreen}:{openScreen:(id:string)=>void}){return <div className="mobile-screen sign-in-screen"><PhoneStatus/><div className="sign-in-brand"><div className="brand-mark large">T</div><strong>TRH360</strong><span>Human + AI CRM</span></div><div className="sign-in-form"><h1>Welcome back</h1><p>Sign in to your Meenestham workspace.</p><label><span>Mobile or work email</span><input defaultValue="sravani@meenestham.in"/></label><label><span>Password</span><input type="password" defaultValue="password"/></label><Button className="primary-action full-width" onClick={()=>openScreen("mobile-permissions")}>Sign in securely</Button><button className="forgot">Forgot password?</button></div><div className="secure-note"><LockKeyhole size={14}/> Protected with workspace access controls</div></div>;}

function MobilePermissions({openScreen}:{openScreen:(id:string)=>void}){return <div className="mobile-screen"><PhoneStatus/><div className="permission-intro"><div className="permission-icon"><PhoneCall size={25}/></div><h1>Set up calling</h1><p>TRH360 needs these permissions to start calls, attach recordings, and keep your work complete.</p></div><div className="permission-list"><div><Phone size={19}/><span><b>Phone</b><small>Start calls from your assigned lead list</small></span><Check size={17}/></div><div><Mic size={19}/><span><b>Microphone</b><small>Record calls after consent is captured</small></span><Check size={17}/></div><div><Bell size={19}/><span><b>Notifications</b><small>Remind you about commitments and SLA</small></span><Check size={17}/></div><div><Upload size={19}/><span><b>Background upload</b><small>Securely attach audio after the call</small></span><Check size={17}/></div></div><div className="permission-guardrail"><ShieldCheck size={17}/><p>Recording follows your organization’s consent policy. You will always see when it is active.</p></div><div className="mobile-sticky-actions single"><Button className="primary-action" onClick={()=>openScreen("mobile-home")}>Allow & continue</Button></div></div>;}

function MobileAppointment({notify}:{notify:(message:string)=>void}){return <div className="mobile-screen"><MobileHeader title="Book appointment" subtitle="Lakshmi Narayana" back="mobile-lead-360"/><div className="mobile-body"><div className="form-progress"><span className="active"/><span className="active"/><span/><small>Availability</small></div><label className="mobile-field"><span>Branch</span><button className="mobile-select">Banjara Hills <ChevronDown size={15}/></button></label><label className="mobile-field"><span>Department & doctor</span><button className="mobile-select">Orthopaedics · Dr. Shashank <ChevronDown size={15}/></button></label><label className="mobile-field"><span>Date</span><div className="date-options">{["Sat\n07","Mon\n09","Tue\n10","Wed\n11"].map((item,index)=><button className={index===0?"active":""} key={item}>{item.split("\n").map((part)=><span key={part}>{part}</span>)}</button>)}</div></label><label className="mobile-field"><span>Available time</span><div className="time-options">{["10:30 AM","11:30 AM","2:00 PM","4:30 PM"].map((item,index)=><button className={index===1?"active":""} key={item}>{item}</button>)}</div></label><label className="mobile-field"><span>Purpose</span><button className="mobile-select">Knee replacement consultation <ChevronDown size={15}/></button></label><div className="mobile-ai-note"><ShieldCheck size={17}/><p>Booking becomes the next commitment and updates Lead 360.</p></div></div><div className="mobile-sticky-actions single"><Button className="primary-action" onClick={()=>notify("Appointment booked for 07 Sep at 11:30 AM")}>Confirm appointment</Button></div></div>;}

function MobileFollowUp({notify}:{notify:(message:string)=>void}){return <div className="mobile-screen"><MobileHeader title="Complete follow-up" subtitle="Commitment due · 4:30 PM" back="mobile-lead-360"/><div className="mobile-body"><div className="mobile-ai-note"><Sparkles size={17}/><p>Context: confirm Priya’s availability and check whether the written EMI estimate was received.</p></div><label className="mobile-field"><span>Outcome</span><button className="mobile-select">Connected · Positive <ChevronDown size={15}/></button></label><label className="mobile-field"><span>What changed?</span><textarea rows={6} defaultValue="Daughter can join the Saturday appointment. EMI estimate received; wants final hospital package after consultation."/></label><label className="mobile-field"><span>Temperature</span><div className="mobile-temperature"><button className="active">Hot</button><button>Warm</button><button>Cold</button></div></label><label className="mobile-field"><span>Next commitment</span><button className="mobile-select">Appointment · 07 Sep, 11:30 AM <CalendarDays size={15}/></button></label></div><div className="mobile-sticky-actions single"><Button className="primary-action" onClick={()=>notify("Follow-up completed and journey updated")}>Save follow-up</Button></div></div>;}

function MobileTasks({openScreen}:{openScreen:(id:string)=>void}){return <div className="mobile-screen"><MobileHeader title="Tasks" subtitle="28 due today" back="mobile-home" openScreen={openScreen} right={<button><Filter size={18}/></button>}/><div className="mobile-body"><div className="mobile-tabs"><button className="active">Due now</button><button>Later</button><button>Done</button></div>{[["Call Lakshmi Narayana","Confirm decision-maker","Now","hot"],["Send EMI estimate to Madhavi","WhatsApp · Financial","11:30 AM",""],["Retry Prakash Reddy","Third call attempt","12:15 PM",""],["Confirm Dr. visit with Faizal","Appointment · Cardiology","2:00 PM",""]].map((row)=><button className="task-card" key={row[0]} onClick={()=>row[0].startsWith("Call")&&openScreen("mobile-active-call")}><span className={row[3]}><CircleCheck size={17}/></span><div><strong>{row[0]}</strong><small>{row[1]}</small></div><b>{row[2]}</b></button>)}</div><MobileBottomNav active="Tasks" openScreen={openScreen}/></div>;}

function MobileNotifications(){return <div className="mobile-screen"><MobileHeader title="Notifications" subtitle="5 unread" back="mobile-home"/><div className="mobile-body"><div className="queue-date"><span>Today</span></div>{[[AlarmClock,"SLA crossed for 3 new leads","Reassign or call now","2 min ago"],[CalendarDays,"Appointment confirmed","Lakshmi · 07 Sep, 11:30 AM","18 min ago"],[Sparkles,"AI draft ready for review","Call with Madhavi · 6m 02s","24 min ago"],[MessageSquare,"Patient replied on WhatsApp","Faizal: ‘Tomorrow morning works’","41 min ago"]].map(([Icon,title,detail,time])=>{const NotificationIcon=Icon as LucideIcon;return <button className="notification-card" key={title as string}><div><NotificationIcon size={17}/></div><span><strong>{title as string}</strong><small>{detail as string}</small><em>{time as string}</em></span></button>;})}</div></div>;}

function ScreenAtlas({search,setSearch,activeId,openScreen,close}:{search:string;setSearch:(value:string)=>void;activeId:string;openScreen:(id:string)=>void;close:()=>void}){
  const filtered=useMemo(()=>crmScreens.filter((screen)=>`${screen.title} ${screen.role} ${screen.module}`.toLowerCase().includes(search.toLowerCase())),[search]);
  const groups=(["Shared","Agent","Manager","Leadership","Operations","Admin","Voice AI","Mobile"] as ScreenRole[]).map((role)=>({role,screens:filtered.filter((screen)=>screen.role===role)})).filter((group)=>group.screens.length);
  return <div className="atlas-overlay"><div className="atlas-backdrop" onClick={close}/><section className="atlas-panel"><div className="atlas-header"><div><span className="eyebrow">Product blueprint</span><h1>TRH360 Screen Atlas</h1><p>{crmScreens.length} connected screens across desktop, mobile, human operations, and Voice AI.</p></div><button onClick={close}><X size={21}/></button></div><div className="atlas-search"><Search size={18}/><Input autoFocus value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search all screens…"/><span>{filtered.length} screens</span></div><div className="atlas-body">{groups.map((group)=><div className="atlas-group" key={group.role}><div className="atlas-group-title"><span>{group.role}</span><b>{roleCounts[group.role]}</b></div><div className="atlas-grid">{group.screens.map((screen,index)=><button key={screen.id} className={activeId===screen.id?"active":""} onClick={()=>openScreen(screen.id)}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{screen.title}</strong><small>{screen.module} · {screen.experience}</small></div><ChevronRight size={15}/></button>)}</div></div>)}</div><footer className="atlas-footer"><ShieldCheck size={16}/><span>One shared design system. Role-based permissions. Complete auditability.</span><b>{crmScreens.length} mapped</b></footer></section></div>;
}

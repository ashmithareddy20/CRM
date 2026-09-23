"use client";

import React, { useState, useEffect } from "react";
import {
  Activity, AlarmClock, AlertTriangle, ArrowDown, ArrowRight, ArrowUpRight,
  BarChart3, Bot, Calendar, CalendarDays, Check, CheckCircle2, ChevronDown,
  ChevronRight, CircleAlert, CircleCheck, Clock, Download, ExternalLink,
  Eye, FileAudio, FileCheck, FileSpreadsheet, FileText, Filter, Headphones,
  History, Layers, MessageSquare, Mic, Phone, PhoneCall, PhoneForwarded,
  PhoneMissed, Play, Plus, RefreshCw, RotateCcw, Search, Send, Settings,
  ShieldAlert, ShieldCheck, Sparkles, Target, TrendingDown, TrendingUp,
  Upload, User, UserCheck, UserPlus, Users, Volume2, Wallet, X, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";

// ============================================================================
// VOICE AI CONTROL WORKSPACE SCREENS (Uploaded Screenshot 1 Reference)
// ============================================================================

export function VoiceCampaignsScreen({ notify }: { notify: (msg: string) => void }) {
  const [campaigns, setCampaigns] = useState([
    { id: "vcamp-1", name: "Knee Care Telugu — Q3 Inbound Triage", status: "Live", language: "Telugu (te-IN)", pace: "12 calls/min", dialTarget: 1200, dialed: 628, connected: 492, transferRate: "24.2%", agentVoice: "Kavitha (Empathetic Senior Counselor)" },
    { id: "vcamp-2", name: "No-Show Recovery — Saturday OPD Desk", status: "Live", language: "Telugu + Hindi", pace: "8 calls/min", dialTarget: 480, dialed: 318, connected: 264, transferRate: "38.6%", agentVoice: "Suresh (Clinical Coordinator)" },
    { id: "vcamp-3", name: "Financial & 0% EMI Document Reminder", status: "Paused", language: "Hindi (hi-IN)", pace: "5 calls/min", dialTarget: 620, dialed: 204, connected: 161, transferRate: "18.5%", agentVoice: "Priya (Billing Specialist)" },
    { id: "vcamp-4", name: "Laser Piles Consultation Triage", status: "Live", language: "Telugu (te-IN)", pace: "10 calls/min", dialTarget: 800, dialed: 540, connected: 412, transferRate: "31.0%", agentVoice: "Kavitha (Empathetic Senior Counselor)" },
  ]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Voice AI Control · Campaigns</p>
          <h1>Autonomous Voice Campaigns</h1>
          <p className="page-description">
            High-concurrency outbound AI calling agents with native Telugu, Hindi, and English multilingual STT/TTS.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="outline" onClick={() => notify("Campaign list exported.")}><Download size={14} /> Export</Button>
          <Button className="primary-action" onClick={() => notify("New AI campaign wizard launched.")}><Plus size={14} /> New Campaign</Button>
        </div>
      </div>

      <div className="metric-grid four">
        <div className="metric-card"><span className="metric-label">Live Campaigns</span><strong className="metric-value">3 Active</strong><span className="metric-delta positive">1,486 calls completed</span></div>
        <div className="metric-card"><span className="metric-label">Avg Connection Rate</span><strong className="metric-value">79.2%</strong><span className="metric-delta positive">+6.4% vs telecom IVR</span></div>
        <div className="metric-card"><span className="metric-label">Human Transfer Rate</span><strong className="metric-value">28.4%</strong><span className="metric-delta positive">Hot intent warm transfers</span></div>
        <div className="metric-card"><span className="metric-label">Avg Dial-to-Connect</span><strong className="metric-value">8.2 sec</strong><span className="metric-delta neutral">Target: &lt;10s</span></div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Active & Scheduled Voice Runs</h3>
            <p>Monitored in real time with Soniox multilingual speech recognition</p>
          </div>
        </div>
        <div className="generic-table">
          <div className="generic-row head">
            <span>Campaign Name</span>
            <span>Language & Persona</span>
            <span>Progress</span>
            <span>Connected</span>
            <span>Warm Transfer</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          {campaigns.map((c) => (
            <div className="generic-row" key={c.id}>
              <div>
                <strong>{c.name}</strong>
                <div style={{ fontSize: 11, color: "var(--subtle)" }}>Pacing: {c.pace}</div>
              </div>
              <div>
                <Badge variant="outline">{c.language}</Badge>
                <div style={{ fontSize: 11, color: "var(--navy)", marginTop: 2 }}>{c.agentVoice}</div>
              </div>
              <div style={{ minWidth: 120 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                  <span>{c.dialed}/{c.dialTarget}</span>
                  <strong>{Math.round((c.dialed / c.dialTarget) * 100)}%</strong>
                </div>
                <Progress value={(c.dialed / c.dialTarget) * 100} />
              </div>
              <div>
                <strong>{c.connected}</strong>
                <span style={{ fontSize: 11, color: "#166534", marginLeft: 4 }}>({Math.round((c.connected / (c.dialed || 1)) * 100)}%)</span>
              </div>
              <div>
                <strong style={{ color: "var(--gold)" }}>{c.transferRate}</strong>
              </div>
              <div>
                <Badge style={{ background: c.status === "Live" ? "#22c55e" : "#e2e8f0", color: c.status === "Live" ? "#ffffff" : "#475569" }}>
                  {c.status}
                </Badge>
              </div>
              <div>
                <Button variant="outline" size="sm" onClick={() => notify(`Campaign "${c.name}" paused/resumed`)}>
                  {c.status === "Live" ? "Pause" : "Resume"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function VoiceAgentConfigScreen({ notify }: { notify: (msg: string) => void }) {
  const [agents, setAgents] = useState([
    { id: "agent-kavitha", name: "Kavitha", role: "Telugu Knee Care Specialist", model: "Gemini 2.5 Flash + Soniox Telugu STT", latency: "420ms", interruption: "Enabled (High Sensitivity)", confidenceThreshold: "85%" },
    { id: "agent-suresh", name: "Suresh", role: "Hospital OPD & No-Show Recovery Desk", model: "Gemini 2.5 Flash + Soniox Multilingual", latency: "380ms", interruption: "Enabled (Medium)", confidenceThreshold: "88%" },
    { id: "agent-priya", name: "Priya", role: "Financial Counseling & TPA Insurance", model: "Gemini 2.5 Flash + Multilingual TTS", latency: "450ms", interruption: "Enabled (Strict)", confidenceThreshold: "90%" },
  ]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Voice AI Control · Agents</p>
          <h1>Voice Agent Personas & Speech Models</h1>
          <p className="page-description">
            Configure conversational guardrails, speech latency, language accents, and human-agent handoff criteria.
          </p>
        </div>
        <div className="page-actions">
          <Button className="primary-action" onClick={() => notify("New persona created.")}><Plus size={14} /> New Persona</Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {agents.map((a) => (
          <section className="panel" key={a.id} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--navy)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                    {a.name[0]}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{a.name}</h3>
                    <span style={{ fontSize: 12, color: "var(--subtle)" }}>{a.role}</span>
                  </div>
                </div>
                <Badge variant="outline" style={{ borderColor: "#22c55e", color: "#15803d" }}>Active</Badge>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, background: "#f8fafc", padding: 12, borderRadius: 6 }}>
                <div><strong>AI Architecture:</strong> {a.model}</div>
                <div><strong>Speech Latency:</strong> <span style={{ color: "#15803d", fontWeight: 600 }}>{a.latency}</span></div>
                <div><strong>Interruption Handling:</strong> {a.interruption}</div>
                <div><strong>Auto-Review Threshold:</strong> &lt; {a.confidenceThreshold} confidence</div>
              </div>
            </div>

            <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <span style={{ fontSize: 12, color: "var(--subtle)" }}>Audio Sample: 0:14s</span>
              <Button variant="outline" size="sm" onClick={() => notify(`Testing voice persona "${a.name}"`)}>
                <Volume2 size={14} /> Test Audio Voice
              </Button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function VoiceRunsScreen({ notify }: { notify: (msg: string) => void }) {
  const [runs] = useState([
    { id: "RUN-9821", lead: "Lakshmi Narayana", phone: "+91 98491 22618", duration: "1m 42s", intent: "Hot (Surgery Advised)", language: "Telugu", confidence: 94, status: "Transferred to Agent" },
    { id: "RUN-9820", lead: "Ravi Kumar", phone: "+91 97011 22441", duration: "2m 15s", intent: "Warm (Needs Pricing)", language: "Telugu", confidence: 89, status: "Cadence Scheduled" },
    { id: "RUN-9819", lead: "Suresh Babu", phone: "+91 98850 99120", duration: "48s", intent: "Not Connected (Busy)", language: "Telugu", confidence: 100, status: "Double-Dial Scheduled" },
    { id: "RUN-9818", lead: "Praveen Reddy", phone: "+91 90102 33418", duration: "3m 04s", intent: "Hot (Consult Confirmed)", language: "Hindi", confidence: 91, status: "Appointment Created" },
    { id: "RUN-9817", lead: "Anitha Devi", phone: "+91 93920 11982", duration: "1m 18s", intent: "Review Required", language: "Telugu", confidence: 78, status: "In Review Queue" },
  ]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Voice AI Control · Call Runs</p>
          <h1>Call Execution History & Soniox Transcripts</h1>
          <p className="page-description">Every automated AI call creates an immutable call run record with diarized speech, detected intent, and outcome disposition.</p>
        </div>
        <div className="page-actions">
          <Button variant="outline"><Filter size={14} /> Filter</Button>
          <Button variant="outline"><Download size={14} /> Export Audio Logs</Button>
        </div>
      </div>

      <section className="panel">
        <div className="generic-table">
          <div className="generic-row head">
            <span>Run ID & Lead</span>
            <span>Phone</span>
            <span>Duration & Lang</span>
            <span>Detected Intent</span>
            <span>Confidence</span>
            <span>Disposition</span>
            <span>Action</span>
          </div>
          {runs.map((r) => (
            <div className="generic-row" key={r.id}>
              <div>
                <strong>{r.lead}</strong>
                <div style={{ fontSize: 11, color: "var(--subtle)" }}>{r.id}</div>
              </div>
              <div style={{ fontFamily: "monospace" }}>{r.phone}</div>
              <div>
                <strong>{r.duration}</strong>
                <div style={{ fontSize: 11, color: "var(--subtle)" }}>{r.language}</div>
              </div>
              <div>
                <Badge variant={r.intent.includes("Hot") ? "default" : "outline"}>{r.intent}</Badge>
              </div>
              <div>
                <span style={{ fontWeight: 600, color: r.confidence >= 85 ? "#166534" : "#b91c1c" }}>{r.confidence}%</span>
              </div>
              <div>{r.status}</div>
              <div>
                <Button variant="outline" size="sm" onClick={() => notify(`Opening transcript & audio for ${r.id}`)}>
                  <Headphones size={13} /> Review
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function VoiceLiveMonitorScreen({ notify }: { notify: (msg: string) => void }) {
  const [activeCalls] = useState([
    { id: "call-live-1", lead: "Chandra Sekhar", phone: "+91 99480 12048", agent: "Kavitha AI", duration: "0:48", liveText: "Patient asking: శనివారం డాక్టర్ రమేష్ గారు ఏ టైం కి అవైలబుల్ ఉంటారు? (Asking Saturday slot timing)", sentiment: "Positive", transferFlag: true },
    { id: "call-live-2", lead: "Sunitha Rao", phone: "+91 98480 34912", agent: "Kavitha AI", duration: "1:14", liveText: "Explaining laser procedure duration: సర్జరీ కేవలం 30 నిమిషాలు మాత్రమే పడుతుంది, అదే రోజు డిశ్చార్జ్ ఉంటుంది.", sentiment: "Engaged", transferFlag: false },
    { id: "call-live-3", lead: "Venkat Raman", phone: "+91 97000 88914", agent: "Suresh AI", duration: "0:22", liveText: "Greeting and identity verification in progress...", sentiment: "Neutral", transferFlag: false },
  ]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Voice AI Control · Live Monitor</p>
          <h1>Live Concurrent Telephony Stream</h1>
          <p className="page-description">Real-time supervision of ongoing conversational AI calls with live STT transcript stream and instant human barge-in.</p>
        </div>
        <div className="page-actions">
          <Badge style={{ background: "#ef4444", color: "#ffffff", padding: "6px 12px", animation: "pulse 2s infinite" }}>
            ● 3 Live Streams Active
          </Badge>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
        {activeCalls.map((c) => (
          <section className="panel" key={c.id} style={{ borderLeft: c.transferFlag ? "4px solid var(--gold)" : "4px solid #22c55e" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <strong style={{ fontSize: 15 }}>{c.lead}</strong>
                <div style={{ fontSize: 12, color: "var(--subtle)" }}>{c.phone} · Agent: {c.agent}</div>
              </div>
              <Badge variant="outline" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Clock size={12} /> {c.duration}
              </Badge>
            </div>

            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6, fontSize: 13, minHeight: 70, border: "1px solid #e2e8f0", lineHeight: 1.4 }}>
              <span style={{ fontSize: 10, color: "var(--gold)", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Live STT Stream</span>
              "{c.liveText}"
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12 }}>Sentiment: <strong>{c.sentiment}</strong></span>
              <div style={{ display: "flex", gap: 6 }}>
                <Button variant="outline" size="sm" onClick={() => notify(`Listening in silently on ${c.lead}`)}>
                  <Headphones size={13} /> Listen
                </Button>
                <Button className="primary-action" size="sm" onClick={() => notify(`Human agent took over call with ${c.lead}`)}>
                  <PhoneForwarded size={13} /> Barge-in
                </Button>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// WORKSPACE ADMIN WORKSPACE SCREENS (Uploaded Screenshot 2 Reference)
// ============================================================================

export function AdminSourcesScreen({ notify }: { notify: (msg: string) => void }) {
  const [sources] = useState([
    { source: "Facebook", campaigns: 8, leads: 1104, connectedRate: "72.4%", hotRate: "34.1%", junkRate: "4.2%", costPerSurgery: "₹6,800" },
    { source: "Google Ads", campaigns: 5, leads: 486, connectedRate: "81.6%", hotRate: "48.2%", junkRate: "1.8%", costPerSurgery: "₹4,200" },
    { source: "YouTube", campaigns: 4, leads: 426, connectedRate: "76.8%", hotRate: "38.5%", junkRate: "3.1%", costPerSurgery: "₹5,400" },
    { source: "Website Organic", campaigns: 1, leads: 384, connectedRate: "88.2%", hotRate: "52.0%", junkRate: "0.8%", costPerSurgery: "₹2,100" },
    { source: "Direct Call / IVR", campaigns: 1, leads: 448, connectedRate: "94.0%", hotRate: "61.5%", junkRate: "0.5%", costPerSurgery: "₹1,800" },
  ]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Workspace Admin · Lead Intake</p>
          <h1>Source Taxonomy & Campaign Hierarchy</h1>
          <p className="page-description">
            Thesis Principle 3.1: "No Lead Without a Source". Hierarchical mapping from Platform → Campaign → Ad Set → Creative → Landing Page → Disease.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="outline"><Upload size={14} /> Import Sources</Button>
          <Button className="primary-action" onClick={() => notify("New source configured.")}><Plus size={14} /> Add Source</Button>
        </div>
      </div>

      <div className="metric-grid four">
        <div className="metric-card"><span className="metric-label">Active Sources</span><strong className="metric-value">16 Channels</strong><span className="metric-delta positive">100% attributed</span></div>
        <div className="metric-card"><span className="metric-label">Active Campaigns</span><strong className="metric-value">24 Live</strong><span className="metric-delta neutral">Multi-specialty</span></div>
        <div className="metric-card"><span className="metric-label">Junk Data Rate</span><strong className="metric-value">2.4%</strong><span className="metric-delta positive">-1.8% vs last month</span></div>
        <div className="metric-card"><span className="metric-label">Lowest Cost / Surgery</span><strong className="metric-value">₹1,800</strong><span className="metric-delta positive">Direct Call Helpline</span></div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Source Quality & Granular Performance</h3>
            <p>Thesis Section 5 & 6: Measure quality by conversion and cost per surgery, never lead volume alone.</p>
          </div>
        </div>
        <div className="generic-table">
          <div className="generic-row head">
            <span>Lead Source</span>
            <span>Campaigns</span>
            <span>Volume</span>
            <span>Connected %</span>
            <span>Hot Lead %</span>
            <span>Junk %</span>
            <span>Cost / Surgery</span>
            <span>Status</span>
          </div>
          {sources.map((s) => (
            <div className="generic-row" key={s.source}>
              <strong>{s.source}</strong>
              <div>{s.campaigns} campaigns</div>
              <div><strong>{s.leads}</strong> leads</div>
              <div style={{ color: "#166534", fontWeight: 600 }}>{s.connectedRate}</div>
              <div style={{ color: "var(--gold)", fontWeight: 600 }}>{s.hotRate}</div>
              <div style={{ color: parseFloat(s.junkRate) > 3 ? "#b91c1c" : "var(--subtle)" }}>{s.junkRate}</div>
              <div><strong>{s.costPerSurgery}</strong></div>
              <div><Badge variant="outline">Verified</Badge></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function AdminTelephonyScreen({ notify }: { notify: (msg: string) => void }) {
  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Workspace Admin · Telephony</p>
          <h1>Telephony Gateways & 5-Day Double-Dial Cadence</h1>
          <p className="page-description">Configure SIP trunks, Exotel / Twilio cloud gateways, recording consent disclosures, and automated double-dial intervals.</p>
        </div>
        <div className="page-actions">
          <Button className="primary-action" onClick={() => notify("Telephony settings saved.")}>Save Telephony Config</Button>
        </div>
      </div>

      <div className="settings-grid">
        <section className="panel">
          <div className="panel-header">
            <h3>Telephony Integration Settings</h3>
            <p>Thesis Section 6 & 15 telephony compliance rules</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="config-row">
              <div>
                <strong>Primary Outbound Cloud Trunk</strong>
                <p>Exotel India Enterprise PRI / SIP Trunk</p>
              </div>
              <Badge style={{ background: "#22c55e", color: "#ffffff" }}>Connected</Badge>
            </div>
            <div className="config-row">
              <div>
                <strong>Secondary Gateway / Failover</strong>
                <p>Twilio India Trunk</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="config-row">
              <div>
                <strong>Thesis Section 15 Double-Dial Protocol</strong>
                <p>Automatically triggers two call attempts separated by 15-minute interval for unreached leads</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="config-row">
              <div>
                <strong>Two-Way Call Audio Recording & Soniox Transcribe</strong>
                <p>Complies with DPDP Act with mandatory opening bilingual consent prompt</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="config-row">
              <div>
                <strong>Agent Caller ID Masking</strong>
                <p>Protects patient privacy; agents dial through unified hospital virtual numbers</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>5-Day Not Connected Cadence Schedule</h3>
            <p>Strictly governed by Thesis Section 15</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
            <div style={{ padding: 8, background: "#f8fafc", borderRadius: 6 }}>
              <strong>Day 1:</strong> Double Dial + Initial WhatsApp Acknowledgement
            </div>
            <div style={{ padding: 8, background: "#f8fafc", borderRadius: 6 }}>
              <strong>Day 2:</strong> Alternative-Time Call Attempt (No routine messaging)
            </div>
            <div style={{ padding: 8, background: "#f8fafc", borderRadius: 6 }}>
              <strong>Day 3:</strong> Double Dial + Visual RCS / MMS Education Card
            </div>
            <div style={{ padding: 8, background: "#f8fafc", borderRadius: 6 }}>
              <strong>Day 4:</strong> Morning / Evening Shifted Call Attempt
            </div>
            <div style={{ padding: 8, background: "#f8fafc", borderRadius: 6 }}>
              <strong>Day 5:</strong> Double Dial + Final WhatsApp Follow-up (Auto-moves to 90-day pool)
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function AdminAuditScreen({ notify }: { notify: (msg: string) => void }) {
  const [logs] = useState([
    { id: "AUD-1042", actor: "Sravani K. (Agent)", action: "Lead Qualification Changed", entity: "TRH-24190 (Lakshmi N.)", details: "Warm → Hot (Score: 84 pts, severe joint pain, surgery intent)", time: "18 min ago" },
    { id: "AUD-1041", actor: "Anil M. (Manager)", action: "Lead Reassigned (SLA Breach)", entity: "TRH-24168 (Prakash R.)", details: "Uncalled for 18 min (>15m threshold). Reassigned to Divya M.", time: "42 min ago" },
    { id: "AUD-1040", actor: "Dr. Ramesh (Admin)", action: "Discount Request Approved", entity: "TRH-24179 (Mohammed F.)", details: "₹15,000 package relief approved for TPA cashless procedure", time: "1 hr ago" },
    { id: "AUD-1039", actor: "System Engine", action: "48-Hour Cadence Executed", entity: "TRH-24184 (Madhavi R.)", details: "Touch 2 (RCS Visual Card) dispatched after 48h WhatsApp touch", time: "2 hrs ago" },
    { id: "AUD-1038", actor: "Sravani K. (Agent)", action: "Lead Closure Diagnosed", entity: "TRH-24102 (Venkat B.)", details: "Primary: Financial Issue · Secondary: Package Above Budget · Recoverable: Yes (30-day pool)", time: "Yesterday" },
  ]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Workspace Admin · Audit Log</p>
          <h1>Immutable System Audit Trail</h1>
          <p className="page-description">
            Thesis Principle 3.4 & 29: "No CRM Status Without an Audit Trail". No user can modify historical activity silently.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="outline"><Download size={14} /> Export Encrypted Audit Trail</Button>
        </div>
      </div>

      <section className="panel">
        <div className="generic-table">
          <div className="generic-row head">
            <span>Log ID & Timestamp</span>
            <span>Actor / Member</span>
            <span>Action Type</span>
            <span>Entity Affected</span>
            <span>Evidence & Details</span>
          </div>
          {logs.map((l) => (
            <div className="generic-row" key={l.id}>
              <div>
                <strong>{l.id}</strong>
                <div style={{ fontSize: 11, color: "var(--subtle)" }}>{l.time}</div>
              </div>
              <div><strong>{l.actor}</strong></div>
              <div><Badge variant="outline">{l.action}</Badge></div>
              <div><strong style={{ color: "var(--navy)" }}>{l.entity}</strong></div>
              <div style={{ fontSize: 12, color: "#334155" }}>{l.details}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// CLINICAL OPERATIONS WORKSPACE SCREENS (Uploaded Screenshot 3 Reference)
// ============================================================================

export function OpsAppointmentsScreen({ notify }: { notify: (msg: string) => void }) {
  const [appointments] = useState([
    { id: "APT-801", patient: "Lakshmi Narayana", doctor: "Dr. K. Ramesh (Senior Orthopedic)", time: "Tomorrow, 11:30 AM", type: "In-Clinic OPD", stage: "Confirmed", phone: "+91 98491 22618" },
    { id: "APT-802", patient: "Madhava Rao", doctor: "Dr. P. Sailaja (Urologist)", time: "Tomorrow, 2:15 PM", type: "In-Clinic OPD", stage: "Confirmation Pending", phone: "+91 99850 41172" },
    { id: "APT-803", patient: "Mohammed Faizal", doctor: "Dr. K. Ramesh (Senior Orthopedic)", time: "Friday, 10:00 AM", type: "Video Consultation", stage: "Booked", phone: "+91 97011 98420" },
    { id: "APT-804", patient: "Sailaja Devi", doctor: "Dr. Anil Kumar (General Surgeon)", time: "Saturday, 12:00 PM", type: "In-Clinic OPD", stage: "Rescheduled", phone: "+91 93920 36442" },
  ]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Clinical Operations · Appointments</p>
          <h1>OPD Consultation Scheduling & Verification</h1>
          <p className="page-description">Thesis Section 17: Track patient progression through all 10 appointment stages from Suggested to Completed.</p>
        </div>
        <div className="page-actions">
          <Button variant="outline"><Calendar size={14} /> Day View</Button>
          <Button className="primary-action" onClick={() => notify("Appointment booked.")}><Plus size={14} /> Book Slot</Button>
        </div>
      </div>

      <div className="metric-grid four">
        <div className="metric-card"><span className="metric-label">Today's Consultations</span><strong className="metric-value">28 Booked</strong><span className="metric-delta positive">22 confirmed</span></div>
        <div className="metric-card"><span className="metric-label">Arrival Rate</span><strong className="metric-value">84.2%</strong><span className="metric-delta positive">+4.8% vs last week</span></div>
        <div className="metric-card"><span className="metric-label">Pending Confirmations</span><strong className="metric-value">6 Leads</strong><span className="metric-delta neutral">Automated RCS sent</span></div>
        <div className="metric-card"><span className="metric-label">Surgery Advice Rate</span><strong className="metric-value">54.0%</strong><span className="metric-delta positive">Clinical conversion</span></div>
      </div>

      <section className="panel">
        <div className="generic-table">
          <div className="generic-row head">
            <span>Patient Name</span>
            <span>Assigned Specialist</span>
            <span>Scheduled Slot</span>
            <span>Consultation Mode</span>
            <span>Stage</span>
            <span>Action</span>
          </div>
          {appointments.map((a) => (
            <div className="generic-row" key={a.id}>
              <div>
                <strong>{a.patient}</strong>
                <div style={{ fontSize: 11, color: "var(--subtle)" }}>{a.phone}</div>
              </div>
              <div><strong>{a.doctor}</strong></div>
              <div>{a.time}</div>
              <div><Badge variant="outline">{a.type}</Badge></div>
              <div>
                <Badge style={{ background: a.stage === "Confirmed" ? "#22c55e" : "var(--gold)", color: "#ffffff" }}>
                  {a.stage}
                </Badge>
              </div>
              <div>
                <Button variant="outline" size="sm" onClick={() => notify(`Sent WhatsApp reminder card to ${a.patient}`)}>
                  <Send size={13} /> Reminder
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function OpsNoShowScreen({ notify }: { notify: (msg: string) => void }) {
  const [noShows] = useState([
    { id: "NS-401", patient: "K. Venkatesh", date: "Yesterday, 3:30 PM", doctor: "Dr. K. Ramesh", reason: "Transport & Distance Issue", contactAttempts: 2, recoverable: "Yes", action: "Offered Video Consult or Secunderabad Branch" },
    { id: "NS-402", patient: "Padma S.", date: "22 Sep, 11:00 AM", doctor: "Dr. P. Sailaja", reason: "Family Member Unavailable", contactAttempts: 3, recoverable: "Yes", action: "Rescheduled for Saturday Family Slot" },
    { id: "NS-403", patient: "G. Anand", date: "21 Sep, 4:00 PM", doctor: "Dr. Anil Kumar", reason: "Price Concern / Out of Budget", contactAttempts: 2, recoverable: "Yes", action: "Escalated to Financial Desk for 0% EMI" },
  ]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Clinical Operations · No-Shows</p>
          <h1>No-Show Recovery Desk</h1>
          <p className="page-description">
            Thesis Section 2 & 24: "A patient who booked but did not visit requires immediate reason capture, video alternative, or branch rescheduling."
          </p>
        </div>
      </div>

      <div className="metric-grid four">
        <div className="metric-card"><span className="metric-label">No-Shows (Last 7d)</span><strong className="metric-value">18 Patients</strong><span className="metric-delta neutral">11.4% of bookings</span></div>
        <div className="metric-card"><span className="metric-label">Recovered Patients</span><strong className="metric-value">11 Patients</strong><span className="metric-delta positive">61.1% recovery rate</span></div>
        <div className="metric-card"><span className="metric-label">Video Consult Shift</span><strong className="metric-value">5 Patients</strong><span className="metric-delta positive">Overcame distance</span></div>
        <div className="metric-card"><span className="metric-label">Avg Recovery Time</span><strong className="metric-value">4.2 hours</strong><span className="metric-delta positive">Within same day</span></div>
      </div>

      <section className="panel">
        <div className="generic-table">
          <div className="generic-row head">
            <span>Patient</span>
            <span>Missed Slot</span>
            <span>Specialist</span>
            <span>Identified Reason</span>
            <span>Attempts</span>
            <span>Corrective Action Taken</span>
            <span>Action</span>
          </div>
          {noShows.map((n) => (
            <div className="generic-row" key={n.id}>
              <strong>{n.patient}</strong>
              <div>{n.date}</div>
              <div>{n.doctor}</div>
              <div><Badge variant="outline">{n.reason}</Badge></div>
              <div>{n.contactAttempts} calls</div>
              <div style={{ fontSize: 12, color: "var(--navy)", fontWeight: 500 }}>{n.action}</div>
              <div>
                <Button className="primary-action" size="sm" onClick={() => notify(`Rescheduling window opened for ${n.patient}`)}>
                  Reschedule
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function OpsFinancialQueueScreen({ notify }: { notify: (msg: string) => void }) {
  const [cases] = useState([
    { id: "FIN-301", patient: "Mohammed Faizal", procedure: "Laser Hemorrhoidectomy", packageQuoted: "₹45,000", patientBudget: "₹30,000", issue: "Budget Gap (₹15,000)", emiStatus: "Eligible for 6-month 0% EMI (₹5,000/mo)", insurance: "Cashless Star Health (Approved ₹35k)", status: "Counseling Pending" },
    { id: "FIN-302", patient: "Lakshmi Narayana", procedure: "Bilateral Knee Replacement", packageQuoted: "₹2,80,000", patientBudget: "₹2,00,000", issue: "Insurance Pre-Auth Pending", emiStatus: "Not needed", insurance: "HDFC ERGO Pre-auth under review", status: "TPA Desk Follow-up" },
    { id: "FIN-303", patient: "Srinivas Rao", procedure: "Laparoscopic Hernia Repair", packageQuoted: "₹65,000", patientBudget: "₹50,000", issue: "Discount Requested", emiStatus: "Approved ₹10,000 manager relief", insurance: "None (Self-pay)", status: "Discount Approval Pending" },
  ]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Clinical Operations · Financial Desk</p>
          <h1>Commercial Counseling & 0% EMI Support</h1>
          <p className="page-description">
            Thesis Section 16 & 24: "A patient who accepted surgery but could not arrange finance must receive structured financial counseling, package comparison, and insurance support."
          </p>
        </div>
      </div>

      <div className="metric-grid four">
        <div className="metric-card"><span className="metric-label">Active Financial Cases</span><strong className="metric-value">14 Patients</strong><span className="metric-delta neutral">Post-consultation</span></div>
        <div className="metric-card"><span className="metric-label">0% EMI Conversion</span><strong className="metric-value">68.2%</strong><span className="metric-delta positive">Saved price-drop cases</span></div>
        <div className="metric-card"><span className="metric-label">TPA Cashless Pre-Auth</span><strong className="metric-value">₹42.8 Lakhs</strong><span className="metric-delta positive">92% approval rate</span></div>
        <div className="metric-card"><span className="metric-label">Recovered Revenue</span><strong className="metric-value">₹18.4 Lakhs</strong><span className="metric-delta positive">Overcame pricing hurdle</span></div>
      </div>

      <section className="panel">
        <div className="generic-table">
          <div className="generic-row head">
            <span>Patient & Case</span>
            <span>Advised Procedure</span>
            <span>Package Quoted</span>
            <span>Pricing Gap / Issue</span>
            <span>EMI / Insurance Solution</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          {cases.map((c) => (
            <div className="generic-row" key={c.id}>
              <div>
                <strong>{c.patient}</strong>
                <div style={{ fontSize: 11, color: "var(--subtle)" }}>{c.id}</div>
              </div>
              <div>{c.procedure}</div>
              <div><strong>{c.packageQuoted}</strong></div>
              <div><Badge variant="outline" style={{ color: "#b91c1c", borderColor: "#fca5a5" }}>{c.issue}</Badge></div>
              <div style={{ fontSize: 12 }}>
                <div><strong>EMI:</strong> {c.emiStatus}</div>
                <div style={{ color: "var(--subtle)" }}>{c.insurance}</div>
              </div>
              <div><Badge style={{ background: "var(--gold)", color: "#ffffff" }}>{c.status}</Badge></div>
              <div>
                <Button className="primary-action" size="sm" onClick={() => notify(`Financial counseling call placed to ${c.patient}`)}>
                  <PhoneCall size={13} /> Counsel
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// TEAM MANAGER WORKSPACE SCREENS (Uploaded Screenshot 4 Reference)
// ============================================================================

export function ManagerDailyConversionScreen({ notify }: { notify: (msg: string) => void }) {
  const [stages] = useState([
    { stage: "1. Lead Received", count: 2864, drop: "-", conversion: "100%", rootCause: "Ad spend verified" },
    { stage: "2. Meaningful Connection", count: 2176, drop: "688 (24.0%)", conversion: "76.0%", rootCause: "Not-connected double dial cadence active" },
    { stage: "3. Qualified (Hot/Warm)", count: 1824, drop: "352 (16.2%)", conversion: "63.7%", rootCause: "Clinical triage complete" },
    { stage: "4. Hot Leads Due", count: 912, drop: "912 to Warm", conversion: "31.8%", rootCause: "Urgent surgical intent" },
    { stage: "5. Appointment Booked", count: 684, drop: "228 (25.0%)", conversion: "23.9%", rootCause: "Objection handling or slot conflict" },
    { stage: "6. Patient Visited (OPD)", count: 546, drop: "138 (20.2%)", conversion: "19.1%", rootCause: "No-show recovery active" },
    { stage: "7. Surgery Advised", count: 324, drop: "222 (40.7%)", conversion: "11.3%", rootCause: "Medical management recommended" },
    { stage: "8. Financial Counseling Done", count: 282, drop: "42 (13.0%)", conversion: "9.8%", rootCause: "Price objection & 0% EMI applied" },
    { stage: "9. Procedure Booked & OT", count: 248, drop: "34 (12.1%)", conversion: "8.7%", rootCause: "Date fixed" },
    { stage: "10. Converted Revenue Recorded", count: 218, drop: "30 (12.1%)", conversion: "7.6%", rootCause: "₹1.84 Cr Attributed Revenue" },
  ]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Team Manager · Conversion</p>
          <h1>20-Stage Daily Conversion & Funnel Leaks</h1>
          <p className="page-description">
            Thesis Section 25 & 26: Pinpoint exact funnel stage where leads drop and connect each drop to an evidence-backed root cause.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="outline"><Calendar size={14} /> Today</Button>
          <Button className="primary-action" onClick={() => notify("Generating End-of-Day 21:00 Manager Report...")}>
            <FileText size={14} /> End-of-Day Report (21:00)
          </Button>
        </div>
      </div>

      <section className="panel">
        <div className="generic-table">
          <div className="generic-row head">
            <span>Lifecycle Funnel Stage</span>
            <span>Patient Volume</span>
            <span>Drop from Prior</span>
            <span>Cumulative %</span>
            <span>Operating Diagnosis & Next Action</span>
          </div>
          {stages.map((s) => (
            <div className="generic-row" key={s.stage}>
              <strong>{s.stage}</strong>
              <div><strong style={{ fontSize: 14 }}>{s.count}</strong></div>
              <div style={{ color: s.drop === "-" ? "var(--subtle)" : "#b91c1c", fontWeight: 600 }}>{s.drop}</div>
              <div><Badge variant="outline">{s.conversion}</Badge></div>
              <div style={{ fontSize: 12, color: "var(--navy)" }}>{s.rootCause}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ManagerAgentScorecardScreen({
  notify,
  onAddAgent,
  newAgents = [],
}: {
  notify: (msg: string) => void;
  onAddAgent?: () => void;
  newAgents?: any[];
}) {
  const [agents] = useState([
    { name: "Sravani K.", assigned: 148, firstTouch: "4.2 min", connectedRate: "82.4%", hotLeads: 48, followUpCompleted: "96.4%", missedFollowUps: 2, bookings: 36, surgeries: 18, revenue: "₹16.2L", compliance: "98% (High)" },
    { name: "Anil M.", assigned: 132, firstTouch: "6.8 min", connectedRate: "78.0%", hotLeads: 39, followUpCompleted: "92.0%", missedFollowUps: 5, bookings: 28, surgeries: 14, revenue: "₹12.8L", compliance: "94% (Good)" },
    { name: "Divya M.", assigned: 154, firstTouch: "5.1 min", connectedRate: "79.8%", hotLeads: 44, followUpCompleted: "94.2%", missedFollowUps: 4, bookings: 32, surgeries: 15, revenue: "₹13.5L", compliance: "96% (High)" },
    { name: "Kiran R.", assigned: 110, firstTouch: "14.6 min", connectedRate: "64.2%", hotLeads: 21, followUpCompleted: "78.4%", missedFollowUps: 14, bookings: 14, surgeries: 6, revenue: "₹5.4L", compliance: "76% (Breach SLA)" },
  ]);

  const allAgents = [
    ...newAgents.map((na: any) => ({
      name: na.name || "New Telecaller",
      assigned: 0,
      firstTouch: "Active",
      connectedRate: "0%",
      hotLeads: 0,
      followUpCompleted: "100%",
      missedFollowUps: 0,
      bookings: 0,
      surgeries: 0,
      revenue: "₹0",
      compliance: "New Active",
    })),
    ...agents,
  ];

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Team Manager · Team</p>
          <h1>Agent Scorecard: Outcome vs Process Compliance</h1>
          <p className="page-description">
            Thesis Section 28: "The CRM must separate what the agent achieved (Outcomes) from whether the agent followed the required system (Process Compliance)."
          </p>
        </div>
        <div className="page-actions">
          <Button variant="outline"><Download size={14} /> Export</Button>
          {onAddAgent && (
            <Button
              className="primary-action"
              onClick={onAddAgent}
              style={{ background: "#0b2545", color: "#ffffff", fontWeight: 700 }}
            >
              <UserPlus size={14} style={{ marginRight: 6 }} /> Add Telecalling Agent & Issue Credentials
            </Button>
          )}
        </div>
      </div>

      <div className="metric-grid four">
        <div className="metric-card"><span className="metric-label">Active Agents</span><strong className="metric-value">4 Telecallers</strong><span className="metric-delta positive">Full capacity</span></div>
        <div className="metric-card"><span className="metric-label">Team First Touch SLA</span><strong className="metric-value">5.8 min</strong><span className="metric-delta positive">Target: &lt;10 min</span></div>
        <div className="metric-card"><span className="metric-label">Follow-up Compliance</span><strong className="metric-value">91.8%</strong><span className="metric-delta positive">48h rule adherence</span></div>
        <div className="metric-card"><span className="metric-label">Total Monthly Attributed</span><strong className="metric-value">₹47.9 Lakhs</strong><span className="metric-delta positive">From 63 surgeries</span></div>
      </div>

      <section className="panel">
        <div className="generic-table">
          <div className="generic-row head">
            <span>Agent</span>
            <span>Leads</span>
            <span>First Touch</span>
            <span>Connected %</span>
            <span>Hot Leads</span>
            <span>Follow-up Done</span>
            <span>Missed</span>
            <span>Surgeries</span>
            <span>Attributed Rev</span>
            <span>Compliance Score</span>
          </div>
          {allAgents.map((a) => (
            <div className="generic-row" key={a.name}>
              <strong>{a.name}</strong>
              <div>{a.assigned}</div>
              <div style={{ color: parseFloat(a.firstTouch) > 10 ? "#b91c1c" : "#166534", fontWeight: 600 }}>{a.firstTouch}</div>
              <div>{a.connectedRate}</div>
              <div><Badge variant="outline">{a.hotLeads}</Badge></div>
              <div>{a.followUpCompleted}</div>
              <div style={{ color: a.missedFollowUps > 5 ? "#b91c1c" : "var(--subtle)", fontWeight: 600 }}>{a.missedFollowUps}</div>
              <div><strong style={{ color: "var(--navy)" }}>{a.surgeries}</strong></div>
              <div><strong>{a.revenue}</strong></div>
              <div>
                <Badge style={{ background: a.compliance.includes("High") ? "#22c55e" : a.compliance.includes("Good") ? "var(--gold)" : "#ef4444", color: "#ffffff" }}>
                  {a.compliance}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ManagerEscalationsScreen({ notify }: { notify: (msg: string) => void }) {
  const [escalations] = useState([
    { id: "ESC-11", lead: "Prakash Reddy", issue: "5-Minute Uncalled SLA Breached", uncalledTime: "36 hours uncalled", assignedTo: "Kiran R.", severity: "Critical", recommended: "Auto-reassign to Divya M." },
    { id: "ESC-10", lead: "Venkat Raman", issue: "48-Hour Touch Overdue (>72h)", uncalledTime: "Overdue by 28 hrs", assignedTo: "Anil M.", severity: "High", recommended: "Dispatch Touch 3 RCS education card" },
    { id: "ESC-09", lead: "Suresh Babu", issue: "Price Objection Unresolved", uncalledTime: "No counseling logged", assignedTo: "Sravani K.", severity: "Medium", recommended: "Escalate to Financial Counselor for 0% EMI" },
    { id: "ESC-08", lead: "Padma S.", issue: "No-Show Without Reason Remark", uncalledTime: "Missed consult yesterday", assignedTo: "Kiran R.", severity: "High", recommended: "Place manager follow-up call" },
  ]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Team Manager · Escalations</p>
          <h1>Process Breach & SLA Escalation Desk</h1>
          <p className="page-description">Thesis Section 24 & 30.5: Active exception queue for delayed first response, missed follow-ups, and unhandled patient objections.</p>
        </div>
        <div className="page-actions">
          <Badge style={{ background: "#ef4444", color: "#ffffff", padding: "6px 12px" }}>11 Open Escalations</Badge>
        </div>
      </div>

      <section className="panel">
        <div className="generic-table">
          <div className="generic-row head">
            <span>Escalation ID & Lead</span>
            <span>Breach Nature</span>
            <span>Overdue Duration</span>
            <span>Current Owner</span>
            <span>Severity</span>
            <span>Recommended Corrective Action</span>
            <span>Resolve</span>
          </div>
          {escalations.map((e) => (
            <div className="generic-row" key={e.id}>
              <div>
                <strong>{e.lead}</strong>
                <div style={{ fontSize: 11, color: "var(--subtle)" }}>{e.id}</div>
              </div>
              <div style={{ fontWeight: 600, color: "var(--burgundy)" }}>{e.issue}</div>
              <div>{e.uncalledTime}</div>
              <div>{e.assignedTo}</div>
              <div>
                <Badge style={{ background: e.severity === "Critical" ? "#ef4444" : e.severity === "High" ? "var(--gold)" : "#64748b", color: "#ffffff" }}>
                  {e.severity}
                </Badge>
              </div>
              <div style={{ fontSize: 12, color: "var(--navy)" }}>{e.recommended}</div>
              <div>
                <Button className="primary-action" size="sm" onClick={() => notify(`Resolved escalation ${e.id}: Action executed.`)}>
                  Resolve Now
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// FOUNDER / LEADERSHIP WORKSPACE SCREENS (Uploaded Screenshot 5 Reference)
// ============================================================================

export function OwnerCohortScreen({ notify }: { notify: (msg: string) => void }) {
  const [factors] = useState([
    { factor: "Average first response time", converted: "4.2 minutes", nonConverted: "42.8 minutes", variance: "+38.6 min delay in lost leads" },
    { factor: "Meaningful connected rate", converted: "94.6%", nonConverted: "58.2%", variance: "-36.4% in lost leads" },
    { factor: "Average number of calls", converted: "4.8 calls", nonConverted: "1.4 calls", variance: "Incomplete follow-up in lost leads" },
    { factor: "Follow-up completion (48h cadence)", converted: "98.2%", nonConverted: "41.6%", variance: "Severe cadence drop" },
    { factor: "WhatsApp delivery & read rate", converted: "96.4%", nonConverted: "68.2%", variance: "Higher contactability in converted" },
    { factor: "RCS / MMS visual card sent", converted: "88.4%", nonConverted: "12.0%", variance: "Visual cards drive conversion (+76%)" },
    { factor: "Patient reply rate", converted: "62.4%", nonConverted: "14.1%", variance: "+48.3% interactive engagement" },
    { factor: "Appointment booking confirmation", converted: "100%", nonConverted: "28.4%", variance: "Confirmed appointments convert 3.5x higher" },
    { factor: "Financial counseling completed", converted: "91.2%", nonConverted: "18.4%", variance: "Missing counseling is #1 drop reason" },
    { factor: "Average quoted package", converted: "₹1,45,000", nonConverted: "₹1,62,000", variance: "Small price gap (₹17k) recoverable via EMI" },
    { factor: "Insurance / Cashless available", converted: "78.4%", nonConverted: "42.1%", variance: "Cashless support unlocks high conversion" },
    { factor: "Main source channel", converted: "Google Search & IVR", nonConverted: "Meta Campaign B", variance: "Campaign B needs qualification fix" },
    { factor: "Doctor interaction / call", converted: "64.0%", nonConverted: "8.2%", variance: "Doctor trust callbacks double surgery intake" },
  ]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Founder / Leadership · Cohorts</p>
          <h1>Converted vs Non-Converted Cohort Comparison</h1>
          <p className="page-description">
            Thesis Section 22: "Comparing converted and non-converted cohorts across 15 operational factors is far more valuable than looking only at lost leads. This identifies exact successful patterns vs process failures."
          </p>
        </div>
        <div className="page-actions">
          <Button variant="outline"><Download size={14} /> Export Cohort Analysis</Button>
        </div>
      </div>

      <section className="panel">
        <div className="generic-table">
          <div className="generic-row head">
            <span>Factor / Characteristic</span>
            <span style={{ color: "#166534" }}>Converted Cohort (Surgeries)</span>
            <span style={{ color: "#b91c1c" }}>Non-Converted Cohort (Lost)</span>
            <span>Diagnostic Variance / Evidence Finding</span>
          </div>
          {factors.map((f) => (
            <div className="generic-row" key={f.factor}>
              <strong>{f.factor}</strong>
              <div style={{ color: "#166534", fontWeight: 700 }}>{f.converted}</div>
              <div style={{ color: "#b91c1c", fontWeight: 600 }}>{f.nonConverted}</div>
              <div style={{ fontSize: 12, color: "var(--navy)", fontWeight: 500 }}>{f.variance}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function OwnerSourceRoiScreen({ notify }: { notify: (msg: string) => void }) {
  const [sources] = useState([
    { name: "Google Search · Super Specialty", adSpend: "₹3,40,000", leads: 486, surgeries: 54, revAttributed: "₹78,40,000", costPerSurgery: "₹6,296", roi: "23.0x" },
    { name: "Inbound Helpline / Direct IVR", adSpend: "₹45,000", leads: 448, surgeries: 48, revAttributed: "₹61,20,000", costPerSurgery: "₹937", roi: "136.0x" },
    { name: "Meta Telugu · Piles Campaign A", adSpend: "₹2,10,000", leads: 620, surgeries: 28, revAttributed: "₹24,80,000", costPerSurgery: "₹7,500", roi: "11.8x" },
    { name: "Meta Telugu · Piles Campaign B", adSpend: "₹1,80,000", leads: 484, surgeries: 8, revAttributed: "₹7,20,000", costPerSurgery: "₹22,500", roi: "4.0x (Leak)" },
    { name: "YouTube · Patient Recovery Stories", adSpend: "₹1,20,000", leads: 426, surgeries: 18, revAttributed: "₹18,40,000", costPerSurgery: "₹6,666", roi: "15.3x" },
  ]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Founder / Leadership · Source ROI</p>
          <h1>Source Attribution & Cost per Surgery</h1>
          <p className="page-description">
            Thesis Section 5 & 26: "Lead count alone should never be used to judge campaign quality. The final measurement must be based on conversion, cost per surgery, and attributed revenue."
          </p>
        </div>
      </div>

      <div className="metric-grid four">
        <div className="metric-card"><span className="metric-label">Total Attributed Revenue</span><strong className="metric-value">₹1.84 Cr</strong><span className="metric-delta positive">+11.8% vs prev period</span></div>
        <div className="metric-card"><span className="metric-label">Total Ad Spend</span><strong className="metric-value">₹8.95 Lakhs</strong><span className="metric-delta neutral">Target: &lt;₹10L</span></div>
        <div className="metric-card"><span className="metric-label">Blended Cost / Surgery</span><strong className="metric-value">₹5,737</strong><span className="metric-delta positive">Industry bench: ₹9,500</span></div>
        <div className="metric-card"><span className="metric-label">Overall Campaign ROI</span><strong className="metric-value">20.5x</strong><span className="metric-delta positive">Healthy margin</span></div>
      </div>

      <section className="panel">
        <div className="generic-table">
          <div className="generic-row head">
            <span>Campaign / Source</span>
            <span>Ad Spend</span>
            <span>Leads</span>
            <span>Surgeries</span>
            <span>Attributed Revenue</span>
            <span>Cost / Surgery</span>
            <span>Blended ROI</span>
          </div>
          {sources.map((s) => (
            <div className="generic-row" key={s.name}>
              <strong>{s.name}</strong>
              <div>{s.adSpend}</div>
              <div>{s.leads}</div>
              <div><strong style={{ color: "var(--navy)" }}>{s.surgeries}</strong></div>
              <div><strong style={{ color: "#166534" }}>{s.revAttributed}</strong></div>
              <div><strong>{s.costPerSurgery}</strong></div>
              <div>
                <Badge style={{ background: s.roi.includes("Leak") ? "#ef4444" : "#22c55e", color: "#ffffff" }}>
                  {s.roi}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// INTERACTIVE THESIS MODALS & SPECIALIZED ENGINES
// ============================================================================

/** Section 7: 11-Factor Objective Lead Quality Scoring Calculator */
export function LeadScoringModal({
  leadName,
  lead,
  onClose,
  onSave,
  onScoreApplied,
}: {
  leadName?: string;
  lead?: { name: string; id?: string };
  onClose: () => void;
  onSave?: (score: number, qualification: string) => void;
  onScoreApplied?: (score: number, qualification: string) => void;
}) {
  const effectiveName = lead?.name || leadName || "Patient";
  const [factors, setFactors] = useState({
    symptomSeverity: 8, // 1-10
    durationOfProblem: 7, // 1-10
    treatmentUrgency: 9, // 1-10
    distanceFromHospital: 8, // 1-10 (<15km = 10)
    financialReadiness: 7, // 1-10
    appointmentReadiness: 9, // 1-10
    decisionMakerAuthority: 8, // 1-10 (Self/Spouse = 10)
    previousTreatmentCompleted: 6, // 1-10
    insuranceAvailability: 9, // 1-10 (TPA / Cashless = 10)
    interestInConsultation: 9, // 1-10
    interestInSurgery: 8, // 1-10
  });

  const totalScore = Math.round(
    Object.values(factors).reduce((a, b) => a + b, 0) / 1.1
  );

  const qualification = totalScore >= 75 ? "Hot" : totalScore >= 50 ? "Warm" : "Cold";

  return (
    <div className="crm-modal-overlay">
      <div className="crm-modal-backdrop" onClick={onClose} />
      <div className="crm-modal-window" style={{ maxWidth: 680 }}>
        <div className="crm-modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--navy)" }}>
              Thesis Section 7 · Objective Lead Scoring
            </span>
            <h2>11-Factor Qualification Calculator · {effectiveName}</h2>
          </div>
          <button onClick={onClose} className="icon-button"><X size={19} /></button>
        </div>

        <div className="crm-modal-body">
          <div style={{ background: qualification === "Hot" ? "#f0fdf4" : qualification === "Warm" ? "#fffdf5" : "#f8fafc", border: "1.5px solid", borderColor: qualification === "Hot" ? "#22c55e" : qualification === "Warm" ? "var(--gold)" : "#94a3b8", borderRadius: 8, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontSize: 12, color: "var(--subtle)" }}>Calculated Qualification Score</span>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--navy)" }}>{totalScore} <span style={{ fontSize: 14, fontWeight: 500 }}>/ 100 pts</span></div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 12, color: "var(--subtle)" }}>Objective Classification</span>
              <div>
                <Badge style={{ background: qualification === "Hot" ? "#22c55e" : qualification === "Warm" ? "var(--gold)" : "#64748b", color: "#ffffff", fontSize: 16, padding: "4px 14px" }}>
                  {qualification} Lead
                </Badge>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            {[
              { key: "symptomSeverity", label: "1. Symptom Severity" },
              { key: "durationOfProblem", label: "2. Duration of Problem" },
              { key: "treatmentUrgency", label: "3. Treatment Urgency" },
              { key: "distanceFromHospital", label: "4. Distance from Hospital" },
              { key: "financialReadiness", label: "5. Financial Readiness" },
              { key: "appointmentReadiness", label: "6. Appointment Readiness" },
              { key: "decisionMakerAuthority", label: "7. Decision Maker Authority" },
              { key: "previousTreatmentCompleted", label: "8. Previous Investigations Done" },
              { key: "insuranceAvailability", label: "9. Insurance / Cashless Availability" },
              { key: "interestInConsultation", label: "10. Interest in Doctor Consultation" },
              { key: "interestInSurgery", label: "11. Interest in Surgical Procedure" },
            ].map(({ key, label }) => (
              <div key={key} style={{ background: "#f8fafc", padding: "8px 12px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{label}</span>
                  <strong>{factors[key as keyof typeof factors]} / 10</strong>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={factors[key as keyof typeof factors]}
                  onChange={(e) => setFactors({ ...factors, [key]: Number(e.target.value) })}
                  style={{ width: "100%" }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="crm-modal-footer">
          <Button
            className="primary-action"
            onClick={() => {
              onSave?.(totalScore, qualification);
              onScoreApplied?.(totalScore, qualification);
              onClose();
            }}
          >
            Save Objective Score ({totalScore} pts · {qualification})
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Section 8-11: 48-Hour Alternating Communication Engine & 13 Rich Content Cards */
export function Cadence48hSchedulerModal({
  lead,
  onClose,
  notify,
}: {
  lead: any;
  onClose: () => void;
  notify: (msg: string) => void;
}) {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    { day: "Day 1", channel: "WhatsApp", purpose: "1. Acknowledgement", card: "Doctor Profile & Hospital Introduction", text: "Namaste! We received your inquiry regarding knee pain treatment. Dr. K. Ramesh (22+ years experience) is available for OPD consultation." },
    { day: "Day 3 (48h)", channel: "RCS / MMS", purpose: "2. Education & Awareness", card: "Treatment Awareness & Procedure Explainer", text: "Visual Info Card: How robotic knee replacement ensures same-day walking with 99.2% success rate." },
    { day: "Day 5 (48h)", channel: "WhatsApp", purpose: "3. Trust & Volume", card: "Hospital Credibility & Doctor Credentials", text: "Dr. Ramesh has successfully completed 4,500+ joint procedures. Video consultation is also available if you reside >20km away." },
    { day: "Day 7 (48h)", channel: "RCS / MMS", purpose: "4. Social Proof", card: "Patient Recovery Story & Video Testimonial", text: "Watch Mr. Satyanarayana's recovery story: walked without pain within 48 hours of minimally invasive surgery." },
    { day: "Day 9 (48h)", channel: "WhatsApp", purpose: "5. Financial Support", card: "Insurance & 0% EMI Breakdown", text: "Full insurance cashless support (Star Health, HDFC ERGO, Care) & 0% EMI options starting at ₹4,500/month." },
    { day: "Day 11 (48h)", channel: "RCS / MMS", purpose: "6. Facility & OT", card: "Modular OT & Infection-Free Facility Poster", text: "NABH-accredited laminar airflow modular operation theatres for zero-infection safety." },
    { day: "Day 13 (48h)", channel: "WhatsApp", purpose: "7. Direct Action", card: "Priority Appointment Booking Card", text: "Confirm your Saturday specialist appointment slot or request a call from our Chief Medical Officer." },
  ];

  return (
    <div className="crm-modal-overlay">
      <div className="crm-modal-backdrop" onClick={onClose} />
      <div className="crm-modal-window" style={{ maxWidth: 740 }}>
        <div className="crm-modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--navy)" }}>
              Thesis Section 8, 9 & 10 · 48-Hour Alternating Engine
            </span>
            <h2>WhatsApp ⇄ RCS/MMS 48-Hour Nurturing Journey · {lead.name}</h2>
          </div>
          <button onClick={onClose} className="icon-button"><X size={19} /></button>
        </div>

        <div className="crm-modal-body">
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: 12, fontSize: 12, color: "#166534" }}>
            <strong>✓ Thesis Rule Enforced:</strong> Planned messages are strictly spaced 48 hours apart (no daily spam). Channels alternate automatically: WhatsApp → RCS/MMS → WhatsApp.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 14, marginTop: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {steps.map((s, idx) => (
                <button
                  key={s.day}
                  onClick={() => setActiveStep(idx)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid",
                    borderColor: activeStep === idx ? "var(--gold)" : "var(--border)",
                    background: activeStep === idx ? "rgba(208,154,38,0.12)" : "#ffffff",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: 12, color: "var(--navy)" }}>{s.day}</strong>
                    <Badge variant="outline" style={{ fontSize: 10 }}>{s.channel}</Badge>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--subtle)", marginTop: 2 }}>{s.purpose}</div>
                </button>
              ))}
            </div>

            <div style={{ background: "#ffffff", border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Badge style={{ background: steps[activeStep].channel === "WhatsApp" ? "#25D366" : "#2563eb", color: "#ffffff" }}>
                  {steps[activeStep].channel}
                </Badge>
                <span style={{ fontSize: 12, color: "var(--subtle)" }}>{steps[activeStep].day} Schedule</span>
              </div>
              <h3 style={{ margin: "4px 0 8px 0", fontSize: 15, color: "var(--navy)" }}>
                {steps[activeStep].card}
              </h3>
              <div style={{ background: "#f8fafc", padding: 14, borderRadius: 6, fontSize: 13, border: "1px solid #e2e8f0", lineHeight: 1.5 }}>
                {steps[activeStep].text}
              </div>
              <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--subtle)" }}>Rich card payload verified · Non-spam compliant</span>
                <Button className="primary-action" size="sm" onClick={() => { notify(`Dispatched ${steps[activeStep].day} touch via ${steps[activeStep].channel}`); onClose(); }}>
                  <Send size={13} /> Dispatch Touch Now
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="crm-modal-footer">
          <Button variant="outline" onClick={onClose}>Close Cadence Engine</Button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Thesis Section 25: Interactive 9-Level Drill-Down Root-Cause Explorer
// ----------------------------------------------------------------------------
export function NineLevelDrillDownModal({ onClose }: { onClose: () => void }) {
  const [level, setLevel] = useState(1);

  const levels = [
    { level: 1, title: "Level 1: Overall Conversions Metric", finding: "Total hospital surgical conversions decreased this period.", metric: "Conversions: 218 vs 245 target (-11.0%)", status: "Alarm Triggered" },
    { level: 2, title: "Level 2: Specific Treatment Stage Drop", finding: "Drop occurred specifically in General Surgery conversions.", metric: "General Surgery: 20 down to 13 (-35.0%)", status: "Stage Isolated" },
    { level: 3, title: "Level 3: Disease-Wise Isolation", finding: "Most of the reduction specifically originated from Piles / Proctology leads.", metric: "Piles Cases: 14 down to 7 (-50.0%)", status: "Disease Isolated" },
    { level: 4, title: "Level 4: Source & Campaign Drill-Down", finding: "Meta 'Piles Laser Hyderabad July' (Campaign B) had the largest drop.", metric: "Campaign B: 484 leads, but only 8 surgeries (1.6% conv)", status: "Campaign Isolated" },
    { level: 5, title: "Level 5: Telephony & Connection Audit", finding: "Connected rate was normal (78.2%), but appointment booking conversion fell.", metric: "Connected: 378 / 484 leads · Booked: only 42 (11.1%)", status: "Sub-Stage Isolated" },
    { level: 6, title: "Level 6: Patient Objection Analysis", finding: "Most patients raised a pricing objection during Day 1 & Day 3 calls.", metric: "Pricing Objections: 31 patients (73.8% of drops)", status: "Objection Isolated" },
    { level: 7, title: "Level 7: Call Remarks & Audio Evidence", finding: "Remarks and Soniox transcripts prove financial counseling was NOT completed.", metric: "Financial Counseling Completed: 0 / 31 cases (0%)", status: "Process Gap Identified" },
    { level: 8, title: "Level 8: Telecalling Agent Attribution", finding: "Affected leads were mainly handled by Kiran R. and Anil M.", metric: "Kiran R. (18 leads) & Anil M. (13 leads)", status: "Owner Attributed" },
    { level: 9, title: "Level 9: Root Cause & Specific Corrective Action", finding: "Agents did NOT send package comparison creative or escalate to financial counselor for 0% EMI!", metric: "Evidence-Based Conclusion Reached", status: "Actionable Plan Ready" },
  ];

  const current = levels[level - 1];

  return (
    <div className="crm-modal-overlay">
      <div className="crm-modal-backdrop" onClick={onClose} />
      <div className="crm-modal-window" style={{ maxWidth: 780 }}>
        <div className="crm-modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--navy)" }}>
              Thesis Section 25 · 9-Level Drill-Down Technique
            </span>
            <h2>Evidence-Based Conversion Diagnosis Explorer</h2>
          </div>
          <button onClick={onClose} className="icon-button"><X size={19} /></button>
        </div>

        <div className="crm-modal-body">
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>
            {levels.map((l) => (
              <button
                key={l.level}
                onClick={() => setLevel(l.level)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid",
                  borderColor: level === l.level ? "var(--gold)" : "var(--border)",
                  background: level === l.level ? "var(--navy)" : "#ffffff",
                  color: level === l.level ? "#ffffff" : "var(--navy)",
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                L{l.level}
              </button>
            ))}
          </div>

          <div style={{ background: "#ffffff", border: "1.5px solid var(--gold)", borderRadius: 8, padding: 18, marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Badge style={{ background: "var(--navy)", color: "#ffffff" }}>{current.title}</Badge>
              <Badge variant="outline" style={{ borderColor: "#22c55e", color: "#15803d" }}>{current.status}</Badge>
            </div>
            <h3 style={{ margin: "8px 0", fontSize: 16, color: "var(--navy)" }}>{current.finding}</h3>
            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13, fontWeight: 600, color: "var(--burgundy)" }}>
              📊 Metric Evidence: {current.metric}
            </div>

            {level === 9 && (
              <div style={{ marginTop: 14, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: 14, fontSize: 13, color: "#166534" }}>
                <strong>✓ Thesis Conclusion (Section 25 & 33):</strong>
                <p style={{ margin: "6px 0 0 0" }}>
                  "The conversion drop was not caused by lower lead volume or campaign creative failure. It was caused by incomplete price-objection handling and missing financial counseling. Action: Financial counselor call for 7 recoverable patients, RCS package comparison card dispatch, and agent coaching on 0% EMI."
                </p>
                <div style={{ marginTop: 10, fontWeight: 700 }}>
                  Expected Result: 3 to 4 additional conversions (₹4.8L recovered revenue) from existing lost cohort without spending a single additional rupee on advertising.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="crm-modal-footer">
          <Button variant="outline" onClick={onClose}>Close Explorer</Button>
          {level < 9 ? (
            <Button className="primary-action" onClick={() => setLevel(level + 1)}>
              Drill Down to Level {level + 1} <ChevronRight size={14} />
            </Button>
          ) : (
            <Button className="gold-action" onClick={onClose}>
              <Check size={14} /> Corrective Action Plan Approved
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Thesis Section 32 & 33: 15-Day Diagnostic Report
// ----------------------------------------------------------------------------
export function FifteenDayDiagnosticModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="crm-modal-overlay">
      <div className="crm-modal-backdrop" onClick={onClose} />
      <div className="crm-modal-window" style={{ maxWidth: 840 }}>
        <div className="crm-modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--navy)" }}>
              Thesis Section 32 & 33 · Bi-Weekly Strategic Audit
            </span>
            <h2>15-Day Conversion Diagnostic Report (Week 1 vs Week 2)</h2>
          </div>
          <button onClick={onClose} className="icon-button"><X size={19} /></button>
        </div>

        <div className="crm-modal-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <section className="panel" style={{ borderTop: "4px solid #22c55e" }}>
              <h3 style={{ fontSize: 14, color: "#166534", margin: "0 0 8px 0" }}>Why Did Leads Convert? (Positive Drivers)</h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.6, color: "var(--navy)" }}>
                <li><strong>Best Source:</strong> Google Search & Direct Inbound Helpline (92% connection, 11.2% surgery conversion).</li>
                <li><strong>Best Disease Category:</strong> Orthopedic Knee Replacement (₹78.4L attributed).</li>
                <li><strong>Best Channel Sequence:</strong> WhatsApp Day 1 → RCS Visual Card Day 3 (2.8x higher response than SMS).</li>
                <li><strong>Best Counseling Method:</strong> Proactive 0% EMI offer before patient asks.</li>
                <li><strong>Average Conversion Time:</strong> 6.4 days from lead receipt to OT booking.</li>
              </ul>
            </section>

            <section className="panel" style={{ borderTop: "4px solid #ef4444" }}>
              <h3 style={{ fontSize: 14, color: "#991b1b", margin: "0 0 8px 0" }}>Why Did Leads Not Convert? (Leaks & Root Cause)</h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.6, color: "var(--navy)" }}>
                <li><strong>Surgery Conversion Drop:</strong> Dropped from 18 in Week 1 to 12 in Week 2.</li>
                <li><strong>Funnel Drop Stage:</strong> Post-consultation to surgery booking gap.</li>
                <li><strong>Root Cause:</strong> 7 patients raised price concerns; 4 did not receive financial counseling.</li>
                <li><strong>Evidence:</strong> Call remarks and lack of 0% EMI task generation in timeline.</li>
                <li><strong>Action:</strong> Financial counselor call placed for 7 recoverable patients.</li>
              </ul>
            </section>
          </div>

          <div style={{ marginTop: 14, background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
            <h4 style={{ margin: "0 0 6px 0", fontSize: 13, color: "var(--navy)" }}>Sample Management Conclusion (Section 33)</h4>
            <p style={{ margin: 0, fontSize: 12, color: "var(--subtle)", lineHeight: 1.5 }}>
              "The business results show that ad spend should NOT be increased. The conversion drop was isolated to price handling in Facebook Campaign B. Corrective action: Assign Dedicated Financial Counselor Maya Rao, dispatch RCS package breakdown cards, and re-engage the 7 recoverable patients. Expected result: 3 to 4 conversions (₹4.8L recovered revenue)."
            </p>
          </div>
        </div>

        <div className="crm-modal-footer">
          <Button variant="outline" onClick={onClose}>Close Report</Button>
          <Button className="gold-action" onClick={onClose}>
            <Download size={14} /> Download PDF Memo
          </Button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Additional Specialized Workspace Screens
// ----------------------------------------------------------------------------

export function OpsAdmissionQueueScreen({ notify }: { notify: (msg: string) => void }) {
  const [admissions] = useState([
    { id: "IPD-101", patient: "Lakshmi Narayana", procedure: "Bilateral Robotic Knee Replacement", surgeon: "Dr. K. Ramesh", otDate: "Tomorrow, 8:00 AM", bed: "Deluxe Room 304", status: "Pre-Op Workup Done" },
    { id: "IPD-102", patient: "Mohammed Faizal", procedure: "Laser Hemorrhoidectomy", surgeon: "Dr. Anil Kumar", otDate: "Friday, 11:30 AM", bed: "Daycare Suite 12", status: "Insurance Approved" },
    { id: "IPD-103", patient: "Venkatesh Babu", procedure: "Laparoscopic Cholecystectomy", surgeon: "Dr. Anil Kumar", otDate: "Saturday, 9:00 AM", bed: "Single Room 208", status: "Admission Confirmed" },
  ]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Clinical Operations · Admission & IPD</p>
          <h1>Surgical Admission & OT Scheduling</h1>
          <p className="page-description">Thesis Section 4 & 17: Track surgery booking, pre-anesthesia check (PAC), IPD bed admission, and converted revenue recording.</p>
        </div>
        <div className="page-actions">
          <Button className="primary-action" onClick={() => notify("New surgical booking initiated.")}><Plus size={14} /> Book OT Slot</Button>
        </div>
      </div>

      <div className="metric-grid four">
        <div className="metric-card"><span className="metric-label">Scheduled Surgeries (7d)</span><strong className="metric-value">18 Procedures</strong><span className="metric-delta positive">OT 84% booked</span></div>
        <div className="metric-card"><span className="metric-label">Pre-Op Clearance</span><strong className="metric-value">100%</strong><span className="metric-delta positive">PAC completed</span></div>
        <div className="metric-card"><span className="metric-label">Cashless Pre-Auth</span><strong className="metric-value">₹24.5 Lakhs</strong><span className="metric-delta positive">TPA verified</span></div>
        <div className="metric-card"><span className="metric-label">Avg Length of Stay</span><strong className="metric-value">1.4 days</strong><span className="metric-delta positive">Minimally invasive</span></div>
      </div>

      <section className="panel">
        <div className="generic-table">
          <div className="generic-row head">
            <span>Patient & IPD ID</span>
            <span>Procedure</span>
            <span>Operating Surgeon</span>
            <span>OT Date & Time</span>
            <span>Bed / Room</span>
            <span>Pre-Op Status</span>
            <span>Action</span>
          </div>
          {admissions.map((a) => (
            <div className="generic-row" key={a.id}>
              <div>
                <strong>{a.patient}</strong>
                <div style={{ fontSize: 11, color: "var(--subtle)" }}>{a.id}</div>
              </div>
              <div>{a.procedure}</div>
              <div>{a.surgeon}</div>
              <div><strong>{a.otDate}</strong></div>
              <div><Badge variant="outline">{a.bed}</Badge></div>
              <div><Badge style={{ background: "#22c55e", color: "#ffffff" }}>{a.status}</Badge></div>
              <div>
                <Button variant="outline" size="sm" onClick={() => notify(`Admission details opened for ${a.patient}`)}>
                  View PAC
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function OpsDoctorAllocationScreen({ notify }: { notify: (msg: string) => void }) {
  const [doctors] = useState([
    { name: "Dr. K. Ramesh", specialty: "Senior Joint & Robotic Orthopedics", branch: "Hyderabad Central", opdSlots: "24/28 Booked (85%)", surgeryDays: "Mon, Wed, Fri", rating: "4.9 ★" },
    { name: "Dr. P. Sailaja", specialty: "Urology & Endourology", branch: "Hyderabad Central", opdSlots: "18/20 Booked (90%)", surgeryDays: "Tue, Thu, Sat", rating: "4.8 ★" },
    { name: "Dr. Anil Kumar", specialty: "Laparoscopic & Laser General Surgery", branch: "Secunderabad", opdSlots: "16/22 Booked (72%)", surgeryDays: "Daily Mornings", rating: "4.8 ★" },
  ]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Clinical Operations · Doctor Allocation</p>
          <h1>Specialist Routing & Capacity Management</h1>
          <p className="page-description">Route patient inquiries to specialists based on clinical disease taxonomy, branch proximity, and consultation slot availability.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        {doctors.map((d) => (
          <section className="panel" key={d.name}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, color: "var(--navy)" }}>{d.name}</h3>
                <span style={{ fontSize: 12, color: "var(--subtle)" }}>{d.specialty}</span>
              </div>
              <Badge variant="outline">{d.rating}</Badge>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, background: "#f8fafc", padding: 12, borderRadius: 6 }}>
              <div><strong>Branch:</strong> {d.branch}</div>
              <div><strong>OPD Slot Capacity:</strong> <span style={{ color: "#166534", fontWeight: 600 }}>{d.opdSlots}</span></div>
              <div><strong>OT Operating Days:</strong> {d.surgeryDays}</div>
            </div>
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
              <Button variant="outline" size="sm" onClick={() => notify(`Allocated consult slots for ${d.name}`)}>
                Manage Slots
              </Button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function OpsHandoffScreen({ notify }: { notify: (msg: string) => void }) {
  const [handoffs] = useState([
    { lead: "Lakshmi Narayana", from: "Telecalling Agent (Sravani)", to: "OPD Nurse Desk", status: "Handed Off", notes: "Pre-briefed on knee pain duration & previous X-ray" },
    { lead: "Mohammed Faizal", from: "Doctor Consultation", to: "Financial Counselor (Maya)", status: "Pending Counseling", notes: "Advised laser surgery; patient requested package explanation" },
    { lead: "Sailaja Devi", from: "OPD Desk", to: "Video Consult Doctor", status: "Link Sent", notes: "Rescheduled to video call due to distance" },
  ]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Clinical Operations · Journey Handoff</p>
          <h1>Inter-Departmental Patient Journey Handoff</h1>
          <p className="page-description">Seamless context preservation across telecalling, hospital reception, doctor consultation, financial desk, and OT coordinator.</p>
        </div>
      </div>

      <section className="panel">
        <div className="generic-table">
          <div className="generic-row head">
            <span>Patient</span>
            <span>Handoff Origin</span>
            <span>Receiving Department</span>
            <span>Status</span>
            <span>Clinical Notes Preserved</span>
          </div>
          {handoffs.map((h) => (
            <div className="generic-row" key={h.lead}>
              <strong>{h.lead}</strong>
              <div>{h.from}</div>
              <div><strong>{h.to}</strong></div>
              <div><Badge variant="outline">{h.status}</Badge></div>
              <div style={{ fontSize: 12, color: "var(--navy)" }}>{h.notes}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function VoiceConfidenceScreen({ notify }: { notify: (msg: string) => void }) {
  const [queue] = useState([
    { id: "REV-26", lead: "Anitha Devi", phone: "+91 93920 11982", confidence: 78, issue: "Low transcription confidence on Telugu dialect phrase", aiTemp: "Warm", agentAction: "Listen & Re-classify" },
    { id: "REV-25", lead: "K. Raghunath", phone: "+91 98490 22310", confidence: 81, issue: "Unhandled price objection during laser talk", aiTemp: "Warm", agentAction: "Trigger Financial Desk Call" },
    { id: "REV-24", lead: "S. Swamy", phone: "+91 90100 44512", confidence: 82, issue: "Patient mentioned pacemaker; contraindication flag", aiTemp: "Hot", agentAction: "Doctor Callback Required" },
  ]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Voice AI Control · Review Queue</p>
          <h1>Confidence Review Queue (Human-in-the-Loop)</h1>
          <p className="page-description">AI calls with confidence &lt;85% or clinical/pricing flags requiring mandatory human supervisor verification.</p>
        </div>
        <div className="page-actions">
          <Badge style={{ background: "var(--gold)", color: "#ffffff", padding: "6px 12px" }}>26 Calls in Review Queue</Badge>
        </div>
      </div>

      <section className="panel">
        <div className="generic-table">
          <div className="generic-row head">
            <span>Review ID & Patient</span>
            <span>Phone</span>
            <span>AI Confidence</span>
            <span>Reason for Review Flag</span>
            <span>AI Temperature</span>
            <span>Action</span>
          </div>
          {queue.map((q) => (
            <div className="generic-row" key={q.id}>
              <div>
                <strong>{q.lead}</strong>
                <div style={{ fontSize: 11, color: "var(--subtle)" }}>{q.id}</div>
              </div>
              <div>{q.phone}</div>
              <div><strong style={{ color: "#b91c1c" }}>{q.confidence}%</strong></div>
              <div style={{ fontSize: 12, color: "var(--navy)", fontWeight: 500 }}>{q.issue}</div>
              <div><Badge variant="outline">{q.aiTemp}</Badge></div>
              <div>
                <Button className="primary-action" size="sm" onClick={() => notify(`Approved & verified review item ${q.id}`)}>
                  Verify AI Decision
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function VoiceAnalyticsScreen({ notify }: { notify: (msg: string) => void }) {
  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Voice AI Control · Analytics</p>
          <h1>Voice AI Telephony Analytics</h1>
          <p className="page-description">Hourly connection trends, speech accuracy, language effectiveness, and human transfer rates.</p>
        </div>
      </div>

      <div className="metric-grid four">
        <div className="metric-card"><span className="metric-label">AI Calls Handled (Month)</span><strong className="metric-value">34,890</strong><span className="metric-delta positive">+24.2% scale</span></div>
        <div className="metric-card"><span className="metric-label">Soniox STT Word Accuracy</span><strong className="metric-value">96.8%</strong><span className="metric-delta positive">Telugu / Hindi native</span></div>
        <div className="metric-card"><span className="metric-label">Avg Call Duration</span><strong className="metric-value">1m 38s</strong><span className="metric-delta neutral">Optimal engagement</span></div>
        <div className="metric-card"><span className="metric-label">Hot Leads Produced</span><strong className="metric-value">1,482 Leads</strong><span className="metric-delta positive">Directly transferred</span></div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h3>Hourly Connection Rate Patterns</h3>
          <p>Peak pickup window: 10:30 AM to 12:30 PM &amp; 4:30 PM to 6:30 PM</p>
        </div>
        <div className="bar-chart">
          {[35, 62, 88, 92, 74, 58, 65, 84, 89, 78, 48, 30].map((h, i) => (
            <div key={i}><i style={{ height: `${h}%` }} /><span>{`${i + 9}h`}</span></div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function OwnerReportLibraryScreen({ notify }: { notify: (msg: string) => void }) {
  const reports = [
    { title: "Daily Executive Flash Report", schedule: "Daily at 21:00", description: "Leads received, connected rate, Hot generated, consultations, and missed follow-ups." },
    { title: "15-Day Diagnostic Conversion Audit", schedule: "Bi-weekly", description: "Week 1 vs Week 2 comparison, root-cause diagnosis, and corrective action memos." },
    { title: "Source & Campaign ROI Matrix", schedule: "Weekly", description: "Cost per surgery, attributed revenue by source, and junk lead rates." },
    { title: "Converted vs Non-Converted Cohort Matrix", schedule: "Monthly", description: "15-factor operational comparison of mature surgery cohort vs lost cohort." },
    { title: "Agent Performance & Process Compliance", schedule: "Weekly", description: "Outcome performance vs 48h cadence compliance, remarks quality, and SLA adherence." },
  ];

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Founder / Leadership · Reports</p>
          <h1>Enterprise Report Library & Safe CSV Export</h1>
          <p className="page-description">Thesis Section 30.10: Complete institutional reporting suite with formula-safe CSV export preventing spreadsheet injection.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {reports.map((r) => (
          <section className="panel" key={r.title} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: "var(--navy)" }}>{r.title}</h3>
                <Badge variant="outline">{r.schedule}</Badge>
              </div>
              <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "var(--subtle)", lineHeight: 1.4 }}>{r.description}</p>
            </div>
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button variant="outline" size="sm" onClick={() => notify(`Exported ${r.title} to Safe CSV`)}>
                <Download size={13} /> Export CSV
              </Button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// THESIS SECTION 2: BUSINESS PROBLEM THE CRM MUST SOLVE
// Reference: Thesis Page 2 — 100 Leads -> 50 Converted vs 50 Lost & 12 Levers
// ============================================================================

export function ThesisSection2BusinessProblemCard({
  notify,
  onOpenAsk,
  onOpenDiagnostic,
}: {
  notify?: (msg: string) => void;
  onOpenAsk?: () => void;
  onOpenDiagnostic?: () => void;
}) {
  const [appliedLevers, setAppliedLevers] = useState(false);

  const leakReasons = [
    { title: "Pricing & Budget Friction", pct: "30%", count: 15, tag: "Financial", icon: "💰" },
    { title: "Improper or Missed Follow-up", pct: "22%", count: 11, tag: "Process SLA", icon: "⏰" },
    { title: "Booked Appointment but Did Not Visit", pct: "18%", count: 9, tag: "No-Show", icon: "🚪" },
    { title: "Visited OPD but Declined Surgery", pct: "12%", count: 6, tag: "Clinical Conversion", icon: "🩺" },
    { title: "Chose Competitor / Another Hospital", pct: "8%", count: 4, tag: "Competitive", icon: "🏥" },
    { title: "Lacked Trust in Doctor / Second Opinion", pct: "6%", count: 3, tag: "Doctor Handoff", icon: "👨‍⚕️" },
    { title: "Afraid of Surgery / Surgical Hesitation", pct: "6%", count: 3, tag: "Patient Education", icon: "🛡️" },
    { title: "Outside Service Area / Travel Distance", pct: "4%", count: 2, tag: "Logistics", icon: "📍" },
    { title: "Poor-Quality / Invalid Lead", pct: "4%", count: 2, tag: "Marketing Filter", icon: "📉" },
    { title: "Still Recoverable With Target Follow-up", pct: "32%", count: 16, tag: "High-Intent Active", icon: "🔄" },
  ];

  const correctiveLevers = [
    { name: "Better follow-up", detail: "48-hour alternating Call/WhatsApp protocol" },
    { name: "Faster response", detail: "5-minute first touch SLA guarantee" },
    { name: "Improved counseling", detail: "Multilingual structured objection handling" },
    { name: "Better appointment confirmation", detail: "Double confirmation before doctor slot" },
    { name: "Financial counseling", detail: "Written treatment package breakdown" },
    { name: "EMI or insurance support", detail: "0% interest financing & cashless pre-auth" },
    { name: "Doctor intervention", detail: "Specialist video consult for second opinions" },
    { name: "Better patient education", detail: "Minimally invasive procedure recovery guides" },
    { name: "No-show recovery", detail: "Automated same-day rebooking outreach" },
    { name: "Reason-based reactivation", detail: "30-day recovery pool for recoverable losses" },
    { name: "Campaign correction", detail: "Match ad promises directly to opening script" },
    { name: "Agent training", detail: "Section 31 daily rhythm & scorecard coaching" },
  ];

  const handleToggleLevers = () => {
    const nextState = !appliedLevers;
    setAppliedLevers(nextState);
    if (nextState) {
      notify?.("⚡ Applied 12 Corrective Management Levers: Conversion rose from 50 to 70 without extra ad spend!");
    } else {
      notify?.("Reset to baseline 50 conversions.");
    }
  };

  return (
    <section
      className="panel"
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        border: "2px solid #0b2545",
        borderRadius: 12,
        padding: 22,
        marginBottom: 20,
        boxShadow: "0 4px 16px rgba(11,37,69,0.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, borderBottom: "1px solid #e2e8f0", paddingBottom: 16, marginBottom: 18 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: "var(--gold)" }}>
            Thesis Section 2 · Core Business Operating Law
          </span>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--navy)", margin: "4px 0 6px" }}>
            2. Business Problem the CRM Must Solve
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--subtle)", maxWidth: 820 }}>
            <em>&quot;A hospital may receive 100 leads and convert 50 patients. Management asks for 70 conversions. Before requesting more advertising expenditure, understand what happened to the remaining 50 leads.&quot;</em>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            size="sm"
            variant={appliedLevers ? "default" : "outline"}
            style={{
              background: appliedLevers ? "var(--gold)" : "#ffffff",
              color: appliedLevers ? "var(--navy)" : "var(--navy)",
              fontWeight: 700,
              border: "1px solid var(--gold)",
            }}
            onClick={handleToggleLevers}
          >
            <Sparkles size={14} style={{ marginRight: 6 }} />
            {appliedLevers ? "✓ 12 Levers Active (70 Converted)" : "⚡ Simulate 12 Levers (50 → 70)"}
          </Button>
          {onOpenDiagnostic && (
            <Button size="sm" variant="outline" onClick={onOpenDiagnostic}>
              <FileText size={14} style={{ marginRight: 6 }} /> 15-Day Diagnostic
            </Button>
          )}
        </div>
      </div>

      {/* The Fundamental Principle Comparison: Incorrect Response vs Correct CRM Law */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#991b1b", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>🚫</span> The Incorrect Management Response
          </div>
          <blockquote style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#7f1d1d", fontStyle: "italic" }}>
            &ldquo;To get 70 conversions, we need 150 or 200 leads.&rdquo;
          </blockquote>
          <p style={{ margin: 0, fontSize: 12, color: "#991b1b" }}>
            Buying more advertising into an unmeasured leaky bucket burns capital while leaving identical follow-up and counseling leaks unaddressed.
          </p>
        </div>

        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#166534", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>✅</span> The TRH360 CRM Objective
          </div>
          <blockquote style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#14532d" }}>
            Improve conversion efficiency of the leads already received.
          </blockquote>
          <p style={{ margin: 0, fontSize: 12, color: "#166534" }}>
            Only after existing conversion leaks are measured with evidence should management decide whether additional lead generation is required.
          </p>
        </div>
      </div>

      {/* Interactive 100 Leads Breakdown: 50 Converted vs 50 Lost */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <strong style={{ fontSize: 13, color: "var(--navy)" }}>
            Current Lead Journey Cohort: 100 Inbound Inquiries
          </strong>
          <span style={{ fontSize: 12, color: "var(--subtle)" }}>
            Ad Spend Scaled: <strong>₹0 Extra</strong> · Pure Operational Turnaround
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: appliedLevers ? "7fr 3fr" : "5fr 5fr", gap: 8, transition: "all 0.3s ease" }}>
          <div
            style={{
              background: appliedLevers ? "linear-gradient(90deg, #15803d, #22c55e)" : "linear-gradient(90deg, #1e3a8a, #3b82f6)",
              color: "#ffffff",
              borderRadius: 8,
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", opacity: 0.9 }}>
                {appliedLevers ? "Target Achieved With Levers" : "Baseline Operational Conversion"}
              </div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>
                {appliedLevers ? "70 Converted Patients (70%)" : "50 Converted Patients (50%)"}
              </div>
            </div>
            <Badge style={{ background: "rgba(255,255,255,0.25)", color: "#ffffff", fontSize: 13, fontWeight: 700 }}>
              {appliedLevers ? "+20 Recovered" : "OPD + Surgery"}
            </Badge>
          </div>

          <div
            style={{
              background: appliedLevers ? "#fef2f2" : "#fff1f2",
              border: "1px solid #fecdd3",
              borderRadius: 8,
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9f1239" }}>
                {appliedLevers ? "Remaining Unqualified" : "The 50 Lost Leads (Leak Analysis)"}
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#9f1239" }}>
                {appliedLevers ? "30 Lost" : "50 Lost Patients"}
              </div>
            </div>
            <Badge style={{ background: "#fda4af", color: "#881337", fontSize: 12, fontWeight: 700 }}>
              {appliedLevers ? "10 Leaks Mitigated" : "10 Root Causes"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Two Columns: 10 Leak Reasons vs 12 Corrective Levers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 18 }}>
        {/* Left: The 10 Reasons Why 50 Leads Were Lost */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>
              The 10 Root Causes Behind the 50 Lost Leads
            </h3>
            <Badge variant="outline" style={{ fontSize: 11 }}>100% Evidenced</Badge>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {leakReasons.map((item, idx) => (
              <div
                key={item.title}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 10px",
                  borderRadius: 6,
                  background: item.tag === "High-Intent Active" ? "#fef3c7" : "#f8fafc",
                  border: item.tag === "High-Intent Active" ? "1px solid #fde68a" : "1px solid #f1f5f9",
                  fontSize: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{item.icon}</span>
                  <span style={{ fontWeight: item.tag === "High-Intent Active" ? 700 : 500, color: "var(--navy)" }}>
                    {idx + 1}. {item.title}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Badge variant="outline" style={{ fontSize: 10 }}>{item.tag}</Badge>
                  <strong style={{ color: "var(--navy)", width: 44, textAlign: "right" }}>{item.count} leads</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: The 12 CRM Corrective Management Levers */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>
              The 12 CRM Corrective Management Levers
            </h3>
            <Badge style={{ background: "var(--gold)", color: "var(--navy)", fontSize: 11, fontWeight: 700 }}>
              Thesis S.2
            </Badge>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {correctiveLevers.map((lever, idx) => (
              <div
                key={lever.name}
                style={{
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: appliedLevers ? "#f0fdf4" : "#f8fafc",
                  border: appliedLevers ? "1px solid #bbf7d0" : "1px solid #f1f5f9",
                  fontSize: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <div style={{ fontWeight: 700, color: appliedLevers ? "#15803d" : "var(--navy)", display: "flex", alignItems: "center", gap: 4 }}>
                  <span>{appliedLevers ? "✓" : `•`}</span> {idx + 1}. {lever.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--subtle)" }}>{lever.detail}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(208,154,38,0.12)", border: "1px solid rgba(208,154,38,0.3)", borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: "#854d0e", fontWeight: 600 }}>
              <strong>Executive Rule:</strong> Only after the existing conversion leak has been measured should management decide whether additional lead generation is required.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}



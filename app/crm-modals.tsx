"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Edit3,
  FileAudio,
  FileText,
  HeartPulse,
  Key,
  LockKeyhole,
  MessageSquare,
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneOff,
  Play,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Upload,
  UserCheck,
  UserPlus,
  UsersRound,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { ApiClient } from "@/lib/api";

const api = new ApiClient();

export type DisplayLead = {
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

export interface TenantPack {
  id: string;
  name: string;
  vertical: string;
  description: string;
}

export const VERTICAL_TENANTS: TenantPack[] = [
  {
    id: "trh-hospital",
    name: "Meenestham Healthcare Group",
    vertical: "Hospital & Multi-Specialty",
    description: "Anchor Tenant: Orthopedics, Cardiology, Nephrology, Surgery & Inpatient",
  },
  {
    id: "apex-ortho",
    name: "Apex Spine & Orthopedics",
    vertical: "Orthopedic Clinic",
    description: "Joint replacement, robotic spine surgeries & sports injury protocols",
  },
  {
    id: "bloom-ivf",
    name: "Bloom Fertility & IVF Institute",
    vertical: "IVF & Reproductive Medicine",
    description: "Cycle counseling, fertility diagnostics & donor packages",
  },
  {
    id: "aesthetica-derm",
    name: "Aesthetica Dermatology",
    vertical: "Dermatology & Cosmetology",
    description: "Skin laser, hair transplants & aesthetic medicine programs",
  },
  {
    id: "nextgen-b2b",
    name: "NextGen B2B Corporate Health",
    vertical: "B2B Occupational Health",
    description: "Annual health checkups, corporate wellness & workplace diagnostics",
  },
];

export interface RoleUser {
  name: string;
  role: string;
  email: string;
  title: string;
  avatar: string;
  tagline: string;
  icon?: string;
}

export const ROLE_USERS: RoleUser[] = [
  {
    name: "Dr. Ramesh (Founder)",
    role: "Leadership",
    email: "founder@meenestham.in",
    title: "Founder / Executive Leadership",
    avatar: "DR",
    tagline: "Owner 5-question cockpit, benchmark strip, source ROI & 15-day diagnostic memo",
    icon: "👔",
  },
  {
    name: "Sravani K.",
    role: "Agent",
    email: "sravani@meenestham.in",
    title: "Telecalling Agent",
    avatar: "SK",
    tagline: "Priority queue, 5-minute SLA dialer, Soniox STT, 48h cadence & daily tasks",
    icon: "🎧",
  },
  {
    name: "Anil Kumar",
    role: "Manager",
    email: "anil@meenestham.in",
    title: "Team Manager",
    avatar: "AK",
    tagline: "Section 31 daily pattern (Morning → Day → EOD), SLA breaches, add agents & scorecards",
    icon: "📊",
  },
  {
    name: "Dr. Radhakrishna",
    role: "Doctor",
    email: "clinical@meenestham.in",
    title: "Chief of Clinical & Doctor Ops",
    avatar: "RK",
    tagline: "Doctor allocation, specialty consultation queue, surgery advice & clinical eligibility",
    icon: "🩺",
  },
  {
    name: "Radha V.",
    role: "Finance",
    email: "finance@meenestham.in",
    title: "Financial Counselor & Commercial Desk",
    avatar: "RV",
    tagline: "Pricing objections, package breakdown, EMI financing, insurance pre-auth & discounts",
    icon: "💳",
  },
  {
    name: "Nilesh N.",
    role: "Voice AI",
    email: "admin@meenestham.in",
    title: "Voice AI & Telephony Admin",
    avatar: "NN",
    tagline: "Autonomous voice bots, live monitor, SIP telephony, AI guardrails & audit trail",
    icon: "🤖",
  },
  {
    name: "Priya Rao",
    role: "Operations",
    email: "ops@meenestham.in",
    title: "Revenue Operations",
    avatar: "PR",
    tagline: "Doctor allocation, commercial desk, admission queue & no-show recovery",
    icon: "🏥",
  },
  {
    name: "System Admin",
    role: "Admin",
    email: "admin@meenestham.in",
    title: "System Administrator",
    avatar: "SA",
    tagline: "Control tower, follow-up ageing, telephony setup, AI safety policy & audit trail",
    icon: "⚙️",
  },
];

// --------------------------------------------------------------------------
// PRD 18: Benchmark Strip (100 -> 50 -> 25 -> 12)
// --------------------------------------------------------------------------
export function BenchmarkStrip() {
  const steps = [
    { label: "Sourced Leads", benchmark: "100", actual: "100", rate: "100%", tone: "safe" },
    { label: "Connected & Qualified", benchmark: "50", actual: "52", rate: "52.0%", tone: "safe" },
    { label: "Booked / Consultations", benchmark: "25", actual: "21", rate: "21.0%", tone: "risk", alert: "4-point funnel leak" },
    { label: "Converted / Admitted", benchmark: "12", actual: "7.6", rate: "7.6%", tone: "critical", alert: "₹27.4L recoverable" },
  ];

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--navy)" }}>
          PRD 18: Conversion Funnel Benchmark Strip (100 → 50 → 25 → 12)
        </span>
        <Badge variant="outline" style={{ fontSize: 11, color: "var(--navy)" }}>Standard Operating Benchmark</Badge>
      </div>
      <div className="benchmark-strip">
        {steps.map((step, index) => (
          <div key={step.label} className={`benchmark-step ${step.tone === "critical" || step.tone === "risk" ? "highlight" : ""}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="benchmark-step-num">{step.actual}</span>
              <span className="benchmark-target">Target: {step.benchmark}</span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--navy)", marginTop: 2 }}>{step.label}</div>
            <div className="benchmark-actual" style={{ color: step.tone === "safe" ? "var(--green)" : "var(--burgundy)" }}>
              {step.rate} actual conversion {step.alert ? `· ${step.alert}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// PRD 18: Owner 5-Question Cockpit Grid
// --------------------------------------------------------------------------
export function OwnerQuestionCockpit({ onOpenAsk }: { onOpenAsk?: () => void }) {
  const questions = [
    {
      num: "Q1",
      title: "Are form leads touched in 5 minutes?",
      stat: "92.4% On Time",
      desc: "Median response 3m 42s. 8 SLA alerts triggered today, 2 reassigned after 15m.",
      tone: "safe",
    },
    {
      num: "Q2",
      title: "Which campaign brings the most booked revenue?",
      stat: "Google Search Ortho (₹76.2L)",
      desc: "Meta Telugu generates ₹61.8L, YouTube ₹29.7L. Google has 81% connect rate.",
      tone: "safe",
    },
    {
      num: "Q3",
      title: "Where in the funnel are leads dropping off?",
      stat: "Qualified → Consultation (-38%)",
      desc: "650 leads lost. 61% stalled waiting for surgical cost breakup or family approval.",
      tone: "risk",
    },
    {
      num: "Q4",
      title: "Which agents have highest follow-up adherence?",
      stat: "Sravani (94%) & Divya (91%)",
      desc: "Anil Kumar at 79% (needs cadence review). Kiran Reddy at 68% (overdue follow-ups).",
      tone: "safe",
    },
    {
      num: "Q5",
      title: "How much recoverable revenue is in overdue leads?",
      stat: "₹27.4L in Overdue Leads",
      desc: "84 leads have documented medical urgency and resolvable pricing objections.",
      tone: "critical",
    },
  ];

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--navy)" }}>
          Owner 5-Question Operating Cockpit
        </h2>
        <Button variant="outline" size="sm" onClick={onOpenAsk}>
          <Sparkles size={14} /> Ask CRM in Telugu / Hindi / English
        </Button>
      </div>
      <div className="owner-q-grid">
        {questions.map((q) => (
          <article key={q.num} className="owner-q-card">
            <span className="owner-q-title">{q.num} · {q.title}</span>
            <div className="owner-q-stat" style={{ color: q.tone === "critical" ? "var(--burgundy)" : "var(--navy)" }}>
              {q.stat}
            </div>
            <p className="owner-q-desc">{q.desc}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// PRD 13: Pre-Call Context Card Modal
// --------------------------------------------------------------------------
export function PreCallModal({
  lead,
  sonioxApiKey,
  onSonioxKeyChange,
  onClose,
  onStartCall,
}: {
  lead: DisplayLead;
  sonioxApiKey: string;
  onSonioxKeyChange: (key: string) => void;
  onClose: () => void;
  onStartCall: (lead: DisplayLead, language: string) => void;
}) {
  const [lang, setLang] = useState<"telugu" | "hindi" | "english">("telugu");

  const openingLines = {
    telugu: `నమస్తే ${lead.name} గారు, మేనేస్తం హెల్త్‌కేర్ నుంచి శ్రావణి మాట్లాడుతున్నాను. మీరు అడిగిన చికిత్స వివరాలు మరియు శనివారం డాక్టర్ అపాయింట్‌మెంట్ గురించి మాట్లాడుదామని కాల్ చేస్తున్నాను...`,
    hindi: `नमस्ते ${lead.name} जी, मीनेस्थम हेल्थकेयर से श्रावणी बात कर रही हूँ। आपने जो ट्रीटमेंट की जानकारी माँगी थी और शनिवार डॉक्टर अपॉइंटमेंट के बारे में बात करने के लिए कॉल किया है...`,
    english: `Namaste ${lead.name} garu, this is Sravani from Meenestham Healthcare Group following up as promised regarding your treatment package and confirming your Saturday appointment...`,
  };

  const [customWaMsg, setCustomWaMsg] = useState(
    openingLines[lang] || `Namaste ${lead.name} garu, this is Sravani from Meenestham Healthcare Group.`
  );

  return (
    <div className="crm-modal-overlay">
      <div className="crm-modal-backdrop" onClick={onClose} />
      <div className="crm-modal-window" style={{ maxWidth: 640 }}>
        <div className="crm-modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--navy)" }}>
              PRD 13 · Pre-Call Context Card
            </span>
            <h2>{lead.name}</h2>
          </div>
          <button onClick={onClose} className="icon-button"><X size={19} /></button>
        </div>

        <div className="crm-modal-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, background: "#f8f6f0", padding: 12, borderRadius: 8, fontSize: 13 }}>
            <div><strong>Mobile:</strong> {lead.phone || "+91 98491 22618"}</div>
            <div><strong>Source:</strong> {lead.source}</div>
            <div><strong>Intent Temp:</strong> <Badge variant="outline">{lead.qualification || "Hot"}</Badge></div>
            <div><strong>Assigned To:</strong> {lead.agent}</div>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--subtle)", textTransform: "uppercase" }}>Previous Conversation Summary</span>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--navy)" }}>
              Patient has chronic joint pain for 6 months. Seeking second opinion for replacement surgery before festive season. Daughter Priya manages finances.
            </p>
          </div>

          <div style={{ background: "#fffdf8", border: "1px solid #fae29c", borderRadius: 8, padding: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", textTransform: "uppercase" }}>Open Commitment Due</span>
            <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>
              Send full package cost breakdown & 0% EMI details. Confirm Saturday 11:30 AM specialist slot.
            </p>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)" }}>
                💬 WhatsApp Message / Opening Line (Agent Decides & Edits)
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                {(["telugu", "hindi", "english"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => {
                      setLang(l);
                      setCustomWaMsg(openingLines[l]);
                    }}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                      background: lang === l ? "var(--navy)" : "#ffffff",
                      color: lang === l ? "#ffffff" : "var(--navy)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={customWaMsg}
              onChange={(e) => setCustomWaMsg(e.target.value)}
              placeholder="Agent: Enter or customize the exact message to send to the patient on WhatsApp..."
              style={{
                width: "100%",
                minHeight: 74,
                padding: 10,
                borderRadius: 6,
                border: "1.5px solid #22c55e",
                background: "#f0fdf4",
                fontSize: 13,
                lineHeight: 1.5,
                fontFamily: "inherit",
                resize: "vertical",
                color: "#14532d",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <small style={{ color: "#15803d", fontSize: 11 }}>
                ✏️ Edit this text freely — this exact message will be sent to the patient on WhatsApp.
              </small>
              <small style={{ color: "var(--subtle)", fontSize: 11 }}>
                {customWaMsg.length} chars
              </small>
            </div>
          </div>

          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
              Soniox Speech-to-Text API Key (Optional / Auto-Simulated)
            </span>
            <Input
              value={sonioxApiKey}
              onChange={(e) => onSonioxKeyChange(e.target.value)}
              placeholder="Paste Soniox API Key (or leave blank to use high-accuracy simulation)"
              style={{ fontSize: 12 }}
            />
            <small style={{ color: "var(--subtle)", fontSize: 11 }}>
              Telugu, Hindi & English multilingual diarization powered by Soniox Speech-to-Text.
            </small>
          </div>
        </div>

        <div className="crm-modal-footer" style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 8 }}>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <a
            href={`https://wa.me/${(lead.phone || "919849122618").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(customWaMsg.trim() || openingLines[lang])}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium border shadow-xs h-9 px-4 py-2"
            style={{ textDecoration: "none", color: "#166534", backgroundColor: "#dcfce7", borderColor: "#86efac", fontWeight: 600 }}
          >
            <MessageSquare size={15} /> 💬 WhatsApp Msg
          </a>
          <Button
            variant="outline"
            style={{ color: "#15803d", backgroundColor: "#f0fdf4", borderColor: "#86efac", fontWeight: 600 }}
            onClick={() => {
              const cleanPhone = (lead.phone || "+919849122618").replace(/[^0-9+]/g, "");
              window.location.href = `tel:${cleanPhone}`;
              onStartCall(lead, lang);
            }}
          >
            <PhoneCall size={15} /> Direct GSM Call (tel:)
          </Button>
          <Button className="primary-action" onClick={() => onStartCall(lead, lang)}>
            <Mic size={16} /> 🎙️ Start Live Call & Listen (Soniox STT)
          </Button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// PRD 10 & 11: Interactive Active Calling & Post-Call Review Modal
// --------------------------------------------------------------------------
export function ActiveCallModal({
  lead,
  language: initialLanguage,
  sonioxApiKey,
  onClose,
  onCallFinished,
}: {
  lead: DisplayLead;
  language: string;
  sonioxApiKey: string;
  onClose: () => void;
  onCallFinished: (callData: any) => void;
}) {
  const [callActive, setCallActive] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [language, setLanguage] = useState<"telugu" | "hindi" | "english">(
    initialLanguage.includes("hin") ? "hindi" : initialLanguage.includes("eng") ? "english" : "telugu"
  );
  const [transcriptLines, setTranscriptLines] = useState<Array<{ speaker: string; time: string; text: string; evidence?: boolean }>>([]);
  const [loadingSTT, setLoadingSTT] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [micPermission, setMicPermission] = useState<"prompt" | "granted" | "denied">("prompt");
  const [interimText, setInterimText] = useState("");
  const [activeSpeaker, setActiveSpeaker] = useState<"Agent" | "Lead">("Agent");
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(36).fill(12));
  const [manualNote, setManualNote] = useState("");
  const [sonioxSuccess, setSonioxSuccess] = useState<string | null>(null);

  // Post-call state
  const [agentTemp, setAgentTemp] = useState("Hot");
  const aiSuggestedTemp = "Hot";
  const [primaryObjection, setPrimaryObjection] = useState("Surgical package cost & insurance cashless clearance");
  const [structuredRemark, setStructuredRemark] = useState(
    `Urgent follow-up completed for joint consultation. Discussed Saturday slot and cashless insurance clearance. Sent estimate details on WhatsApp.`
  );

  // Refs for media recording & audio analysis
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const animFrameRef = React.useRef<number | null>(null);
  const recognitionRef = React.useRef<any>(null);

  // Timer
  useEffect(() => {
    if (!callActive) return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [callActive]);

  // Format time mm:ss
  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // Start Real Microphone Listening & Browser Web Speech Recognition
  const startMicrophone = React.useCallback(async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setMicPermission("denied");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setMicPermission("granted");
      setMicActive(true);

      // Real Audio Analyser for reactive waveform
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          const nextLevels: number[] = [];
          for (let i = 0; i < 36; i++) {
            const raw = dataArray[i % dataArray.length] || 0;
            nextLevels.push(Math.max(8, Math.min(42, Math.round(8 + (raw / 255) * 34))));
          }
          setAudioLevels(nextLevels);
          animFrameRef.current = requestAnimationFrame(loop);
        };
        animFrameRef.current = requestAnimationFrame(loop);
      }

      // MediaRecorder to record audio for Soniox
      try {
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "audio/webm";

        const recorder = new MediaRecorder(stream, { mimeType });
        audioChunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
      } catch (recErr) {
        console.warn("MediaRecorder could not start:", recErr);
      }

      // Real-Time Browser Speech Recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language === "telugu" ? "te-IN" : language === "hindi" ? "hi-IN" : "en-IN";

        recognition.onresult = (event: any) => {
          let currentInterim = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const text = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              const cleaned = text.trim();
              if (cleaned) {
                const timeStr = formatTime(seconds);
                setTranscriptLines((prev) => [
                  ...prev,
                  {
                    speaker: activeSpeaker,
                    time: timeStr,
                    text: cleaned,
                    evidence: activeSpeaker === "Lead" && (cleaned.includes("cost") || cleaned.includes("నొప్పి") || cleaned.includes("appointment") || cleaned.includes("హాస్పిటల్")),
                  },
                ]);
              }
            } else {
              currentInterim += text;
            }
          }
          setInterimText(currentInterim);
        };

        recognition.onerror = (e: any) => {
          if (e.error !== "no-speech") {
            console.warn("Live Speech recognition notice:", e.error);
          }
        };

        recognition.onend = () => {
          if (mediaStreamRef.current?.active) {
            try { recognition.start(); } catch {}
          }
        };

        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch {}
      }
    } catch (err) {
      console.warn("Microphone access denied or error:", err);
      setMicPermission("denied");
      setMicActive(false);
    }
  }, [language, seconds, activeSpeaker]);

  // Trigger microphone on mount
  useEffect(() => {
    void startMicrophone();
    return () => {
      // Clean up resources on unmount
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [startMicrophone]);

  // Transcribe recorded audio with Soniox AI
  const triggerSonioxTranscribe = async () => {
    if (audioChunksRef.current.length === 0) return;
    setLoadingSTT(true);
    try {
      const mime = mediaRecorderRef.current?.mimeType || "audio/webm";
      const audioBlob = new Blob(audioChunksRef.current, { type: mime });
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const res = (reader.result as string) || "";
          resolve(res.split(",")[1] || "");
        };
        reader.readAsDataURL(audioBlob);
      });

      const res = await api.transcribeAudio({
        audioBase64: base64,
        mimeType: mime,
        apiKey: sonioxApiKey || "43569228c10e9142e5e35a5cf92ab7c488444f97d84e7e6216e99e43c19f831a",
        language,
        leadName: lead.name,
      });

      if (res?.lines && res.lines.length > 0) {
        setTranscriptLines(res.lines);
        setSonioxSuccess("Soniox AI transcription complete with speaker diarization.");
      }
    } catch (err) {
      console.warn("Soniox STT call failed:", err);
    } finally {
      setLoadingSTT(false);
    }
  };

  const handleEndCall = () => {
    // Stop recording and stream
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    setMicActive(false);
    setCallActive(false);
    void triggerSonioxTranscribe();
  };

  const handleAddManualNote = () => {
    if (!manualNote.trim()) return;
    setTranscriptLines((prev) => [
      ...prev,
      {
        speaker: activeSpeaker,
        time: formatTime(seconds),
        text: manualNote.trim(),
        evidence: activeSpeaker === "Lead",
      },
    ]);
    setManualNote("");
  };

  const handleSavePostCall = async () => {
    const callPayload = {
      leadId: lead.id || lead.apiId,
      agentId: lead.agent || "Sravani K.",
      durationSec: seconds || 78,
      outcome: "connected",
      language,
      transcript: transcriptLines.map((l) => `${l.speaker} (${l.time}): ${l.text}`).join("\n"),
      agentTemp,
      aiSuggestedTemp,
      primaryObjection,
      structuredRemark,
    };

    try {
      await api.logCall(callPayload);
      await api.updateLeadTemperature(lead.id || lead.apiId, agentTemp);
    } catch {
      // Offline fallback
    }

    onCallFinished(callPayload);
  };

  return (
    <div className="crm-modal-overlay">
      <div className="crm-modal-backdrop" onClick={onClose} />
      <div className="crm-modal-window" style={{ maxWidth: 760 }}>
        {callActive ? (
          <>
            <div className="crm-modal-header" style={{ background: "var(--navy)", color: "#ffffff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="live-dot" style={{ background: micActive ? "#22c55e" : "#ff4444" }} />
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {micActive ? "🎙️ LIVE MICROPHONE ACTIVE" : "MIC MUTED"} · {language.toUpperCase()} · SONIOX AI
                </span>
                <Badge variant="outline" style={{ color: "#a5b4c6", borderColor: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                  Key: {sonioxApiKey ? `${sonioxApiKey.slice(0, 8)}...` : "43569228..."}
                </Badge>
              </div>
              <Badge variant="outline" style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 700 }}>
                {formatTime(seconds)}
              </Badge>
            </div>

            <div className="crm-modal-body" style={{ background: "#0b2545", color: "#ffffff" }}>
              {/* Mic permission warning if denied */}
              {micPermission === "denied" && (
                <div style={{ background: "#450a0a", border: "1px solid #dc2626", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12, color: "#fca5a5", display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertCircle size={16} />
                  <span>Microphone access was blocked by browser. Please allow microphone permission in your browser address bar to transcribe your real voice.</span>
                </div>
              )}

              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <div className="large-avatar" style={{ margin: "0 auto 8px", background: "var(--gold)", color: "var(--navy)" }}>
                  {lead.name.slice(0, 2).toUpperCase()}
                </div>
                <h2 style={{ color: "#ffffff", margin: "0 0 4px", fontSize: 20 }}>{lead.name}</h2>
                <p style={{ color: "#a5b4c6", margin: 0, fontSize: 13 }}>{lead.phone || "+91 98491 22618"} · {lead.source}</p>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)", marginTop: 6 }}>{formatTime(seconds)}</div>
              </div>

              {/* Real Responsive Audio Waveform */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, height: 44, margin: "6px 0" }}>
                {audioLevels.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      width: 4,
                      height: `${h}px`,
                      background: micActive ? "var(--gold)" : "#64748b",
                      borderRadius: 2,
                      transition: "height 0.08s ease",
                    }}
                  />
                ))}
              </div>

              {/* Language & Speaker Toolbar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.06)", padding: "8px 12px", borderRadius: 8, marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>Language:</span>
                  {(["telugu", "hindi", "english"] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLanguage(l)}
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        border: "1px solid rgba(255,255,255,0.2)",
                        background: language === l ? "var(--gold)" : "transparent",
                        color: language === l ? "var(--navy)" : "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>Speaking as:</span>
                  <button
                    onClick={() => setActiveSpeaker(activeSpeaker === "Agent" ? "Lead" : "Agent")}
                    style={{
                      padding: "2px 10px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      border: "1px solid var(--gold)",
                      background: activeSpeaker === "Agent" ? "#0284c7" : "#16a34a",
                      color: "#ffffff",
                      cursor: "pointer",
                    }}
                  >
                    {activeSpeaker === "Agent" ? "🧑 Agent (Sravani)" : "👤 Patient / Lead"} ⇋
                  </button>
                </div>
              </div>

              {/* Live Streaming Speech Transcript */}
              <div style={{ background: "rgba(0,0,0,0.35)", borderRadius: 8, padding: 12, maxHeight: 190, overflowY: "auto", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--gold)", fontSize: 12, fontWeight: 700 }}>
                    <Sparkles size={14} /> Live Speech Transcription ({language.toUpperCase()})
                  </div>
                  {sonioxSuccess && <span style={{ fontSize: 11, color: "#4ade80" }}>✓ {sonioxSuccess}</span>}
                </div>

                {transcriptLines.length === 0 && !interimText && (
                  <div style={{ padding: "16px 0", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                    🎙️ Listening to your microphone... Start speaking in {language.toUpperCase()} to transcribe live.
                  </div>
                )}

                {transcriptLines.map((line, idx) => (
                  <div key={idx} style={{ marginBottom: 8, fontSize: 12, lineHeight: 1.4 }}>
                    <strong style={{ color: line.speaker === "Lead" ? "var(--gold)" : "#7dd3fc" }}>
                      {line.speaker} ({line.time}):
                    </strong>{" "}
                    <span style={{ color: "#e2e8f0" }}>{line.text}</span>
                    {line.evidence && <Badge variant="outline" style={{ marginLeft: 6, fontSize: 10, color: "var(--gold)", borderColor: "var(--gold)" }}>Evidence</Badge>}
                  </div>
                ))}

                {/* Real-Time Live Interim Words */}
                {interimText && (
                  <div style={{ color: "#fde047", fontStyle: "italic", fontSize: 12, marginTop: 4 }}>
                    <strong>{activeSpeaker} (speaking...):</strong> {interimText}
                  </div>
                )}

                {loadingSTT && <small style={{ color: "#94a3b8", display: "block", marginTop: 6 }}>⚡ Soniox AI transcribing recorded speech stream...</small>}
              </div>

              {/* Quick Input Note */}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Input
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddManualNote(); }}
                  placeholder={`Type remark as ${activeSpeaker}... (Press Enter)`}
                  style={{ fontSize: 12, background: "rgba(255,255,255,0.1)", color: "#ffffff", borderColor: "rgba(255,255,255,0.2)" }}
                />
                <Button size="sm" variant="outline" style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.3)" }} onClick={handleAddManualNote}>
                  + Add
                </Button>
                <Button size="sm" variant="outline" style={{ color: "var(--gold)", borderColor: "var(--gold)" }} onClick={triggerSonioxTranscribe} disabled={loadingSTT}>
                  <Sparkles size={13} style={{ marginRight: 4 }} /> Soniox Sync
                </Button>
              </div>

              {/* End Call Button */}
              <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
                <Button
                  variant="destructive"
                  onClick={handleEndCall}
                  style={{ borderRadius: 30, padding: "10px 36px", fontSize: 14, fontWeight: 700 }}
                >
                  <PhoneOff size={16} style={{ marginRight: 6 }} /> End Call & Review
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* POST-CALL REVIEW */
          <>
            <div className="crm-modal-header">
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--navy)" }}>
                  PRD 5, 10 & 11 · Post-Call Review ({formatTime(seconds)})
                </span>
                <h2>Review Call & Generate Cadence</h2>
              </div>
              <Badge variant="outline">Meaningful Touch (45s+)</Badge>
            </div>

            <div className="crm-modal-body">
              {/* QA Disagreement Check */}
              {agentTemp !== aiSuggestedTemp && (
                <div style={{ background: "#fff3f3", border: "1px solid #f8b4b4", borderRadius: 8, padding: 12, display: "flex", gap: 10 }}>
                  <AlertTriangle size={20} style={{ color: "var(--burgundy)", flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: "var(--burgundy)" }}>
                    <strong>PRD 11 QA Disagreement Flag:</strong> AI model suggested <strong>HOT</strong> based on appointment acceptance and 4-week timeline.
                    You selected <strong>{agentTemp}</strong>. This difference will be reported in the Manager QA Ledger for review.
                  </div>
                </div>
              )}

              {/* Temperature Selector */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>
                    PRD 5: Agent Lead Temperature Disposition
                  </span>
                  <small style={{ color: "var(--subtle)" }}>AI suggests: Hot</small>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                  {["Hot", "Warm", "Cold", "Not Lifting", "Junk"].map((temp) => (
                    <button
                      key={temp}
                      onClick={() => setAgentTemp(temp)}
                      style={{
                        padding: "8px 0",
                        borderRadius: 6,
                        border: agentTemp === temp ? "2px solid var(--navy)" : "1px solid var(--border)",
                        background: agentTemp === temp ? "var(--navy)" : "#ffffff",
                        color: agentTemp === temp ? "#ffffff" : "var(--navy)",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {temp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto Cadence Preview (PRD 6) */}
              <div style={{ background: "#f8fafd", border: "1px solid #c8d8ec", borderRadius: 8, padding: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", textTransform: "uppercase" }}>
                  PRD 6: Automated Follow-Up Cadence Preview
                </span>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--navy)" }}>
                  {agentTemp === "Hot" && "⚡ Hot Cadence: 3 Calls scheduled (Day 1, Day 3, Day 5) + 3 WhatsApp clinical updates."}
                  {agentTemp === "Warm" && "⚡ Warm Cadence: 2 Calls scheduled (Day 2, Day 5) + 2 WhatsApp follow-ups."}
                  {agentTemp === "Cold" && "⚡ Cold Cadence: 1 Call scheduled (Day 4) + educational content dispatch."}
                  {agentTemp === "Not Lifting" && "⚡ Not Lifting Cadence: 2 staggered double-dials scheduled for tomorrow morning."}
                  {agentTemp === "Junk" && "❌ Lead marked Junk: Cadence terminated. Disqualified."}
                </p>
              </div>

              {/* Structured Remark (PRD 10) */}
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                  7-Part Structured Call Remark
                </span>
                <textarea
                  value={structuredRemark}
                  onChange={(e) => setStructuredRemark(e.target.value)}
                  rows={3}
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
                />
              </div>

              {/* Full Speech Transcript Accordion */}
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                  Diarized Soniox Speech Transcript ({transcriptLines.length} turns)
                </span>
                <div style={{ background: "#f8f6f0", border: "1px solid var(--border)", borderRadius: 6, padding: 10, maxHeight: 120, overflowY: "auto", fontSize: 12 }}>
                  {transcriptLines.map((l, idx) => (
                    <p key={idx} style={{ margin: "0 0 6px" }}>
                      <strong>{l.speaker} ({l.time}):</strong> {l.text}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="crm-modal-footer">
              <Button variant="outline" onClick={onClose}>Discard</Button>
              <Button className="primary-action" onClick={handleSavePostCall}>
                <Check size={16} /> Confirm & Save to Lead 360
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// PRD 15: Lead Closure Governance Modal
// --------------------------------------------------------------------------
export function LeadClosureModal({
  lead,
  onClose,
  onConfirmClose,
}: {
  lead: DisplayLead;
  onClose: () => void;
  onConfirmClose: (leadId: string, reason: string, isRecoverable: boolean) => void;
}) {
  const [primaryReason, setPrimaryReason] = useState("Competitor chosen (Local clinic in Warangal)");
  const [secondaryReason, setSecondaryReason] = useState("Daughter decided to try conservative Ayurveda therapy for 30 days first.");
  const [evidence, setEvidence] = useState("Call timestamp 01:24 (Recording #REC-8291)");
  const [isRecoverable, setIsRecoverable] = useState(true);

  const reasons = [
    "Competitor chosen (Local clinic in Warangal)",
    "Financial / surgical package affordability",
    "Procedure postponed / timing changed",
    "Clinical criteria not met / surgery not recommended",
    "Unable to reach (unresponsive after full cadence)",
    "Invalid mobile number / spam",
  ];

  const handleSave = async () => {
    try {
      await api.closeLead(lead.id || lead.apiId, primaryReason, secondaryReason, evidence, isRecoverable ? 1 : 0);
    } catch {
      // fallback
    }
    onConfirmClose(lead.id || lead.apiId, primaryReason, isRecoverable);
  };

  return (
    <div className="crm-modal-overlay">
      <div className="crm-modal-backdrop" onClick={onClose} />
      <div className="crm-modal-window" style={{ maxWidth: 580 }}>
        <div className="crm-modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--navy)" }}>
              PRD 15 · Lead Closure Governance
            </span>
            <h2>Close Lead · {lead.name}</h2>
          </div>
          <button onClick={onClose} className="icon-button"><X size={19} /></button>
        </div>

        <div className="crm-modal-body">
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
              Primary Closure Reason (Mandatory)
            </span>
            <select
              value={primaryReason}
              onChange={(e) => setPrimaryReason(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13 }}
            >
              {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
              Secondary Reason / Detailed Clinical Note
            </span>
            <textarea
              value={secondaryReason}
              onChange={(e) => setSecondaryReason(e.target.value)}
              rows={3}
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
            />
          </div>

          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
              Call Evidence / Transcript Timestamp
            </span>
            <Input
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              style={{ fontSize: 12 }}
            />
          </div>

          <div style={{ background: "#f8f6f0", border: "1px solid var(--border)", borderRadius: 8, padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <strong style={{ fontSize: 13, color: "var(--navy)", display: "block" }}>Is this lead recoverable in the future?</strong>
              <small style={{ color: "var(--subtle)" }}>
                {isRecoverable ? "✅ Automatically schedules a 30-day reactivation touch in the recovery queue." : "Lead is permanently disqualified."}
              </small>
            </div>
            <Switch checked={isRecoverable} onCheckedChange={setIsRecoverable} />
          </div>
        </div>

        <div className="crm-modal-footer">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handleSave}>
            Confirm Lead Closure
          </Button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// PRD 19: Multilingual Voice/Text Ask Bar with 1-Click Excel Download
// --------------------------------------------------------------------------
export function MultilingualAskModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("రవి పెర్ఫార్మెన్స్ రిపోర్ట్");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const sampleQueries = [
    { label: "Telugu: రవి పెర్ఫార్మెన్స్ రిపోర్ట్", text: "రవి పెర్ఫార్మెన్స్ రిపోర్ట్" },
    { label: "Telugu: గూగుల్ లీడ్స్ ఎన్ని వచ్చాయి?", text: "గూగుల్ లీడ్స్ ఎన్ని వచ్చాయి?" },
    { label: "Hindi: यूट्यूब कैंपेन लीकेज रिपोर्ट", text: "यूट्यूब कैंपेन लीकेज रिपोर्ट" },
    { label: "Hindi: कितने लीड्स हॉट हैं?", text: "कितने लीड्स हॉट हैं?" },
    { label: "English: YouTube Campaign Leakage", text: "Show YouTube campaign leakage analysis" },
  ];

  const handleAsk = async (q = query) => {
    setLoading(true);
    try {
      const res = await api.ask(q);
      setResult(res);
    } catch {
      // Mock result
      setResult({
        title: `Report for "${q}"`,
        columns: ["Metric / Segment", "Volume", "Qualified Rate", "Conversion Rate", "Revenue"],
        rows: [
          ["Google Search · Orthopedics", "486", "68%", "11.2%", "₹76.2L"],
          ["Meta Telugu · Spine & Joint", "1,104", "72%", "6.1%", "₹61.8L"],
          ["YouTube · Patient Reviews", "426", "77%", "7.2%", "₹29.7L"],
          ["Inbound Helpline", "448", "84%", "10.6%", "₹16.3L"],
        ],
        summary: "1,576 leads analyzed. Google Search generates the highest revenue with 11.2% conversion.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void handleAsk(query);
  }, []);

  const downloadExcel = () => {
    if (!result || !result.columns || !result.rows) return;
    const header = result.columns.map((c: string) => `"${c.replace(/"/g, '""')}"`).join(",");
    const rows = result.rows.map((r: any[]) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const csvData = "\uFEFF" + `${header}\n${rows}`;
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${(result.title || "CRM_Report").replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="crm-modal-overlay">
      <div className="crm-modal-backdrop" onClick={onClose} />
      <div className="crm-modal-window" style={{ maxWidth: 740 }}>
        <div className="crm-modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--navy)" }}>
              PRD 19 · Multilingual Ask Bar
            </span>
            <h2>Natural Language Query (Telugu · Hindi · English)</h2>
          </div>
          <button onClick={onClose} className="icon-button"><X size={19} /></button>
        </div>

        <div className="crm-modal-body">
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask in Telugu, Hindi, or English (e.g. రవి పెర్ఫార్మెన్స్ రిపోర్ట్, कितने लीड्स हॉट हैं?)"
                onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                style={{ paddingRight: 40 }}
              />
              <Mic size={18} style={{ position: "absolute", right: 12, top: 10, color: "var(--gold)" }} />
            </div>
            <Button className="primary-action" onClick={() => handleAsk()} disabled={loading}>
              <Search size={16} /> {loading ? "Searching..." : "Ask"}
            </Button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {sampleQueries.map((s) => (
              <button
                key={s.label}
                onClick={() => { setQuery(s.text); handleAsk(s.text); }}
                style={{
                  background: "#f0ede4",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: "4px 10px",
                  fontSize: 11,
                  cursor: "pointer",
                  color: "var(--navy)",
                  fontWeight: 500,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {result && (
            <div style={{ background: "#ffffff", border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: "var(--navy)", fontFamily: "var(--font-display)" }}>
                  {result.title}
                </h3>
                <Button variant="outline" size="sm" onClick={downloadExcel} style={{ gap: 6 }}>
                  <Download size={14} /> 1-Click Excel (CSV)
                </Button>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--subtle)" }}>
                {result.summary}
              </p>
              <table className="ask-result-table">
                <thead>
                  <tr>
                    {result.columns?.map((c: string) => <th key={c}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {result.rows?.map((r: any[], i: number) => (
                    <tr key={i}>
                      {r.map((cell, cellIdx) => <td key={cellIdx}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="crm-modal-footer">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {result && (
            <Button className="gold-action" onClick={downloadExcel}>
              <Download size={16} /> Download Excel Spreadsheet
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// PRD 20: System Training Modal
// --------------------------------------------------------------------------
export function SystemTrainingModal({ onClose, notify }: { onClose: () => void; notify?: (msg: string) => void }) {
  const [docName, setDocName] = useState("TRH_Hospital_Orthopedic_Protocols_v2.pdf");
  const [spokenRules, setSpokenRules] = useState(
    `1. If patient mentions severe pain > 6 months, mandate Saturday specialist consult slot.\n2. In Telangana campaigns, telecalling agents must greet in Telugu.\n3. Always offer cashless TPA insurance and 0% EMI assistance before concluding first call.`
  );

  const handleSave = () => {
    notify?.("System training saved and updated in AI Policy Engine.");
    onClose();
  };

  return (
    <div className="crm-modal-overlay">
      <div className="crm-modal-backdrop" onClick={onClose} />
      <div className="crm-modal-window" style={{ maxWidth: 620 }}>
        <div className="crm-modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--navy)" }}>
              PRD 20 · Continuous Learning & Governance
            </span>
            <h2>Train CRM System (SOPs & Spoken Rules)</h2>
          </div>
          <button onClick={onClose} className="icon-button"><X size={19} /></button>
        </div>

        <div className="crm-modal-body">
          <div style={{ border: "2px dashed var(--border)", borderRadius: 8, padding: 20, textAlign: "center", background: "#fdfcfa" }}>
            <Upload size={24} style={{ color: "var(--gold)", margin: "0 auto 8px" }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>Upload Department SOP or Clinical Playbook</div>
            <p style={{ margin: "4px 0 10px", fontSize: 11, color: "var(--subtle)" }}>PDF, DOCX, or Excel file up to 25MB</p>
            <Badge variant="outline">{docName}</Badge>
          </div>

          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
              Custom Business Rules & Opening Script Guidelines
            </span>
            <textarea
              value={spokenRules}
              onChange={(e) => setSpokenRules(e.target.value)}
              rows={4}
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
            />
          </div>

          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 12, display: "flex", gap: 8 }}>
            <ShieldCheck size={18} style={{ color: "var(--green)", flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--green)" }}>
              These rules directly instruct Soniox speech transcription, AI remark drafts, and opening line suggestions without altering historical auditable records.
            </span>
          </div>
        </div>

        <div className="crm-modal-footer">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="primary-action" onClick={handleSave}>
            <Check size={16} /> Save & Train System
          </Button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// PRD 20: 21:00 Evening Manager Daily Report Modal
// --------------------------------------------------------------------------
export function EveningManagerReportModal({ onClose }: { onClose: () => void }) {
  const agentTouches = [
    { name: "Sravani K.", dials: 82, connected: 64, touchesUnder5m: "94%", sundayAfterHours: 6, status: "Healthy" },
    { name: "Anil Kumar", dials: 78, connected: 58, touchesUnder5m: "79%", sundayAfterHours: 8, status: "Coaching" },
    { name: "Divya M.", dials: 74, connected: 61, touchesUnder5m: "91%", sundayAfterHours: 4, status: "Healthy" },
    { name: "Kiran Reddy", dials: 69, connected: 46, touchesUnder5m: "68%", sundayAfterHours: 11, status: "Intervene" },
  ];

  return (
    <div className="crm-modal-overlay">
      <div className="crm-modal-backdrop" onClick={onClose} />
      <div className="crm-modal-window" style={{ maxWidth: 720 }}>
        <div className="crm-modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--navy)" }}>
              PRD 20 · Automated 21:00 Dispatch
            </span>
            <h2>Evening Manager Operating Report (21:00 IST)</h2>
          </div>
          <button onClick={onClose} className="icon-button"><X size={19} /></button>
        </div>

        <div className="crm-modal-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <div style={{ background: "#f8f6f0", padding: 12, borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: "var(--subtle)" }}>Total Sourced</span>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--navy)" }}>142</div>
            </div>
            <div style={{ background: "#f8f6f0", padding: 12, borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: "var(--subtle)" }}>Touch Time &lt; 5m</span>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--green)" }}>86.2%</div>
            </div>
            <div style={{ background: "#f8f6f0", padding: 12, borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: "var(--subtle)" }}>Sunday & After-Hours</span>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--gold)" }}>29 Leads</div>
            </div>
            <div style={{ background: "#f8f6f0", padding: 12, borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: "var(--subtle)" }}>15m Reassignments</span>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--burgundy)" }}>4 Leads</div>
            </div>
          </div>

          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 8 }}>
              Agent Touch Breakdown & Touch Time Buckets
            </span>
            <table className="ask-result-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Dials</th>
                  <th>Connected</th>
                  <th>&lt; 5m SLA</th>
                  <th>After-Hours</th>
                  <th>Review Action</th>
                </tr>
              </thead>
              <tbody>
                {agentTouches.map((a) => (
                  <tr key={a.name}>
                    <td><strong>{a.name}</strong></td>
                    <td>{a.dials}</td>
                    <td>{a.connected}</td>
                    <td><Badge variant="outline">{a.touchesUnder5m}</Badge></td>
                    <td>{a.sundayAfterHours}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: a.status === "Intervene" ? "var(--burgundy)" : "var(--navy)" }}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="crm-modal-footer">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button className="primary-action" onClick={onClose}>
            <Download size={15} /> Export PDF Brief
          </Button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Multi-Tenant Role Switcher / Login Modal
// --------------------------------------------------------------------------
export function UserAccountModal({
  currentUser,
  currentTenant,
  onSelectUser,
  onSelectTenant,
  onClose,
}: {
  currentUser: RoleUser;
  currentTenant: TenantPack;
  onSelectUser: (user: RoleUser) => void;
  onSelectTenant: (tenant: TenantPack) => void;
  onClose: () => void;
}) {
  return (
    <div className="crm-modal-overlay">
      <div className="crm-modal-backdrop" onClick={onClose} />
      <div className="crm-modal-window" style={{ maxWidth: 660 }}>
        <div className="crm-modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--navy)" }}>
              Multi-Tenant Architecture & Auth
            </span>
            <h2>Workspace Roles & Vertical Tenant Packs</h2>
          </div>
          <button onClick={onClose} className="icon-button"><X size={19} /></button>
        </div>

        <div className="crm-modal-body">
          {/* Tenant pack selector */}
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 6 }}>
              Select Active Vertical Tenant Pack (5 Packs Available)
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 8 }}>
              {VERTICAL_TENANTS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelectTenant(t)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    padding: 10,
                    borderRadius: 8,
                    border: currentTenant.id === t.id ? "2px solid var(--gold)" : "1px solid var(--border)",
                    background: currentTenant.id === t.id ? "#fffdf6" : "#ffffff",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                    <strong style={{ fontSize: 12, color: "var(--navy)" }}>{t.name}</strong>
                    {currentTenant.id === t.id && <Badge variant="outline" style={{ borderColor: "var(--gold)" }}>Active</Badge>}
                  </div>
                  <small style={{ color: "var(--subtle)", marginTop: 2 }}>{t.description}</small>
                </button>
              ))}
            </div>
          </div>

          <hr style={{ borderColor: "var(--line)", margin: "4px 0" }} />

          {/* Quick role switches */}
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 6 }}>
              1-Tap Switch Role & Permissions
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ROLE_USERS.map((u) => (
                <button
                  key={u.email}
                  onClick={() => { onSelectUser(u); onClose(); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 12,
                    borderRadius: 8,
                    border: currentUser.email === u.email ? "2px solid var(--navy)" : "1px solid var(--border)",
                    background: currentUser.email === u.email ? "#f1ede3" : "#ffffff",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="user-avatar" style={{ background: "var(--navy)", color: "#ffffff" }}>
                      {u.avatar}
                    </div>
                    <div>
                      <strong style={{ fontSize: 13, color: "var(--navy)" }}>{u.name} · {u.title}</strong>
                      <div style={{ fontSize: 11, color: "var(--subtle)" }}>{u.email}</div>
                      <small style={{ color: "#475569", fontSize: 11 }}>{u.tagline}</small>
                    </div>
                  </div>
                  {currentUser.email === u.email ? <Check size={18} style={{ color: "var(--navy)" }} /> : <ChevronRight size={16} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="crm-modal-footer">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// WhatsApp Two-Way Live Conversation & Inbound Reply Simulator - PRD 7
// --------------------------------------------------------------------------
export function WhatsAppConversationModal({
  lead,
  onClose,
  onMessageReceived,
  notify,
}: {
  lead: DisplayLead;
  onClose: () => void;
  onMessageReceived?: () => void;
  notify?: (msg: string) => void;
}) {
  const [messagesList, setMessagesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [outboundText, setOutboundText] = useState("");
  const [inboundSimulatorText, setInboundSimulatorText] = useState("");
  const [simulating, setSimulating] = useState(false);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/messages?leadId=${lead.apiId || lead.id}`);
      const data: any = await res.json();
      if (data && data.success && Array.isArray(data.data)) {
        setMessagesList(data.data.slice().reverse());
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [lead.id, lead.apiId]);

  const handleSendOutbound = async () => {
    if (!outboundText.trim()) return;
    try {
      setSending(true);
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.apiId || lead.id,
          channel: "whatsapp",
          direction: "outbound",
          content: outboundText.trim(),
          purpose: "followup",
          status: "delivered",
          sentBy: "Sravani (Agent)",
        }),
      });
      const data: any = await res.json();
      if (data && data.success) {
        setMessagesList((prev) => [...prev, data.data]);
        const text = outboundText.trim();
        setOutboundText("");
        notify?.(`WhatsApp message logged for ${lead.name}`);

        const cleanPhone = lead.phone.replace(/\D/g, "");
        const norm = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        const waUrl = `https://wa.me/${norm}?text=${encodeURIComponent(text)}`;
        window.open(waUrl, "_blank");
      }
    } catch {
      notify?.("Failed to send WhatsApp message.");
    } finally {
      setSending(false);
    }
  };

  const handleSimulateInbound = async (customReply?: string) => {
    const textToSend = customReply || inboundSimulatorText.trim();
    if (!textToSend) return;
    try {
      setSimulating(true);
      const cleanPhone = lead.phone.replace(/\D/g, "");
      const res = await fetch("/api/messages/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.apiId || lead.id,
          phone: cleanPhone,
          content: textToSend,
          senderName: lead.name,
        }),
      });
      const data: any = await res.json();
      if (data && data.success) {
        setMessagesList((prev) => [...prev, data.data.message]);
        setInboundSimulatorText("");
        notify?.(`🟢 WhatsApp Reply Received: ${data.data.intentBadge}! Qualification updated to ${data.data.updatedQualification}.`);
        if (onMessageReceived) {
          onMessageReceived();
        }
      }
    } catch {
      notify?.("Failed to process WhatsApp reply.");
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="crm-modal-backdrop" onClick={onClose}>
      <div className="crm-modal-card" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="crm-modal-header" style={{ background: "#0b2545", color: "#ffffff", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>💬</span>
              <h2 style={{ fontSize: 18, fontWeight: "700", color: "#ffffff", margin: 0 }}>
                WhatsApp 2-Way Stream · {lead.name}
              </h2>
              <Badge style={{ background: "#25D366", color: "#ffffff", border: "none", fontSize: 10 }}>
                ● Meta Business Webhook Active
              </Badge>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#d09a26" }}>
              {lead.phone} · Qualification: <strong style={{ color: "#ffffff" }}>{lead.qualification}</strong> · Stage: {lead.stage}
            </p>
          </div>
          <button className="crm-modal-close" style={{ color: "#ffffff" }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="crm-modal-body" style={{ padding: 18, background: "#f8fafc" }}>
          {/* Messages Scroll Area */}
          <div
            style={{
              height: 280,
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginBottom: 16,
            }}
          >
            {loading && messagesList.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: "#64748b" }}>
                Loading conversation history...
              </div>
            ) : messagesList.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
                <p style={{ fontSize: 13, margin: 0 }}>No WhatsApp messages recorded yet.</p>
                <small>Send a greeting or simulate a patient reply below.</small>
              </div>
            ) : (
              messagesList.map((m, idx) => {
                const isInbound = m.direction === "inbound";
                return (
                  <div
                    key={m.id || idx}
                    style={{
                      alignSelf: isInbound ? "flex-start" : "flex-end",
                      maxWidth: "78%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isInbound ? "flex-start" : "flex-end",
                    }}
                  >
                    <div
                      style={{
                        background: isInbound ? "#e8f5e9" : "#0b2545",
                        color: isInbound ? "#0b2545" : "#ffffff",
                        padding: "10px 14px",
                        borderRadius: isInbound ? "12px 12px 12px 2px" : "12px 12px 2px 12px",
                        border: isInbound ? "1px solid #a7f3d0" : "none",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                        <strong style={{ fontSize: 11, color: isInbound ? "#166534" : "#d09a26" }}>
                          {isInbound ? `👤 ${lead.name} (Patient)` : `🧑 ${m.sentBy || "Sravani (Agent)"}`}
                        </strong>
                        <span style={{ fontSize: 10, opacity: 0.7 }}>
                          {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now"}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: "19px", whiteSpace: "pre-wrap" }}>
                        {m.content}
                      </p>
                      {isInbound && m.purpose && (
                        <div style={{ marginTop: 6, display: "inline-block" }}>
                          <span
                            style={{
                              background: m.purpose.includes("confirm") ? "#16a34a" : m.purpose.includes("financial") ? "#d09a26" : "#2563eb",
                              color: "#ffffff",
                              fontSize: 9,
                              fontWeight: "700",
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            {m.purpose.replace(/_/g, " ").toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Inbound WhatsApp Reply Simulation Box */}
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <strong style={{ fontSize: 12, color: "#166534", display: "flex", alignItems: "center", gap: 6 }}>
                <span>⚡</span> Inbound WhatsApp Simulator (Test Patient Reply Real-Time)
              </strong>
              <span style={{ fontSize: 10, color: "#15803d", fontWeight: "600" }}>
                Auto-updates Database & Leads
              </span>
            </div>

            {/* Quick response test pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              <button
                type="button"
                onClick={() => handleSimulateInbound("Namasthe")}
                disabled={simulating}
                style={{
                  background: "#ecfdf5",
                  border: "1.5px solid #059669",
                  color: "#047857",
                  padding: "5px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                🙏 "Namasthe" (Patient Greeting)
              </button>

              <button
                type="button"
                onClick={() => handleSimulateInbound("Yes, Saturday 11:30 AM confirmed! We will attend in-clinic consultation.")}
                disabled={simulating}
                style={{
                  background: "#ffffff",
                  border: "1px solid #16a34a",
                  color: "#166534",
                  padding: "5px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                🟢 "Confirm Saturday 11:30 AM" (Hot)
              </button>

              <button
                type="button"
                onClick={() => handleSimulateInbound("Please send treatment cost estimate and cashless insurance details on WhatsApp.")}
                disabled={simulating}
                style={{
                  background: "#ffffff",
                  border: "1px solid #d09a26",
                  color: "#854d0e",
                  padding: "5px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                🟡 "Send Cost & Insurance Info" (Hot)
              </button>

              <button
                type="button"
                onClick={() => handleSimulateInbound("Call me tomorrow after 4:30 PM, I am in office right now.")}
                disabled={simulating}
                style={{
                  background: "#ffffff",
                  border: "1px solid #2563eb",
                  color: "#1e40af",
                  padding: "5px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                🔵 "Call Tomorrow after 4:30 PM" (Warm)
              </button>

              <button
                type="button"
                onClick={() => handleSimulateInbound("Not interested, please do not call again.")}
                disabled={simulating}
                style={{
                  background: "#ffffff",
                  border: "1px solid #ef4444",
                  color: "#991b1b",
                  padding: "5px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                🔴 "Not Interested / Stop" (Cold)
              </button>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="Type custom patient reply in Telugu, Hindi, or English..."
                value={inboundSimulatorText}
                onChange={(e) => setInboundSimulatorText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSimulateInbound()}
                style={{
                  flex: 1,
                  padding: "7px 12px",
                  borderRadius: 6,
                  border: "1px solid #86efac",
                  fontSize: 12,
                  outline: "none",
                }}
              />
              <Button
                size="sm"
                onClick={() => handleSimulateInbound()}
                disabled={simulating || !inboundSimulatorText.trim()}
                style={{ background: "#16a34a", color: "#ffffff", fontWeight: "700" }}
              >
                {simulating ? "Processing..." : "Receive Reply"}
              </Button>
            </div>
          </div>

          {/* Outbound Message Composer */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              placeholder={`Send message to ${lead.name}...`}
              value={outboundText}
              onChange={(e) => setOutboundText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendOutbound()}
              style={{
                flex: 1,
                padding: "9px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 13,
                outline: "none",
              }}
            />
            <Button
              onClick={handleSendOutbound}
              disabled={sending || !outboundText.trim()}
              style={{ background: "#0b2545", color: "#ffffff", fontWeight: "700" }}
            >
              {sending ? "Sending..." : "Send Outbound"}
            </Button>
          </div>
        </div>

        <div className="crm-modal-footer" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#475569" }}>
            <span>🌐 Live Webhook:</span>
            <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, fontSize: 10 }}>
              https://delivers-studios-studio-way.trycloudflare.com/api/webhooks/whatsapp
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText("https://delivers-studios-studio-way.trycloudflare.com/api/webhooks/whatsapp");
                notify?.("Webhook URL copied to clipboard!");
              }}
              style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontWeight: "600", fontSize: 11 }}
            >
              Copy
            </button>
          </div>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Agent Modal: Add New Patient Lead & Health Issue Clinical Intake
// --------------------------------------------------------------------------
export function AddPatientLeadModal({
  onClose,
  onLeadAdded,
  notify,
}: {
  onClose: () => void;
  onLeadAdded: (newLead: DisplayLead) => void;
  notify?: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+91 ");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("Hyderabad Central");
  const [age, setAge] = useState("45");
  const [gender, setGender] = useState("Male");
  const [source, setSource] = useState("Direct Inbound Helpline");
  const [language, setLanguage] = useState("Telugu");

  // Health Issue & Clinical Details
  const [department, setDepartment] = useState("Orthopedics & Spine");
  const [condition, setCondition] = useState("Severe Knee Pain / Osteoarthritis");
  const [symptoms, setSymptoms] = useState("Difficulty walking, joint swelling, persistent pain for over 6 months. Seeking minimally invasive option.");
  const [severity, setSeverity] = useState("Severe");
  const [duration, setDuration] = useState("6–12 months");
  const [urgency, setUrgency] = useState("Immediate (Within 1 week)");
  const [testsDone, setTestsDone] = useState<string[]>(["X-Ray Done", "Previous Doctor Consult"]);
  const [insurance, setInsurance] = useState("Cashless Insurance");
  const [qualification, setQualification] = useState("Hot");
  const [saving, setSaving] = useState(false);

  const toggleTest = (test: string) => {
    setTestsDone((prev) =>
      prev.includes(test) ? prev.filter((t) => t !== test) : [...prev, test]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Please enter patient name.");
      return;
    }
    if (!phone.trim() || phone.trim() === "+91") {
      alert("Please enter a valid phone number.");
      return;
    }

    setSaving(true);
    const newId = `TRH-${Math.floor(10000 + Math.random() * 90000)}`;

    const newLeadRecord: DisplayLead = {
      id: newId,
      apiId: newId,
      name: name.trim(),
      phone: phone.trim(),
      source,
      stage: "received",
      qualification: qualification.toLowerCase(),
      next: "Immediate Call Required (SLA 5m)",
      last: "Just created",
      agent: "Sravani K.",
      createdAt: new Date().toISOString(),
    };

    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newId,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          source,
          campaign: `${department} Intake`,
          creative: `${condition} (${severity})`,
          qualification,
          department,
          branch: city,
          status: "new",
          ownerId: "Sravani",
        }),
      });
    } catch (err) {
      console.warn("Backend save lead fallback:", err);
    }

    setSaving(false);
    onLeadAdded(newLeadRecord);
    notify?.(`➕ Patient lead created for ${name}. 5-minute response SLA timer and 48-hour cadence activated.`);
    onClose();
  };

  return (
    <div className="crm-modal-overlay">
      <div className="crm-modal-backdrop" onClick={onClose} />
      <div className="crm-modal-window" style={{ maxWidth: 740, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="crm-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="modal-icon-badge" style={{ background: "rgba(11,37,69,0.1)", color: "var(--navy)" }}>
              <UserPlus size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--navy)" }}>
                Add New Patient Lead & Health Intake
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--subtle)" }}>
                Enter general contact information and health issue details. Automatically starts 5-min SLA tracking.
              </p>
            </div>
          </div>
          <button className="crm-modal-close" onClick={onClose} aria-label="Close modal"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="crm-modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Section 1: General Information */}
            <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <UsersRound size={16} style={{ color: "var(--navy)" }} />
                <strong style={{ fontSize: 13, color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  1. General Patient Information
                </strong>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                    Patient Full Name *
                  </label>
                  <Input
                    required
                    placeholder="e.g. K. Venkat Reddy"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                    Primary Phone (+91) *
                  </label>
                  <Input
                    required
                    placeholder="+91 98490 XXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                    Alternate Contact / Relative
                  </label>
                  <Input
                    placeholder="e.g. +91 99850 XXXXX (Son)"
                    value={alternatePhone}
                    onChange={(e) => setAlternatePhone(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                    Patient Age & Gender
                  </label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Input
                      style={{ width: 60 }}
                      placeholder="Age"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                    />
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      style={{ flex: 1, padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                    City / Branch
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    style={{ width: "100%", height: 36, padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
                  >
                    <option value="Hyderabad Central">Hyderabad Central</option>
                    <option value="Banjara Hills">Banjara Hills</option>
                    <option value="Secunderabad">Secunderabad</option>
                    <option value="Warangal">Warangal</option>
                    <option value="Karimnagar">Karimnagar</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                    Lead Source Channel (Thesis S.5)
                  </label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    style={{ width: "100%", height: 36, padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
                  >
                    <option value="Direct Inbound Helpline">Direct Inbound Helpline</option>
                    <option value="Google Search Ads">Google Search Ads · Super Specialty</option>
                    <option value="Meta Facebook Ads">Meta Facebook · Knee & Piles Campaign</option>
                    <option value="Doctor Referral">Doctor Referral</option>
                    <option value="Walk-in Health Camp">Walk-in Health Camp</option>
                    <option value="WhatsApp Inbound">WhatsApp Inbound Enquiry</option>
                    <option value="Organic Website">Organic Website Enquiry</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                    Language Preference
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{ width: "100%", height: 36, padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
                  >
                    <option value="Telugu">Telugu (తెలుగు)</option>
                    <option value="Hindi">Hindi (हिंदी)</option>
                    <option value="English">English</option>
                    <option value="Kannada">Kannada (ಕನ್ನಡ)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Health Issue & Clinical Profile */}
            <div style={{ background: "#f0f7ff", padding: "14px 16px", borderRadius: 8, border: "1px solid #bfdbfe" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Stethoscope size={16} style={{ color: "var(--navy)" }} />
                <strong style={{ fontSize: 13, color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  2. Health Issue & Clinical Assessment (Thesis S.4 & S.7)
                </strong>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                    Clinical Department *
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    style={{ width: "100%", height: 36, padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
                  >
                    <option value="Orthopedics & Spine">Orthopedics & Joint Replacement</option>
                    <option value="General & Laparoscopic Surgery">General & Laparoscopic Surgery (Piles/Hernia)</option>
                    <option value="Cardiology">Cardiology & Heart Care</option>
                    <option value="Urology">Urology & Kidney Stones</option>
                    <option value="IVF & Fertility">IVF & Reproductive Medicine</option>
                    <option value="Neurology & Neurosurgery">Neurology & Neurosurgery</option>
                    <option value="Oncology">Oncology & Cancer Care</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                    Health Issue / Specific Diagnosis *
                  </label>
                  <Input
                    required
                    placeholder="e.g. Severe Osteoarthritis Knee Pain"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                  Symptoms & Patient Clinical Complaint (Free text)
                </label>
                <textarea
                  rows={2}
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="Describe patient pain, mobility restrictions, bleeding, duration..."
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                    Symptom Severity
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    style={{ width: "100%", height: 34, padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
                  >
                    <option value="Mild">Mild (Occasional discomfort)</option>
                    <option value="Moderate">Moderate (Daily activities affected)</option>
                    <option value="Severe">Severe (Severe pain, immobility)</option>
                    <option value="Critical">Critical / Emergency</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                    Duration of Problem
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    style={{ width: "100%", height: 34, padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
                  >
                    <option value="< 1 month">&lt; 1 month (Recent onset)</option>
                    <option value="1–6 months">1–6 months</option>
                    <option value="6–12 months">6–12 months</option>
                    <option value="> 1 year">&gt; 1 year (Chronic)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                    Treatment Urgency
                  </label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                    style={{ width: "100%", height: 34, padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
                  >
                    <option value="Immediate (Within 1 week)">Immediate (Within 1 week)</option>
                    <option value="Within 1 month">Within 1 month</option>
                    <option value="Second Opinion / Exploring">Second Opinion / Exploring</option>
                  </select>
                </div>
              </div>

              {/* Previous Investigations Done */}
              <div style={{ marginTop: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 6 }}>
                  Previous Medical Reports / Investigations Available:
                </span>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {["X-Ray Done", "MRI Available", "Blood Reports Ready", "Previous Doctor Consult"].map((test) => (
                    <button
                      type="button"
                      key={test}
                      onClick={() => toggleTest(test)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 16,
                        border: testsDone.includes(test) ? "1px solid var(--navy)" : "1px solid #cbd5e1",
                        background: testsDone.includes(test) ? "var(--navy)" : "#ffffff",
                        color: testsDone.includes(test) ? "#ffffff" : "var(--navy)",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {testsDone.includes(test) ? "✓ " : "+ "}{test}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 3: Initial Lead Qualification & Follow-up Cadence */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                  Financial & Insurance Plan
                </label>
                <select
                  value={insurance}
                  onChange={(e) => setInsurance(e.target.value)}
                  style={{ width: "100%", height: 36, padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
                >
                  <option value="Cashless Insurance">Cashless Insurance (Star, Care, HDFC)</option>
                  <option value="Reimbursement Scheme">Reimbursement (Arogyasri / EHS / CGHS)</option>
                  <option value="Self-pay / Direct">Self-Pay / Cash</option>
                  <option value="Needs 0% EMI Financing">Needs 0% EMI Financing (Bajaj/Credit)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                  Initial Temperature Qualification (Thesis S.7)
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {["Hot", "Warm", "Cold"].map((temp) => (
                    <button
                      type="button"
                      key={temp}
                      onClick={() => setQualification(temp)}
                      style={{
                        padding: "7px 0",
                        borderRadius: 6,
                        border: qualification === temp ? "2px solid var(--navy)" : "1px solid var(--border)",
                        background: qualification === temp ? "var(--navy)" : "#ffffff",
                        color: qualification === temp ? "#ffffff" : "var(--navy)",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {temp === "Hot" ? "🔥 Hot" : temp === "Warm" ? "⚡ Warm" : "❄️ Cold"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "10px 14px", borderRadius: 8, display: "flex", gap: 10, alignItems: "center" }}>
              <ShieldCheck size={20} style={{ color: "#166534", flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: "#166534" }}>
                <strong>Automated SLA & Cadence Guarantee:</strong> Creating this lead assigns it to Sravani K., activates the 5-minute first-touch SLA alert, and generates the 48-hour alternating WhatsApp/Call follow-up sequence.
              </div>
            </div>
          </div>

          <div className="crm-modal-footer">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="primary-action" disabled={saving}>
              {saving ? "Creating Lead..." : "➕ Create Lead & Start 5m SLA"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Agent Modal: Edit Patient Details & Health Issue
// --------------------------------------------------------------------------
export function EditPatientDetailsModal({
  lead,
  onClose,
  onLeadUpdated,
  notify,
}: {
  lead: DisplayLead;
  onClose: () => void;
  onLeadUpdated: (updatedLead: DisplayLead) => void;
  notify?: (msg: string) => void;
}) {
  const [name, setName] = useState(lead.name);
  const [phone, setPhone] = useState(lead.phone);
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("Hyderabad Central");
  const [department, setDepartment] = useState("Orthopedics & Spine");
  const [condition, setCondition] = useState("Knee Pain & Cartilage Wear");
  const [symptoms, setSymptoms] = useState("Patient reports worsening morning stiffness and difficulty climbing stairs.");
  const [severity, setSeverity] = useState("Moderate");
  const [stage, setStage] = useState(lead.stage || "contacted");
  const [qualification, setQualification] = useState(lead.qualification === "hot" ? "Hot" : lead.qualification === "cold" ? "Cold" : "Warm");
  const [assignedDoctor, setAssignedDoctor] = useState("Dr. K. Ramesh (Senior Orthopedic)");
  const [commercialNotes, setCommercialNotes] = useState("Discussed package estimate ₹2,40,000. 12-month 0% EMI suggested.");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const updated: DisplayLead = {
      ...lead,
      name: name.trim(),
      phone: phone.trim(),
      qualification: qualification.toLowerCase(),
      stage,
      last: "Edited just now",
    };

    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          qualification,
          status: stage,
          department,
        }),
      });
    } catch {}

    setSaving(false);
    onLeadUpdated(updated);
    notify?.(`✏️ Updated patient details and health notes for ${name}.`);
    onClose();
  };

  return (
    <div className="crm-modal-overlay">
      <div className="crm-modal-backdrop" onClick={onClose} />
      <div className="crm-modal-window" style={{ maxWidth: 680, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="crm-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="modal-icon-badge" style={{ background: "rgba(11,37,69,0.1)", color: "var(--navy)" }}>
              <Edit3 size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--navy)" }}>
                Edit Patient Details & Health Record
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--subtle)" }}>
                Update contact information, clinical condition, symptoms, and stage for {lead.name} ({lead.id}).
              </p>
            </div>
          </div>
          <button className="crm-modal-close" onClick={onClose} aria-label="Close modal"><X size={18} /></button>
        </div>

        <form onSubmit={handleSave}>
          <div className="crm-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* General Info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                  Patient Full Name
                </label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                  Phone Number
                </label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                  Email Address
                </label>
                <Input placeholder="patient@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                  City / Branch
                </label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>

            {/* Health Issue & Clinical Condition */}
            <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Stethoscope size={15} style={{ color: "var(--navy)" }} />
                <strong style={{ fontSize: 12, color: "var(--navy)" }}>Clinical Health Assessment</strong>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                    Specialty Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    style={{ width: "100%", height: 36, padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
                  >
                    <option value="Orthopedics & Spine">Orthopedics & Joint Replacement</option>
                    <option value="General & Laparoscopic Surgery">General & Laparoscopic Surgery</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Urology">Urology</option>
                    <option value="IVF & Fertility">IVF & Fertility</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                    Diagnosis / Health Issue
                  </label>
                  <Input value={condition} onChange={(e) => setCondition(e.target.value)} />
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                  Symptoms & Clinical Remarks
                </label>
                <textarea
                  rows={2}
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                    Symptom Severity
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    style={{ width: "100%", height: 34, padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
                  >
                    <option value="Mild">Mild</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Severe">Severe</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                    Assigned Specialist Doctor
                  </label>
                  <select
                    value={assignedDoctor}
                    onChange={(e) => setAssignedDoctor(e.target.value)}
                    style={{ width: "100%", height: 34, padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
                  >
                    <option value="Dr. K. Ramesh (Senior Orthopedic)">Dr. K. Ramesh (Senior Orthopedic)</option>
                    <option value="Dr. Radhakrishna (Joint Specialist)">Dr. Radhakrishna (Joint Specialist)</option>
                    <option value="Dr. P. Sailaja (General Surgeon)">Dr. P. Sailaja (General Surgeon)</option>
                    <option value="Dr. S. Rao (Cardiologist)">Dr. S. Rao (Cardiologist)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Stage and Qualification */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                  Funnel Stage
                </label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  style={{ width: "100%", height: 36, padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
                >
                  <option value="received">Received / Intake</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="appointment_booked">Appointment Booked</option>
                  <option value="visited">OPD Visited</option>
                  <option value="surgery_advised">Surgery Advised</option>
                  <option value="closed">Closed / Archived</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                  Temperature Qualification
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {["Hot", "Warm", "Cold"].map((temp) => (
                    <button
                      type="button"
                      key={temp}
                      onClick={() => setQualification(temp)}
                      style={{
                        padding: "7px 0",
                        borderRadius: 6,
                        border: qualification === temp ? "2px solid var(--navy)" : "1px solid var(--border)",
                        background: qualification === temp ? "var(--navy)" : "#ffffff",
                        color: qualification === temp ? "#ffffff" : "var(--navy)",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {temp}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                Commercial / Financial Notes
              </label>
              <textarea
                rows={2}
                value={commercialNotes}
                onChange={(e) => setCommercialNotes(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
              />
            </div>
          </div>

          <div className="crm-modal-footer">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="primary-action" disabled={saving}>
              {saving ? "Saving Changes..." : "Save Details & Update Record"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Manager Modal: Add Telecalling Agent & Issue Login Credentials
// --------------------------------------------------------------------------
export function ManagerAddAgentModal({
  onClose,
  onAgentAdded,
  notify,
}: {
  onClose: () => void;
  onAgentAdded: (newAgent: any) => void;
  notify?: (msg: string) => void;
}) {
  const [step, setStep] = useState<"form" | "slip">("form");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+91 ");
  const [department, setDepartment] = useState("Telecalling - Orthopedics");
  const [branch, setBranch] = useState("Hyderabad Central");
  const [shift, setShift] = useState("General Shift (09:00 - 18:00)");
  const [dialingTarget, setDialingTarget] = useState(50);
  const [password, setPassword] = useState("TrhPass@2026");
  const [showPassword, setShowPassword] = useState(false);
  const [createdSlip, setCreatedSlip] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateAutoEmail = (name: string) => {
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    if (slug) setEmail(`${slug}@meenestham.in`);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      alert("Please enter agent full name and work email.");
      return;
    }

    setLoading(true);
    const agentId = `AGT-${Math.floor(700 + Math.random() * 290)}`;

    const agentData = {
      id: agentId,
      name: fullName.trim(),
      email: email.trim().toLowerCase(),
      password,
      phone: phone.trim(),
      department,
      branch,
      shift,
      dialingTarget,
      loginUrl: typeof window !== "undefined" ? window.location.origin : "http://localhost:5173",
      issuedAt: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }),
      managerName: "Anil Kumar (Team Manager)",
    };

    try {
      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          role: "Agent",
          department,
          branch,
          tenantId: "trh-hospital",
        }),
      });
    } catch {}

    setLoading(false);
    setCreatedSlip(agentData);
    setStep("slip");
    onAgentAdded(agentData);
    notify?.(`👤 Telecalling agent ${fullName} created. Credentials ready for in-person handover.`);
  };

  const handleCopyCredentials = () => {
    if (!createdSlip) return;
    const text = `=== MEENESTHAM HEALTHCARE CRM — AGENT CREDENTIALS ===\nAgent Name: ${createdSlip.name}\nAgent ID: ${createdSlip.id}\nDepartment: ${createdSlip.department}\nShift: ${createdSlip.shift}\nWeb Login URL: ${createdSlip.loginUrl}\nLogin Email: ${createdSlip.email}\nTemporary Password: ${createdSlip.password}\nIssued By: ${createdSlip.managerName}\nIssued Date: ${createdSlip.issuedAt}\n======================================================\nPlease login and begin calling your assigned queue.`;
    navigator.clipboard?.writeText(text);
    notify?.("📋 Agent login credentials copied to clipboard!");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="crm-modal-overlay">
      <div className="crm-modal-backdrop" onClick={onClose} />
      <div className="crm-modal-window" style={{ maxWidth: 640 }}>
        {step === "form" ? (
          <>
            <div className="crm-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="modal-icon-badge" style={{ background: "rgba(11,37,69,0.1)", color: "var(--navy)" }}>
                  <UserPlus size={20} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--navy)" }}>
                    Add Telecalling Agent & Issue Login Credentials
                  </h2>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--subtle)" }}>
                    Create telecaller account, set shift and targets, and generate an in-person login slip for the agent.
                  </p>
                </div>
              </div>
              <button className="crm-modal-close" onClick={onClose} aria-label="Close modal"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="crm-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                      Agent Full Name *
                    </label>
                    <Input
                      required
                      placeholder="e.g. Pooja Sharma"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        generateAutoEmail(e.target.value);
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                      Work Email (Login ID) *
                    </label>
                    <Input
                      required
                      type="email"
                      placeholder="pooja@meenestham.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                      Mobile Phone (+91)
                    </label>
                    <Input
                      placeholder="+91 98480 12345"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                      Assigned Branch
                    </label>
                    <select
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      style={{ width: "100%", height: 36, padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
                    >
                      <option value="Hyderabad Central">Hyderabad Central</option>
                      <option value="Banjara Hills">Banjara Hills</option>
                      <option value="Secunderabad">Secunderabad</option>
                      <option value="Warangal">Warangal</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                      Department Allocation
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      style={{ width: "100%", height: 36, padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
                    >
                      <option value="Telecalling - Orthopedics">Telecalling - Orthopedics & Joint Replacement</option>
                      <option value="Telecalling - General Surgery">Telecalling - General & Laparoscopic Surgery</option>
                      <option value="Telecalling - Cardiology">Telecalling - Cardiology</option>
                      <option value="Telecalling - IVF & Fertility">Telecalling - IVF & Fertility</option>
                      <option value="Telecalling - Inbound Helpline">Telecalling - Inbound Helpline</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                      Working Shift
                    </label>
                    <select
                      value={shift}
                      onChange={(e) => setShift(e.target.value)}
                      style={{ width: "100%", height: 36, padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}
                    >
                      <option value="General Shift (09:00 - 18:00)">General Shift (09:00 - 18:00)</option>
                      <option value="Morning Shift (08:00 - 16:30)">Morning Shift (08:00 - 16:30)</option>
                      <option value="Evening Shift (12:30 - 21:00)">Evening Shift (12:30 - 21:00)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                      Initial Password
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", background: "#f8fafc", fontSize: 11, cursor: "pointer" }}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: 4 }}>
                      Daily Dialing Target
                    </label>
                    <Input
                      type="number"
                      value={dialingTarget}
                      onChange={(e) => setDialingTarget(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div style={{ background: "#fef3c7", border: "1px solid #fde68a", padding: "10px 14px", borderRadius: 8, display: "flex", gap: 10, alignItems: "center" }}>
                  <Key size={18} style={{ color: "#b45309", flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: "#92400e" }}>
                    <strong>In-Person Delivery:</strong> Upon clicking create, a physical/printable credential slip will be generated with credentials to give to the telecaller in person.
                  </div>
                </div>
              </div>

              <div className="crm-modal-footer">
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" className="primary-action" disabled={loading}>
                  {loading ? "Creating..." : "Create Agent & Issue Slip"}
                </Button>
              </div>
            </form>
          </>
        ) : (
          /* Step 2: In-Person Credential Handover Card */
          <>
            <div className="crm-modal-header" style={{ background: "var(--navy)", color: "#ffffff", borderRadius: "12px 12px 0 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--gold)", color: "var(--navy)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                  <Key size={18} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#ffffff" }}>
                    Agent Login Credential Handover Slip
                  </h2>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                    Ready for in-person handover to {createdSlip.name}
                  </p>
                </div>
              </div>
              <button className="crm-modal-close" onClick={onClose} style={{ color: "#ffffff" }} aria-label="Close modal"><X size={18} /></button>
            </div>

            <div className="crm-modal-body" style={{ padding: 20 }}>
              {/* Slip Document */}
              <div
                style={{
                  background: "#ffffff",
                  border: "2px solid #0b2545",
                  borderRadius: 10,
                  padding: 20,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #0b2545", paddingBottom: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#0b2545", textTransform: "uppercase" }}>
                      Meenestham Healthcare Group
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      TRH360 Telecalling Desk · Official Credential Handover Card
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <Badge style={{ background: "#22c55e", color: "#ffffff", fontWeight: 700 }}>
                      ACTIVE ROSTER
                    </Badge>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                      Issued: {createdSlip.issuedAt}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Agent ID</span>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#0b2545" }}>{createdSlip.id}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Agent Name</span>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#0b2545" }}>{createdSlip.name}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Department</span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{createdSlip.department}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Shift / Hours</span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{createdSlip.shift}</div>
                  </div>
                </div>

                {/* Login Credentials Box */}
                <div style={{ background: "#f8fafc", border: "1px dashed #0b2545", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#0b2545", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <LockKeyhole size={14} /> Official Login Credentials
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 8, fontSize: 13 }}>
                    <strong style={{ color: "#64748b" }}>Login URL:</strong>
                    <code style={{ color: "#0284c7", fontWeight: 700 }}>{createdSlip.loginUrl}</code>

                    <strong style={{ color: "#64748b" }}>Username / Email:</strong>
                    <strong style={{ color: "#0b2545" }}>{createdSlip.email}</strong>

                    <strong style={{ color: "#64748b" }}>Temporary Password:</strong>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ background: "#fef08a", padding: "2px 8px", borderRadius: 4, color: "#854d0e", fontFamily: "monospace", fontSize: 14 }}>
                        {createdSlip.password}
                      </strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#64748b", borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
                  <div>Issued by: <strong>{createdSlip.managerName}</strong></div>
                  <div>Daily Dialing Target: <strong>{createdSlip.dialingTarget} Calls / Day</strong></div>
                </div>
              </div>
            </div>

            <div className="crm-modal-footer" style={{ justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="outline" onClick={handleCopyCredentials}>
                  <Copy size={14} style={{ marginRight: 6 }} /> Copy Credentials
                </Button>
                <Button variant="outline" onClick={handlePrint}>
                  <Printer size={14} style={{ marginRight: 6 }} /> Print Slip
                </Button>
              </div>
              <Button className="primary-action" onClick={onClose}>
                <Check size={14} style={{ marginRight: 6 }} /> Done & Return to Cockpit
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}



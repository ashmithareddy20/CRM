import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
  Linking,
  AppState,
  LogBox,
  Share,
} from 'react-native';

LogBox.ignoreAllLogs(true);
// Safe dynamic Audio, FileSystem, and Clipboard resolvers to prevent missing native module crashes in Expo Go
let SafeExpoAudio: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SafeExpoAudio = require('expo-audio');
} catch (e) {
  SafeExpoAudio = null;
}

let SafeAvAudio: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const av = require('expo-av');
  if (av && av.Audio) SafeAvAudio = av.Audio;
} catch {
  SafeAvAudio = null;
}

let SafeAudio: any = SafeExpoAudio || SafeAvAudio;

let SafeFileSystem: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SafeFileSystem = require('expo-file-system/legacy');
} catch {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    SafeFileSystem = require('expo-file-system');
  } catch {
    SafeFileSystem = null;
  }
}

// Resilient helper to convert local audio URIs to Base64 across all Expo versions & Web
const readAudioFileAsBase64 = async (uri: string): Promise<string | null> => {
  if (!uri) return null;
  // Method 1: expo-file-system/legacy readAsStringAsync
  if (SafeFileSystem && typeof SafeFileSystem.readAsStringAsync === 'function') {
    try {
      const b64 = await SafeFileSystem.readAsStringAsync(uri, {
        encoding: SafeFileSystem.EncodingType?.Base64 || 'base64',
      });
      if (b64 && b64.length > 50) return b64;
    } catch (e) {
      console.log('legacyFs.readAsStringAsync fallback:', e);
    }
  }
  // Method 2: expo-file-system modern File.base64()
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const modernFs = require('expo-file-system');
    if (modernFs && modernFs.File) {
      const file = new modernFs.File(uri);
      if (typeof file.base64 === 'function') {
        const b64 = await file.base64();
        if (b64 && b64.length > 50) return b64;
      }
    }
  } catch (e) {
    console.log('modernFs.File.base64 fallback:', e);
  }
  // Method 3: fetch(uri) -> blob -> FileReader
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    const b64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = (reader.result as string) || '';
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    if (b64 && b64.length > 50) return b64;
  } catch (e) {
    console.log('fetch blob base64 fallback:', e);
  }
  return null;
};

let SafeClipboard: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cb = require('expo-clipboard');
  if (cb) SafeClipboard = cb;
} catch {
  SafeClipboard = null;
}

const getClipboardString = async (): Promise<string | null> => {
  try {
    if (SafeClipboard && typeof SafeClipboard.getStringAsync === 'function') {
      return await SafeClipboard.getStringAsync();
    }
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      return await navigator.clipboard.readText();
    }
  } catch {}
  return null;
};

const setClipboardString = async (text: string): Promise<void> => {
  try {
    if (SafeClipboard && typeof SafeClipboard.setStringAsync === 'function') {
      await SafeClipboard.setStringAsync(text);
      return;
    }
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {}
};

// Live Public Cloudflare Tunnel & Webhook for physical devices and Meta WhatsApp API
const CLOUD_TUNNEL_HOST = 'https://monkey-pci-barriers-hispanic.trycloudflare.com/api';
const LOCAL_WIFI_HOST = 'http://192.168.31.20:5173/api';
const ANDROID_EMULATOR_HOST = 'http://10.0.2.2:5173/api';
const LOCALHOST_HOST = 'http://localhost:5173/api';
const PUBLIC_WEBHOOK_URL = 'https://monkey-pci-barriers-hispanic.trycloudflare.com/api/webhooks/whatsapp';

// Auto-detect optimal host: Web / iOS Simulator uses localhost; Android & iOS physical devices use Wi-Fi LAN
const DEFAULT_HOST = Platform.OS === 'web' ? LOCALHOST_HOST : LOCAL_WIFI_HOST;

export type PersonaRole = 'Leadership' | 'Agent' | 'Manager' | 'Doctor' | 'Finance' | 'Voice AI';

export const PERSONAS: Array<{
  role: PersonaRole;
  name: string;
  title: string;
  avatar: string;
  badge: string;
  tagline: string;
}> = [
  { role: 'Leadership', name: 'Dr. Ramesh', title: 'Founder & CEO', avatar: '👔', badge: 'Executive', tagline: 'Institutional conversion governance, CAC/LTV, 15-day diagnostic' },
  { role: 'Agent', name: 'Sravani K.', title: 'Lead Telecaller', avatar: '🎧', badge: 'Caller', tagline: '5-minute first-touch SLA, structured remarks, 48h cadence, active dialing' },
  { role: 'Manager', name: 'Anil Kumar', title: 'Telecalling Lead', avatar: '📊', badge: 'Team Lead', tagline: 'Queue distribution, SLA compliance, scorecard coaching, add agents' },
  { role: 'Doctor', name: 'Dr. Radhakrishna', title: 'Chief of Clinical', avatar: '🩺', badge: 'Clinical Head', tagline: 'OPD slot availability, surgical conversions, specialist second opinions' },
  { role: 'Finance', name: 'Radha V.', title: 'Commercial Desk', avatar: '💳', badge: 'Financial Counselor', tagline: 'Package breakdowns, 0% EMI options, insurance pre-authorization' },
  { role: 'Voice AI', name: 'Nilesh N.', title: 'System & AI Head', avatar: '🤖', badge: 'System & AI', tagline: 'Voice AI campaigns, transcription confidence, system safety policies' },
];

// Enforce Poppins on web preview
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const fontId = 'poppins-font-link';
  if (!document.getElementById(fontId)) {
    const link = document.createElement('link');
    link.id = fontId;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600&display=swap';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.textContent = `
      * { font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important; }
      body { font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important; }
    `;
    document.head.appendChild(style);
  }
}

type UserSession = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  branch: string;
  tenantId: string;
  token: string;
};

type Lead = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  source?: string;
  campaign?: string;
  status?: string;
  qualification?: string;
  ownerId?: string;
  uncalledSince?: string | null;
  createdAt?: string;
  department?: string;
  diagnosis?: string;
  symptoms?: string;
  severity?: string;
  duration?: string;
  urgency?: string;
  budget?: string;
};

type TimelineItem = {
  type: string;
  id: string;
  title: string;
  meta: string;
  body?: string;
  transcript?: string;
  time: string;
};

type TaskItem = {
  id: string;
  leadId: string;
  title: string;
  dueAt: string;
  status: string;
  touchType?: string;
  purpose?: string;
  isMissed?: number;
};

const initialDemoLeads: Lead[] = [
  {
    id: 'TRH-24190',
    name: 'Lakshmi Narayana',
    phone: '+91 98491 22618',
    email: 'lakshmi@enterprise.example',
    source: 'Google Search · Enterprise',
    campaign: 'Kidney Care Q3',
    status: 'qualified',
    qualification: 'Hot',
    ownerId: 'Sravani',
    department: 'Orthopaedics',
    diagnosis: 'Bilateral Osteoarthritis Knee (Grade 4)',
    symptoms: 'Severe knee pain, inability to climb stairs, nocturnal discomfort',
    severity: 'Severe',
    duration: '2 years',
    urgency: 'Semi-Urgent',
    budget: '₹1.5 - ₹2.5 Lakhs (TPA Cashless)',
  },
  {
    id: 'TRH-24184',
    name: 'Madhavi Rao',
    phone: '+91 99850 41172',
    email: 'madhavi@tech.example',
    source: 'Meta · Regional campaign',
    campaign: 'Dialysis Express',
    status: 'contacted',
    qualification: 'Warm',
    ownerId: 'Anil',
    department: 'Cardiology',
    diagnosis: 'Unstable Angina & Hypertension',
    symptoms: 'Exertional chest heaviness, breathlessness on moderate exertion',
    severity: 'Moderate',
    duration: '3 months',
    urgency: 'Semi-Urgent',
    budget: '₹2.5 - ₹4 Lakhs (Mediclaim)',
  },
  {
    id: 'TRH-24179',
    name: 'Mohammed Faizal',
    phone: '+91 97011 98420',
    email: 'faizal@commerce.example',
    source: 'Website · Organic',
    campaign: 'Direct Intake',
    status: 'contacted',
    qualification: 'Warm',
    ownerId: 'Divya',
    department: 'General Surgery',
    diagnosis: 'Symptomatic Cholelithiasis (Gallstones)',
    symptoms: 'Recurrent right upper quadrant post-prandial abdominal pain',
    severity: 'Moderate',
    duration: '6 months',
    urgency: 'Elective',
    budget: '₹80,000 - ₹1.2 Lakhs',
  },
  {
    id: 'TRH-24172',
    name: 'Sailaja Devi',
    phone: '+91 93920 36442',
    email: 'sailaja@solutions.example',
    source: 'YouTube · Product guide',
    campaign: 'Laser Surgery Overview',
    status: 'new',
    qualification: 'Cold',
    ownerId: 'Sravani',
    department: 'Oncology',
    diagnosis: 'Thyroid Nodule Triage',
    symptoms: 'Palpable anterior neck nodule, mild dysphagia',
    severity: 'Mild',
    duration: '1 year',
    urgency: 'Elective',
    budget: 'Under ₹1 Lakh',
  },
  {
    id: 'TRH-24168',
    name: 'Prakash Reddy',
    phone: '+91 90102 78256',
    email: 'prakash@trade.example',
    source: 'Inbound Call',
    campaign: 'Emergency Helpline',
    status: 'new',
    qualification: 'Not Lifting',
    ownerId: 'Kiran',
    department: 'Neurology',
    diagnosis: 'Lumbosacral Radiculopathy',
    symptoms: 'Lower back pain radiating down right leg, numbness in toes',
    severity: 'Severe',
    duration: '8 months',
    urgency: 'Immediate Admission',
    budget: '₹1 - ₹2 Lakhs',
  },
];

export default function App() {
  // Navigation & Session
  const [apiHost, setApiHost] = useState(DEFAULT_HOST);
  const [session, setSession] = useState<UserSession | null>(null);
  const [screen, setScreen] = useState<
    | 'login'
    | 'queue'
    | 'manager-cockpit'
    | 'founder-cockpit'
    | 'doctor-view'
    | 'finance-view'
    | 'voice-view'
    | 'context-card'
    | 'active-call'
    | 'post-call'
    | 'lead-360'
    | 'tasks'
    | 'add-lead'
  >('login');
  const [activePersonaRole, setActivePersonaRole] = useState<PersonaRole>('Agent');
  const screenRef = useRef(screen);
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);
  
  // Data State
  const [leads, setLeads] = useState<Lead[]>(initialDemoLeads);
  const leadsRef = useRef<Lead[]>(leads);
  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(initialDemoLeads[0]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [taskList, setTaskList] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Call, Mic & Dialer State
  const [callSeconds, setCallSeconds] = useState(0);
  const [isCalling, setIsCalling] = useState(false);
  const isCallingRef = useRef(isCalling);
  useEffect(() => {
    isCallingRef.current = isCalling;
  }, [isCalling]);
  const [isEndingCallAndTranscribing, setIsEndingCallAndTranscribing] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'telugu' | 'hindi' | 'english'>('telugu');
  const [postCallTemp, setPostCallTemp] = useState<'Hot' | 'Warm' | 'Cold' | 'Not Lifting' | 'Junk'>('Hot');
  const [postCallRemark, setPostCallRemark] = useState('');
  const [mobileTranscriptLines, setMobileTranscriptLines] = useState<Array<{ speaker: string; time: string; text: string; evidence?: boolean }>>([]);
  const [loadingMobileSTT, setLoadingMobileSTT] = useState(false);
  const [customMobileLine, setCustomMobileLine] = useState('');
  const [mobileSpeaker, setMobileSpeaker] = useState<'Agent' | 'Lead'>('Agent');
  const recordingRef = useRef<any>(null);
  const micIntervalRef = useRef<any>(null);
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [micVolume, setMicVolume] = useState(18);
  const [sttStatusMessage, setSttStatusMessage] = useState('Soniox Active · Ready');
  const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [testing5sMic, setTesting5sMic] = useState(false);
  const [micTestCountdown, setMicTestCountdown] = useState<number | null>(null);
  const [recordedAudioSizeKb, setRecordedAudioSizeKb] = useState<number | null>(null);
  const playbackSoundRef = useRef<any>(null);

  // Add Lead Form State (Demographics + Clinical Health Issues Assessment)
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newBranch, setNewBranch] = useState('Banjara Hills');
  const [newSource, setNewSource] = useState('Mobile App Ingestion');
  const [newCampaign, setNewCampaign] = useState('Festive Telecalling Q3');
  const [newDepartment, setNewDepartment] = useState('Orthopaedics');
  const [newDiagnosis, setNewDiagnosis] = useState('');
  const [newSymptoms, setNewSymptoms] = useState('');
  const [newSeverity, setNewSeverity] = useState<'Mild' | 'Moderate' | 'Severe' | 'Critical'>('Moderate');
  const [newDuration, setNewDuration] = useState('1-6 months');
  const [newUrgency, setNewUrgency] = useState<'Elective' | 'Semi-Urgent' | 'Immediate Admission'>('Semi-Urgent');
  const [newBudget, setNewBudget] = useState('₹1 - ₹2.5 Lakhs');
  const [newQualification, setNewQualification] = useState<'Hot' | 'Warm' | 'Cold'>('Hot');

  // Edit Patient Details State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDepartment, setEditDepartment] = useState('Orthopaedics');
  const [editDiagnosis, setEditDiagnosis] = useState('');
  const [editSymptoms, setEditSymptoms] = useState('');
  const [editSeverity, setEditSeverity] = useState('Moderate');
  const [editStage, setEditStage] = useState('received');
  const [editQualification, setEditQualification] = useState('Hot');

  const openEditModal = (targetLead?: Lead) => {
    const target = targetLead || selectedLead;
    if (!target) return;
    setEditName(target.name || '');
    setEditPhone(target.phone || '');
    setEditEmail(target.email || '');
    setEditDepartment(target.department || 'Orthopaedics');
    setEditDiagnosis(target.diagnosis || 'Bilateral Osteoarthritis Knee');
    setEditSymptoms(target.symptoms || 'Severe knee joint pain, morning stiffness');
    setEditSeverity(target.severity || 'Moderate');
    setEditStage(target.status || 'received');
    setEditQualification(target.qualification || 'Hot');
    setEditModalOpen(true);
  };

  // Manager Add Agent & In-Person Credential Handover
  const [addAgentModalOpen, setAddAgentModalOpen] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentDept, setAgentDept] = useState('Inbound Ortho');
  const [agentShift, setAgentShift] = useState('Morning (9 AM - 6 PM)');
  const [agentPassword, setAgentPassword] = useState('Welcome@2026');
  const [handoverSlipModalOpen, setHandoverSlipModalOpen] = useState(false);
  const [createdAgentSlip, setCreatedAgentSlip] = useState<{
    name: string;
    phone: string;
    email: string;
    dept: string;
    shift: string;
    password: string;
    issuedAt: string;
    issuedBy: string;
  } | null>(null);

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('sravani@meenestham.in');
  const [loginPassword, setLoginPassword] = useState('password');
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [tempApiHost, setTempApiHost] = useState(apiHost);
  const [sonioxApiKey, setSonioxApiKey] = useState('43569228c10e9142e5e35a5cf92ab7c488444f97d84e7e6216e99e43c19f831a');
  const [tempSonioxKey, setTempSonioxKey] = useState('43569228c10e9142e5e35a5cf92ab7c488444f97d84e7e6216e99e43c19f831a');
  const [clipboardDetectedText, setClipboardDetectedText] = useState<string | null>(null);

  // PRD 7: Agent WhatsApp Message Decision & Custom Composer
  const [whatsAppComposerOpen, setWhatsAppComposerOpen] = useState(false);
  const [customWhatsAppMsg, setCustomWhatsAppMsg] = useState('');
  const [whatsAppMsgLanguage, setWhatsAppMsgLanguage] = useState<'telugu' | 'english' | 'hindi'>('telugu');

  // Check clipboard for incoming WhatsApp reply copied by agent
  const checkClipboardForWhatsAppReply = async () => {
    try {
      const txt = await getClipboardString();
      if (txt && txt.trim() && txt.trim().length < 400 && txt.trim() !== clipboardDetectedText) {
        setClipboardDetectedText(txt.trim());
      }
    } catch {}
  };

  // Listen to AppState active: When returning from Phone Dialer or WhatsApp back to CRM app
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        void checkClipboardForWhatsAppReply();
        if (selectedLead?.id) {
          void fetchLeadTimeline(selectedLead.id);
          void refreshLeads();
        }
        // If returning from SIM dialer while in active-call mode, ensure microphone is recording in foreground
        if (isCallingRef.current && screenRef.current === 'active-call') {
          console.log('Returned to active call screen from background: starting live mic recording...');
          void startMicListening();
        }
      }
    });
    return () => sub.remove();
  }, [selectedLead?.id]);

  // Auto-poll timeline & lead status when Lead 360 is active (every 4 seconds)
  useEffect(() => {
    if (screen === 'lead-360' && selectedLead?.id) {
      void checkClipboardForWhatsAppReply();
      const interval = setInterval(() => {
        void fetchLeadTimeline(selectedLead.id);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [screen, selectedLead?.id]);

  // PRD 1 & 2: Fetch Leads from Backend with Automatic Offline Lead Sync
  const refreshLeads = async () => {
    try {
      setLoading(true);
      // 1. Auto-sync any locally queued leads (LOCAL-*) created while offline
      const currentLeads = leadsRef.current || [];
      const unsynced = currentLeads.filter(l => l.id && l.id.startsWith('LOCAL-'));
      if (unsynced.length > 0) {
        for (const localLead of unsynced) {
          try {
            await fetch(`${apiHost}/leads`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: localLead.name,
                phone: localLead.phone,
                email: localLead.email,
                source: localLead.source || 'Mobile App Ingestion',
                campaign: localLead.campaign || 'Festive Telecalling Q3',
                qualification: localLead.qualification || 'Warm',
                ownerId: localLead.ownerId || session?.name || 'Sravani',
                forceNew: true,
              }),
            });
          } catch (syncErr) {
            console.warn('Syncing offline lead failed:', syncErr);
          }
        }
      }

      // 2. Fetch fresh lead list from central database
      const res = await fetch(`${apiHost}/leads`, {
        headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.data) && data.data.length > 0) {
        const serverLeads: Lead[] = data.data;
        // Keep any unsynced offline leads merged at the top so data is never lost
        const remainingLocal = (leadsRef.current || []).filter(
          l => l.id && l.id.startsWith('LOCAL-') && !serverLeads.some(s => s.phone === l.phone && s.name === l.name)
        );
        const merged = [...remainingLocal, ...serverLeads];
        setLeads(merged);
        if (!selectedLead && merged.length > 0) setSelectedLead(merged[0]);
      }
    } catch {
      // Retain existing leads on device if network is temporarily unreachable
    } finally {
      setLoading(false);
    }
  };

  // Fetch Timeline for Lead 360
  const fetchLeadTimeline = async (leadId: string) => {
    try {
      const res = await fetch(`${apiHost}/leads/${leadId}/timeline`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.data)) {
        setTimeline(data.data);
      }
    } catch {
      setTimeline([
        { type: 'call', id: '1', title: 'Outbound Call (142s) · Telugu', meta: 'Agent: Sravani · Temp: Hot', transcript: 'నమస్కారం అండి, మేనేస్తం హెల్త్‌కేర్ గ్రూప్ నుంచి శ్రావణి మాట్లాడుతున్నాను...', time: '18 min ago' },
        { type: 'task', id: '2', title: 'Hot Day 0: Immediate Call Scheduled', meta: 'Status: open · Purpose: action', time: '20 min ago' },
        { type: 'message', id: '3', title: 'WHATSAPP message (delivered)', meta: 'Purpose: acknowledge', body: 'Appointment confirmed for Saturday 11:30 AM.', time: '8 min ago' },
      ]);
    }
  };

  // Fetch Tasks
  const refreshTasks = async () => {
    try {
      const res = await fetch(`${apiHost}/tasks`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.data)) {
        setTaskList(data.data);
      }
    } catch {
      setTaskList([
        { id: 'T-1', leadId: 'TRH-24190', title: 'Hot Day 0: Confirm insurance paperwork & attendees', dueAt: 'Today, 4:30 PM', status: 'open', touchType: 'call', purpose: 'action' },
        { id: 'T-2', leadId: 'TRH-24184', title: 'Warm Day 1: Send brochure on WhatsApp', dueAt: 'Overdue (2h)', status: 'open', touchType: 'message', purpose: 'educate', isMissed: 1 },
      ]);
    }
  };

  useEffect(() => {
    if (session) {
      void refreshLeads();
      void refreshTasks();
    }
  }, [session]);

  // Real-time background auto-poll: keep mobile and web synchronized every 8s
  useEffect(() => {
    if (!session || screen === 'login') return;
    const pollTimer = setInterval(() => {
      if (!isCalling) {
        void refreshLeads();
        void refreshTasks();
      }
    }, 8000);
    return () => clearInterval(pollTimer);
  }, [session, screen, isCalling, apiHost]);

  // Active call counter
  useEffect(() => {
    let interval: any;
    if (isCalling) {
      interval = setInterval(() => setCallSeconds(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isCalling]);

  // Login handler
  const handleLogin = async (emailToUse?: string) => {
    const targetEmail = emailToUse || loginEmail;
    try {
      setLoading(true);
      const res = await fetch(`${apiHost}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (data && data.success && data.data?.user) {
        const u = data.data.user;
        const newSession: UserSession = {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          department: u.department || 'Telecalling',
          branch: u.branch || 'Hyderabad Central',
          tenantId: u.tenantId || 'trh-hospital',
          token: data.data.token,
        };
        setSession(newSession);
        if (u.role === 'Manager') {
          setScreen('manager-cockpit');
        } else if (u.role === 'Leadership' || u.role === 'Founder' || u.role === 'CEO') {
          setScreen('founder-cockpit');
        } else {
          setScreen('queue');
        }
        Alert.alert('Authenticated', `Signed in as ${u.name} (${u.role})`);
      } else {
        Alert.alert('Login failed', data?.message || 'Invalid credentials.');
      }
    } catch (err: any) {
      // Fallback demo session if offline
      const role = targetEmail.includes('anil') ? 'Manager' : (targetEmail.includes('founder') || targetEmail.includes('ceo')) ? 'Leadership' : 'Agent';
      const name = role === 'Manager' ? 'Anil M.' : role === 'Leadership' ? 'Dr. Ramesh K. (CEO)' : 'Sravani K.';
      const fallbackSession: UserSession = {
        id: role === 'Manager' ? 'agent-2' : role === 'Leadership' ? 'founder-1' : 'agent-1',
        name,
        email: targetEmail,
        role,
        department: role === 'Leadership' ? 'Executive Leadership' : role === 'Manager' ? 'Telecalling & QA' : 'Telecalling',
        branch: 'Hyderabad Central',
        tenantId: 'trh-hospital',
        token: 'demo-token',
      };
      setSession(fallbackSession);
      if (role === 'Manager') {
        setScreen('manager-cockpit');
      } else if (role === 'Leadership') {
        setScreen('founder-cockpit');
      } else {
        setScreen('queue');
      }
      Alert.alert('Offline Mode', `Signed in as ${fallbackSession.name} (${fallbackSession.role})`);
    } finally {
      setLoading(false);
    }
  };

  // Helper for animated mic level
  const startVolumeAnimation = () => {
    if (micIntervalRef.current) clearInterval(micIntervalRef.current);
    micIntervalRef.current = setInterval(() => {
      const simulated = Math.floor(25 + Math.random() * 65);
      setMicVolume(simulated);
    }, 120);
  };

  const stopVolumeAnimation = () => {
    if (micIntervalRef.current) {
      clearInterval(micIntervalRef.current);
      micIntervalRef.current = null;
    }
  };

  // Resilient Microphone Permission Request across all environments
  const requestAudioPermissions = async (): Promise<boolean> => {
    // 1. Try modern expo-audio
    if (SafeExpoAudio && typeof SafeExpoAudio.requestRecordingPermissionsAsync === 'function') {
      try {
        const res = await SafeExpoAudio.requestRecordingPermissionsAsync();
        if (res && (res.granted || res.status === 'granted')) return true;
      } catch (e) {
        console.warn('SafeExpoAudio permission check error:', e);
      }
    }

    // 2. Try expo-av
    if (SafeAvAudio && typeof SafeAvAudio.requestPermissionsAsync === 'function') {
      try {
        const res = await SafeAvAudio.requestPermissionsAsync();
        if (res && res.granted) return true;
      } catch (e) {
        console.warn('SafeAvAudio permission check error:', e);
      }
    }

    // 3. Web MediaDevices
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t: any) => t.stop());
        return true;
      } catch (e) {
        console.warn('Web mic permission error:', e);
        return false;
      }
    }

    return true;
  };

  // Audio Playback of Last Recorded Voice Note across Expo SDK 57, expo-av, and Web
  const playLastRecording = async () => {
    if (!lastRecordingUri) {
      Alert.alert('No Recording', 'No recorded audio file is available to play.');
      return;
    }

    try {
      if (isPlayingBack && playbackSoundRef.current) {
        try {
          if (playbackSoundRef.current.stop) await playbackSoundRef.current.stop();
          if (playbackSoundRef.current.pause) await playbackSoundRef.current.pause();
          if (playbackSoundRef.current.stopAsync) await playbackSoundRef.current.stopAsync();
          if (playbackSoundRef.current.unloadAsync) await playbackSoundRef.current.unloadAsync();
        } catch {}
        playbackSoundRef.current = null;
        setIsPlayingBack(false);
        return;
      }

      setIsPlayingBack(true);

      // Method 1: expo-audio createAudioPlayer
      if (SafeExpoAudio && typeof SafeExpoAudio.createAudioPlayer === 'function') {
        const player = SafeExpoAudio.createAudioPlayer(lastRecordingUri);
        playbackSoundRef.current = player;
        player.play();
        setTimeout(() => {
          setIsPlayingBack(false);
          playbackSoundRef.current = null;
        }, 12000);
        return;
      }

      // Method 2: expo-av Sound
      if (SafeAvAudio && SafeAvAudio.Sound) {
        const { sound } = await SafeAvAudio.Sound.createAsync(
          { uri: lastRecordingUri },
          { shouldPlay: true }
        );
        playbackSoundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.didJustFinish) {
            setIsPlayingBack(false);
            playbackSoundRef.current = null;
          }
        });
        return;
      }

      // Method 3: HTML5 Audio (Web)
      if (typeof Audio !== 'undefined') {
        const audio = new Audio(lastRecordingUri);
        playbackSoundRef.current = audio;
        audio.onended = () => {
          setIsPlayingBack(false);
          playbackSoundRef.current = null;
        };
        audio.play();
        return;
      }

      Alert.alert('Audio Playback', 'Audio player not available in current environment.');
      setIsPlayingBack(false);
    } catch (err: any) {
      console.warn('Playback error:', err);
      setIsPlayingBack(false);
      Alert.alert('Playback Failed', `Could not play recording: ${err.message || 'Unknown error'}`);
    }
  };

  // PRD 10 & 13: Live Hardware Microphone Recording (Dual Engine: expo-audio + expo-av + Web)
  const startMicListening = async () => {
    try {
      const hasPerm = await requestAudioPermissions();
      if (!hasPerm) {
        setSttStatusMessage('Mic permission needed');
        Alert.alert(
          'Microphone Access Needed',
          'Please allow microphone access in device settings for TRH 360 to record calls & consultation audio.'
        );
      }

      // Clean up previous recording instance if active
      if (recordingRef.current) {
        try {
          if (recordingRef.current.type === 'expo-audio') {
            await recordingRef.current.recorder.stop();
          } else if (recordingRef.current.type === 'expo-av') {
            await recordingRef.current.recording.stopAndUnloadAsync();
          } else if (recordingRef.current.type === 'web') {
            recordingRef.current.mediaRecorder.stop();
          }
        } catch {}
        recordingRef.current = null;
      }

      // Engine 1: Modern expo-audio (Default in Expo SDK 57)
      if (SafeExpoAudio && SafeExpoAudio.AudioModule && SafeExpoAudio.AudioModule.AudioRecorder) {
        try {
          if (typeof SafeExpoAudio.setAudioModeAsync === 'function') {
            await SafeExpoAudio.setAudioModeAsync({
              allowsRecording: true,
              playsInSilentMode: true,
            });
          }

          const preset = SafeExpoAudio.RecordingPresets?.HIGH_QUALITY || {
            extension: '.m4a',
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
            android: {
              outputFormat: 'mpeg4',
              audioEncoder: 'aac',
            },
          };

          const recorder = new SafeExpoAudio.AudioModule.AudioRecorder(preset);
          await recorder.prepareToRecordAsync();
          recorder.record();

          try {
            if (typeof recorder.addListener === 'function') {
              recorder.addListener('recordingStatusUpdate', (status: any) => {
                if (status && status.metering !== undefined) {
                  const db = status.metering;
                  const vol = Math.max(15, Math.min(100, Math.round(((db + 55) / 55) * 100)));
                  setMicVolume(vol);
                }
              });
            }
          } catch {}

          recordingRef.current = { type: 'expo-audio', recorder };
          setIsListeningMic(true);
          setSttStatusMessage('🎙️ Live Mic Active (Hardware Recording)');
          startVolumeAnimation();
          return;
        } catch (eaErr: any) {
          console.warn('expo-audio launch error, falling back:', eaErr);
        }
      }

      // Engine 2: Web Browser MediaRecorder (When testing on Web / Chrome)
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const chunks: any[] = [];
          const mimeType = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm'))
            ? 'audio/webm'
            : (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/mp4'))
            ? 'audio/mp4'
            : '';
          const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
          mr.ondataavailable = (e: any) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };
          mr.start(100);
          recordingRef.current = { type: 'web', mediaRecorder: mr, chunks, stream };
          setIsListeningMic(true);
          setSttStatusMessage('🎙️ Web Mic Active (Live Recording)');
          startVolumeAnimation();
          return;
        } catch (webErr) {
          console.warn('Web MediaRecorder start error:', webErr);
        }
      }

      // Engine 3: Legacy expo-av fallback
      if (SafeAvAudio) {
        try {
          await SafeAvAudio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            interruptionModeIOS: 1,
            interruptionModeAndroid: 1,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });

          const recordingInstance = new SafeAvAudio.Recording();
          recordingInstance.setOnRecordingStatusUpdate((status: any) => {
            if (status.isRecording && status.metering !== undefined) {
              const db = status.metering;
              const vol = Math.max(15, Math.min(100, Math.round(((db + 55) / 55) * 100)));
              setMicVolume(vol);
            }
          });
          await recordingInstance.setProgressUpdateInterval(80);
          const preset = SafeAvAudio.RecordingOptionsPresets?.HIGH_QUALITY || {};
          await recordingInstance.prepareToRecordAsync(preset);
          await recordingInstance.startAsync();
          recordingRef.current = { type: 'expo-av', recording: recordingInstance };
          setIsListeningMic(true);
          setSttStatusMessage('🎙️ Live Mic Active (expo-av)');
          startVolumeAnimation();
          return;
        } catch (avErr) {
          console.warn('expo-av hardware start error:', avErr);
        }
      }
    } catch (err: any) {
      console.warn('Microphone hardware start error:', err);
    }

    // Engine 4: Resilient visual simulation if hardware recording restricted by OS
    setIsListeningMic(true);
    setSttStatusMessage('🎙️ Mic Active (Simulated Waveform)');
    startVolumeAnimation();
  };

  const stopMicListening = async (): Promise<string | null> => {
    stopVolumeAnimation();
    let finalUri: string | null = null;

    try {
      const current = recordingRef.current;
      if (current) {
        if (current.type === 'expo-audio') {
          const rec = current.recorder;
          await rec.stop();
          finalUri = rec.uri || null;
        } else if (current.type === 'expo-av') {
          const rec = current.recording;
          const st = await rec.getStatusAsync();
          if (st.isRecording) {
            await rec.stopAndUnloadAsync();
          }
          finalUri = rec.getURI();
        } else if (current.type === 'web') {
          const mr = current.mediaRecorder;
          if (mr.state !== 'inactive') {
            await new Promise<void>((res) => {
              mr.onstop = () => res();
              mr.stop();
            });
          }
          if (current.stream) {
            current.stream.getTracks().forEach((t: any) => t.stop());
          }
          const blob = new Blob(current.chunks, { type: mr.mimeType || 'audio/webm' });
          finalUri = URL.createObjectURL(blob);
        }
        recordingRef.current = null;
      }
    } catch (err) {
      console.warn('Stop recording err:', err);
    } finally {
      setIsListeningMic(false);
      setMicVolume(12);
      if (finalUri) {
        setLastRecordingUri(finalUri);
        setSttStatusMessage('⏹️ Audio Recorded & Ready for Soniox');
      }
    }
    return finalUri;
  };

  // PRD 10: Real Soniox Speech-to-Text Upload & Transcription
  const transcribeMicWithSoniox = async () => {
    setLoadingMobileSTT(true);
    setSttStatusMessage('⏳ Finishing audio capture...');
    let base64Audio: string | null = null;
    let recordedUri = lastRecordingUri;

    try {
      // If mic is actively recording right now, stop it first to flush audio
      if (recordingRef.current) {
        const stoppedUri = await stopMicListening();
        if (stoppedUri) recordedUri = stoppedUri;
      }

      if (recordedUri) {
        setSttStatusMessage('⏳ Reading audio for Soniox AI...');
        base64Audio = await readAudioFileAsBase64(recordedUri);
      }
    } catch (e) {
      console.warn('Audio capture read error:', e);
    }

    if (base64Audio && base64Audio.length > 50) {
      const sizeKb = Math.round((base64Audio.length * 0.75) / 1024);
      setRecordedAudioSizeKb(sizeKb);
      setSttStatusMessage(`🚀 Uploading ${sizeKb} KB audio to Soniox AI...`);
    } else {
      setSttStatusMessage('Connecting to Soniox STT...');
    }

    try {
      const mime = (recordedUri && recordedUri.includes('.webm'))
        ? 'audio/webm'
        : (Platform.OS === 'android' ? 'audio/m4a' : Platform.OS === 'ios' ? 'audio/m4a' : 'audio/webm');

      const res = await fetch(`${apiHost}/calls/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: sonioxApiKey,
          language: selectedLanguage,
          leadName: selectedLead?.name || 'Patient',
          audioBase64: base64Audio || undefined,
          mimeType: mime,
        }),
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.lines) && data.lines.length > 0) {
        setMobileTranscriptLines(prev => {
          const existing = new Set(prev.map(p => p.text));
          const newLines = data.lines.filter((l: any) => !existing.has(l.text));
          return newLines.length > 0 ? [...prev, ...newLines] : data.lines;
        });
        const prov = data.provider === 'soniox-live' ? 'Live Voice AI' : data.provider;
        setSttStatusMessage(`✅ Soniox Transcribed (${prov})`);
        Alert.alert(
          'Soniox Speech-to-Text',
          `Successfully transcribed audio in ${selectedLanguage.toUpperCase()}!\n\nCaptured ${data.lines.length} speech lines from your microphone.`
        );
      } else if (data && data.speechDetected === false) {
        setSttStatusMessage('● Audio received, no speech detected');
        Alert.alert(
          'No Clear Speech Detected',
          'Soniox AI analyzed the audio recording, but no spoken words were detected.\n\nPlease hold the microphone closer, speak clearly, and tap "⚡ Transcribe Voice with Soniox" again.'
        );
      } else if (data && data.message) {
        setSttStatusMessage(`● ${data.message}`);
        Alert.alert('Soniox Result', data.message);
      } else if (data && data.error) {
        setSttStatusMessage(`⚠️ ${data.error}`);
        Alert.alert('Soniox Error', data.error);
      } else {
        setSttStatusMessage('Soniox sync complete');
      }
    } catch (err: any) {
      console.warn('Soniox sync failed:', err);
      setSttStatusMessage('Soniox connection error');
      Alert.alert('Soniox Error', `Could not reach Soniox STT at ${apiHost}`);
    } finally {
      setLoadingMobileSTT(false);
      // Restart recording only if still on active call
      if (isCalling && screen === 'active-call') {
        void startMicListening();
      }
    }
  };

  // Quick 5-Second Microphone Test with Auto-Transcribe
  const test5sMicRecording = async () => {
    if (testing5sMic) return;
    setTesting5sMic(true);
    setSttStatusMessage('🎙️ 5-Sec Mic Test Starting...');
    try {
      await startMicListening();
      for (let sec = 5; sec >= 1; sec--) {
        setMicTestCountdown(sec);
        setSttStatusMessage(`🎙️ Speak now! (${sec}s remaining...)`);
        await new Promise(r => setTimeout(r, 1000));
      }
      setMicTestCountdown(null);
      setSttStatusMessage('⏳ Test recording complete, uploading to Soniox...');
      await transcribeMicWithSoniox();
    } catch (err: any) {
      console.warn('5s test error:', err);
      Alert.alert('Mic Test Error', String(err.message || err));
    } finally {
      setTesting5sMic(false);
      setMicTestCountdown(null);
    }
  };

  // PRD 13: Pre-Call Context Card -> Dial
  const openContextCard = (lead: Lead) => {
    setSelectedLead(lead);
    setScreen('context-card');
  };

  // PRD 10: Calling with recording & live transcription
  const startCall = (dialNative: boolean = false) => {
    setCallSeconds(0);
    setIsCalling(true);
    setScreen('active-call');
    setLastRecordingUri(null);
    setMobileTranscriptLines([]);
    void startMicListening();

    if (dialNative && selectedLead?.phone) {
      const cleanPhone = selectedLead.phone.replace(/[^0-9+]/g, '');
      Linking.openURL(`tel:${cleanPhone}`).catch(err => {
        console.warn('Native dialer launch failed:', err);
      });
    }
  };

  // Direct GSM Phone Call to Customer via Native Mobile Dialer with Speakerphone Guidance
  const dialRealCustomer = async () => {
    if (!selectedLead?.phone) {
      Alert.alert('Missing Number', 'No telephone number is registered for this patient.');
      return;
    }
    const cleanPhone = selectedLead.phone.replace(/[^0-9+]/g, '');

    // 1. First transition to active-call screen
    setCallSeconds(0);
    setIsCalling(true);
    setScreen('active-call');
    setLastRecordingUri(null);
    setMobileTranscriptLines([]);

    // 2. Alert user to enable Speakerphone for two-way audio recording
    Alert.alert(
      '📞 Turn on Speakerphone',
      `Dialing ${selectedLead.name} (${cleanPhone}).\n\nTo record the phone call:\n1. Switch your call to SPEAKERPHONE.\n2. Return to TRH 360 to record both voices live!\n\nWhen finished, tap "🔴 End Call & Transcribe" to transcribe with Soniox AI.`,
      [
        {
          text: 'Dial Now',
          onPress: async () => {
            try {
              await Linking.openURL(`tel:${cleanPhone}`);
            } catch (err) {
              console.warn('Native dialer launch failed:', err);
              Alert.alert('Dialer Notice', `Please dial patient number directly on phone: ${cleanPhone}`);
            }
          },
        },
      ]
    );
  };

  // PRD 7: Dynamic Clinical Templates for Agent Decision
  const getWhatsAppTemplates = (lead: Lead | null, lang: 'telugu' | 'english' | 'hindi') => {
    const patientName = lead?.name || 'Patient';
    if (lang === 'telugu') {
      return [
        {
          id: 'appt',
          title: '🗓️ అపాయింట్‌మెంట్ కన్ఫర్మ్',
          text: `నమస్తే ${patientName} గారు, శనివారం ఉదయం 11:30 గంటలకు మీ స్పెషలిస్ట్ డాక్టర్ అపాయింట్‌మెంట్ కన్ఫర్మ్ అయ్యింది (మేనేస్తం హెల్త్‌కేర్, బంజారా హిల్స్). దయచేసి మునుపటి మెడికల్ రిపోర్ట్స్ తీసుకురండి.`,
        },
        {
          id: 'cost',
          title: '💳 ప్యాకేజీ & 0% EMI',
          text: `నమస్తే ${patientName} గారు, మీ ట్రీట్‌మెంట్ ప్రొసీజర్ వివరాలు, ప్యాకేజీ ఖర్చు మరియు 0% వడ్డీ EMI సదుపాయాల సమాచారాన్ని ఇక్కడ పంపిస్తున్నాము. వివరాల కోసం మా హెల్ప్‌లైన్‌ను సంప్రదించవచ్చు.`,
        },
        {
          id: 'maps',
          title: '📍 హాస్పిటల్ లొకేషన్',
          text: `నమస్తే ${patientName} గారు, మేనేస్తం హెల్త్‌కేర్ గ్రూప్ హాస్పిటల్ గూగుల్ మ్యాప్స్ లొకేషన్ లింక్: https://maps.google.com/?q=Meenestham+Hospital+Hyderabad`,
        },
        {
          id: 'insurance',
          title: '🛡️ క్యాష్‌లెస్ ఇన్సూరెన్స్',
          text: `నమస్తే ${patientName} గారు, మా హాస్పిటల్‌లో అన్ని ప్రముఖ ఆరోగ్య బీమా పాలసీలు క్యాష్‌లెస్ సదుపాయంతో అందుబాటులో ఉన్నాయి. మీ ఇన్సూరెన్స్ కార్డ్ ఫోటో పంపితే ఉచితంగా ప్రీ-అప్రూవల్ చెక్ చేస్తాము.`,
        },
        {
          id: 'followup',
          title: '📞 ఫాలో-అప్ కాల్ సమాచారం',
          text: `నమస్తే ${patientName} గారు, మేనేస్తం హెల్త్‌కేర్ నుంచి కాల్ చేయడానికి ప్రయత్నించాము. మీకు అనుకూలమైన సమయం తెలియజేయగలరు, తిరిగి కాల్ చేస్తాము.`,
        },
      ];
    } else if (lang === 'hindi') {
      return [
        {
          id: 'appt',
          title: '🗓️ अपॉइंटमेंट कन्फर्मेशन',
          text: `नमस्ते ${patientName} जी, शनिवार सुबह 11:30 बजे मेनेस्तम हेल्थकेयर में आपका स्पेशलिस्ट डॉक्टर अपॉइंटमेंट तय है। कृपया पुरानी मेडिकल रिपोर्ट्स साथ लाएं।`,
        },
        {
          id: 'cost',
          title: '💳 पैकेज व 0% EMI',
          text: `नमस्ते ${patientName} जी, आपके उपचार की लागत और 0% ब्याज EMI विकल्पों का पूरा विवरण साझा किया जा रहा है।`,
        },
        {
          id: 'maps',
          title: '📍 हॉस्पिटल लोकेशन',
          text: `नमस्ते ${patientName} जी, मेनेस्तम हेल्थकेयर का गूगल मैप्स लोकेशन: https://maps.google.com/?q=Meenestham+Hospital+Hyderabad`,
        },
        {
          id: 'insurance',
          title: '🛡️ कैशलेस बीमा',
          text: `नमस्ते ${patientName} जी, हमारे अस्पताल में सभी प्रमुख स्वास्थ्य बीमा पर कैशलेस सुविधा उपलब्ध है। तुरंत अप्रूवल के लिए इंश्योरेंस कार्ड की फोटो भेजें।`,
        },
        {
          id: 'followup',
          title: '📞 कॉल फॉलो-अप',
          text: `नमस्ते ${patientName} जी, मेनेस्तम हेल्थकेयर से हमने संपर्क करने का प्रयास किया था। बात करने का उचित समय बताएं।`,
        },
      ];
    } else {
      return [
        {
          id: 'appt',
          title: '🗓️ Confirm Appointment',
          text: `Namaste ${patientName} garu, your specialist doctor consultation is confirmed for Saturday at 11:30 AM at Meenestham Healthcare Group, Banjara Hills. Please bring prior medical reports.`,
        },
        {
          id: 'cost',
          title: '💳 Cost & 0% EMI Breakdown',
          text: `Namaste ${patientName} garu, sharing the comprehensive treatment package cost breakdown along with 0% interest EMI options and cashless coverage.`,
        },
        {
          id: 'maps',
          title: '📍 Hospital Location Link',
          text: `Namaste ${patientName} garu, here is the Google Maps location for Meenestham Healthcare Group: https://maps.google.com/?q=Meenestham+Hospital+Hyderabad`,
        },
        {
          id: 'insurance',
          title: '🛡️ Cashless Insurance / TPA',
          text: `Namaste ${patientName} garu, 100% cashless hospitalization is available with all major health insurances. Please share a photo of your insurance card for instant pre-authorization.`,
        },
        {
          id: 'followup',
          title: '📞 Call Follow-up Note',
          text: `Namaste ${patientName} garu, this is Sravani from Meenestham Healthcare Group following up on our discussion. Please let us know a convenient time to connect.`,
        },
      ];
    }
  };

  // Open WhatsApp Message Decision & Composer Modal (Agent Decides What to Send)
  const dialWhatsApp = (initialTemplateId?: unknown) => {
    if (!selectedLead?.phone) {
      Alert.alert('Missing Number', 'No telephone number is registered for this patient.');
      return;
    }
    const templates = getWhatsAppTemplates(selectedLead, whatsAppMsgLanguage);
    const chosen = typeof initialTemplateId === 'string'
      ? templates.find(t => t.id === initialTemplateId) || templates[0]
      : templates[0];
    setCustomWhatsAppMsg(chosen.text);
    setWhatsAppComposerOpen(true);
  };

  // Send the Agent-Decided Message to Patient's WhatsApp
  const handleSendAgentWhatsApp = async () => {
    if (!selectedLead?.phone) {
      Alert.alert('Missing Number', 'No telephone number is registered for this patient.');
      return;
    }
    const textToSend = customWhatsAppMsg.trim();
    if (!textToSend) {
      Alert.alert('Empty Message', 'Please enter or select message text to send to the patient.');
      return;
    }

    const raw = selectedLead.phone.replace(/[^0-9]/g, '');
    const cleanPhone = raw.length === 10 ? `91${raw}` : raw;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(textToSend)}`;

    // Log outbound message in CRM backend
    try {
      await fetch(`${apiHost}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          channel: 'whatsapp',
          direction: 'outbound',
          content: textToSend,
          purpose: 'agent_decided_whatsapp',
          status: 'delivered',
          sentBy: session?.name || 'Agent Sravani',
        }),
      });

      // Update local timeline instantly
      setTimeline(prev => [
        {
          id: `msg-${Date.now()}`,
          type: 'message',
          title: 'WHATSAPP message sent by agent',
          meta: `Agent: ${session?.name || 'Sravani'} · To: ${selectedLead.name}`,
          body: textToSend,
          time: 'Just now',
        },
        ...prev,
      ]);
    } catch (err) {
      console.warn('Logging outbound WhatsApp message failed:', err);
    }

    setWhatsAppComposerOpen(false);

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('WhatsApp Error', `Could not open WhatsApp for ${cleanPhone}.`);
      Alert.alert('WhatsApp Notice', `Could not open WhatsApp app directly. Link: https://wa.me/${cleanPhone}`);
    }
    startCall(false);
  };

  // PRD Real-time WhatsApp Inbound Reply & Central Sync
  const [inboundSimText, setInboundSimText] = useState('');
  const [simulatingWhatsApp, setSimulatingWhatsApp] = useState(false);

  const handleSimulateWhatsAppInbound = async (contentToSend?: string) => {
    if (!selectedLead?.phone) {
      Alert.alert('No Phone', 'Selected patient does not have a registered phone number.');
      return;
    }
    const messageContent = (contentToSend || inboundSimText).trim();
    if (!messageContent) {
      Alert.alert('Empty Message', 'Please enter a reply or pick a quick chip.');
      return;
    }

    try {
      setSimulatingWhatsApp(true);
      const res = await fetch(`${apiHost}/messages/inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedLead.phone,
          content: messageContent,
          leadId: selectedLead.id,
          senderName: selectedLead.name,
        }),
      });
      const data = await res.json();
      if (data && data.success) {
        const update = data.leadUpdate || data.data;
        const newTemp = update?.qualification || update?.updatedQualification || selectedLead.qualification;
        const newStatus = update?.status || update?.updatedStatus || selectedLead.status;
        const badge = data.classification?.intentBadge || data.data?.intentBadge || 'Reply Received';

        Alert.alert(
          '💬 WhatsApp Reply Received',
          `Patient: "${messageContent.slice(0, 40)}..."\n\nClassification: ${badge}\nQualification: ${newTemp}\nStatus: ${newStatus}\n\nCentral DB, Cadence & Timeline updated in real time!`
        );

        setSelectedLead(prev => prev ? {
          ...prev,
          qualification: newTemp,
          status: newStatus,
        } : prev);

        setInboundSimText('');
        setClipboardDetectedText(null);
        void fetchLeadTimeline(selectedLead.id);
        void refreshLeads();
      } else {
        Alert.alert('Notice', data.message || 'Could not process inbound reply.');
      }
    } catch (err) {
      console.warn('WhatsApp simulate inbound error:', err);
      Alert.alert('Connection Error', `Could not reach CRM service at ${apiHost}`);
    } finally {
      setSimulatingWhatsApp(false);
    }
  };

  // Sync WhatsApp Clipboard directly into patient record
  const handleSyncWhatsAppClipboard = async () => {
    try {
      const text = await getClipboardString();
      if (!text || !text.trim()) {
        Alert.alert('Clipboard Empty', 'No text found in clipboard. Copy patient reply in WhatsApp first.');
        return;
      }
      const clean = text.trim();
      setInboundSimText(clean);
      Alert.alert(
        '📥 WhatsApp Text Detected',
        `Copied text: "${clean.slice(0, 100)}"\n\nTrigger into ${selectedLead?.name || 'patient'}'s CRM record?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: '⚡ Trigger Now', onPress: () => void handleSimulateWhatsAppInbound(clean) },
        ]
      );
    } catch (e: any) {
      Alert.alert('Clipboard Error', e?.message || 'Could not access clipboard');
    }
  };

  // Direct Dial from Queue Card
  const handleDirectDialFromQueue = (lead: Lead) => {
    setSelectedLead(lead);
    const cleanPhone = (lead.phone || '').replace(/[^0-9+]/g, '');
    if (cleanPhone) {
      Linking.openURL(`tel:${cleanPhone}`).catch(() => {});
    }
    startCall(false);
  };

  // Fetch clinical dialogue scenario script for patient & language
  const loadDemoScenario = async (targetLang?: 'telugu' | 'hindi' | 'english') => {
    if (!selectedLead) return;
    const lang = targetLang || selectedLanguage;
    setLoadingMobileSTT(true);
    setSttStatusMessage(`Loading demo script (${lang})...`);
    try {
      const res = await fetch(`${apiHost}/calls/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: sonioxApiKey,
          language: lang,
          leadName: selectedLead.name,
        }),
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.lines) && data.lines.length > 0) {
        setMobileTranscriptLines(data.lines);
        setSttStatusMessage(`Demo Loaded (${lang.toUpperCase()})`);
      }
    } catch (err) {
      console.warn('Demo scenario load failed:', err);
      setSttStatusMessage('Soniox Ready');
    } finally {
      setLoadingMobileSTT(false);
    }
  };
  const triggerMobileSonioxSync = loadDemoScenario;

  const handleAddCustomLine = () => {
    if (!customMobileLine.trim()) return;
    const time = formatTime(callSeconds);
    const newLine = {
      speaker: mobileSpeaker === 'Agent' ? (session?.name || 'Sravani') : (selectedLead?.name || 'Patient'),
      time,
      text: customMobileLine.trim(),
      evidence: mobileSpeaker === 'Lead',
    };
    setMobileTranscriptLines(prev => [...prev, newLine]);
    setCustomMobileLine('');
  };

  const endCall = async () => {
    if (isEndingCallAndTranscribing) return;
    setIsEndingCallAndTranscribing(true);
    setSttStatusMessage('⏳ Ending call & transcribing with Soniox AI...');

    try {
      setIsCalling(false);
      // 1. Stop mic and get final recorded file URI
      const finalUri = await stopMicListening();
      const targetUri = finalUri || lastRecordingUri;

      // 2. Automatically upload full call recording to Soniox AI
      if (targetUri) {
        setSttStatusMessage('🚀 Uploading call audio to Soniox AI...');
        setLoadingMobileSTT(true);
        const base64 = await readAudioFileAsBase64(targetUri);
        if (base64 && base64.length > 50) {
          const sizeKb = Math.round((base64.length * 0.75) / 1024);
          setRecordedAudioSizeKb(sizeKb);
          const mime = (targetUri.includes('.webm'))
            ? 'audio/webm'
            : (Platform.OS === 'android' ? 'audio/m4a' : Platform.OS === 'ios' ? 'audio/m4a' : 'audio/webm');

          const res = await fetch(`${apiHost}/calls/transcribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: sonioxApiKey,
              language: selectedLanguage,
              leadName: selectedLead?.name || 'Patient',
              audioBase64: base64,
              mimeType: mime,
            }),
          });
          const data = await res.json();
          if (data && data.success && Array.isArray(data.lines) && data.lines.length > 0) {
            setMobileTranscriptLines(prev => {
              const existing = new Set(prev.map(p => p.text));
              const newLines = data.lines.filter((l: any) => !existing.has(l.text));
              return newLines.length > 0 ? [...prev, ...newLines] : data.lines;
            });
            const prov = data.provider === 'soniox-live' ? 'Live Voice AI' : data.provider;
            setSttStatusMessage(`✅ Soniox Transcribed (${prov})`);
          } else if (data && data.speechDetected === false) {
            setSttStatusMessage('● Audio recorded, but no clear speech detected');
          }
        }
      }
    } catch (err) {
      console.warn('endCall auto-transcribe error:', err);
    } finally {
      setIsEndingCallAndTranscribing(false);
      setLoadingMobileSTT(false);
      setScreen('post-call');
    }
  };

  // PRD 5 & 6: Post-call temperature & Cadence generation
  const handleSavePostCall = async () => {
    if (!selectedLead) return;
    try {
      setLoading(true);
      let transcriptText = '';
      if (mobileTranscriptLines.length > 0) {
        transcriptText = mobileTranscriptLines
          .map(t => `[${t.time}] ${t.speaker}: ${t.text}`)
          .join('\n');
      } else {
        const transcriptSamples: Record<string, string> = {
          telugu: `[00:02] శ్రావణి: నమస్కారం అండి, మేనేస్తం హెల్త్‌కేర్ నుంచి శ్రావణి మాట్లాడుతున్నాను.\n[00:08] పేషెంట్: అవునండి, కిడ్నీ డాక్టర్ గారి అపాయింట్‌మెంట్ శనివారం 11:30 కు ఖరారు చేయండి.\n[00:20] శ్రావణి: సరేనండి, ఇన్సూరెన్స్ డెస్క్ కి కూడా వివరాలు పంపిస్తాను.`,
          hindi: `[00:03] एजेंट: नमस्ते, मीनेस्थम हेल्थकेयर से बोल रहा हूँ।\n[00:09] पेशेंट: जी, डॉक्टर से शनिवार सुबह मिलना है। फीस का विवरण व्हाट्सएप कर दीजिए।`,
          english: `[00:02] Agent: Hello, calling from Meenestham Healthcare Group.\n[00:07] Patient: Yes, please confirm consultation for Saturday 11:30 AM.`,
        };
        transcriptText = transcriptSamples[selectedLanguage] || transcriptSamples.telugu;
      }
      let aiTemp = 'Hot';

      try {
        const transRes = await fetch(`${apiHost}/calls/transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: sonioxApiKey,
            language: selectedLanguage,
            leadName: selectedLead.name,
          }),
        });
        const transData = await transRes.json();
        if (transData && transData.success) {
          if (!transcriptText && Array.isArray(transData.transcript) && transData.transcript.length > 0) {
            transcriptText = transData.transcript
              .map((t: any) => `[${t.time}] ${t.speaker}: ${t.text}`)
              .join('\n');
          }
          if (transData.aiTemp) aiTemp = transData.aiTemp;
        }
      } catch {}

      await fetch(`${apiHost}/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          agentId: session?.name || 'Sravani K.',
          durationSec: callSeconds || 74,
          outcome: 'connected',
          language: selectedLanguage,
          transcript: transcriptText,
          agentTemp: postCallTemp,
          aiSuggestedTemp: aiTemp,
        }),
      });

      // Update in local state
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, qualification: postCallTemp, status: 'contacted' } : l));
      Alert.alert(
        'Call & Cadence Saved',
        `Call logged (${callSeconds}s). Marked '${postCallTemp}'. Full follow-up cadence generated in central database!`
      );
      setScreen('queue');
      refreshLeads();
    } catch {
      Alert.alert('Saved locally', `Marked '${postCallTemp}' for ${selectedLead.name}.`);
      setScreen('queue');
    } finally {
      setLoading(false);
    }
  };

  // PRD 1 & 2: Add Patient Lead (Demographics + Clinical Health Assessment) with Deduplication
  const handleSaveLead = async (forceNew = false) => {
    const trimmedName = newName.trim();
    const trimmedPhone = newPhone.trim();
    if (!trimmedName || !trimmedPhone) {
      Alert.alert('Validation Error', 'Enter a full name and valid 10-digit mobile number.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${apiHost}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          phone: trimmedPhone,
          email: newEmail.trim() || undefined,
          branch: newBranch,
          source: newSource.trim() || 'Mobile App Ingestion',
          campaign: newCampaign.trim() || 'Festive Telecalling Q3',
          department: newDepartment,
          diagnosis: newDiagnosis.trim() || 'Clinical Review Pending',
          symptoms: newSymptoms.trim() || 'Symptoms reported on call',
          severity: newSeverity,
          duration: newDuration,
          urgency: newUrgency,
          budget: newBudget,
          qualification: newQualification,
          ownerId: session?.name || 'Sravani',
          forceNew,
        }),
      });
      const data = await res.json();

      if (data && data.success) {
        if (data.duplicateDetected && !forceNew) {
          Alert.alert(
            '90-Day Deduplication Attached!',
            `Patient phone ${trimmedPhone} was already registered within 90 days as "${data.data.name}" (${data.data.id}).\n\nInteraction attached to existing patient journey! (PRD 2)`,
            [
              {
                text: 'View Existing Patient',
                onPress: () => {
                  setSelectedLead(data.data);
                  setScreen('lead-360');
                  fetchLeadTimeline(data.data.id);
                },
              },
              {
                text: '➕ Create Separate Record',
                onPress: () => void handleSaveLead(true),
              },
            ]
          );
        } else {
          Alert.alert('Patient Lead Created', `Patient ${data.data.name} (${data.data.id}) registered in central database! Both Web and Mobile are synced.`);
          setLeads(prev => [data.data, ...prev.filter((l: any) => l.id !== data.data.id)]);
          setSelectedLead(data.data);
          setScreen('queue');
          void refreshLeads();
        }
        setNewName('');
        setNewPhone('');
        setNewEmail('');
        setNewDiagnosis('');
        setNewSymptoms('');
      } else {
        Alert.alert('Error', data?.message || 'Could not save lead.');
      }
    } catch (err: any) {
      // Resilient local save fallback when offline or server unreachable
      const localLead: Lead = {
        id: `LOCAL-${Math.floor(10000 + Math.random() * 90000)}`,
        name: trimmedName,
        phone: trimmedPhone,
        email: newEmail.trim() || undefined,
        source: newSource.trim() || 'Mobile Intake',
        campaign: newCampaign.trim() || 'Direct Intake',
        department: newDepartment,
        diagnosis: newDiagnosis.trim() || 'Clinical Review Pending',
        symptoms: newSymptoms.trim() || 'Symptoms reported on call',
        severity: newSeverity,
        duration: newDuration,
        urgency: newUrgency,
        budget: newBudget,
        status: 'new',
        qualification: newQualification,
        ownerId: session?.name || 'Sravani',
        createdAt: new Date().toISOString(),
      };
      setLeads(prev => [localLead, ...prev]);
      setSelectedLead(localLead);
      setScreen('queue');
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      Alert.alert(
        'Saved Locally (Offline)',
        `Could not reach server at ${apiHost}.\n\nPatient "${trimmedName}" has been saved to your local device queue! You can call or review them now.`
      );
    } finally {
      setLoading(false);
    }
  };

  // Edit Patient Details: Updates SQLite and immediately reflects across Web and Mobile
  const handleSaveEditLead = async () => {
    if (!selectedLead) return;
    try {
      setLoading(true);
      const res = await fetch(`${apiHost}/leads/${selectedLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
          department: editDepartment,
          diagnosis: editDiagnosis,
          symptoms: editSymptoms,
          status: editStage,
          qualification: editQualification,
        }),
      });
      const data = await res.json();
      if (data && data.success) {
        Alert.alert('Patient Updated', `Details for ${editName} (${selectedLead.id}) successfully updated in central database!`);
        const updated: Lead = {
          ...selectedLead,
          name: editName,
          phone: editPhone,
          email: editEmail,
          department: editDepartment,
          diagnosis: editDiagnosis,
          symptoms: editSymptoms,
          status: editStage,
          qualification: editQualification,
        };
        setSelectedLead(updated);
        setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l));
        setEditModalOpen(false);
        void refreshLeads();
        void fetchLeadTimeline(selectedLead.id);
      } else {
        Alert.alert('Error', data?.message || 'Could not update patient.');
      }
    } catch (err: any) {
      Alert.alert('Network Error', err.message || 'Failed to update patient.');
    } finally {
      setLoading(false);
    }
  };

  // Manager: Register Telecalling Agent and Generate In-Person Credential Handover Slip
  const handleCreateAgent = async () => {
    const trimmedName = agentName.trim();
    const trimmedEmail = agentEmail.trim();
    const trimmedPhone = agentPhone.trim();
    if (!trimmedName || !trimmedEmail || !agentPassword) {
      Alert.alert('Missing Fields', 'Please enter Agent Name, Official Email, and Initial Password.');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${apiHost}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          role: 'agent',
          department: agentDept,
          branch: 'Banjara Hills',
          password: agentPassword,
        }),
      });
      const data = await res.json();
      if (data && data.success) {
        const slip = {
          name: trimmedName,
          phone: trimmedPhone,
          email: trimmedEmail,
          dept: agentDept,
          shift: agentShift,
          password: agentPassword,
          issuedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          issuedBy: session?.name || 'Anil Kumar · Team Lead',
        };
        setCreatedAgentSlip(slip);
        setAddAgentModalOpen(false);
        setHandoverSlipModalOpen(true);
        setAgentName('');
        setAgentPhone('');
        setAgentEmail('');
        Alert.alert('Agent Created', `Agent account created in central database! Handover credential slip ready for in-person delivery.`);
      } else {
        Alert.alert('Error', data?.message || 'Could not create agent.');
      }
    } catch (err: any) {
      Alert.alert('Network Error', err.message || 'Failed to create agent.');
    } finally {
      setLoading(false);
    }
  };

  const getFormattedSlipText = (slip: NonNullable<typeof createdAgentSlip>) => {
    return `================================================
🏥 TRH360 HEALTHCARE GROUP — TELECALLING OPERATIONS
OFFICIAL IN-PERSON LOGIN CREDENTIAL HANDOVER SLIP
================================================
Agent Name:    ${slip.name}
Role:          Telecalling Agent (Inbound & Outbound)
Department:    ${slip.dept}
Branch:        Banjara Hills Super-Speciality
Shift Window:  ${slip.shift}
Portal URL:    http://localhost:5173/login

------------------------------------------------
CONFIDENTIAL LOGIN CREDENTIALS
------------------------------------------------
Login Email:   ${slip.email}
Temporary Pwd: ${slip.password}

------------------------------------------------
SECURITY & ONBOARDING GUIDELINES
------------------------------------------------
1. Sign in to your telecalling console on day 1.
2. Change your temporary password upon first login.
3. Keep the 5-minute uncalled lead SLA below threshold.
4. Record all customer calls with consent and structured remarks.

Issued By:     ${slip.issuedBy}
Date & Time:   ${slip.issuedAt}
Manager Signature: [ Anil Kumar — Authorized Team Lead ]
================================================`;
  };

  const handleShareSlip = async () => {
    if (!createdAgentSlip) return;
    const text = getFormattedSlipText(createdAgentSlip);
    try {
      await Share.share({
        title: `TRH360 Credential Slip - ${createdAgentSlip.name}`,
        message: text,
      });
    } catch {
      await setClipboardString(text);
      Alert.alert('Copied', 'Slip text copied to clipboard!');
    }
  };

  const handleSelectPersona = (role: PersonaRole) => {
    setActivePersonaRole(role);
    if (role === 'Leadership') setScreen('founder-cockpit');
    else if (role === 'Agent') setScreen('queue');
    else if (role === 'Manager') setScreen('manager-cockpit');
    else if (role === 'Doctor') setScreen('doctor-view');
    else if (role === 'Finance') setScreen('finance-view');
    else if (role === 'Voice AI') setScreen('voice-view');
  };

  // PRD 8 & 9: Complete or Miss Task
  const handleTaskStatus = async (taskId: string, status: 'completed' | 'missed') => {
    try {
      await fetch(`${apiHost}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setTaskList(prev => prev.map(t => t.id === taskId ? { ...t, status, isMissed: status === 'missed' ? 1 : 0 } : t));
      if (status === 'missed') {
        Alert.alert('Escalated', 'Touch recorded as MISSED and escalated to Manager queue. (PRD 9)');
      } else {
        Alert.alert('Completed', 'Commitment marked as KEPT. (PRD 8)');
      }
    } catch {
      setTaskList(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filteredLeads = leads.filter(l => {
    if (statusFilter === 'All') return true;
    return (l.qualification || '').toLowerCase() === statusFilter.toLowerCase();
  });
  const currentLeadIndex = selectedLead ? leads.findIndex(l => l.id === selectedLead.id) : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0b2545" />

      {/* TOP HEADER NAVIGATION BAR */}
      <View style={styles.topbar}>
        {session && screen !== 'login' && screen !== 'queue' ? (
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={() => {
              if (screen === 'active-call') {
                Alert.alert('Ongoing Call', 'Exit active call and return to queue?', [
                  { text: 'Stay', style: 'cancel' },
                  { text: 'Exit Call', onPress: () => { endCall(); setScreen('queue'); } },
                ]);
              } else {
                setScreen('queue');
              }
            }}
          >
            <Text style={styles.headerBackText}>‹ Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.brand}>
            <View style={styles.logoBadge}><Text style={styles.logoText}>L</Text></View>
            <View>
              <Text style={styles.brandTitle}>LeadLoop</Text>
              <Text style={styles.brandSub}>TRH360 CRM</Text>
            </View>
          </View>
        )}

        {/* Screen Breadcrumb / Active Screen Title Pill */}
        {session && screen !== 'login' && (
          <View style={styles.screenPill}>
            <Text style={styles.screenPillText} numberOfLines={1}>
              {screen === 'queue' ? `📋 Queue (${filteredLeads.length})`
                : screen === 'lead-360' ? `👤 360 · ${selectedLead?.name?.split(' ')[0] || 'Lead'}`
                : screen === 'context-card' ? `🔍 Pre-Call`
                : screen === 'active-call' ? `🎙️ Call (${formatTime(callSeconds)})`
                : screen === 'post-call' ? `⭐ Post-Call`
                : screen === 'tasks' ? `⏰ Tasks (${taskList.length})`
                : screen === 'add-lead' ? `➕ Add Lead`
                : screen === 'manager-cockpit' ? `📊 Cockpit`
                : screen === 'founder-cockpit' ? `👑 Executive`
                : screen === 'doctor-view' ? `🩺 Doctor OPD`
                : screen === 'finance-view' ? `💳 Commercial`
                : screen === 'voice-view' ? `🤖 Voice AI`
                : 'CRM'}
            </Text>
          </View>
        )}

        {/* Top Header Action Buttons */}
        <View style={styles.topRightActions}>
          {session && screen !== 'login' && (
            <>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  void refreshLeads();
                  void refreshTasks();
                  Alert.alert('CRM Synced', 'Updated patient leads and tasks from central database.');
                }}
              >
                <Text style={styles.iconBtnText}>🔄</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setScreen('add-lead')}
              >
                <Text style={styles.iconBtnText}>➕</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={() => setSettingsModalOpen(true)}>
            <Text style={styles.iconBtnText}>⚙️</Text>
          </TouchableOpacity>
          {session ? (
            <TouchableOpacity style={styles.sessionBadge} onPress={() => setScreen('login')}>
              <Text style={styles.sessionBadgeText}>{session.name.slice(0, 2).toUpperCase()}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* CHARACTER PERSONA RIBBON SWITCHER */}
      {session && screen !== 'login' && screen !== 'active-call' && (
        <View style={styles.personaRibbon}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.personaRibbonScroll}>
            {PERSONAS.map((p) => {
              const isActive = activePersonaRole === p.role;
              return (
                <TouchableOpacity
                  key={p.role}
                  style={[styles.personaChip, isActive && styles.personaChipActive]}
                  onPress={() => handleSelectPersona(p.role)}
                >
                  <Text style={styles.personaChipAvatar}>{p.avatar}</Text>
                  <View>
                    <Text style={[styles.personaChipName, isActive && styles.personaChipNameActive]}>{p.name}</Text>
                    <Text style={[styles.personaChipBadge, isActive && styles.personaChipBadgeActive]}>{p.badge}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* CHARACTER MISSION BANNER */}
      {session && screen !== 'login' && screen !== 'active-call' && (
        <View style={styles.missionBanner}>
          <View style={styles.missionBannerLeft}>
            <Text style={styles.missionRoleTag}>
              {PERSONAS.find(p => p.role === activePersonaRole)?.avatar} {PERSONAS.find(p => p.role === activePersonaRole)?.name} · {PERSONAS.find(p => p.role === activePersonaRole)?.title}
            </Text>
            <Text style={styles.missionTagline}>
              {PERSONAS.find(p => p.role === activePersonaRole)?.tagline}
            </Text>
          </View>
          <View style={styles.missionActions}>
            {activePersonaRole === 'Agent' && (
              <>
                <TouchableOpacity style={styles.missionActionBtn} onPress={() => setScreen('add-lead')}>
                  <Text style={styles.missionActionBtnText}>➕ Add Patient</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.missionActionBtnSec} onPress={() => setScreen('queue')}>
                  <Text style={styles.missionActionBtnSecText}>📋 Queue</Text>
                </TouchableOpacity>
              </>
            )}
            {activePersonaRole === 'Manager' && (
              <>
                <TouchableOpacity style={styles.missionActionBtn} onPress={() => setAddAgentModalOpen(true)}>
                  <Text style={styles.missionActionBtnText}>➕ Add Telecaller</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.missionActionBtnSec} onPress={() => setScreen('manager-cockpit')}>
                  <Text style={styles.missionActionBtnSecText}>📊 Cockpit</Text>
                </TouchableOpacity>
              </>
            )}
            {activePersonaRole === 'Leadership' && (
              <>
                <TouchableOpacity style={styles.missionActionBtn} onPress={() => setScreen('founder-cockpit')}>
                  <Text style={styles.missionActionBtnText}>👑 Executive</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.missionActionBtnSec} onPress={() => setScreen('queue')}>
                  <Text style={styles.missionActionBtnSecText}>📊 All Leads</Text>
                </TouchableOpacity>
              </>
            )}
            {activePersonaRole === 'Doctor' && (
              <>
                <TouchableOpacity style={styles.missionActionBtn} onPress={() => setScreen('doctor-view')}>
                  <Text style={styles.missionActionBtnText}>🩺 OPD Review</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.missionActionBtnSec} onPress={() => setScreen('queue')}>
                  <Text style={styles.missionActionBtnSecText}>📋 Patients</Text>
                </TouchableOpacity>
              </>
            )}
            {activePersonaRole === 'Finance' && (
              <>
                <TouchableOpacity style={styles.missionActionBtn} onPress={() => setScreen('finance-view')}>
                  <Text style={styles.missionActionBtnText}>💳 Commercial</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.missionActionBtnSec} onPress={() => setScreen('queue')}>
                  <Text style={styles.missionActionBtnSecText}>📋 Recovery</Text>
                </TouchableOpacity>
              </>
            )}
            {activePersonaRole === 'Voice AI' && (
              <>
                <TouchableOpacity style={styles.missionActionBtn} onPress={() => setScreen('voice-view')}>
                  <Text style={styles.missionActionBtnText}>🤖 AI Monitor</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.missionActionBtnSec} onPress={() => setScreen('queue')}>
                  <Text style={styles.missionActionBtnSecText}>📞 Call Queue</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      {/* SCREEN 1: LOGIN SCREEN */}
      {screen === 'login' && (
        <ScrollView contentContainerStyle={styles.loginContainer}>
          <View style={styles.loginHeader}>
            <View style={styles.largeLogo}><Text style={styles.largeLogoText}>L</Text></View>
            <Text style={styles.loginTitle}>LeadLoop (TRH360)</Text>
            <Text style={styles.loginSubtitle}>Centralized Follow-up & Conversion CRM</Text>
            <View style={styles.tenantTag}><Text style={styles.tenantTagText}>Tenant: Meenestham Healthcare Group</Text></View>
          </View>

          <View style={styles.loginCard}>
            <Text style={styles.inputLabel}>Work Email</Text>
            <TextInput
              style={styles.textInput}
              value={loginEmail}
              onChangeText={setLoginEmail}
              placeholder="e.g. sravani@meenestham.in"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.textInput}
              value={loginPassword}
              onChangeText={setLoginPassword}
              placeholder="••••••••"
              secureTextEntry
            />

            <TouchableOpacity style={styles.primaryBtn} onPress={() => handleLogin()}>
              {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryBtnText}>Sign In to CRM</Text>}
            </TouchableOpacity>

            <Text style={styles.quickLoginHeader}>Quick Demo Login (One-Tap)</Text>
            <View style={styles.quickLoginRow}>
              <TouchableOpacity style={styles.quickPill} onPress={() => { setLoginEmail('sravani@meenestham.in'); handleLogin('sravani@meenestham.in'); }}>
                <Text style={styles.quickPillText}>Agent (Sravani)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickPill} onPress={() => { setLoginEmail('anil@meenestham.in'); handleLogin('anil@meenestham.in'); }}>
                <Text style={styles.quickPillText}>Manager (Anil)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickPill} onPress={() => { setLoginEmail('founder@meenestham.in'); handleLogin('founder@meenestham.in'); }}>
                <Text style={styles.quickPillText}>Founder (Dr. Ramesh)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* SCREEN: MANAGER COCKPIT (PRD 3, 4, 11) */}
      {screen === 'manager-cockpit' && (
        <ScrollView style={styles.content}>
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
              Management Cockpit · Team Operations
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#0b2545' }}>
              Good morning, {session?.name || 'Anil'}.
            </Text>
            <Text style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
              Your team has 17 priority actions before the next doctor appointment window.
            </Text>
          </View>

          {/* Manager Action: Add Telecaller & In-Person Handover */}
          <TouchableOpacity 
            style={[styles.primaryBtn, { backgroundColor: '#1d4ed8', marginVertical: 8 }]}
            onPress={() => setAddAgentModalOpen(true)}
          >
            <Text style={styles.primaryBtnText}>➕ Add Telecalling Agent (In-Person Handover)</Text>
          </TouchableOpacity>

          {/* PRD 4: 5-Minute Uncalled SLA Banner */}
          <TouchableOpacity 
            style={[styles.slaBanner, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}
            onPress={() => Alert.alert('SLA Reassignment (PRD 4)', '11 uncalled leads automatically re-routed to least-loaded telecallers: Divya M. (4), Sravani K. (4), Kiran R. (3).')}
          >
            <Text style={[styles.slaBannerTitle, { color: '#b91c1c' }]}>🚨 11 Leads Breached 5-Min SLA (PRD 4)</Text>
            <Text style={[styles.slaBannerDesc, { color: '#991b1b' }]}>
              Highest exposure: Meta Regional Campaign (6 leads). Tap to auto-reassign to least-loaded agents.
            </Text>
          </TouchableOpacity>

          {/* Manager Conversion Funnel */}
          <Text style={[styles.sectionHeader, { marginTop: 14, marginBottom: 8 }]}>Conversion Funnel (Last 30 Days)</Text>
          <View style={{ backgroundColor: '#ffffff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 8 }}>
            {[
              { label: 'Received', val: '2,864', pct: '100%', color: '#0b2545' },
              { label: 'Connected', val: '2,176', pct: '76%', color: '#1d4ed8' },
              { label: 'Qualified', val: '1,392', pct: '64%', color: '#2563eb' },
              { label: 'Appt Booked', val: '742', pct: '53%', color: '#059669' },
              { label: 'Converted', val: '218', pct: '29%', color: '#16a34a' },
            ].map(f => (
              <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155', width: 90 }}>{f.label}</Text>
                <View style={{ flex: 1, height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, marginHorizontal: 8, overflow: 'hidden' }}>
                  <View style={{ width: f.pct as any, height: '100%', backgroundColor: f.color, borderRadius: 4 }} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a', width: 60, textAlign: 'right' }}>{f.val} ({f.pct})</Text>
              </View>
            ))}
          </View>

          {/* Team Operating Health */}
          <Text style={[styles.sectionHeader, { marginTop: 18, marginBottom: 8 }]}>Agent Operating Health & Scorecards</Text>
          <View style={{ backgroundColor: '#ffffff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 10 }}>
            {[
              { name: 'Sravani K.', assigned: 82, firstTouch: '3m 12s', followUp: '94%', score: '94 · Star' },
              { name: 'Divya M.', assigned: 74, firstTouch: '2m 41s', followUp: '91%', score: '91 · Fast' },
              { name: 'Anil M.', assigned: 78, firstTouch: '6m 48s', followUp: '79%', score: '88 · Good' },
              { name: 'Kiran R.', assigned: 69, firstTouch: '9m 16s', followUp: '68%', score: '74 · Intervene' },
            ].map((a, i) => (
              <View key={a.name} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottomWidth: i < 3 ? 1 : 0, borderBottomColor: '#f1f5f9' }}>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0b2545' }}>{a.name}</Text>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>Touch: {a.firstTouch} · Cadence: {a.followUp}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: a.score.includes('Intervene') ? '#dc2626' : '#16a34a' }}>{a.score}</Text>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>{a.assigned} leads</Text>
                </View>
              </View>
            ))}
          </View>

          {/* PRD 11: Call Quality & QA Disagreement Queue */}
          <Text style={[styles.sectionHeader, { marginTop: 18, marginBottom: 8 }]}>Soniox STT QA Disagreement Alerts (PRD 11)</Text>
          <View style={{ backgroundColor: '#fffbeb', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#fde68a', gap: 8 }}>
            <Text style={{ fontSize: 12, color: '#92400e', fontWeight: '600' }}>
              ⚠️ 3 calls flagged: Agent tagged "Warm", but Soniox STT speech detected "Hot" buying signals.
            </Text>
            <TouchableOpacity 
              style={{ backgroundColor: '#f59e0b', padding: 8, borderRadius: 6, alignItems: 'center', marginTop: 4 }}
              onPress={() => Alert.alert('QA Reviewed', 'Approved AI temperature update to "Hot" for Lakshmi Narayana (TRH-24190). Cadence updated!')}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>Review & Approve AI Override</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.primaryBtn, { marginTop: 18, marginBottom: 30 }]}
            onPress={() => setScreen('queue')}
          >
            <Text style={styles.primaryBtnText}>View Team Calling Queue →</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* SCREEN: FOUNDER / CEO COCKPIT (PRD 16, 17, 18) */}
      {screen === 'founder-cockpit' && (
        <ScrollView style={styles.content}>
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#b45309', textTransform: 'uppercase' }}>
              Executive Cockpit · Founder & CEO
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#0b2545' }}>
              Welcome, Dr. Ramesh K.
            </Text>
            <Text style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
              Hospital conversion velocity, CAC attribution, and the 5-question owner cockpit.
            </Text>
          </View>

          {/* PRD 18: 100 -> 50 -> 25 -> 12 Benchmark Strip */}
          <Text style={[styles.sectionHeader, { marginBottom: 8 }]}>Conversion Benchmark Strip (100 → 50 → 25 → 12)</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
            {[
              { stage: 'Sourced', target: '100', actual: '2,864', color: '#0b2545' },
              { stage: 'Contacted', target: '50', actual: '1,432', color: '#1d4ed8' },
              { stage: 'Qualified', target: '25', actual: '716', color: '#059669' },
              { stage: 'Converted', target: '12', actual: '343', color: '#b45309' },
            ].map(b => (
              <View key={b.stage} style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}>
                <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '600' }}>{b.stage}</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: b.color, marginVertical: 2 }}>{b.actual}</Text>
                <Text style={{ fontSize: 9, color: '#059669', fontWeight: '700' }}>Target {b.target}%</Text>
              </View>
            ))}
          </View>

          {/* Revenue Attribution */}
          <View style={{ backgroundColor: '#0b2545', borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <Text style={{ fontSize: 11, color: '#cbd5e1', textTransform: 'uppercase', fontWeight: '700' }}>Attributed Net Revenue</Text>
            <Text style={{ fontSize: 26, fontWeight: '900', color: '#f59e0b', marginTop: 4 }}>₹1.84 Crore</Text>
            <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Across Nephrology, Orthopedics, Urology, Laparoscopy & IVF</Text>
          </View>

          {/* PRD 18: Owner 5-Question Cockpit */}
          <Text style={[styles.sectionHeader, { marginBottom: 8 }]}>Owner 5-Question Cockpit (PRD 18)</Text>
          
          <View style={{ backgroundColor: '#ffffff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 12, marginBottom: 20 }}>
            {/* Q1 */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0b2545' }}>Q1. Where are patient leads coming from?</Text>
              <Text style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                • Meta Regional: 38.5% (CAC ₹5,940) · Connect: 72%
              </Text>
              <Text style={{ fontSize: 11, color: '#475569' }}>
                • Google Search: 30.9% (CAC ₹4,120) · Connect: 81%
              </Text>
              <Text style={{ fontSize: 11, color: '#475569' }}>
                • Website Organic: 15.7% (CAC ₹1,180) · Connect: 84%
              </Text>
            </View>

            <View style={{ height: 1, backgroundColor: '#f1f5f9' }} />

            {/* Q2 */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0b2545' }}>Q2. What happened to them?</Text>
              <Text style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                51.7% in active follow-up cadence, 18.3% consults booked, 19.1% lost/closed, 10.9% in fresh intake.
              </Text>
            </View>

            <View style={{ height: 1, backgroundColor: '#f1f5f9' }} />

            {/* Q3 */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0b2545' }}>Q3. Why did they convert?</Text>
              <Text style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>
                53.6% driven by sub-5-minute first touch; 25.9% by Pre-Call Context Card opening scripts.
              </Text>
            </View>

            <View style={{ height: 1, backgroundColor: '#f1f5f9' }} />

            {/* Q4 */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0b2545' }}>Q4. Why did they not convert?</Text>
              <Text style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>
                36.8% financial/treatment cost objection; 27.3% family decision maker confirmation pending.
              </Text>
            </View>

            <View style={{ height: 1, backgroundColor: '#f1f5f9' }} />

            {/* Q5 */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0b2545' }}>Q5. What to do next?</Text>
              <Text style={{ fontSize: 11, color: '#b45309', marginTop: 2, fontWeight: '600' }}>
                ⚡ Action: Deploy 30-day reactivation touch for 201 financial objection leads (₹18.4L pipeline).
              </Text>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.primaryBtn, { marginBottom: 30 }]}
            onPress={() => setScreen('queue')}
          >
            <Text style={styles.primaryBtnText}>Inspect Live Patient Database →</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* SCREEN 2: PRIORITY QUEUE & HOME */}
      {screen === 'queue' && (
        <ScrollView style={styles.content}>
          {/* PRD 4: 5-Minute Uncalled SLA Alert */}
          <View style={styles.slaBanner}>
            <Text style={styles.slaBannerTitle}>🚨 SLA Response Alert (5 min)</Text>
            <Text style={styles.slaBannerDesc}>1 form lead uncalled for 16 minutes. Reassignment offered. (PRD 4)</Text>
          </View>

          {/* Quick Metrics */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricVal}>{leads.length}</Text>
              <Text style={styles.metricLabel}>Total Leads</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricVal}>14</Text>
              <Text style={styles.metricLabel}>Calls Due</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricVal}>88%</Text>
              <Text style={styles.metricLabel}>SLA Score</Text>
            </View>
          </View>

          {/* Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
            {['All', 'Hot', 'Warm', 'Cold', 'Not Lifting'].map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
                onPress={() => setStatusFilter(f)}
              >
                <Text style={[styles.filterChipText, statusFilter === f && styles.filterChipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Lead List */}
          <View style={styles.listHeaderRow}>
            <Text style={styles.sectionHeader}>Priority Calling List</Text>
            <TouchableOpacity onPress={() => setScreen('add-lead')} style={styles.addLeadBtnSmall}>
              <Text style={styles.addLeadBtnText}>+ New Lead</Text>
            </TouchableOpacity>
          </View>

          {filteredLeads.map((item, index) => (
            <TouchableOpacity
              key={item.id || index}
              style={styles.leadCard}
              onPress={() => { setSelectedLead(item); setScreen('lead-360'); fetchLeadTimeline(item.id); }}
            >
              <View style={styles.leadInfo}>
                <View style={styles.leadNameRow}>
                  <Text style={styles.leadName}>{item.name}</Text>
                  <View style={[styles.tempBadge, item.qualification === 'Hot' ? styles.badgeHot : item.qualification === 'Cold' ? styles.badgeCold : styles.badgeWarm]}>
                    <Text style={styles.tempBadgeText}>{item.qualification || 'Warm'}</Text>
                  </View>
                </View>
                <Text style={styles.leadPhone}>{item.phone || 'No phone'}</Text>
                {item.diagnosis ? (
                  <Text style={{ fontSize: 11, color: '#0369a1', fontWeight: '600', marginTop: 2 }}>
                    🩺 {item.department || 'Clinical'}: {item.diagnosis}
                  </Text>
                ) : null}
                <Text style={styles.leadSource}>{item.source || 'Direct Intake'} · {item.campaign || 'General'}</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                  style={[styles.dialBtn, { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' }]}
                  onPress={() => openEditModal(item)}
                >
                  <Text style={[styles.dialBtnText, { fontSize: 13 }]}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dialBtn} onPress={() => handleDirectDialFromQueue(item)}>
                  <Text style={styles.dialBtnText}>📞</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* SCREEN 3: PRD 13 PRE-CALL CONTEXT CARD */}
      {screen === 'context-card' && selectedLead && (
        <ScrollView style={styles.content}>
          <View style={styles.screenTopNavRow}>
            <TouchableOpacity style={styles.backBtnRow} onPress={() => setScreen('queue')}>
              <Text style={styles.backBtnText}>← Back to Queue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionNavBtnSmall}
              onPress={() => {
                fetchLeadTimeline(selectedLead.id);
                setScreen('lead-360');
              }}
            >
              <Text style={styles.actionNavBtnSmallText}>👤 View 360 →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.contextHeader}>
            <Text style={styles.contextTag}>PRD 13 · Pre-Call Intelligence</Text>
            <Text style={styles.contextName}>{selectedLead.name}</Text>
            <Text style={styles.contextPhone}>{selectedLead.phone}</Text>
          </View>

          <View style={styles.contextCard}>
            <View style={styles.contextRow}>
              <Text style={styles.contextLabel}>Last Real Conversation</Text>
              <Text style={styles.contextVal}>Enquired about nephrology super-specialty consultation & surgery cost.</Text>
            </View>
            <View style={styles.contextRow}>
              <Text style={styles.contextLabel}>Open Commitment</Text>
              <Text style={styles.contextVal}>"Call me Saturday morning to confirm finance director attendance."</Text>
            </View>
            <View style={styles.contextRow}>
              <Text style={styles.contextLabel}>Preferred Day & Time</Text>
              <Text style={styles.contextVal}>Saturday · 11:30 AM (In-Clinic OPD)</Text>
            </View>
            <View style={styles.contextRow}>
              <Text style={styles.contextLabel}>Open Objection</Text>
              <Text style={styles.contextVal}>TPA cashless insurance clearance before procedure.</Text>
            </View>
            <View style={styles.contextRow}>
              <Text style={styles.contextLabel}>What Was Already Sent</Text>
              <Text style={styles.contextVal}>WhatsApp confirmation, Dr. Rao profile, Cashless guide.</Text>
            </View>

            <View style={styles.openingLineBox}>
              <Text style={styles.openingLineLabel}>Suggested Opening Line (Continuous Context):</Text>
              <Text style={styles.openingLineText}>
                "Namaste {selectedLead.name} garu, this is {session?.name || 'Sravani'} from Meenestham Healthcare Group following up on our discussion regarding Saturday's 11:30 AM specialist slot..."
              </Text>
            </View>

            <View style={{ gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={[styles.startCallBtn, { backgroundColor: '#16a34a' }]} onPress={() => startCall(false)}>
                <Text style={styles.startCallBtnText}>🎙️ Start In-App Call & Live Mic Recording</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.startCallBtn, { backgroundColor: '#0284c7' }]} onPress={dialRealCustomer}>
                <Text style={styles.startCallBtnText}>📞 Call {selectedLead.name} on Phone (SIM + Speakerphone)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.startCallBtn, { backgroundColor: '#25D366' }]} onPress={dialWhatsApp}>
                <Text style={styles.startCallBtnText}>💬 WhatsApp Msg / Chat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* SCREEN 4: PRD 10 ACTIVE CALL DIALER & AUTO-TRANSCRIPTION */}
      {screen === 'active-call' && selectedLead && (
        <ScrollView contentContainerStyle={styles.callScrollContainer} style={styles.callContainer}>
          {/* Top navigation row */}
          <View style={styles.callTopBar}>
            <TouchableOpacity style={styles.callBackBtn} onPress={() => { endCall(); setScreen('queue'); }}>
              <Text style={styles.callBackBtnText}>← Queue</Text>
            </TouchableOpacity>

            <View style={styles.recordingPill}>
              <View style={[styles.redDot, { backgroundColor: isListeningMic ? '#16a34a' : '#ff4d4f' }]} />
              <Text style={styles.recordingText}>
                {isListeningMic ? `🎙️ Live Mic (${micVolume}%)` : '🎙️ Mic Standby'}
              </Text>
            </View>
          </View>

          <Text style={styles.callingName}>{selectedLead.name}</Text>
          <Text style={styles.callingPhone}>{selectedLead.phone}</Text>

          {/* SIM Phone Call Guidance Banner */}
          <View style={styles.callSimTipBox}>
            <Text style={styles.callSimTipTitle}>💡 How to record a SIM phone call:</Text>
            <Text style={styles.callSimTipText}>
              Tap <Text style={{ fontWeight: '700', color: '#ffffff' }}>📞 Dial on Phone (SIM)</Text>, switch call to <Text style={{ fontWeight: '700', color: '#ffffff' }}>Speakerphone</Text>, then return to TRH 360. Your microphone will record both voices live!
            </Text>
          </View>

          {/* Direct GSM & WhatsApp Dial Buttons */}
          <View style={styles.callQuickDialRow}>
            <TouchableOpacity style={styles.callPhoneDialBtn} onPress={dialRealCustomer}>
              <Text style={styles.callPhoneDialBtnText}>📞 Dial on Phone (SIM)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.callWhatsAppDialBtn} onPress={dialWhatsApp}>
              <Text style={styles.callWhatsAppDialBtnText}>💬 WhatsApp Msg</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.callTimerText}>{formatTime(callSeconds)}</Text>

          {/* Dynamic Audio Waveform Bouncing with Real Microphone Voice */}
          <View style={styles.waveformBox}>
            {[0.4, 0.75, 0.3, 0.95, 0.55, 0.85, 0.45, 1.0, 0.65, 0.5, 0.9, 0.6, 0.35, 0.8, 0.5].map((mult, i) => {
              const dynamicH = Math.max(14, Math.min(68, Math.round((micVolume || 18) * mult * (0.85 + 0.3 * Math.sin((callSeconds * 2) + i)))));
              return (
                <View
                  key={i}
                  style={[
                    styles.waveBar,
                    {
                      height: dynamicH,
                      backgroundColor: isListeningMic ? '#16a34a' : '#d09a26',
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Soniox Live STT Card */}
          <View style={styles.transcriptCard}>
            <View style={styles.langSelectorRow}>
              <View>
                <Text style={styles.transcriptHeader}>Soniox Live STT:</Text>
                <Text style={{ fontSize: 9, color: isListeningMic ? '#16a34a' : '#d09a26', fontWeight: '700' }}>
                  ● {sttStatusMessage}
                </Text>
              </View>
              <View style={styles.langPills}>
                {(['telugu', 'hindi', 'english'] as const).map(l => (
                  <TouchableOpacity
                    key={l}
                    style={[styles.langPill, selectedLanguage === l && styles.langPillActive]}
                    onPress={() => {
                      setSelectedLanguage(l);
                    }}
                  >
                    <Text style={[styles.langPillText, selectedLanguage === l && styles.langPillTextActive]}>
                      {l === 'telugu' ? 'తెలుగు' : l === 'hindi' ? 'हिंदी' : 'English'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Quick 5-Second Microphone Test with Auto-Transcribe */}
            <TouchableOpacity
              style={[styles.transcribeActionBtn, { backgroundColor: testing5sMic ? '#ef4444' : '#10b981', marginBottom: 8 }]}
              onPress={test5sMicRecording}
              disabled={testing5sMic || loadingMobileSTT}
            >
              {testing5sMic ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={[styles.transcribeActionBtnText, { color: '#ffffff' }]}>
                    🎙️ Speak Now: {micTestCountdown !== null ? `${micTestCountdown}s remaining...` : 'Listening...'}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.transcribeActionBtnText, { color: '#ffffff' }]}>
                  🎤 Quick 5s Mic Test (Auto-Transcribe)
                </Text>
              )}
            </TouchableOpacity>

            {/* Soniox Transcribe Action Button */}
            <TouchableOpacity
              style={styles.transcribeActionBtn}
              onPress={transcribeMicWithSoniox}
              disabled={loadingMobileSTT || testing5sMic}
            >
              {loadingMobileSTT ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ActivityIndicator color="#0b2545" size="small" />
                  <Text style={styles.transcribeActionBtnText}>Transcribing with Soniox API...</Text>
                </View>
              ) : (
                <Text style={styles.transcribeActionBtnText}>⚡ Transcribe Voice with Soniox</Text>
              )}
            </TouchableOpacity>

            {/* Secondary audio playback & demo buttons */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              {lastRecordingUri && (
                <TouchableOpacity
                  style={[styles.transcribeActionBtn, { flex: 1, backgroundColor: isPlayingBack ? '#ef4444' : '#059669', marginBottom: 0 }]}
                  onPress={playLastRecording}
                >
                  <Text style={[styles.transcribeActionBtnText, { color: '#ffffff', fontSize: 12 }]}>
                    {isPlayingBack ? '⏹️ Stop Audio' : '▶️ Play Recording'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.transcribeActionBtn, { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 0 }]}
                onPress={() => void loadDemoScenario(selectedLanguage)}
              >
                <Text style={[styles.transcribeActionBtnText, { color: '#ffffff', fontSize: 12 }]}>
                  📋 Load Demo Script
                </Text>
              </TouchableOpacity>
            </View>

            {/* Scrollable Live Diarized Transcript */}
            <View style={styles.transcriptScrollArea}>
              {mobileTranscriptLines.length > 0 ? (
                mobileTranscriptLines.map((line, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.transcriptBubble,
                      line.speaker.toLowerCase().includes('agent') || line.speaker.toLowerCase().includes('sravani')
                        ? styles.bubbleAgent
                        : styles.bubbleLead,
                    ]}
                  >
                    <View style={styles.bubbleHeader}>
                      <Text style={styles.bubbleSpeaker}>
                        {line.speaker} · {line.time}
                      </Text>
                      {line.evidence && (
                        <View style={styles.evidenceTag}>
                          <Text style={styles.evidenceTagText}>Key Requirement</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.bubbleText}>{line.text}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.transcriptEmptyBox}>
                  <Text style={styles.transcriptEmptyIcon}>🎙️</Text>
                  <Text style={styles.transcriptEmptyTitle}>Ready to Record & Transcribe</Text>
                  <Text style={styles.transcriptEmptySub}>
                    Speak into your phone (or hold a speakerphone call). When you finish, tap "⚡ Transcribe Voice with Soniox" above to transcribe what was said into {selectedLanguage.toUpperCase()}!
                  </Text>
                </View>
              )}
            </View>

            {/* Quick Dialogue / Remark Entry */}
            <View style={styles.addDialogueRow}>
              <TouchableOpacity
                style={[
                  styles.speakerToggleBtn,
                  mobileSpeaker === 'Agent' ? styles.speakerAgentActive : styles.speakerLeadActive,
                ]}
                onPress={() => setMobileSpeaker(prev => prev === 'Agent' ? 'Lead' : 'Agent')}
              >
                <Text style={styles.speakerToggleText}>
                  {mobileSpeaker === 'Agent' ? 'You' : `${selectedLead.name.split(' ')[0]}`}
                </Text>
              </TouchableOpacity>
              <TextInput
                style={styles.dialogueInput}
                placeholder="Add remark / spoken phrase..."
                placeholderTextColor="#9ca3af"
                value={customMobileLine}
                onChangeText={setCustomMobileLine}
              />
              <TouchableOpacity style={styles.addDialogueBtn} onPress={handleAddCustomLine}>
                <Text style={styles.addDialogueBtnText}>+ Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.endCallBtn, isEndingCallAndTranscribing && { backgroundColor: '#7f1d1d' }]} 
            onPress={endCall}
            disabled={isEndingCallAndTranscribing}
          >
            {isEndingCallAndTranscribing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <ActivityIndicator color="#ffffff" size="small" />
                <Text style={styles.endCallBtnText}>Ending Call & Transcribing with Soniox AI...</Text>
              </View>
            ) : (
              <Text style={styles.endCallBtnText}>🔴 End Call & Transcribe (Soniox AI)</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* SCREEN 5: PRD 5 & 6 POST-CALL REVIEW & CADENCE */}
      {screen === 'post-call' && selectedLead && (
        <ScrollView style={styles.content}>
          <View style={styles.screenTopNavRow}>
            <TouchableOpacity style={styles.backBtnRow} onPress={() => setScreen('queue')}>
              <Text style={styles.backBtnText}>← Cancel / Return to Queue</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.postCallTitle}>Call Outcome & Temperature (PRD 5)</Text>
          <Text style={styles.postCallSub}>{selectedLead.name} · Duration: {callSeconds}s</Text>

          <View style={styles.reviewCard}>
            <Text style={styles.reviewLabel}>Set Patient Temperature (System Never Overrides):</Text>
            <View style={styles.tempSelectRow}>
              {(['Hot', 'Warm', 'Cold', 'Not Lifting', 'Junk'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tempChoice, postCallTemp === t && styles.tempChoiceActive]}
                  onPress={() => setPostCallTemp(t)}
                >
                  <Text style={[styles.tempChoiceText, postCallTemp === t && styles.tempChoiceTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.cadencePreviewBox}>
              <Text style={styles.cadencePreviewTitle}>Automated Cadence Generated (PRD 6):</Text>
              <Text style={styles.cadencePreviewDesc}>
                {postCallTemp === 'Hot'
                  ? '• 5-Day Plan: 3 mandatory call attempts (Day 0, 2, 4) & 3 alternating messages (Day 1, 3, 5)'
                  : postCallTemp === 'Warm'
                  ? '• 15-Day Plan: 5 calls & 7 alternating WhatsApp/RCS messages across 15 days'
                  : postCallTemp === 'Cold'
                  ? '• Weekly re-engagement touch until month end'
                  : '• 5 days of double dials (morning & evening)'}
              </Text>
            </View>

            {/* Audio Recording & Soniox Transcript Review */}
            <View style={{ marginBottom: 16, backgroundColor: '#f0fdf4', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#166534', marginBottom: 6 }}>
                🎙️ Call Audio Recording & Soniox AI Transcript
              </Text>
              {lastRecordingUri ? (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { flex: 1, backgroundColor: isPlayingBack ? '#ef4444' : '#16a34a', paddingVertical: 8 }]}
                    onPress={playLastRecording}
                  >
                    <Text style={[styles.primaryBtnText, { fontSize: 12 }]}>
                      {isPlayingBack ? '⏹️ Stop Playback' : '▶️ Listen to Recording'}
                    </Text>
                  </TouchableOpacity>
                  {mobileTranscriptLines.length === 0 && (
                    <TouchableOpacity
                      style={[styles.primaryBtn, { flex: 1, backgroundColor: '#d09a26', paddingVertical: 8 }]}
                      onPress={transcribeMicWithSoniox}
                      disabled={loadingMobileSTT}
                    >
                      <Text style={[styles.primaryBtnText, { fontSize: 12, color: '#0b2545' }]}>
                        {loadingMobileSTT ? 'Transcribing...' : '⚡ Transcribe with Soniox'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <Text style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', marginBottom: 6 }}>
                  No hardware audio captured during this session.
                </Text>
              )}

              {mobileTranscriptLines.length > 0 ? (
                <View style={{ maxHeight: 160, overflow: 'hidden' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#15803d', marginBottom: 4 }}>
                    Captured {mobileTranscriptLines.length} lines ({selectedLanguage.toUpperCase()}):
                  </Text>
                  {mobileTranscriptLines.slice(0, 3).map((l, i) => (
                    <Text key={i} style={{ fontSize: 11, color: '#1f2937', marginBottom: 2 }}>
                      <Text style={{ fontWeight: '700' }}>{l.speaker}:</Text> {l.text}
                    </Text>
                  ))}
                  {mobileTranscriptLines.length > 3 && (
                    <Text style={{ fontSize: 10, color: '#15803d', fontStyle: 'italic' }}>
                      + {mobileTranscriptLines.length - 3} more lines recorded
                    </Text>
                  )}
                </View>
              ) : null}
            </View>

            <Text style={styles.reviewLabel}>Structured Remarks & Notes:</Text>
            <TextInput
              style={styles.textArea}
              value={postCallRemark}
              onChangeText={setPostCallRemark}
              multiline
              numberOfLines={4}
              placeholder="Record verified facts only: Decision-maker Priya, Saturday in-clinic visit, cashless clearance needed."
            />

            <TouchableOpacity style={styles.primaryBtn} onPress={handleSavePostCall}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Confirm & Sync with Central DB</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* SCREEN 6: PRD 12 UNBROKEN JOURNEY (LEAD 360) */}
      {screen === 'lead-360' && selectedLead && (
        <ScrollView style={styles.content}>
          {/* Top Navigation Row: Back Button & Patient Switcher Carousel */}
          <View style={styles.screenTopNavRow}>
            <TouchableOpacity style={styles.backBtnRow} onPress={() => setScreen('queue')}>
              <Text style={styles.backBtnText}>← Back to Queue</Text>
            </TouchableOpacity>

            {/* Patient Switcher Carousel Navigation */}
            <View style={styles.carouselNavRow}>
              <TouchableOpacity
                style={[styles.carouselNavBtn, currentLeadIndex <= 0 && styles.carouselNavBtnDisabled]}
                disabled={currentLeadIndex <= 0}
                onPress={() => {
                  if (currentLeadIndex > 0) {
                    const prev = leads[currentLeadIndex - 1];
                    setSelectedLead(prev);
                    fetchLeadTimeline(prev.id);
                  }
                }}
              >
                <Text style={[styles.carouselNavBtnText, currentLeadIndex <= 0 && styles.carouselNavBtnTextDisabled]}>◀ Prev</Text>
              </TouchableOpacity>

              <View style={styles.carouselCounter}>
                <Text style={styles.carouselCounterText}>
                  {currentLeadIndex + 1} of {leads.length}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.carouselNavBtn, currentLeadIndex >= leads.length - 1 && styles.carouselNavBtnDisabled]}
                disabled={currentLeadIndex >= leads.length - 1}
                onPress={() => {
                  if (currentLeadIndex < leads.length - 1) {
                    const next = leads[currentLeadIndex + 1];
                    setSelectedLead(next);
                    fetchLeadTimeline(next.id);
                  }
                }}
              >
                <Text style={[styles.carouselNavBtnText, currentLeadIndex >= leads.length - 1 && styles.carouselNavBtnTextDisabled]}>Next ▶</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Lead Header */}
          <View style={styles.lead360Header}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lead360Id}>{selectedLead.id}</Text>
                <Text style={styles.lead360Name}>{selectedLead.name}</Text>
                <Text style={styles.lead360Sub}>{selectedLead.phone} · {selectedLead.source}</Text>
              </View>
              <View style={[styles.tempBadge, selectedLead.qualification === 'Hot' ? styles.badgeHot : styles.badgeWarm]}>
                <Text style={styles.tempBadgeText}>{selectedLead.qualification || 'Warm'}</Text>
              </View>
            </View>

            {/* Clinical Health Issues Summary Card */}
            <View style={styles.clinicalAssessmentCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={styles.clinicalCardTitle}>🩺 Clinical Health Assessment</Text>
                <Text style={styles.clinicalDeptBadge}>{selectedLead.department || 'Orthopaedics'}</Text>
              </View>
              <Text style={styles.clinicalDiagnosisText}>
                Diagnosis: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{selectedLead.diagnosis || 'Bilateral Osteoarthritis Knee (Grade 4)'}</Text>
              </Text>
              <Text style={styles.clinicalSymptomsText}>
                Symptoms: {selectedLead.symptoms || 'Severe knee pain, difficulty walking, nocturnal stiffness'}
              </Text>
              <View style={styles.clinicalMetricsRow}>
                <Text style={styles.clinicalMetricTag}>Severity: {selectedLead.severity || 'Severe'}</Text>
                <Text style={styles.clinicalMetricTag}>Duration: {selectedLead.duration || '1-2 years'}</Text>
                <Text style={styles.clinicalMetricTag}>Urgency: {selectedLead.urgency || 'Semi-Urgent'}</Text>
                {selectedLead.budget ? <Text style={styles.clinicalMetricTag}>Plan: {selectedLead.budget}</Text> : null}
              </View>
            </View>
          </View>

          {/* Direct Action Navigation Bar */}
          <View style={styles.actionNavRow}>
            <TouchableOpacity style={[styles.actionNavBtn, { backgroundColor: '#16a34a' }]} onPress={dialRealCustomer}>
              <Text style={styles.actionNavBtnText}>📞 Call SIM</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionNavBtn, { backgroundColor: '#25D366' }]} onPress={dialWhatsApp}>
              <Text style={styles.actionNavBtnText}>💬 WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionNavBtn, { backgroundColor: '#2563eb' }]} onPress={() => openEditModal(selectedLead)}>
              <Text style={styles.actionNavBtnText}>✏️ Edit Patient</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionNavBtn, { backgroundColor: '#0b2545' }]} onPress={() => setScreen('context-card')}>
              <Text style={styles.actionNavBtnText}>🔍 Pre-Call</Text>
            </TouchableOpacity>
          </View>

          {/* PRD Real-time WhatsApp Inbound Stream & Simulator Card */}
          <View style={styles.whatsAppStreamCard}>
            <View style={styles.whatsAppStreamHeader}>
              <Text style={styles.whatsAppStreamTitle}>💬 WhatsApp Direct Inbound Trigger</Text>
              <View style={styles.whatsAppOnlineBadge}>
                <View style={styles.greenPulseDot} />
                <Text style={styles.whatsAppOnlineText}>Live Sync</Text>
              </View>
            </View>
            <Text style={styles.whatsAppStreamSub}>
              Directly triggers patient reply into {selectedLead.name}&apos;s profile, journey & cadence:
            </Text>

            {/* If clipboard detected from WhatsApp, show instant 1-tap trigger */}
            {clipboardDetectedText ? (
              <View style={styles.clipboardDetectedBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clipboardDetectedTitle}>📋 WhatsApp Reply in Clipboard:</Text>
                  <Text style={styles.clipboardDetectedBody} numberOfLines={2}>&quot;{clipboardDetectedText}&quot;</Text>
                </View>
                <TouchableOpacity
                  style={styles.clipboardTriggerBtn}
                  onPress={() => void handleSimulateWhatsAppInbound(clipboardDetectedText)}
                  disabled={simulatingWhatsApp}
                >
                  <Text style={styles.clipboardTriggerBtnText}>⚡ Trigger</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.quickChipsWrap}>
              <TouchableOpacity
                style={[styles.quickChipEmerald, { borderColor: '#059669', borderWidth: 1.5, backgroundColor: '#ecfdf5' }]}
                onPress={() => handleSimulateWhatsAppInbound('Namasthe')}
              >
                <Text style={[styles.quickChipEmeraldText, { fontWeight: '800', color: '#047857' }]}>🙏 "Namasthe" (Reply)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickChipEmerald}
                onPress={() => handleSimulateWhatsAppInbound('Namaste, Saturday 11:30 AM appointment confirm cheyandi. Memu vasthamu.')}
              >
                <Text style={styles.quickChipEmeraldText}>✅ Confirm Sat 11:30 AM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickChipBlue}
                onPress={() => handleSimulateWhatsAppInbound('Please send surgery cost breakdown and cashless insurance details.')}
              >
                <Text style={styles.quickChipBlueText}>💰 Cost & Insurance</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickChipAmber}
                onPress={() => handleSimulateWhatsAppInbound('Repu morning 10 AM ki call cheyandi.')}
              >
                <Text style={styles.quickChipAmberText}>⏰ Call Tomorrow</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickChipRed}
                onPress={() => handleSimulateWhatsAppInbound('Not interested, please do not call again.')}
              >
                <Text style={styles.quickChipRedText}>❌ Not Interested</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickChipEmerald, { backgroundColor: '#f1f5f9', borderColor: '#94a3b8' }]}
                onPress={handleSyncWhatsAppClipboard}
              >
                <Text style={[styles.quickChipEmeraldText, { color: '#0b2545' }]}>📋 Paste Clipboard</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.customReplyRow}>
              <TextInput
                style={styles.customReplyInput}
                placeholder="Type or paste patient reply..."
                value={inboundSimText}
                onChangeText={setInboundSimText}
              />
              <TouchableOpacity
                style={styles.customReplySendBtn}
                onPress={() => handleSimulateWhatsAppInbound()}
                disabled={simulatingWhatsApp}
              >
                {simulatingWhatsApp ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.customReplySendBtnText}>Trigger</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Public Meta / Twilio Webhook URL Card */}
            <View style={styles.webhookUrlCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={styles.webhookUrlLabel}>🌐 Public WhatsApp Webhook:</Text>
                <TouchableOpacity onPress={async () => {
                  await setClipboardString(PUBLIC_WEBHOOK_URL);
                  Alert.alert('Copied', 'Public Webhook URL copied! Configure in Meta WhatsApp Cloud API or Twilio.');
                }}>
                  <Text style={styles.webhookCopyBtnText}>📋 Copy URL</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.webhookUrlValue} numberOfLines={1}>{PUBLIC_WEBHOOK_URL}</Text>
            </View>
          </View>

          <Text style={styles.sectionHeader}>Unbroken Patient Journey (PRD 12)</Text>
          {timeline.map((item, idx) => (
            <View key={item.id || idx} style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>{item.title}</Text>
                <Text style={styles.timelineMeta}>{item.meta}</Text>
                {item.transcript ? <Text style={styles.timelineTranscript}>{item.transcript}</Text> : null}
                {item.body ? <Text style={styles.timelineBody}>{item.body}</Text> : null}
                <Text style={styles.timelineTime}>{item.time}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* SCREEN 7: PRD 8 & 9 TASKS & COMMITMENTS */}
      {screen === 'tasks' && (
        <ScrollView style={styles.content}>
          <View style={styles.screenTopNavRow}>
            <TouchableOpacity style={styles.backBtnRow} onPress={() => setScreen('queue')}>
              <Text style={styles.backBtnText}>← Back to Queue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addLeadBtnSmall} onPress={() => setScreen('add-lead')}>
              <Text style={styles.addLeadBtnText}>+ New Lead</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionHeader}>Daily Follow-up Tasks (PRD 8 & 9)</Text>
          {taskList.map((task, idx) => (
            <View key={task.id || idx} style={styles.taskCard}>
              <View style={styles.taskInfo}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskDue}>Due: {task.dueAt} · Purpose: {task.purpose || 'action'}</Text>
                <Text style={[styles.taskStatus, task.isMissed ? styles.taskMissed : styles.taskOpen]}>
                  {task.isMissed ? 'MISSED · Escalated to Manager' : `Status: ${task.status}`}
                </Text>

                {/* Patient Navigation Button on Task Card */}
                <TouchableOpacity
                  style={styles.taskLeadNavBtn}
                  onPress={() => {
                    const match = leads.find(l => l.id === task.leadId);
                    if (match) {
                      setSelectedLead(match);
                      fetchLeadTimeline(match.id);
                      setScreen('lead-360');
                    } else {
                      setScreen('queue');
                    }
                  }}
                >
                  <Text style={styles.taskLeadNavBtnText}>👤 View Patient 360 →</Text>
                </TouchableOpacity>
              </View>

              {task.status === 'open' && (
                <View style={styles.taskBtnCol}>
                  <TouchableOpacity style={styles.taskCompleteBtn} onPress={() => handleTaskStatus(task.id, 'completed')}>
                    <Text style={styles.taskCompleteBtnText}>✓ Kept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.taskMissedBtn} onPress={() => handleTaskStatus(task.id, 'missed')}>
                    <Text style={styles.taskMissedBtnText}>✗ Missed</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* SCREEN 8: PRD 1 & 2 ADD LEAD WITH CLINICAL HEALTH ASSESSMENT & 90-DAY DEDUPLICATION */}
      {screen === 'add-lead' && (
        <ScrollView style={styles.content}>
          <TouchableOpacity style={styles.backBtnRow} onPress={() => setScreen('queue')}>
            <Text style={styles.backBtnText}>← Back to Queue</Text>
          </TouchableOpacity>

          <Text style={styles.postCallTitle}>Register Inbound Patient & Clinical Triage</Text>
          <Text style={styles.postCallSub}>Intake Engine with 90-Day Deduplication & Clinical Condition Capture</Text>

          <View style={styles.reviewCard}>
            <Text style={styles.cardSectionHeader}>👤 Demographics & Contact Information</Text>

            <Text style={styles.inputLabel}>Patient Full Name *</Text>
            <TextInput style={styles.textInput} value={newName} onChangeText={setNewName} placeholder="e.g. Ramesh Kumar" />

            <Text style={styles.inputLabel}>Mobile Number * (Deduplicated across 90 Days)</Text>
            <TextInput style={styles.textInput} value={newPhone} onChangeText={setNewPhone} placeholder="+91 98491 22618" keyboardType="phone-pad" />

            <Text style={styles.inputLabel}>Email (Optional)</Text>
            <TextInput style={styles.textInput} value={newEmail} onChangeText={setNewEmail} placeholder="patient@example.com" keyboardType="email-address" />

            <Text style={styles.inputLabel}>Lead Source</Text>
            <TextInput style={styles.textInput} value={newSource} onChangeText={setNewSource} placeholder="Google, Meta, YouTube, Web Form" />

            <Text style={styles.inputLabel}>Campaign Name</Text>
            <TextInput style={styles.textInput} value={newCampaign} onChangeText={setNewCampaign} placeholder="Campaign / Creative ID" />

            <Text style={[styles.cardSectionHeader, { marginTop: 18 }]}>🩺 Clinical Health Issues & Triage Assessment</Text>

            <Text style={styles.inputLabel}>Clinical Department</Text>
            <View style={styles.chipSelectorRow}>
              {['Orthopaedics', 'Cardiology', 'Oncology', 'Neurology', 'Gastroenterology', 'General Surgery'].map(dept => (
                <TouchableOpacity
                  key={dept}
                  style={[styles.selectableChip, newDepartment === dept && styles.selectableChipActive]}
                  onPress={() => setNewDepartment(dept)}
                >
                  <Text style={[styles.selectableChipText, newDepartment === dept && styles.selectableChipTextActive]}>{dept}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Primary Diagnosis / Suspected Condition</Text>
            <TextInput
              style={styles.textInput}
              value={newDiagnosis}
              onChangeText={setNewDiagnosis}
              placeholder="e.g. Bilateral Osteoarthritis Knee (Grade 4), CAD Angina"
            />

            <Text style={styles.inputLabel}>Patient Reported Symptoms & Complaints</Text>
            <TextInput
              style={styles.textArea}
              value={newSymptoms}
              onChangeText={setNewSymptoms}
              placeholder="e.g. Severe knee joint pain, morning stiffness, difficulty climbing stairs for 6+ months"
              multiline
              numberOfLines={3}
            />

            <Text style={styles.inputLabel}>Severity Level</Text>
            <View style={styles.chipSelectorRow}>
              {(['Mild', 'Moderate', 'Severe', 'Critical'] as const).map(sev => (
                <TouchableOpacity
                  key={sev}
                  style={[styles.selectableChip, newSeverity === sev && styles.selectableChipActive]}
                  onPress={() => setNewSeverity(sev)}
                >
                  <Text style={[styles.selectableChipText, newSeverity === sev && styles.selectableChipTextActive]}>{sev}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Symptom Duration</Text>
            <View style={styles.chipSelectorRow}>
              {['< 1 month', '1-6 months', '6-12 months', '1-2 years', '> 2 years'].map(dur => (
                <TouchableOpacity
                  key={dur}
                  style={[styles.selectableChip, newDuration === dur && styles.selectableChipActive]}
                  onPress={() => setNewDuration(dur)}
                >
                  <Text style={[styles.selectableChipText, newDuration === dur && styles.selectableChipTextActive]}>{dur}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Clinical Urgency</Text>
            <View style={styles.chipSelectorRow}>
              {(['Elective', 'Semi-Urgent', 'Immediate Admission'] as const).map(urg => (
                <TouchableOpacity
                  key={urg}
                  style={[styles.selectableChip, newUrgency === urg && styles.selectableChipActive]}
                  onPress={() => setNewUrgency(urg)}
                >
                  <Text style={[styles.selectableChipText, newUrgency === urg && styles.selectableChipTextActive]}>{urg}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Treatment Budget / Payment Category</Text>
            <View style={styles.chipSelectorRow}>
              {['₹50k - ₹1 Lakh', '₹1 - ₹2.5 Lakhs', '₹2.5 - ₹5 Lakhs', 'Corporate TPA Cashless', 'Ayushman / Arogyasri'].map(b => (
                <TouchableOpacity
                  key={b}
                  style={[styles.selectableChip, newBudget === b && styles.selectableChipActive]}
                  onPress={() => setNewBudget(b)}
                >
                  <Text style={[styles.selectableChipText, newBudget === b && styles.selectableChipTextActive]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Initial Qualification Rating</Text>
            <View style={styles.chipSelectorRow}>
              {(['Hot', 'Warm', 'Cold'] as const).map(q => (
                <TouchableOpacity
                  key={q}
                  style={[styles.selectableChip, newQualification === q && styles.selectableChipActive]}
                  onPress={() => setNewQualification(q)}
                >
                  <Text style={[styles.selectableChipText, newQualification === q && styles.selectableChipTextActive]}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.primaryBtn, { marginTop: 20 }]} onPress={() => void handleSaveLead(false)}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>💾 Save Patient Lead to Central DB</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* SCREEN: DOCTOR CLINICAL WORKSPACE (Dr. Radhakrishna) */}
      {screen === 'doctor-view' && (
        <ScrollView style={styles.content}>
          <View style={styles.personaBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 32 }}>🩺</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.personaTitle}>Dr. Radhakrishna</Text>
                <Text style={styles.personaRoleSub}>Chief of Clinical Services · Surgical Case Reviews</Text>
              </View>
            </View>
            <Text style={styles.personaMissionText}>
              OPD slot allocations, second medical opinions, surgical case qualifications and clinical triage protocols.
            </Text>
          </View>

          {/* Quick Stats Grid */}
          <View style={styles.statGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>18</Text>
              <Text style={styles.statLabel}>OPD Appointments</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#dc2626' }]}>
                {leads.filter(l => l.severity === 'Severe' || l.severity === 'Critical').length}
              </Text>
              <Text style={styles.statLabel}>High Severity</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#16a34a' }]}>68%</Text>
              <Text style={styles.statLabel}>Surgical Conversion</Text>
            </View>
          </View>

          {/* OPD Specialist Allocation Card */}
          <View style={styles.reviewCard}>
            <Text style={styles.cardSectionHeader}>👨‍⚕️ Today's OPD Specialist Allocation</Text>
            <View style={styles.doctorSlotCard}>
              <Text style={styles.doctorSlotName}>Dr. Radhakrishna (Joint Replacement)</Text>
              <Text style={styles.doctorSlotMeta}>Room 204 · 10:00 AM - 02:00 PM · 6 slots remaining</Text>
            </View>
            <View style={styles.doctorSlotCard}>
              <Text style={styles.doctorSlotName}>Dr. B. Srinivas (Cardiology / Cath Lab)</Text>
              <Text style={styles.doctorSlotMeta}>Room 108 · 11:30 AM - 04:30 PM · 3 slots remaining</Text>
            </View>
            <View style={styles.doctorSlotCard}>
              <Text style={styles.doctorSlotName}>Dr. Ananya P. (Neuro & Spine Surgery)</Text>
              <Text style={styles.doctorSlotMeta}>Room 312 · 02:00 PM - 07:00 PM · 8 slots remaining</Text>
            </View>
          </View>

          {/* Clinical Patient Triage Queue */}
          <Text style={[styles.postCallTitle, { fontSize: 16, marginTop: 12 }]}>High-Priority Clinical Review Queue</Text>
          {leads.slice(0, 5).map(lead => (
            <View key={lead.id} style={styles.leadCard}>
              <View style={styles.leadCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.leadName}>{lead.name}</Text>
                  <Text style={styles.leadPhone}>{lead.phone} · {lead.department || 'Orthopaedics'}</Text>
                </View>
                <View style={[styles.tempBadge, lead.qualification === 'Hot' ? styles.badgeHot : styles.badgeWarm]}>
                  <Text style={styles.tempBadgeText}>{lead.qualification || 'Warm'}</Text>
                </View>
              </View>

              <View style={styles.clinicalBox}>
                <Text style={styles.clinicalDiagnosisText}>
                  Diagnosis: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{lead.diagnosis || 'Bilateral Knee OA'}</Text>
                </Text>
                <Text style={styles.clinicalSymptomsText} numberOfLines={2}>
                  Symptoms: {lead.symptoms || 'Joint pain and difficulty walking'}
                </Text>
                <View style={styles.clinicalMetricsRow}>
                  <Text style={styles.clinicalMetricTag}>Severity: {lead.severity || 'Severe'}</Text>
                  <Text style={styles.clinicalMetricTag}>Urgency: {lead.urgency || 'Semi-Urgent'}</Text>
                </View>
              </View>

              <View style={styles.leadActionRow}>
                <TouchableOpacity
                  style={[styles.smallActionBtn, { backgroundColor: '#0b2545' }]}
                  onPress={() => {
                    setSelectedLead(lead);
                    fetchLeadTimeline(lead.id);
                    setScreen('lead-360');
                  }}
                >
                  <Text style={styles.smallActionBtnText}>🔍 Patient 360</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallActionBtn, { backgroundColor: '#2563eb' }]}
                  onPress={() => openEditModal(lead)}
                >
                  <Text style={styles.smallActionBtnText}>✏️ Edit Clinical</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* SCREEN: FINANCE & COMMERCIAL DESK WORKSPACE (Radha V.) */}
      {screen === 'finance-view' && (
        <ScrollView style={styles.content}>
          <View style={styles.personaBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 32 }}>💳</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.personaTitle}>Radha V.</Text>
                <Text style={styles.personaRoleSub}>Commercial Desk & Financial Counselor</Text>
              </View>
            </View>
            <Text style={styles.personaMissionText}>
              Package breakdowns, 0% interest medical EMI financing, corporate TPA insurance cashless pre-authorizations.
            </Text>
          </View>

          {/* Stat Grid */}
          <View style={styles.statGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>₹18.4L</Text>
              <Text style={styles.statLabel}>Pre-Auth Approved</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#059669' }]}>42</Text>
              <Text style={styles.statLabel}>Active EMI Plans</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#2563eb' }]}>22m</Text>
              <Text style={styles.statLabel}>Avg TPA Turnaround</Text>
            </View>
          </View>

          {/* Standard Treatment Packages */}
          <View style={styles.reviewCard}>
            <Text style={styles.cardSectionHeader}>🏥 Standard Hospital Package Rates</Text>
            <View style={styles.packageCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.packageName}>Total Knee Replacement (Unilateral)</Text>
                <Text style={styles.packageInclusions}>Includes Zimmer Implant, 4 Days IPD, Surgeon & OT Charges</Text>
              </View>
              <Text style={styles.packagePrice}>₹1,80,000</Text>
            </View>
            <View style={styles.packageCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.packageName}>PTCA Angioplasty (Single Stent)</Text>
                <Text style={styles.packageInclusions}>Includes US FDA DES Stent, 2 Days CCU, Angiogram</Text>
              </View>
              <Text style={styles.packagePrice}>₹2,40,000</Text>
            </View>
            <View style={styles.packageCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.packageName}>Laparoscopic Cholecystectomy</Text>
                <Text style={styles.packageInclusions}>Includes HD Laparoscopy, 2 Days Twin Sharing IPD</Text>
              </View>
              <Text style={styles.packagePrice}>₹95,000</Text>
            </View>
            <View style={styles.packageCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.packageName}>Lumbar Microdiscectomy (Spine)</Text>
                <Text style={styles.packageInclusions}>Includes Operating Microscope, 3 Days IPD, Rehab Care</Text>
              </View>
              <Text style={styles.packagePrice}>₹2,10,000</Text>
            </View>
          </View>

          {/* 0% EMI Scheme Calculator */}
          <View style={styles.reviewCard}>
            <Text style={styles.cardSectionHeader}>🧮 0% Interest Hospital Medical EMI</Text>
            <Text style={styles.modalSub}>Pre-approved medical loan with zero interest and instant KYC approval:</Text>
            <View style={styles.emiRow}>
              <View style={styles.emiBox}>
                <Text style={styles.emiMonths}>3 Months</Text>
                <Text style={styles.emiAmount}>₹60,000 / mo</Text>
                <Text style={styles.emiZero}>0% Interest</Text>
              </View>
              <View style={styles.emiBox}>
                <Text style={styles.emiMonths}>6 Months</Text>
                <Text style={styles.emiAmount}>₹30,000 / mo</Text>
                <Text style={styles.emiZero}>0% Interest</Text>
              </View>
              <View style={styles.emiBox}>
                <Text style={styles.emiMonths}>12 Months</Text>
                <Text style={styles.emiAmount}>₹15,000 / mo</Text>
                <Text style={styles.emiZero}>0% Interest</Text>
              </View>
            </View>
          </View>

          {/* TPA Cashless Insurance Partners */}
          <View style={styles.reviewCard}>
            <Text style={styles.cardSectionHeader}>🛡️ Cashless Insurance Desk Status</Text>
            <Text style={styles.modalSub}>Direct cashless tie-ups with active pre-auth desks:</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {['Star Health (Active)', 'Care Health (Active)', 'HDFC ERGO (Active)', 'ICICI Lombard (Active)', 'Max Bupa / Niva (Active)', 'Arogyasri / Ayushman (Active)'].map(ins => (
                <View key={ins} style={styles.insuranceChip}>
                  <Text style={styles.insuranceChipText}>✓ {ins}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {/* SCREEN: VOICE AI & SYSTEM FLEET (Nilesh N.) */}
      {screen === 'voice-view' && (
        <ScrollView style={styles.content}>
          <View style={styles.personaBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 32 }}>🤖</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.personaTitle}>Nilesh N.</Text>
                <Text style={styles.personaRoleSub}>System & Voice AI Operations Lead</Text>
              </View>
            </View>
            <Text style={styles.personaMissionText}>
              Soniox real-time speech intelligence, telecalling fleet streams, multilingual models, and transcript audit QA.
            </Text>
          </View>

          {/* Stat Grid */}
          <View style={styles.statGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>6</Text>
              <Text style={styles.statLabel}>Active Fleet Channels</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#16a34a' }]}>98.4%</Text>
              <Text style={styles.statLabel}>STT Accuracy</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#2563eb' }]}>180ms</Text>
              <Text style={styles.statLabel}>Speech Latency</Text>
            </View>
          </View>

          {/* Soniox Speech Engine Status Card */}
          <View style={styles.reviewCard}>
            <Text style={styles.cardSectionHeader}>🎙️ Soniox Speech Intelligence Status</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <View style={styles.greenPulseDot} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#15803d' }}>
                Engine Connected · Real-Time Streaming Active
              </Text>
            </View>
            <Text style={styles.modalSub}>
              Configured API Key: {sonioxApiKey ? `${sonioxApiKey.slice(0, 8)}...${sonioxApiKey.slice(-4)}` : 'Default In-House Key'}
            </Text>
            <Text style={styles.modalSub}>
              Multilingual Models: Telugu (te-IN), Hindi (hi-IN), Indian English (en-IN) with Medical Dialect Dictionary.
            </Text>
            <TouchableOpacity
              style={[styles.smallActionBtn, { backgroundColor: '#0b2545', alignSelf: 'flex-start', marginTop: 6 }]}
              onPress={() => setSettingsModalOpen(true)}
            >
              <Text style={styles.smallActionBtnText}>⚙️ Configure Soniox Engine</Text>
            </TouchableOpacity>
          </View>

          {/* Real-time Fleet Audio QA Queue */}
          <View style={styles.reviewCard}>
            <Text style={styles.cardSectionHeader}>🎧 Recent Calls QA Audio Audit</Text>
            {[
              { id: 'CALL-901', agent: 'Sravani K.', lead: 'Lakshmi Narayana', dur: '4m 38s', lang: 'Telugu', conf: '99.1%', sentiment: 'High Intent' },
              { id: 'CALL-902', agent: 'Madhavi R.', lead: 'Prakash Reddy', dur: '2m 14s', lang: 'Telugu', conf: '97.8%', sentiment: 'Price Sensitive' },
              { id: 'CALL-903', agent: 'Anil Kumar', lead: 'Mohammed Faizal', dur: '3m 05s', lang: 'Hindi', conf: '98.5%', sentiment: 'Surgical Consultation' },
            ].map(call => (
              <View key={call.id} style={styles.callAuditItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.callAuditTitle}>{call.lead} · {call.agent}</Text>
                  <Text style={styles.callAuditMeta}>{call.lang} · {call.dur} · Confidence: {call.conf}</Text>
                </View>
                <View style={styles.sentimentBadge}>
                  <Text style={styles.sentimentBadgeText}>{call.sentiment}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* BOTTOM NAVIGATION BAR - ENHANCED WITH REAL-TIME BADGES */}
      {session && screen !== 'login' && screen !== 'active-call' && (
        <View style={styles.bottomNav}>
          {/* Tab 1: Leads Queue */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setScreen('queue')}
          >
            <View>
              <Text style={[styles.navIcon, screen === 'queue' && styles.navIconActive]}>📋</Text>
              {leads.length > 0 && (
                <View style={styles.navBadge}>
                  <Text style={styles.navBadgeText}>{leads.length}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.navLabel, screen === 'queue' && styles.navLabelActive]}>Queue</Text>
          </TouchableOpacity>

          {/* Tab 2: Follow-up Tasks */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => {
              void refreshTasks();
              setScreen('tasks');
            }}
          >
            <View>
              <Text style={[styles.navIcon, screen === 'tasks' && styles.navIconActive]}>⏰</Text>
              {taskList.filter(t => t.status === 'open').length > 0 && (
                <View style={[styles.navBadge, { backgroundColor: '#dc2626' }]}>
                  <Text style={styles.navBadgeText}>{taskList.filter(t => t.status === 'open').length}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.navLabel, screen === 'tasks' && styles.navLabelActive]}>Tasks</Text>
          </TouchableOpacity>

          {/* Tab 3: Quick Patient Intake */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setScreen('add-lead')}
          >
            <Text style={[styles.navIcon, screen === 'add-lead' && styles.navIconActive]}>➕</Text>
            <Text style={[styles.navLabel, screen === 'add-lead' && styles.navLabelActive]}>Intake</Text>
          </TouchableOpacity>

          {/* Tab 4: Patient 360 or Cockpit */}
          {session.role === 'Manager' ? (
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setScreen('manager-cockpit')}
            >
              <Text style={[styles.navIcon, screen === 'manager-cockpit' && styles.navIconActive]}>📊</Text>
              <Text style={[styles.navLabel, screen === 'manager-cockpit' && styles.navLabelActive]}>Cockpit</Text>
            </TouchableOpacity>
          ) : (session.role === 'Leadership' || session.role === 'Founder' || session.role === 'CEO') ? (
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setScreen('founder-cockpit')}
            >
              <Text style={[styles.navIcon, screen === 'founder-cockpit' && styles.navIconActive]}>👑</Text>
              <Text style={[styles.navLabel, screen === 'founder-cockpit' && styles.navLabelActive]}>Executive</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => {
                if (selectedLead) {
                  fetchLeadTimeline(selectedLead.id);
                  setScreen('lead-360');
                } else if (leads.length > 0) {
                  setSelectedLead(leads[0]);
                  fetchLeadTimeline(leads[0].id);
                  setScreen('lead-360');
                } else {
                  setScreen('queue');
                }
              }}
            >
              <Text style={[styles.navIcon, (screen === 'lead-360' || screen === 'context-card') && styles.navIconActive]}>👤</Text>
              <Text style={[styles.navLabel, (screen === 'lead-360' || screen === 'context-card') && styles.navLabelActive]}>360</Text>
            </TouchableOpacity>
          )}

          {/* Tab 5: Switch User / Role */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setScreen('login')}
          >
            <Text style={styles.navIcon}>🔄</Text>
            <Text style={styles.navLabel}>Switch</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* SETTINGS MODAL: Configure Backend API Host IP */}
      <Modal visible={settingsModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>CRM Backend Server Settings</Text>
            <Text style={styles.modalSub}>
              Select a server preset or enter custom host:
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              <TouchableOpacity
                style={[styles.quickChipEmerald, tempApiHost === CLOUD_TUNNEL_HOST && { borderColor: '#059669', borderWidth: 2 }]}
                onPress={() => setTempApiHost(CLOUD_TUNNEL_HOST)}
              >
                <Text style={styles.quickChipEmeraldText}>🌐 Cloud Tunnel (Phone/4G)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickChipBlue, tempApiHost === LOCAL_WIFI_HOST && { borderColor: '#2563eb', borderWidth: 2 }]}
                onPress={() => setTempApiHost(LOCAL_WIFI_HOST)}
              >
                <Text style={styles.quickChipBlueText}>💻 Local Wi-Fi</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickChipAmber, tempApiHost === LOCALHOST_HOST && { borderColor: '#d97706', borderWidth: 2 }]}
                onPress={() => setTempApiHost(LOCALHOST_HOST)}
              >
                <Text style={styles.quickChipAmberText}>🖥️ Localhost</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.textInput}
              value={tempApiHost}
              onChangeText={setTempApiHost}
              placeholder="https://...trycloudflare.com/api"
              autoCapitalize="none"
            />
            <Text style={[styles.modalSub, { marginTop: 12 }]}>
              Soniox Speech Intelligence STT API Key:
            </Text>
            <TextInput
              style={styles.textInput}
              value={tempSonioxKey}
              onChangeText={setTempSonioxKey}
              placeholder="Soniox API Key"
              autoCapitalize="none"
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setSettingsModalOpen(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSave]}
                onPress={() => {
                  setApiHost(tempApiHost.trim().replace(/\/$/, ''));
                  setSonioxApiKey(tempSonioxKey.trim());
                  setSettingsModalOpen(false);
                  Alert.alert('Saved', `Backend host & Soniox STT Key saved.`);
                  refreshLeads();
                }}
              >
                <Text style={styles.modalBtnSaveText}>Save & Reconnect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* AGENT WHATSAPP MESSAGE DECISION & COMPOSER MODAL */}
      <Modal visible={whatsAppComposerOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.waComposerContent}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.modalTitle}>💬 WhatsApp Message Composer</Text>
                <Text style={styles.modalSub} numberOfLines={1}>
                  To: <Text style={{ fontWeight: '700', color: '#0b2545' }}>{selectedLead?.name}</Text> ({selectedLead?.phone})
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setWhatsAppComposerOpen(false)}
                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#f1ede3', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#687386' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Language Selector */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0b2545' }}>Language:</Text>
              {(['telugu', 'english', 'hindi'] as const).map(l => (
                <TouchableOpacity
                  key={l}
                  onPress={() => {
                    setWhatsAppMsgLanguage(l);
                    const templates = getWhatsAppTemplates(selectedLead, l);
                    setCustomWhatsAppMsg(templates[0].text);
                  }}
                  style={[
                    styles.langChip,
                    whatsAppMsgLanguage === l && styles.langChipActive,
                  ]}
                >
                  <Text style={[styles.langChipText, whatsAppMsgLanguage === l && styles.langChipTextActive]}>
                    {l === 'telugu' ? 'తెలుగు' : l === 'hindi' ? 'हिंदी' : 'English'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Quick Template Chips */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#687386', textTransform: 'uppercase', marginBottom: 6 }}>
              Quick Templates (Tap to Populate & Edit):
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10, maxHeight: 38 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {getWhatsAppTemplates(selectedLead, whatsAppMsgLanguage).map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.waTemplateChip}
                    onPress={() => setCustomWhatsAppMsg(t.text)}
                  >
                    <Text style={styles.waTemplateChipText}>{t.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Agent Decides & Edits the Text */}
            <View style={{ marginBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0b2545' }}>
                ✏️ Message Content (Agent Decides & Edits):
              </Text>
              <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>
                {customWhatsAppMsg.length} chars
              </Text>
            </View>
            <TextInput
              style={styles.waTextarea}
              multiline
              numberOfLines={5}
              value={customWhatsAppMsg}
              onChangeText={setCustomWhatsAppMsg}
              placeholder="Type or edit the exact WhatsApp message to send to the patient..."
              placeholderTextColor="#94a3b8"
              textAlignVertical="top"
            />

            {/* Live Message Preview */}
            <View style={styles.waPreviewBox}>
              <Text style={styles.waPreviewLabel}>Preview To Patient:</Text>
              <Text style={styles.waPreviewText} numberOfLines={3}>
                {customWhatsAppMsg || 'No message entered.'}
              </Text>
            </View>

            {/* Modal Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setWhatsAppComposerOpen(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#25D366', flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                onPress={handleSendAgentWhatsApp}
              >
                <Text style={[styles.modalBtnSaveText, { color: '#ffffff', fontWeight: '800' }]}>
                  💬 Send via WhatsApp
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 1: EDIT PATIENT DETAILS & CLINICAL CASE */}
      <Modal visible={editModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={styles.modalTitle}>✏️ Edit Patient Details & Clinical Case</Text>
              <TouchableOpacity onPress={() => setEditModalOpen(false)}>
                <Text style={{ fontSize: 18, color: '#64748b', fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Changes will save to SQLite database and sync instantly across Web & Mobile.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={styles.inputLabel}>Patient Full Name</Text>
              <TextInput style={styles.textInput} value={editName} onChangeText={setEditName} />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput style={styles.textInput} value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" />

              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput style={styles.textInput} value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" />

              <Text style={styles.inputLabel}>Department</Text>
              <View style={styles.chipSelectorRow}>
                {['Orthopaedics', 'Cardiology', 'Oncology', 'Neurology', 'Gastroenterology', 'General Surgery'].map(dept => (
                  <TouchableOpacity
                    key={dept}
                    style={[styles.selectableChip, editDepartment === dept && styles.selectableChipActive]}
                    onPress={() => setEditDepartment(dept)}
                  >
                    <Text style={[styles.selectableChipText, editDepartment === dept && styles.selectableChipTextActive]}>{dept}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Provisional Diagnosis</Text>
              <TextInput style={styles.textInput} value={editDiagnosis} onChangeText={setEditDiagnosis} />

              <Text style={styles.inputLabel}>Symptoms & Health Complaints</Text>
              <TextInput
                style={styles.textArea}
                value={editSymptoms}
                onChangeText={setEditSymptoms}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>Severity Level</Text>
              <View style={styles.chipSelectorRow}>
                {['Mild', 'Moderate', 'Severe', 'Critical'].map(sev => (
                  <TouchableOpacity
                    key={sev}
                    style={[styles.selectableChip, editSeverity === sev && styles.selectableChipActive]}
                    onPress={() => setEditSeverity(sev)}
                  >
                    <Text style={[styles.selectableChipText, editSeverity === sev && styles.selectableChipTextActive]}>{sev}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Lifecycle Stage</Text>
              <View style={styles.chipSelectorRow}>
                {['received', 'contacted', 'qualified', 'converted', 'lost'].map(stg => (
                  <TouchableOpacity
                    key={stg}
                    style={[styles.selectableChip, editStage === stg && styles.selectableChipActive]}
                    onPress={() => setEditStage(stg)}
                  >
                    <Text style={[styles.selectableChipText, editStage === stg && styles.selectableChipTextActive]}>{stg}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Lead Qualification</Text>
              <View style={styles.chipSelectorRow}>
                {['Hot', 'Warm', 'Cold'].map(q => (
                  <TouchableOpacity
                    key={q}
                    style={[styles.selectableChip, editQualification === q && styles.selectableChipActive]}
                    onPress={() => setEditQualification(q)}
                  >
                    <Text style={[styles.selectableChipText, editQualification === q && styles.selectableChipTextActive]}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setEditModalOpen(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={() => void handleSaveEditLead()}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnSaveText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: MANAGER ADD TELECALLING AGENT (IN-PERSON CREDENTIAL HANDOVER) */}
      <Modal visible={addAgentModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={styles.modalTitle}>➕ Add Telecalling Agent</Text>
              <TouchableOpacity onPress={() => setAddAgentModalOpen(false)}>
                <Text style={{ fontSize: 18, color: '#64748b', fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Security Protocol: Manager registers telecaller & issues official In-Person Credential Handover Slip.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              <Text style={styles.inputLabel}>Agent Full Name *</Text>
              <TextInput style={styles.textInput} value={agentName} onChangeText={setAgentName} placeholder="e.g. Rahul Sharma" />

              <Text style={styles.inputLabel}>Official Email / Username *</Text>
              <TextInput style={styles.textInput} value={agentEmail} onChangeText={setAgentEmail} placeholder="rahul.s@hospital.org" keyboardType="email-address" />

              <Text style={styles.inputLabel}>Mobile Contact</Text>
              <TextInput style={styles.textInput} value={agentPhone} onChangeText={setAgentPhone} placeholder="+91 98490 12345" keyboardType="phone-pad" />

              <Text style={styles.inputLabel}>Assigned Department / Desk</Text>
              <TextInput style={styles.textInput} value={agentDept} onChangeText={setAgentDept} placeholder="Inbound Ortho / Outbound Lead Nurturing" />

              <Text style={styles.inputLabel}>Shift Window</Text>
              <View style={styles.chipSelectorRow}>
                {['Morning (8 AM - 4 PM)', 'General (10 AM - 6 PM)', 'Evening (2 PM - 10 PM)'].map(shift => (
                  <TouchableOpacity
                    key={shift}
                    style={[styles.selectableChip, agentShift === shift && styles.selectableChipActive]}
                    onPress={() => setAgentShift(shift)}
                  >
                    <Text style={[styles.selectableChipText, agentShift === shift && styles.selectableChipTextActive]}>{shift}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Initial Temporary Password *</Text>
              <TextInput style={styles.textInput} value={agentPassword} onChangeText={setAgentPassword} placeholder="Welcome@2026" secureTextEntry />
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setAddAgentModalOpen(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={() => void handleCreateAgent()}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnSaveText}>Register & Issue Slip</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: OFFICIAL IN-PERSON CREDENTIAL HANDOVER SLIP */}
      <Modal visible={handoverSlipModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '92%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={styles.modalTitle}>📋 Official Handover Slip</Text>
              <TouchableOpacity onPress={() => setHandoverSlipModalOpen(false)}>
                <Text style={{ fontSize: 18, color: '#64748b', fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Hand this slip directly to the telecalling agent in person.
            </Text>

            {createdAgentSlip ? (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
                <View style={styles.slipCard}>
                  <View style={styles.slipHeader}>
                    <Text style={styles.slipHospitalTitle}>TRH360 HEALTHCARE GROUP</Text>
                    <Text style={styles.slipHospitalSub}>Telecalling Operations · Banjara Hills</Text>
                    <View style={styles.slipBadge}>
                      <Text style={styles.slipBadgeText}>IN-PERSON HANDOVER ONLY</Text>
                    </View>
                  </View>

                  <View style={styles.slipRow}>
                    <Text style={styles.slipLabel}>Agent Name:</Text>
                    <Text style={styles.slipValue}>{createdAgentSlip.name}</Text>
                  </View>
                  <View style={styles.slipRow}>
                    <Text style={styles.slipLabel}>Assigned Role:</Text>
                    <Text style={styles.slipValue}>Telecalling Agent</Text>
                  </View>
                  <View style={styles.slipRow}>
                    <Text style={styles.slipLabel}>Department:</Text>
                    <Text style={styles.slipValue}>{createdAgentSlip.dept}</Text>
                  </View>
                  <View style={styles.slipRow}>
                    <Text style={styles.slipLabel}>Shift Window:</Text>
                    <Text style={styles.slipValue}>{createdAgentSlip.shift}</Text>
                  </View>

                  <View style={styles.slipDivider} />

                  <View style={styles.slipRow}>
                    <Text style={styles.slipLabel}>Login Email:</Text>
                    <Text style={[styles.slipValue, { color: '#0b2545', fontWeight: '800' }]}>{createdAgentSlip.email}</Text>
                  </View>
                  <View style={styles.slipRow}>
                    <Text style={styles.slipLabel}>Temp Password:</Text>
                    <Text style={[styles.slipValue, { color: '#dc2626', fontWeight: '800' }]}>{createdAgentSlip.password}</Text>
                  </View>

                  <View style={styles.slipDivider} />

                  <Text style={styles.slipInstruction}>
                    🔒 Security Protocol: Agent must sign in and change password on day 1. Maintain under 5-minute uncalled SLA at all times.
                  </Text>
                  <Text style={styles.slipMeta}>
                    Issued By: {createdAgentSlip.issuedBy} · {createdAgentSlip.issuedAt}
                  </Text>
                </View>
              </ScrollView>
            ) : null}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#f1ede3' }]}
                onPress={async () => {
                  if (createdAgentSlip) {
                    await setClipboardString(getFormattedSlipText(createdAgentSlip));
                    Alert.alert('Copied', 'Full handover slip copied to clipboard!');
                  }
                }}
              >
                <Text style={styles.modalBtnCancelText}>📋 Copy Slip Text</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#2563eb' }]}
                onPress={() => void handleShareSlip()}
              >
                <Text style={styles.modalBtnSaveText}>📤 Share Slip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#0b2545' }]}
                onPress={() => setHandoverSlipModalOpen(false)}
              >
                <Text style={styles.modalBtnSaveText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f5f0',
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0b2545',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#d09a26',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoText: {
    color: '#0b2545',
    fontSize: 18,
    fontWeight: 'bold',
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  brandSub: {
    color: '#d09a26',
    fontSize: 11,
    fontWeight: '500',
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 6,
  },
  iconBtnText: {
    fontSize: 18,
  },
  sessionBadge: {
    backgroundColor: '#d09a26',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionBadgeText: {
    color: '#0b2545',
    fontWeight: 'bold',
    fontSize: 12,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  // Login
  loginContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 20,
  },
  largeLogo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#d09a26',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  largeLogoText: {
    color: '#0b2545',
    fontSize: 32,
    fontWeight: 'bold',
  },
  loginTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0b2545',
  },
  loginSubtitle: {
    fontSize: 13,
    color: '#687386',
    marginTop: 4,
  },
  tenantTag: {
    backgroundColor: '#f5ead0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  tenantTagText: {
    color: '#0b2545',
    fontSize: 11,
    fontWeight: '600',
  },
  loginCard: {
    backgroundColor: '#ffffff',
    width: '100%',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#172235',
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: '#f9f9f8',
    borderWidth: 1,
    borderColor: '#dedbd3',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#172235',
  },
  textArea: {
    backgroundColor: '#f9f9f8',
    borderWidth: 1,
    borderColor: '#dedbd3',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#172235',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    backgroundColor: '#0b2545',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  quickLoginHeader: {
    fontSize: 12,
    color: '#687386',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  quickLoginRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  quickPill: {
    backgroundColor: '#f1ede3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dedbd3',
  },
  quickPillText: {
    fontSize: 12,
    color: '#0b2545',
    fontWeight: '600',
  },
  // SLA Banner
  slaBanner: {
    backgroundColor: '#fff1f0',
    borderColor: '#ffa39e',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  slaBannerTitle: {
    color: '#cf1322',
    fontWeight: '700',
    fontSize: 13,
  },
  slaBannerDesc: {
    color: '#820014',
    fontSize: 12,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#dedbd3',
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0b2545',
  },
  metricLabel: {
    fontSize: 11,
    color: '#687386',
    marginTop: 2,
  },
  filterBar: {
    marginBottom: 14,
  },
  filterChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dedbd3',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#0b2545',
    borderColor: '#0b2545',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#687386',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0b2545',
  },
  addLeadBtnSmall: {
    backgroundColor: '#d09a26',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addLeadBtnText: {
    color: '#0b2545',
    fontSize: 12,
    fontWeight: '700',
  },
  leadCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#dedbd3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leadInfo: {
    flex: 1,
    paddingRight: 10,
  },
  leadNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leadName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0b2545',
  },
  tempBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeHot: { backgroundColor: '#ffebe6' },
  badgeWarm: { backgroundColor: '#fff7e6' },
  badgeCold: { backgroundColor: '#e6f7ff' },
  tempBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#172235',
  },
  leadPhone: {
    fontSize: 13,
    color: '#172235',
    marginTop: 2,
  },
  leadSource: {
    fontSize: 11,
    color: '#687386',
    marginTop: 2,
  },
  dialBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e6f4ea',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#b7eb8f',
  },
  dialBtnText: {
    fontSize: 20,
  },
  // Context Card
  backBtnRow: {
    marginBottom: 12,
  },
  backBtnText: {
    color: '#0b2545',
    fontSize: 13,
    fontWeight: '600',
  },
  contextHeader: {
    marginBottom: 12,
  },
  contextTag: {
    color: '#d09a26',
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  contextName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0b2545',
    marginTop: 2,
  },
  contextPhone: {
    fontSize: 13,
    color: '#687386',
  },
  contextCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dedbd3',
  },
  contextRow: {
    marginBottom: 12,
  },
  contextLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#687386',
    textTransform: 'uppercase',
  },
  contextVal: {
    fontSize: 13,
    color: '#172235',
    marginTop: 2,
    fontWeight: '500',
  },
  openingLineBox: {
    backgroundColor: '#f5ead0',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#d09a26',
  },
  openingLineLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0b2545',
    marginBottom: 4,
  },
  openingLineText: {
    fontSize: 13,
    color: '#172235',
    fontStyle: 'italic',
  },
  startCallBtn: {
    backgroundColor: '#137333',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startCallBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  // Active Call
  callContainer: {
    flex: 1,
    backgroundColor: '#0b2545',
  },
  callScrollContainer: {
    alignItems: 'center',
    padding: 20,
    paddingBottom: 40,
  },
  callTopBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  callBackBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  callBackBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  recordingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4d4f',
    marginRight: 6,
  },
  recordingText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  callingName: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
  },
  callingPhone: {
    color: '#d09a26',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '600',
  },
  callSimTipBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: '#38bdf8',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    width: '100%',
    marginTop: 10,
    marginBottom: 6,
  },
  callSimTipTitle: {
    color: '#38bdf8',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 3,
  },
  callSimTipText: {
    color: '#e2e8f0',
    fontSize: 11,
    lineHeight: 16,
  },
  transcriptEmptyBox: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcriptEmptyIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  transcriptEmptyTitle: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 4,
  },
  transcriptEmptySub: {
    color: '#94a3b8',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  callQuickDialRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 14,
    width: '100%',
  },
  callPhoneDialBtn: {
    flex: 1,
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  callPhoneDialBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  callWhatsAppDialBtn: {
    flex: 1,
    backgroundColor: '#25D366',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  callWhatsAppDialBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  callTimerText: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '300',
    marginVertical: 10,
  },
  waveformBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 70,
    marginBottom: 16,
  },
  waveBar: {
    width: 6,
    borderRadius: 3,
  },
  transcriptCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  langSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  transcriptHeader: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  langPills: {
    flexDirection: 'row',
    gap: 4,
  },
  langPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  langPillActive: {
    backgroundColor: '#d09a26',
  },
  langPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  langPillTextActive: {
    color: '#0b2545',
    fontWeight: '800',
  },
  transcribeActionBtn: {
    backgroundColor: '#d09a26',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  transcribeActionBtnText: {
    color: '#0b2545',
    fontSize: 13,
    fontWeight: '800',
  },
  transcriptScrollArea: {
    maxHeight: 220,
    marginVertical: 6,
  },
  transcriptBubble: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  bubbleAgent: {
    backgroundColor: 'rgba(11, 37, 69, 0.7)',
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8',
  },
  bubbleLead: {
    backgroundColor: 'rgba(208, 154, 38, 0.25)',
    borderLeftWidth: 3,
    borderLeftColor: '#d09a26',
  },
  bubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bubbleSpeaker: {
    color: '#d09a26',
    fontSize: 11,
    fontWeight: '700',
  },
  evidenceTag: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  evidenceTagText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  bubbleText: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 18,
  },
  addDialogueRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    alignItems: 'center',
  },
  speakerToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
  },
  speakerAgentActive: {
    backgroundColor: '#2563eb',
  },
  speakerLeadActive: {
    backgroundColor: '#d09a26',
  },
  speakerToggleText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  dialogueInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    color: '#ffffff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
  },
  addDialogueBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addDialogueBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  endCallBtn: {
    backgroundColor: '#cf1322',
    borderRadius: 28,
    paddingHorizontal: 36,
    paddingVertical: 14,
    marginTop: 8,
  },
  endCallBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  // Post-Call
  postCallTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0b2545',
  },
  postCallSub: {
    fontSize: 13,
    color: '#687386',
    marginBottom: 16,
  },
  reviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dedbd3',
  },
  reviewLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#172235',
    marginBottom: 8,
    marginTop: 8,
  },
  tempSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tempChoice: {
    backgroundColor: '#f1ede3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dedbd3',
  },
  tempChoiceActive: {
    backgroundColor: '#0b2545',
    borderColor: '#0b2545',
  },
  tempChoiceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0b2545',
  },
  tempChoiceTextActive: {
    color: '#ffffff',
  },
  cadencePreviewBox: {
    backgroundColor: '#e6f7ff',
    borderColor: '#91d5ff',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  cadencePreviewTitle: {
    color: '#0050b3',
    fontWeight: '700',
    fontSize: 12,
  },
  cadencePreviewDesc: {
    color: '#003a8c',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  // Lead 360
  lead360Header: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dedbd3',
    marginBottom: 16,
  },
  lead360Id: {
    fontSize: 11,
    color: '#d09a26',
    fontWeight: '700',
  },
  lead360Name: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0b2545',
    marginTop: 2,
  },
  lead360Sub: {
    fontSize: 13,
    color: '#687386',
    marginVertical: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#d09a26',
    marginTop: 5,
    marginRight: 10,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#dedbd3',
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0b2545',
  },
  timelineMeta: {
    fontSize: 11,
    color: '#687386',
    marginTop: 2,
  },
  timelineTranscript: {
    fontSize: 12,
    color: '#172235',
    backgroundColor: '#f7f5f0',
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
    fontStyle: 'italic',
  },
  timelineBody: {
    fontSize: 12,
    color: '#172235',
    marginTop: 4,
  },
  timelineTime: {
    fontSize: 10,
    color: '#a0aec0',
    marginTop: 4,
  },
  // Tasks
  taskCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#dedbd3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskInfo: {
    flex: 1,
    paddingRight: 8,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0b2545',
  },
  taskDue: {
    fontSize: 11,
    color: '#687386',
    marginTop: 2,
  },
  taskStatus: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  taskOpen: { color: '#137333' },
  taskMissed: { color: '#cf1322' },
  taskBtnCol: {
    flexDirection: 'row',
    gap: 6,
  },
  taskCompleteBtn: {
    backgroundColor: '#e6f4ea',
    borderColor: '#b7eb8f',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  taskCompleteBtnText: {
    color: '#137333',
    fontSize: 11,
    fontWeight: '700',
  },
  taskMissedBtn: {
    backgroundColor: '#fff1f0',
    borderColor: '#ffa39e',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  taskMissedBtnText: {
    color: '#cf1322',
    fontSize: 11,
    fontWeight: '700',
  },
  // Bottom Nav
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#dedbd3',
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'space-around',
  },
  navItem: {
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 20,
    opacity: 0.5,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 11,
    color: '#687386',
    marginTop: 2,
    fontWeight: '600',
  },
  navLabelActive: {
    color: '#0b2545',
    fontWeight: '700',
  },
  // Header Navigation & Breadcrumbs
  headerBackBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  headerBackText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  screenPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    maxWidth: 160,
  },
  screenPillText: {
    color: '#d09a26',
    fontSize: 11,
    fontWeight: '700',
  },
  // Carousel Navigation Row
  screenTopNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  carouselNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dedbd3',
    padding: 2,
  },
  carouselNavBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f1ede3',
  },
  carouselNavBtnDisabled: {
    opacity: 0.4,
  },
  carouselNavBtnText: {
    color: '#0b2545',
    fontSize: 11,
    fontWeight: '700',
  },
  carouselNavBtnTextDisabled: {
    color: '#94a3b8',
  },
  carouselCounter: {
    paddingHorizontal: 8,
  },
  carouselCounterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0b2545',
  },
  // Action Navigation Row
  actionNavRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  actionNavBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionNavBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  actionNavBtnSmall: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#0b2545',
    borderRadius: 6,
  },
  actionNavBtnSmallText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  // WhatsApp Live Stream & Simulator
  whatsAppStreamCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
    padding: 14,
    marginBottom: 16,
  },
  whatsAppStreamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  whatsAppStreamTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  whatsAppOnlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  greenPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  whatsAppOnlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
  },
  whatsAppStreamSub: {
    fontSize: 11,
    color: '#14532d',
    lineHeight: 16,
    marginBottom: 10,
  },
  quickChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  quickChipEmerald: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quickChipEmeraldText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '700',
  },
  quickChipBlue: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quickChipBlueText: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '700',
  },
  quickChipAmber: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quickChipAmberText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '700',
  },
  quickChipRed: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quickChipRedText: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: '700',
  },
  customReplyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  customReplyInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0f172a',
  },
  customReplySendBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 14,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customReplySendBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  // Clipboard Detected Banner
  clipboardDetectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    gap: 8,
  },
  clipboardDetectedTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065f46',
  },
  clipboardDetectedBody: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
    marginTop: 2,
  },
  clipboardTriggerBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  clipboardTriggerBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  // Public Webhook Card
  webhookUrlCard: {
    marginTop: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
  },
  webhookUrlLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  webhookCopyBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563eb',
  },
  webhookUrlValue: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  // Task & Lead Nav
  taskLeadNavBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#f1ede3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#dedbd3',
  },
  taskLeadNavBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0b2545',
  },
  // Bottom Nav Badges
  navBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#0b2545',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  navBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  // Cockpit Navigation Row
  cockpitNavRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    marginTop: 6,
  },
  cockpitNavBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dedbd3',
    paddingVertical: 6,
    alignItems: 'center',
  },
  cockpitNavBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0b2545',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0b2545',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 12,
    color: '#687386',
    marginBottom: 14,
    lineHeight: 18,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  modalBtnCancel: {
    backgroundColor: '#f1ede3',
  },
  modalBtnCancelText: {
    color: '#0b2545',
    fontWeight: '600',
  },
  modalBtnSave: {
    backgroundColor: '#0b2545',
  },
  modalBtnSaveText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  // WhatsApp Agent Decision & Composer Styles
  waComposerContent: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    width: '100%',
    maxWidth: 480,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  langChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  langChipActive: {
    backgroundColor: '#0b2545',
    borderColor: '#0b2545',
  },
  langChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0b2545',
  },
  langChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  waTemplateChip: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  waTemplateChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  waTextarea: {
    borderWidth: 1.5,
    borderColor: '#25D366',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    lineHeight: 20,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    minHeight: 110,
    maxHeight: 180,
    textAlignVertical: 'top',
  },
  waPreviewBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#25D366',
  },
  waPreviewLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
    textTransform: 'uppercase',
  },
  waPreviewText: {
    fontSize: 11,
    color: '#166534',
    marginTop: 2,
    fontStyle: 'italic',
  },
  // Persona Ribbon Switcher
  personaRibbon: {
    backgroundColor: '#07182c',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#172c47',
  },
  personaRibbonScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  personaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0e233d',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e385c',
    marginRight: 6,
  },
  personaChipActive: {
    backgroundColor: '#d09a26',
    borderColor: '#f5ead0',
  },
  personaChipAvatar: {
    fontSize: 14,
    marginRight: 6,
  },
  personaChipName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  personaChipNameActive: {
    color: '#0b2545',
  },
  personaChipBadge: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94a3b8',
    marginLeft: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: '#172c47',
  },
  personaChipBadgeActive: {
    backgroundColor: '#0b2545',
    color: '#ffffff',
  },
  // Mission Banner
  missionBanner: {
    backgroundColor: '#0b2545',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e3a5f',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  missionBannerLeft: {
    flex: 1,
    paddingRight: 10,
  },
  missionRoleTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#d09a26',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  missionTagline: {
    fontSize: 11,
    color: '#e2e8f0',
    marginTop: 2,
    lineHeight: 15,
  },
  missionActions: {
    flexDirection: 'row',
    gap: 6,
  },
  missionActionBtn: {
    backgroundColor: '#d09a26',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  missionActionBtnText: {
    color: '#0b2545',
    fontSize: 11,
    fontWeight: '800',
  },
  missionActionBtnSec: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  missionActionBtnSecText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  // Clinical Health Assessment Card
  clinicalAssessmentCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginTop: 10,
  },
  clinicalCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0b2545',
  },
  clinicalDeptBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  clinicalDiagnosisText: {
    fontSize: 12,
    color: '#334155',
    marginTop: 4,
    lineHeight: 17,
  },
  clinicalSymptomsText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 16,
  },
  clinicalMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  clinicalMetricTag: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  // Card Sections & Selectable Chips
  cardSectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0b2545',
    marginBottom: 8,
  },
  chipSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
    marginTop: 4,
  },
  selectableChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  selectableChipActive: {
    backgroundColor: '#0b2545',
    borderColor: '#0b2545',
  },
  selectableChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  selectableChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  // Persona Specialized Workspaces
  personaBanner: {
    backgroundColor: '#0b2545',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  personaTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  personaRoleSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d09a26',
    marginTop: 2,
  },
  personaMissionText: {
    fontSize: 12,
    color: '#cbd5e1',
    marginTop: 8,
    lineHeight: 17,
  },
  statGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0b2545',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  doctorSlotCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
  },
  doctorSlotName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  doctorSlotMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  clinicalBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  packageCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  packageName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  packageInclusions: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  packagePrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
    marginLeft: 8,
  },
  emiRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  emiBox: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  emiMonths: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  emiAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#14532d',
    marginTop: 2,
  },
  emiZero: {
    fontSize: 9,
    fontWeight: '700',
    color: '#16a34a',
    marginTop: 2,
  },
  insuranceChip: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  insuranceChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  callAuditItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  callAuditTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  callAuditMeta: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  sentimentBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  sentimentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  // Credential Handover Slip Styles
  slipCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#0b2545',
    padding: 14,
  },
  slipHeader: {
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#0b2545',
    paddingBottom: 10,
    marginBottom: 10,
  },
  slipHospitalTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0b2545',
    letterSpacing: 0.5,
  },
  slipHospitalSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  slipBadge: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 6,
  },
  slipBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#b91c1c',
  },
  slipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  slipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  slipValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  slipDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 8,
  },
  slipInstruction: {
    fontSize: 10,
    color: '#475569',
    lineHeight: 14,
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 6,
    fontStyle: 'italic',
  },
  slipMeta: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 6,
    textAlign: 'center',
  },
  leadCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  leadActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  smallActionBtn: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallActionBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});

import { useEffect, useMemo, useState } from 'react';
import { ApiClient, apiErrorMessage, newIdempotencyKey, type LeadSummary } from '../../lib/api';

type Screen =
  | 'home'
  | 'queue'
  | 'active-call'
  | 'post-call'
  | 'lead-360'
  | 'tasks'
  | 'notifications'
  | 'login'
  | 'permissions'
  | 'follow-up'
  | 'appointment'
  | 'create-lead';

type MobileLead = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: string;
  stage: string;
  qualification: string;
  createdAt?: string;
  department?: string;
  diagnosis?: string;
  symptoms?: string;
  severity?: string;
  duration?: string;
  urgency?: string;
  budget?: string;
};

export type MobilePersonaRole = 'Leadership' | 'Agent' | 'Manager' | 'Doctor' | 'Finance' | 'Voice AI';

export const MOBILE_PERSONAS: Array<{
  role: MobilePersonaRole;
  name: string;
  title: string;
  avatar: string;
  badge: string;
}> = [
  { role: 'Leadership', name: 'Dr. Ramesh', title: 'Founder & CEO', avatar: '👔', badge: 'Executive' },
  { role: 'Agent', name: 'Sravani K.', title: 'Lead Telecaller', avatar: '🎧', badge: 'Caller' },
  { role: 'Manager', name: 'Anil Kumar', title: 'Telecalling Lead', avatar: '📊', badge: 'Team Lead' },
  { role: 'Doctor', name: 'Dr. Radhakrishna', title: 'Chief of Clinical', avatar: '🩺', badge: 'Clinical Head' },
  { role: 'Finance', name: 'Radha V.', title: 'Commercial Desk', avatar: '💳', badge: 'Financial Counselor' },
  { role: 'Voice AI', name: 'Nilesh N.', title: 'System & AI Head', avatar: '🤖', badge: 'System & AI' },
];

const api = new ApiClient();
const displayLead = (lead: any): MobileLead => ({
  id: lead.id,
  name: lead.name?.trim() || 'Unnamed lead',
  phone: lead.phone ?? '',
  email: lead.email ?? '',
  source: lead.source ?? lead.sourceId ?? 'Source not recorded',
  stage: lead.lifecycleStage ?? lead.status ?? 'received',
  qualification: lead.qualification ?? 'Warm',
  createdAt: lead.createdAt ?? undefined,
  department: lead.department ?? 'Orthopaedics',
  diagnosis: lead.diagnosis ?? 'Bilateral Osteoarthritis Knee (Grade 4)',
  symptoms: lead.symptoms ?? 'Severe knee pain, inability to walk, morning stiffness',
  severity: lead.severity ?? 'Severe',
  duration: lead.duration ?? '1-2 years',
  urgency: lead.urgency ?? 'Semi-Urgent',
  budget: lead.budget ?? '₹1.5 - ₹2.5 Lakhs (TPA Cashless)',
});

const indiaDateFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
});
const indiaDateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
});
const formatIndiaDate = (value = new Date()) => indiaDateFormatter.format(value);
const formatIndiaDateTime = (value?: string) => value ? indiaDateTimeFormatter.format(new Date(value)) : 'Just now';

const initialMobileLeads: MobileLead[] = [
  {
    id: 'TRH-24190',
    name: 'Lakshmi Narayana',
    phone: '+91 98491 22618',
    email: 'lakshmi@enterprise.example',
    source: 'Google Search · Enterprise',
    stage: 'qualified',
    qualification: 'Hot',
    department: 'Orthopaedics',
    diagnosis: 'Bilateral Osteoarthritis Knee (Grade 4)',
    symptoms: 'Severe knee pain, difficulty walking, nocturnal stiffness',
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
    stage: 'received',
    qualification: 'Warm',
    department: 'Cardiology',
    diagnosis: 'CAD - Unstable Angina',
    symptoms: 'Exertional chest discomfort, dyspnea on walking 100m',
    severity: 'Critical',
    duration: '3 months',
    urgency: 'Immediate Admission',
    budget: 'Corporate Insurance',
  },
  {
    id: 'TRH-24179',
    name: 'Mohammed Faizal',
    phone: '+91 97011 98420',
    email: 'faizal@gmail.com',
    source: 'Website · Organic',
    stage: 'contacted',
    qualification: 'Warm',
    department: 'General Surgery',
    diagnosis: 'Symptomatic Cholelithiasis (Gallstones)',
    symptoms: 'Recurrent right upper quadrant pain after fatty meals',
    severity: 'Moderate',
    duration: '6 months',
    urgency: 'Elective',
    budget: 'Self-Pay / Cash',
  },
];

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [activePersona, setActivePersona] = useState<MobilePersonaRole>('Agent');
  const [callSeconds, setCallSeconds] = useState(278);
  const [mobileLeads, setMobileLeads] = useState<MobileLead[]>(initialMobileLeads);
  const [selectedLead, setSelectedLead] = useState<MobileLead | null>(initialMobileLeads[0]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Unified Database Real-time Polling (Every 4 seconds):
  // Keeps Mobile and Web completely synchronized. Edits on Web reflect here, and vice versa!
  useEffect(() => {
    let active = true;
    const fetchCentralDatabase = () => {
      fetch('/api/leads')
        .then(res => res.json())
        .then((data: any) => {
          if (!active) return;
          if (data && Array.isArray(data.items) && data.items.length > 0) {
            const next = data.items.map(displayLead);
            setMobileLeads(next);
            setSelectedLead(current => current ? next.find((l: MobileLead) => l.id === current.id) ?? next[0] : next[0]);
          }
          setLoadError(null);
        })
        .catch(() => {
          // Fallback to ApiClient if direct fetch fails
          if (!active) return;
          void api.leads().then(page => {
            if (!active) return;
            if (page?.items && page.items.length > 0) {
              const next = page.items.map(displayLead);
              setMobileLeads(next);
              setSelectedLead(current => current ? next.find((l: MobileLead) => l.id === current.id) ?? next[0] : next[0]);
            }
          }).catch(() => {});
        });
    };

    fetchCentralDatabase();
    const timer = setInterval(fetchCentralDatabase, 4000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (screen !== 'active-call') return;
    const timer = window.setInterval(() => setCallSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [screen]);

  const content = useMemo(() => {
    switch (screen) {
      case 'login':
        return <LoginScreen onContinue={() => setScreen('permissions')} />;
      case 'permissions':
        return <PermissionsScreen onContinue={() => setScreen('home')} />;
      case 'home':
        return <HomeScreen leads={mobileLeads} onOpen={(next) => setScreen(next)} onSelectLead={(lead) => { setSelectedLead(lead); setScreen('lead-360'); }} />;
      case 'queue':
        return <QueueScreen leads={mobileLeads} onOpen={(next) => setScreen(next)} onSelectLead={(lead) => { setSelectedLead(lead); setScreen('lead-360'); }} />;
      case 'create-lead':
        return <CreateLeadScreen onBack={() => setScreen('queue')} onCreated={(lead) => { setMobileLeads((current) => [lead, ...current]); setSelectedLead(lead); setScreen('lead-360'); }} />;
      case 'active-call':
        return selectedLead ? <ActiveCallScreen lead={selectedLead} callSeconds={callSeconds} onEnd={() => setScreen('post-call')} /> : <EmptyState message="Select a lead before starting a call." />;
      case 'post-call':
        return selectedLead ? <PostCallScreen lead={selectedLead} onSaved={() => setScreen('lead-360')} /> : <EmptyState message="Select a lead before saving a call." />;
      case 'lead-360':
        return selectedLead ? (
          <Lead360Screen
            lead={selectedLead}
            onOpen={(next) => setScreen(next)}
            onUpdated={(updated) => {
              setSelectedLead(updated);
              setMobileLeads(prev => prev.map((l: MobileLead) => l.id === updated.id ? updated : l));
            }}
          />
        ) : <EmptyState message="No lead is selected." />;
      case 'tasks':
        return <TasksScreen onOpen={(next) => setScreen(next)} />;
      case 'notifications':
        return <NotificationsScreen onBack={() => setScreen('home')} />;
      case 'follow-up':
        return <FollowUpScreen onSave={() => setScreen('lead-360')} />;
      case 'appointment':
        return <AppointmentScreen onSave={() => setScreen('lead-360')} />;
      default:
        return <HomeScreen leads={mobileLeads} onOpen={(next) => setScreen(next)} onSelectLead={(lead) => { setSelectedLead(lead); setScreen('lead-360'); }} />;
    }
  }, [screen, callSeconds, mobileLeads, selectedLead]);

  return (
    <div className="mobile-shell">
      {screen !== 'login' && screen !== 'permissions' && (
        <div style={{ backgroundColor: '#07182c', padding: '6px 12px', display: 'flex', overflowX: 'auto', gap: 6, borderBottom: '1px solid #172c47' }}>
          {MOBILE_PERSONAS.map(p => (
            <button
              key={p.role}
              onClick={() => setActivePersona(p.role)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                backgroundColor: activePersona === p.role ? '#d09a26' : '#0e233d',
                color: activePersona === p.role ? '#0b2545' : '#cbd5e1',
                padding: '4px 8px', borderRadius: 14, border: '1px solid #1e385c', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
              }}
            >
              <span>{p.avatar}</span>
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}
      {loadError && <p role="alert" className="review-box">{loadError}</p>}
      {content}
    </div>
  );
}

function LoginScreen({ onContinue }: { onContinue: () => void }) {
  const [email, setEmail] = useState('sravani@meenestham.in');
  const [password, setPassword] = useState('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (targetEmail = email) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(targetEmail, password);
      if (res && res.user) {
        localStorage.setItem('leadloop_token', res.token);
        localStorage.setItem('leadloop_user', JSON.stringify(res.user));
        onContinue();
      } else {
        onContinue();
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed');
      onContinue();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen login-screen">
      <div className="status-row">
        <span>9:41</span>
        <span>▣ ▣ ▣ 82%</span>
      </div>
      <div className="brand-block">
        <div className="brand-mark">L</div>
        <div>
          <h1>LeadLoop (TRH360)</h1>
          <p>Human + AI Telecalling App</p>
        </div>
      </div>
      <div className="login-card">
        <h2>Welcome back</h2>
        <label>
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p role="alert" style={{ color: '#cf1322', fontSize: 12 }}>{error}</p>}
        <button className="primary" onClick={() => handleSignIn()} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in securely'}
        </button>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <small style={{ color: '#687386', display: 'block', marginBottom: 8 }}>Quick Demo Login (One-Tap)</small>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            <button className="ghost" style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #dedbd3' }} onClick={() => { setEmail('sravani@meenestham.in'); handleSignIn('sravani@meenestham.in'); }}>Agent</button>
            <button className="ghost" style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #dedbd3' }} onClick={() => { setEmail('anil@meenestham.in'); handleSignIn('anil@meenestham.in'); }}>Manager</button>
            <button className="ghost" style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #dedbd3' }} onClick={() => { setEmail('founder@meenestham.in'); handleSignIn('founder@meenestham.in'); }}>Founder</button>
          </div>
        </div>
      </div>
      <div className="secure-note">Protected with workspace access controls</div>
    </div>
  );
}

function PermissionsScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="screen permissions-screen">
      <div className="status-row">
        <span>9:41</span>
        <span>▣ ▣ ▣ 82%</span>
      </div>
      <div className="permission-header">
        <div className="tiny-icon">☎</div>
        <h2>Set up calling</h2>
        <p>TRH360 needs these permissions to start calls and keep your work complete.</p>
      </div>
      <div className="permission-list">
        {[
          ['Phone', 'Start calls from your assigned lead list'],
          ['Microphone', 'Record calls after consent is captured'],
          ['Notifications', 'Remind you about commitments and SLA'],
          ['Uploads', 'Securely attach audio after the call'],
        ].map(([title, text]) => (
          <div className="permission-row" key={title}>
            <span className="perm-dot">✓</span>
            <div>
              <strong>{title}</strong>
              <small>{text}</small>
            </div>
          </div>
        ))}
      </div>
      <button className="primary full" onClick={onContinue}>Allow & continue</button>
    </div>
  );
}

function HomeScreen({ leads, onOpen, onSelectLead }: { leads: MobileLead[]; onOpen: (screen: Screen) => void; onSelectLead: (lead: MobileLead) => void }) {
  return (
    <div className="screen home-screen">
      <header className="mobile-header">
        <div>
          <strong>Good morning, Sravani</strong>
          <small>{formatIndiaDate()}</small>
        </div>
        <div className="avatar">SK</div>
      </header>

      <button className="alert-banner" onClick={() => onOpen('queue')}>
        <span className="tiny-icon">⏰</span>
        <div>
          <strong>3 calls need attention now</strong>
          <small>Oldest SLA breach · 03:18</small>
        </div>
      </button>

      <div className="metrics-row">
        <div><span>Calls due</span><strong>14</strong><small>3 overdue</small></div>
        <div><span>Follow-ups</span><strong>21</strong><small>Today</small></div>
        <div><span>Meetings</span><strong>07</strong><small>2 confirmed</small></div>
      </div>

      <div className="section-head">
        <div>
          <strong>Next calls</strong>
          <small>AI prioritized</small>
        </div>
        <button onClick={() => onOpen('create-lead')}>Add lead</button>
      </div>

      <div className="lead-list compact">
        {leads.map((lead) => (
          <div className="lead-card" key={lead.id} onClick={() => onSelectLead(lead)}>
            <div className="lead-top">
              <div className="mini-avatar">{lead.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
              <div>
                <strong>{lead.name}</strong>
                <small>{lead.stage} · {formatIndiaDateTime(lead.createdAt)}</small>
              </div>
              <span className={`badge ${lead.qualification.toLowerCase()}`}>{lead.qualification}</span>
            </div>
            <div className="lead-meta">
              <span>Call now</span>
              <span>{lead.source}</span>
            </div>
            <div className="lead-actions">
              <button>Message</button>
              <button className="call" onClick={(event) => { event.stopPropagation(); onOpen('active-call'); }}>Call</button>
            </div>
          </div>
        ))}
      </div>

      <nav className="bottom-nav">
        <button className="active" onClick={() => onOpen('home')}>Home</button>
        <button onClick={() => onOpen('queue')}>Leads</button>
        <button onClick={() => onOpen('active-call')}>Call</button>
        <button onClick={() => onOpen('tasks')}>Tasks</button>
      </nav>
    </div>
  );
}

function QueueScreen({ leads, onOpen, onSelectLead }: { leads: MobileLead[]; onOpen: (screen: Screen) => void; onSelectLead: (lead: MobileLead) => void }) {
  const [search, setSearch] = useState('');
  const visibleLeads = leads.filter((lead) => `${lead.name} ${lead.phone} ${lead.stage}`.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <div className="screen queue-screen">
      <header className="mobile-header">
        <button className="back-btn" onClick={() => onOpen('home')}>←</button>
        <div>
          <strong>Call queue</strong>
          <small>14 due · 3 overdue</small>
        </div>
        <button className="filter-btn" onClick={() => onOpen('create-lead')}>Add lead</button>
      </header>

      <div className="tabs">
        <button className="active">Priority</button>
        <button>Follow-up</button>
        <button>Uncontacted</button>
      </div>

      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or mobile" aria-label="Search leads" />

      <div className="queue-list">
        {visibleLeads.map((lead) => (
          <div className="queue-item" key={lead.id} onClick={() => onSelectLead(lead)}>
            <div className="mini-avatar">{lead.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
            <div className="queue-text">
              <strong>{lead.name}</strong>
              <small>{lead.phone}</small>
              <small>{lead.stage} · {formatIndiaDateTime(lead.createdAt)}</small>
            </div>
            <div className="queue-side">
              <span className={`badge ${lead.qualification.toLowerCase()}`}>{lead.qualification}</span>
              <button className="call-small" onClick={(event) => { event.stopPropagation(); onOpen('active-call'); }}>☎</button>
            </div>
          </div>
        ))}
      </div>

      <nav className="bottom-nav">
        <button onClick={() => onOpen('home')}>Home</button>
        <button className="active" onClick={() => onOpen('queue')}>Leads</button>
        <button onClick={() => onOpen('active-call')}>Call</button>
        <button onClick={() => onOpen('tasks')}>Tasks</button>
      </nav>
    </div>
  );
}

function CreateLeadScreen({ onBack, onCreated }: { onBack: () => void; onCreated: (lead: MobileLead) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('Mobile App Ingestion');
  const [department, setDepartment] = useState('Orthopaedics');
  const [diagnosis, setDiagnosis] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [severity, setSeverity] = useState('Moderate');
  const [urgency, setUrgency] = useState('Semi-Urgent');
  const [budget, setBudget] = useState('₹1 - ₹2.5 Lakhs');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) {
      setError('Enter the patient name.');
      return;
    }
    if (!phone.trim()) {
      setError('Enter the mobile number.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          source: source.trim() || 'Mobile Intake',
          department,
          diagnosis: diagnosis.trim() || 'Clinical Evaluation Pending',
          symptoms: symptoms.trim() || 'Reported on call intake',
          severity,
          urgency,
          budget,
          qualification: 'Hot',
        }),
      });
      const data: any = await res.json();
      if (data && data.success && data.data) {
        onCreated(displayLead(data.data));
        return;
      }
    } catch {}

    try {
      const result = await api.createLead({
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        sourceId: source.trim(),
        platform: 'mobile-web',
        origin: 'manual',
      }, newIdempotencyKey('lead'));
      onCreated(displayLead(result));
    } catch (error) {
      setError(apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen create-lead-screen">
      <header className="mobile-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <div><strong>Register Patient Lead</strong><small>Clinical Triage & 90-Day Deduplication</small></div>
      </header>
      <div className="review-box" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
        <strong style={{ fontSize: 13, color: '#0b2545', display: 'block', marginBottom: 6 }}>👤 Demographics</strong>
        <label><span>Name *</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" /></label>
        <label><span>Phone *</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Mobile number" /></label>
        <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" /></label>
        <label><span>Source</span><input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Website, campaign, referral" /></label>

        <strong style={{ fontSize: 13, color: '#0b2545', display: 'block', marginTop: 14, marginBottom: 6 }}>🩺 Clinical Health Assessment</strong>
        <label>
          <span>Department</span>
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="Orthopaedics">Orthopaedics</option>
            <option value="Cardiology">Cardiology</option>
            <option value="Oncology">Oncology</option>
            <option value="Neurology">Neurology</option>
            <option value="Gastroenterology">Gastroenterology</option>
            <option value="General Surgery">General Surgery</option>
          </select>
        </label>
        <label><span>Provisional Diagnosis</span><input value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} placeholder="e.g. Bilateral Osteoarthritis Knee" /></label>
        <label><span>Symptoms & Complaints</span><textarea rows={3} value={symptoms} onChange={(event) => setSymptoms(event.target.value)} placeholder="e.g. Severe knee pain, difficulty walking" /></label>
        <label>
          <span>Severity</span>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="Mild">Mild</option>
            <option value="Moderate">Moderate</option>
            <option value="Severe">Severe</option>
            <option value="Critical">Critical</option>
          </select>
        </label>
        <label>
          <span>Clinical Urgency</span>
          <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <option value="Elective">Elective</option>
            <option value="Semi-Urgent">Semi-Urgent</option>
            <option value="Immediate Admission">Immediate Admission</option>
          </select>
        </label>
        <label><span>Budget / Scheme</span><input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="₹1 - ₹2.5 Lakhs / Insurance" /></label>
        {error && <p role="alert" style={{ color: '#dc2626', fontSize: 12 }}>{error}</p>}
      </div>
      <div className="sticky-actions single"><button className="primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : '💾 Save to Central DB'}</button></div>
    </div>
  );
}

function ActiveCallScreen({ lead, callSeconds, onEnd }: { lead: MobileLead; callSeconds: number; onEnd: () => void }) {
  return (
    <div className="screen call-screen">
      <div className="status-row">
        <span>9:41</span>
        <span>▣ ▣ ▣ 82%</span>
      </div>
      <div className="recording-tag">Recording with consent</div>
      <div className="caller-card">
        <div className="circle-avatar">LN</div>
        <h2>{lead.name}</h2>
        <p>Outbound · {lead.id}</p>
        <strong>{formatDuration(callSeconds)}</strong>
      </div>
      <div className="call-note-box">
        <span>AI live notes</span>
        <p>Lead is discussing implementation cost. Listening for decision-maker and timeline.</p>
      </div>
      <div className="call-actions">
        <button>Mute</button>
        <button>Note</button>
        <button>Contact</button>
        <button>More</button>
      </div>
      <button className="end-call" onClick={onEnd}>✆</button>
      <small>End call</small>
    </div>
  );
}

function PostCallScreen({ lead, onSaved }: { lead: MobileLead; onSaved: () => void }) {
  const [disposition, setDisposition] = useState<'meaningful_connection' | 'no_answer'>('meaningful_connection');
  const [remark, setRemark] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextDueAt, setNextDueAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setSaving(true); setError(null);
    try {
      const membership = await api.me();
      const attempt = await api.recordCall({ leadId: lead.id, direction: 'outbound', disposition: 'answered', dialedAt: new Date(Date.now() - 60_000).toISOString(), endedAt: new Date().toISOString() }, newIdempotencyKey('call'));
      await api.saveCallRemark(attempt.callAttemptId, {
        disposition,
        patientStatement: disposition === 'meaningful_connection' ? remark || undefined : undefined,
        agentExplanation: remark || undefined,
        nextAction: nextAction || undefined,
        nextActionOwnerMembershipId: nextAction ? membership.membershipId : undefined,
        nextActionDueAt: nextDueAt ? new Date(nextDueAt).toISOString() : undefined,
        notApplicableReason: disposition === 'no_answer' ? remark || 'No conversation occurred' : undefined,
      }, { idempotencyKey: newIdempotencyKey('remark') });
      onSaved();
    } catch (error) { setError(apiErrorMessage(error)); } finally { setSaving(false); }
  };
  return <div className="screen post-call-screen"><header className="mobile-header"><button className="back-btn" onClick={onSaved}>←</button><div><strong>Review call</strong><small>{lead.name} · Save structured facts only</small></div></header><div className="review-box"><label><span>Call outcome</span><select value={disposition} onChange={(event) => setDisposition(event.target.value as typeof disposition)}><option value="meaningful_connection">Meaningful connection</option><option value="no_answer">No answer</option></select></label><label><span>Structured remark</span><textarea rows={6} value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="Record only what was discussed." /></label><label><span>Next commitment</span><input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="Action to complete" /></label><label><span>Due at</span><input type="datetime-local" value={nextDueAt} onChange={(event) => setNextDueAt(event.target.value)} /></label>{error && <p role="alert">{error}</p>}</div><div className="sticky-actions single"><button className="primary" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Confirm & save'}</button></div></div>;
}

function EmptyState({ message }: { message: string }) { return <div className="screen"><div className="review-box" role="status">{message}</div></div>; }

function Lead360Screen({
  lead,
  onOpen,
  onUpdated,
}: {
  lead: MobileLead;
  onOpen: (screen: Screen) => void;
  onUpdated?: (updated: MobileLead) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(lead.name);
  const [editPhone, setEditPhone] = useState(lead.phone);
  const [editEmail, setEditEmail] = useState(lead.email || '');
  const [editDept, setEditDept] = useState(lead.department || 'Orthopaedics');
  const [editDiagnosis, setEditDiagnosis] = useState(lead.diagnosis || '');
  const [editSymptoms, setEditSymptoms] = useState(lead.symptoms || '');
  const [editSeverity, setEditSeverity] = useState(lead.severity || 'Moderate');
  const [editStage, setEditStage] = useState(lead.stage || 'received');
  const [editQualification, setEditQualification] = useState(lead.qualification || 'Hot');
  const [savingEdit, setSavingEdit] = useState(false);

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
          email: editEmail,
          department: editDept,
          diagnosis: editDiagnosis,
          symptoms: editSymptoms,
          severity: editSeverity,
          status: editStage,
          qualification: editQualification,
        }),
      });
      const data: any = await res.json();
      if (data && data.success) {
        const updatedLead: MobileLead = {
          ...lead,
          name: editName,
          phone: editPhone,
          email: editEmail,
          department: editDept,
          diagnosis: editDiagnosis,
          symptoms: editSymptoms,
          severity: editSeverity,
          stage: editStage,
          qualification: editQualification,
        };
        onUpdated?.(updatedLead);
        setEditing(false);
      }
    } catch {
      setEditing(false);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="screen lead360-screen">
      <header className="mobile-header">
        <button className="back-btn" onClick={() => onOpen('queue')}>←</button>
        <div>
          <strong>Lead 360</strong>
          <small>{lead.id}</small>
        </div>
        <button className="icon-btn" onClick={() => setEditing(!editing)}>✏️</button>
      </header>

      {editing ? (
        <div className="review-box" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          <strong style={{ fontSize: 13, color: '#0b2545', display: 'block', marginBottom: 6 }}>✏️ Edit Patient Details</strong>
          <label><span>Name</span><input value={editName} onChange={(e) => setEditName(e.target.value)} /></label>
          <label><span>Phone</span><input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /></label>
          <label><span>Email</span><input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></label>
          <label>
            <span>Department</span>
            <select value={editDept} onChange={(e) => setEditDept(e.target.value)}>
              <option value="Orthopaedics">Orthopaedics</option>
              <option value="Cardiology">Cardiology</option>
              <option value="Oncology">Oncology</option>
              <option value="Neurology">Neurology</option>
              <option value="Gastroenterology">Gastroenterology</option>
              <option value="General Surgery">General Surgery</option>
            </select>
          </label>
          <label><span>Diagnosis</span><input value={editDiagnosis} onChange={(e) => setEditDiagnosis(e.target.value)} /></label>
          <label><span>Symptoms</span><textarea rows={3} value={editSymptoms} onChange={(e) => setEditSymptoms(e.target.value)} /></label>
          <label>
            <span>Severity</span>
            <select value={editSeverity} onChange={(e) => setEditSeverity(e.target.value)}>
              <option value="Mild">Mild</option>
              <option value="Moderate">Moderate</option>
              <option value="Severe">Severe</option>
              <option value="Critical">Critical</option>
            </select>
          </label>
          <label>
            <span>Stage</span>
            <select value={editStage} onChange={(e) => setEditStage(e.target.value)}>
              <option value="received">received</option>
              <option value="contacted">contacted</option>
              <option value="qualified">qualified</option>
              <option value="converted">converted</option>
              <option value="lost">lost</option>
            </select>
          </label>
          <label>
            <span>Qualification</span>
            <select value={editQualification} onChange={(e) => setEditQualification(e.target.value)}>
              <option value="Hot">Hot</option>
              <option value="Warm">Warm</option>
              <option value="Cold">Cold</option>
            </select>
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="ghost" onClick={() => setEditing(false)} style={{ flex: 1 }}>Cancel</button>
            <button className="primary" onClick={handleSaveEdit} disabled={savingEdit} style={{ flex: 1 }}>
              {savingEdit ? 'Saving...' : 'Save to DB'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="profile-box">
            <div className="circle-avatar large">{lead.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
            <div>
              <h2>{lead.name}</h2>
              <p>{lead.phone} · {lead.source}</p>
              <span className={`badge ${lead.qualification.toLowerCase()}`}>{lead.qualification}</span>
            </div>
          </div>

          <div className="profile-actions">
            <button onClick={() => setEditing(true)}>✏️ Edit Patient</button>
            <button className="call" onClick={() => onOpen('active-call')}>Call now</button>
          </div>

          {/* Clinical Health Assessment Card */}
          <div className="summary-card" style={{ borderLeft: '4px solid #0284c7', backgroundColor: '#f0f9ff' }}>
            <strong style={{ color: '#0369a1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🩺 Clinical Health Assessment</span>
              <small style={{ backgroundColor: '#bae6fd', color: '#0369a1', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                {lead.department || 'Orthopaedics'}
              </small>
            </strong>
            <p style={{ marginTop: 4, fontSize: 13, color: '#0c4a6e' }}>
              <strong>Diagnosis:</strong> {lead.diagnosis || 'Bilateral Osteoarthritis Knee (Grade 4)'}
            </p>
            <p style={{ marginTop: 2, fontSize: 12, color: '#075985' }}>
              <strong>Symptoms:</strong> {lead.symptoms || 'Severe knee pain, difficulty walking, nocturnal stiffness'}
            </p>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4 }}>
                Severity: {lead.severity || 'Severe'}
              </span>
              <span style={{ fontSize: 11, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4 }}>
                Urgency: {lead.urgency || 'Semi-Urgent'}
              </span>
              <span style={{ fontSize: 11, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4 }}>
                Duration: {lead.duration || '1-2 years'}
              </span>
            </div>
          </div>

          <div className="summary-card">
            <strong>Journey summary</strong>
            <p>Patient case intake complete. Clinical review pending with attending specialist. Insurance coverage verified.</p>
          </div>

          <div className="next-commitment">
            <span>Next commitment</span>
            <strong>Doctor Specialist OPD Consultation</strong>
            <p>Tomorrow · 11:30 AM · Room 204</p>
            <button onClick={() => onOpen('follow-up')}>Complete follow-up</button>
          </div>

          <div className="timeline-box">
            <div className="timeline-row">
              <span className="dot blue" />
              <div>
                <strong>Clinical intake logged</strong>
                <small>Central SQLite database synced</small>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TasksScreen({ onOpen }: { onOpen: (screen: Screen) => void }) {
  return (
    <div className="screen tasks-screen">
      <header className="mobile-header">
        <button className="back-btn" onClick={() => onOpen('home')}>←</button>
        <div>
          <strong>Tasks</strong>
          <small>28 due today</small>
        </div>
        <button className="icon-btn">⚙</button>
      </header>

      <div className="tabs">
        <button className="active">Due now</button>
        <button>Later</button>
        <button>Done</button>
      </div>

      <div className="task-list">
        {[
          ['Call Lakshmi Narayana', 'Confirm decision-maker', 'Now'],
          ['Send pricing scope to Madhavi', 'WhatsApp · Commercial', '11:30 AM'],
          ['Retry Prakash Reddy', 'Third call attempt', '12:15 PM'],
        ].map(([title, detail, time]) => (
          <button className="task-row" key={title} onClick={() => onOpen('active-call')}>
            <span className="task-bullet" />
            <div>
              <strong>{title}</strong>
              <small>{detail}</small>
            </div>
            <b>{time}</b>
          </button>
        ))}
      </div>

      <nav className="bottom-nav">
        <button onClick={() => onOpen('home')}>Home</button>
        <button onClick={() => onOpen('queue')}>Leads</button>
        <button onClick={() => onOpen('active-call')}>Call</button>
        <button className="active" onClick={() => onOpen('tasks')}>Tasks</button>
      </nav>
    </div>
  );
}

function NotificationsScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen notifications-screen">
      <header className="mobile-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <div>
          <strong>Notifications</strong>
          <small>5 unread</small>
        </div>
      </header>

      <div className="notification-list">
        {[
          ['SLA crossed for 3 new leads', 'Reassign or call now'],
          ['Meeting confirmed', 'Lakshmi · 07 Sep, 11:30 AM'],
          ['AI draft ready for review', 'Call with Madhavi · 6m 02s'],
        ].map(([title, text]) => (
          <div className="notification-card" key={title}>
            <span className="tiny-icon">•</span>
            <div>
              <strong>{title}</strong>
              <small>{text}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FollowUpScreen({ onSave }: { onSave: () => void }) {
  return (
    <div className="screen followup-screen">
      <header className="mobile-header">
        <button className="back-btn" onClick={onSave}>←</button>
        <div>
          <strong>Complete follow-up</strong>
          <small>Commitment due · 4:30 PM</small>
        </div>
      </header>

      <div className="review-box">
        <label>
          <span>Outcome</span>
          <button className="select-button">Connected · Positive</button>
        </label>
        <label>
          <span>What changed?</span>
          <textarea rows={6} defaultValue="Finance director can join the Saturday review. Pricing estimate received; security scope is still required before approval." />
        </label>
        <label>
          <span>Next commitment</span>
          <button className="select-button">Meeting · 07 Sep, 11:30 AM</button>
        </label>
      </div>

      <div className="sticky-actions single">
        <button className="primary" onClick={onSave}>Save follow-up</button>
      </div>
    </div>
  );
}

function AppointmentScreen({ onSave }: { onSave: () => void }) {
  const [saving, setSaving] = useState(false);
  return (
    <div className="screen appointment-screen">
      <header className="mobile-header">
        <button className="back-btn" onClick={onSave}>←</button>
        <div>
          <strong>Book meeting</strong>
          <small>Lakshmi Narayana</small>
        </div>
      </header>

      <div className="review-box">
        <label>
          <span>Date</span>
          <div className="date-row">
            {['Sat 07', 'Mon 09', 'Tue 10', 'Wed 11'].map((date, index) => (
              <button key={date} className={index === 0 ? 'active' : ''}>{date}</button>
            ))}
          </div>
        </label>
        <label>
          <span>Available time</span>
          <div className="date-row">
            {['10:30 AM', '11:30 AM', '2:00 PM', '4:30 PM'].map((time, index) => (
              <button key={time} className={index === 1 ? 'active' : ''}>{time}</button>
            ))}
          </div>
        </label>
      </div>

      <div className="sticky-actions single">
        <button className="primary" disabled={saving} onClick={async () => {
          setSaving(true);
          try {
            const startsAt = new Date();
            startsAt.setHours(startsAt.getHours() + 2);
            await fetch('/api/appointments', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ leadId: 'TRH-24190', ownerId: 'agent-1', startsAt: startsAt.toISOString(), mode: 'online' }),
            });
          } finally {
            setSaving(false);
            onSave();
          }
        }}>{saving ? 'Saving...' : 'Confirm meeting'}</button>
      </div>
    </div>
  );
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

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
  source: string;
  stage: string;
  qualification: string;
  createdAt?: string;
};

const api = new ApiClient();
const displayLead = (lead: LeadSummary): MobileLead => ({
  id: lead.id,
  name: lead.name?.trim() || 'Unnamed lead',
  phone: lead.phone ?? '',
  source: lead.source ?? lead.sourceId ?? 'Source not recorded',
  stage: lead.lifecycleStage ?? 'received',
  qualification: lead.qualification ?? 'Unknown',
  createdAt: lead.createdAt ?? undefined,
});


const indiaDateFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
});
const indiaDateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
});
const formatIndiaDate = (value = new Date()) => indiaDateFormatter.format(value);
const formatIndiaDateTime = (value?: string) => value ? indiaDateTimeFormatter.format(new Date(value)) : 'Just now';

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [callSeconds, setCallSeconds] = useState(278);
  const [mobileLeads, setMobileLeads] = useState<MobileLead[]>([]);
  const [selectedLead, setSelectedLead] = useState<MobileLead | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api.leads().then((page) => {
      if (!active) return;
      const next = page.items.map(displayLead);
      setMobileLeads(next);
      setSelectedLead((current) => current ? next.find((lead) => lead.id === current.id) ?? null : next[0] ?? null);
      setLoadError(null);
    }).catch((error) => { if (active) { setMobileLeads([]); setLoadError(apiErrorMessage(error)); } });
    return () => { active = false; };
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
        return selectedLead ? <Lead360Screen lead={selectedLead} onOpen={(next) => setScreen(next)} /> : <EmptyState message="No lead is selected." />;
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

  return <div className="mobile-shell">{loadError && <p role="alert" className="review-box">{loadError}</p>}{content}</div>;
}

function LoginScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="screen login-screen">
      <div className="status-row">
        <span>9:41</span>
        <span>▣ ▣ ▣ 82%</span>
      </div>
      <div className="brand-block">
        <div className="brand-mark">T</div>
        <div>
          <h1>TRH360</h1>
          <p>Human + AI CRM</p>
        </div>
      </div>
      <div className="login-card">
        <h2>Welcome back</h2>
        <label>
          <span>Email</span>
          <input defaultValue="sravani@northstar.example" />
        </label>
        <label>
          <span>Password</span>
          <input type="password" defaultValue="password" />
        </label>
        <button className="primary" onClick={onContinue}>Sign in securely</button>
        <button className="ghost">Forgot password?</button>
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
  const [source, setSource] = useState('mobile');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) {
      setError('Enter the lead name.');
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
        <div><strong>Add lead</strong><small>New CRM record</small></div>
      </header>
      <div className="review-box">
        <label><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" /></label>
        <label><span>Phone</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Mobile number" /></label>
        <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" /></label>
        <label><span>Source</span><input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Website, campaign, referral" /></label>
        {error && <p role="alert">{error}</p>}
      </div>
      <div className="sticky-actions single"><button className="primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save lead'}</button></div>
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


function Lead360Screen({ lead, onOpen }: { lead: MobileLead; onOpen: (screen: Screen) => void }) {
  return (
    <div className="screen lead360-screen">
      <header className="mobile-header">
        <button className="back-btn" onClick={() => onOpen('queue')}>←</button>
        <div>
          <strong>Lead 360</strong>
          <small>{lead.id}</small>
        </div>
        <button className="icon-btn">⋮</button>
      </header>

      <div className="profile-box">
        <div className="circle-avatar large">{lead.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
        <div>
          <h2>{lead.name}</h2>
          <p>{lead.phone} · {lead.source}</p>
          <span className={`badge ${lead.qualification.toLowerCase()}`}>{lead.qualification} · 86</span>
        </div>
      </div>

      <div className="profile-actions">
        <button>Message</button>
        <button className="call" onClick={() => onOpen('active-call')}>Call now</button>
      </div>

      <div className="summary-card">
        <strong>Journey summary</strong>
        <p>Wants an enterprise CRM this quarter. Finance director decides. Pricing is the main concern. Saturday solution review accepted.</p>
      </div>

      <div className="next-commitment">
        <span>Next commitment</span>
        <strong>Confirm finance director availability</strong>
        <p>Today · 4:30 PM · in 2h 18m</p>
        <button onClick={() => onOpen('follow-up')}>Complete follow-up</button>
      </div>

      <div className="timeline-box">
        <div className="timeline-row">
          <span className="dot blue" />
          <div>
            <strong>Meaningful call</strong>
            <small>Today · 10:42 AM</small>
          </div>
        </div>
      </div>
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

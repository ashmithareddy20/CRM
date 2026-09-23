import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

let cachedShim: any = null;

export function getLocalD1Database(): any {
  if (cachedShim) return cachedShim;

  const fallbackDir = path.resolve(".wrangler");
  if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
  const targetDbPath = path.join(fallbackDir, "crm-local.sqlite");

  const sqlite = new DatabaseSync(targetDbPath);

  // Helper to safely add column if not existing
  const addColumnIfNotExists = (table: string, column: string, typeDef: string) => {
    try {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDef}`);
    } catch {
      // Column likely already exists
    }
  };

  // Ensure core tables exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      vertical text NOT NULL,
      departments text NOT NULL,
      status text DEFAULT 'active' NOT NULL,
      created_at integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      password text DEFAULT 'password' NOT NULL,
      role text DEFAULT 'agent' NOT NULL,
      department text DEFAULT 'Telecalling',
      branch text DEFAULT 'Hyderabad Central',
      tenant_id text DEFAULT 'trh-hospital',
      created_at integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leads (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      phone text,
      email text,
      source text DEFAULT 'manual' NOT NULL,
      campaign text,
      creative text,
      source_timestamp integer,
      status text DEFAULT 'new' NOT NULL,
      qualification text DEFAULT 'Warm',
      department text DEFAULT 'General',
      branch text DEFAULT 'Hyderabad Central',
      tenant_id text DEFAULT 'trh-hospital',
      owner_id text,
      last_call_at integer,
      uncalled_since integer,
      is_recoverable integer DEFAULT 1,
      close_primary_reason text,
      close_secondary_reason text,
      close_evidence text,
      closed_at integer,
      created_at integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calls (
      id text PRIMARY KEY NOT NULL,
      lead_id text NOT NULL,
      agent_id text NOT NULL,
      direction text NOT NULL,
      outcome text DEFAULT 'pending' NOT NULL,
      duration_sec integer DEFAULT 0,
      recording_url text,
      language text DEFAULT 'telugu',
      transcript text,
      ai_suggested_temp text,
      agent_temp text,
      temp_disagreement integer DEFAULT 0,
      is_meaningful integer DEFAULT 1,
      created_at integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id text PRIMARY KEY NOT NULL,
      lead_id text NOT NULL,
      author_id text NOT NULL,
      content text NOT NULL,
      created_at integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id text PRIMARY KEY NOT NULL,
      lead_id text NOT NULL,
      assignee_id text NOT NULL,
      title text NOT NULL,
      due_at integer NOT NULL,
      status text DEFAULT 'open' NOT NULL,
      touch_type text DEFAULT 'call',
      channel text DEFAULT 'call',
      purpose text DEFAULT 'action',
      is_missed integer DEFAULT 0,
      escalated_at integer,
      created_at integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id text PRIMARY KEY NOT NULL,
      lead_id text NOT NULL,
      owner_id text NOT NULL,
      starts_at integer NOT NULL,
      mode text DEFAULT 'online' NOT NULL,
      status text DEFAULT 'booked' NOT NULL,
      reminded_at integer,
      is_no_show integer DEFAULT 0,
      recovered_at integer,
      created_at integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id text PRIMARY KEY NOT NULL,
      lead_id text NOT NULL,
      call_id text,
      confidence integer DEFAULT 85,
      suggested_temperature text DEFAULT 'Hot',
      suggested_objection text,
      summary_text text NOT NULL,
      structured_remark text,
      status text DEFAULT 'draft' NOT NULL,
      reviewed_by text,
      reviewed_at integer,
      created_at integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id text PRIMARY KEY NOT NULL,
      lead_id text NOT NULL,
      channel text DEFAULT 'whatsapp' NOT NULL,
      direction text DEFAULT 'outbound' NOT NULL,
      content text NOT NULL,
      purpose text DEFAULT 'acknowledge',
      sequence_number integer DEFAULT 1,
      status text DEFAULT 'sent' NOT NULL,
      sent_by text,
      created_at integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id text PRIMARY KEY NOT NULL,
      actor_id text NOT NULL,
      action text NOT NULL,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      details text,
      created_at integer NOT NULL
    );
  `);

  // Migrate existing tables if they lack new columns
  addColumnIfNotExists("users", "password", "text DEFAULT 'password'");
  addColumnIfNotExists("users", "department", "text DEFAULT 'Telecalling'");
  addColumnIfNotExists("users", "branch", "text DEFAULT 'Hyderabad Central'");
  addColumnIfNotExists("users", "tenant_id", "text DEFAULT 'trh-hospital'");

  addColumnIfNotExists("leads", "campaign", "text");
  addColumnIfNotExists("leads", "creative", "text");
  addColumnIfNotExists("leads", "source_timestamp", "integer");
  addColumnIfNotExists("leads", "qualification", "text DEFAULT 'Warm'");
  addColumnIfNotExists("leads", "department", "text DEFAULT 'General'");
  addColumnIfNotExists("leads", "branch", "text DEFAULT 'Hyderabad Central'");
  addColumnIfNotExists("leads", "tenant_id", "text DEFAULT 'trh-hospital'");
  addColumnIfNotExists("leads", "last_call_at", "integer");
  addColumnIfNotExists("leads", "uncalled_since", "integer");
  addColumnIfNotExists("leads", "is_recoverable", "integer DEFAULT 1");
  addColumnIfNotExists("leads", "close_primary_reason", "text");
  addColumnIfNotExists("leads", "close_secondary_reason", "text");
  addColumnIfNotExists("leads", "close_evidence", "text");
  addColumnIfNotExists("leads", "closed_at", "integer");

  addColumnIfNotExists("calls", "recording_url", "text");
  addColumnIfNotExists("calls", "language", "text DEFAULT 'telugu'");
  addColumnIfNotExists("calls", "transcript", "text");
  addColumnIfNotExists("calls", "ai_suggested_temp", "text");
  addColumnIfNotExists("calls", "agent_temp", "text");
  addColumnIfNotExists("calls", "temp_disagreement", "integer DEFAULT 0");
  addColumnIfNotExists("calls", "is_meaningful", "integer DEFAULT 1");

  addColumnIfNotExists("tasks", "touch_type", "text DEFAULT 'call'");
  addColumnIfNotExists("tasks", "channel", "text DEFAULT 'call'");
  addColumnIfNotExists("tasks", "purpose", "text DEFAULT 'action'");
  addColumnIfNotExists("tasks", "is_missed", "integer DEFAULT 0");
  addColumnIfNotExists("tasks", "escalated_at", "integer");

  addColumnIfNotExists("messages", "purpose", "text DEFAULT 'acknowledge'");
  addColumnIfNotExists("messages", "sequence_number", "integer DEFAULT 1");

  addColumnIfNotExists("appointments", "reminded_at", "integer");
  addColumnIfNotExists("appointments", "is_no_show", "integer DEFAULT 0");
  addColumnIfNotExists("appointments", "recovered_at", "integer");

  const nowSec = Math.floor(Date.now() / 1000);

  // 1. Seed Tenants
  const tenantCount = sqlite.prepare("SELECT count(*) as count FROM tenants").get() as any;
  if (!tenantCount || tenantCount.count === 0) {
    const seedTenant = sqlite.prepare(`
      INSERT INTO tenants (id, name, slug, vertical, departments, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    seedTenant.run("trh-hospital", "Meenestham Healthcare Group / TRH", "trh", "Hospital & Super-Specialty", "General, Urology, Nephrology, Surgery, Dialysis", "active", nowSec);
    seedTenant.run("apex-ortho", "Apex Spine & Orthopedics", "ortho", "Orthopedics & Joint Clinic", "Joint Replacement, Arthroscopy, Sports Medicine, Spine Rehab", "active", nowSec);
    seedTenant.run("bloom-ivf", "Bloom Fertility & IVF Institute", "ivf", "Reproductive Medicine & IVF", "IVF, IUI, Genetic Screening, Embryology, Counselling", "active", nowSec);
    seedTenant.run("aesthetica-derm", "Aesthetica Dermatology & Cosmetology", "derm", "Aesthetic Medicine & Dermatology", "Hair Restoration, Laser Treatments, Skin Aesthetics", "active", nowSec);
    seedTenant.run("nextgen-b2b", "NextGen B2B Corporate Health", "b2b", "Corporate Wellness & Diagnostics", "Executive Health Checks, Ergonomics, Corporate Health", "active", nowSec);
  }

  // 2. Seed Users
  const userCount = sqlite.prepare("SELECT count(*) as count FROM users").get() as any;
  if (!userCount || userCount.count === 0) {
    const seedUser = sqlite.prepare(`
      INSERT INTO users (id, name, email, password, role, department, branch, tenant_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    seedUser.run("agent-1", "Sravani K.", "sravani@meenestham.in", "password", "Agent", "Telecalling", "Hyderabad Central", "trh-hospital", nowSec);
    seedUser.run("agent-2", "Anil M.", "anil@meenestham.in", "password", "Manager", "Telecalling & QA", "Hyderabad Central", "trh-hospital", nowSec);
    seedUser.run("founder-1", "Dr. Ramesh K.", "founder@meenestham.in", "password", "Leadership", "Executive Leadership", "Corporate", "trh-hospital", nowSec);
    seedUser.run("ops-1", "Maya Rao", "ops@meenestham.in", "password", "Operations", "Clinical & Commercial Ops", "Hyderabad Central", "trh-hospital", nowSec);
    seedUser.run("admin-1", "System Administrator", "admin@meenestham.in", "password", "Admin", "IT & Operations", "Corporate", "trh-hospital", nowSec);
  }

  // 3. Seed Leads
  const leadCount = sqlite.prepare("SELECT count(*) as count FROM leads").get() as any;
  if (!leadCount || leadCount.count === 0) {
    const seed = sqlite.prepare(`
      INSERT INTO leads (id, name, phone, email, source, campaign, creative, source_timestamp, status, qualification, department, branch, tenant_id, owner_id, uncalled_since, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    seed.run("TRH-24190", "Lakshmi Narayana", "+91 98491 22618", "lakshmi@enterprise.example", "Google Search · Enterprise", "Kidney Care Q3", "Creative-DocExplainer-01", nowSec - 20 * 60, "qualified", "Hot", "Nephrology", "Hyderabad Central", "trh-hospital", "Sravani", null, nowSec - 18 * 60);
    seed.run("TRH-24184", "Madhavi Rao", "+91 99850 41172", "madhavi@tech.example", "Meta · Regional campaign", "Dialysis Express", "Creative-PatientStory-03", nowSec - 50 * 60, "contacted", "Warm", "Urology", "Hyderabad Central", "trh-hospital", "Anil", null, nowSec - 42 * 60);
    seed.run("TRH-24179", "Mohammed Faizal", "+91 97011 98420", "faizal@commerce.example", "Website · Organic", "Direct Intake", "Form-Consultation-v2", nowSec - 70 * 60, "contacted", "Warm", "General Surgery", "Hyderabad Central", "trh-hospital", "Divya", null, nowSec - 60 * 60);
    seed.run("TRH-24172", "Sailaja Devi", "+91 93920 36442", "sailaja@solutions.example", "YouTube · Product guide", "Laser Surgery Overview", "Video-DrTalk-05", nowSec - 25 * 3600, "new", "Cold", "General Surgery", "Secunderabad", "trh-hospital", "Sravani", null, nowSec - 24 * 3600);
    seed.run("TRH-24168", "Prakash Reddy", "+91 90102 78256", "prakash@trade.example", "Inbound Call", "Emergency Helpline", "IVR-Option-1", nowSec - 37 * 3600, "new", "Not Lifting", "Nephrology", "Hyderabad Central", "trh-hospital", "Kiran", nowSec - 36 * 3600, nowSec - 36 * 3600);
    // Uncalled form lead exceeding 5 minutes (triggering PRD 4 SLA alert & 15m reassignment)
    seed.run("TRH-24199", "Venkatesh Babu", "+91 91234 56789", "venkatesh@inquiry.example", "Web Form · Urgent", "Laparoscopy Camp", "LandingPage-Banner-A", nowSec - 16 * 60, "new", "Hot", "General Surgery", "Hyderabad Central", "trh-hospital", "Sravani", nowSec - 16 * 60, nowSec - 16 * 60);
  }

  // 4. Seed Calls with Transcripts in Telugu/Hindi/English
  const callCount = sqlite.prepare("SELECT count(*) as count FROM calls").get() as any;
  if (!callCount || callCount.count === 0) {
    const seedCall = sqlite.prepare(`
      INSERT INTO calls (id, lead_id, agent_id, direction, outcome, duration_sec, recording_url, language, transcript, ai_suggested_temp, agent_temp, temp_disagreement, is_meaningful, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const teluguTranscript = `[00:02] ఏజెంట్ (శ్రావణి): నమస్కారం అండి, మేనేస్తం హెల్త్‌కేర్ గ్రూప్ నుంచి శ్రావణి మాట్లాడుతున్నాను. లక్ష్మీ నారాయణ గారేనా?
[00:08] పేషెంట్: అవునండి, నేనే. నిన్న గూగుల్‌లో మీ కిడ్నీ స్పెషలిస్ట్ కన్సల్టేషన్ గురించి ఫారమ్ నింపాను.
[00:15] ఏజెంట్: ధన్యవాదాలు సార్. మీ రిపోర్ట్స్ చూశాను. డాక్టర్ గారితో శనివారం ఉదయం 11:30 కు అపాయింట్‌మెంట్ ఖరారు చేయవచ్చా?
[00:23] పేషెంట్: సరేనండి. మా ఫైనాన్స్ డైరెక్టర్ ప్రియా గారితో కూడా మాట్లాడి ఫీజు వివరాలు తెలుసుకోవాలి.
[00:32] ఏజెంట్: తప్పకుండా సార్, శనివారం స్లాట్ లాక్ చేశాను. వాట్సాప్‌లో వివరాలు పంపిస్తాను.`;

    const hindiTranscript = `[00:03] एजेंट: नमस्ते, मैं अनिल बात कर रहा हूँ मीनेस्थम हेल्थकेयर से। क्या मेरी बात माधवी जी से हो रही है?
[00:09] पेशेंट: हाँ, मैंने फेसबुक पर आपका डायलिसिस और यूरोलॉजी का ऐड देखा था।
[00:16] एजेंट: जी मैडम, हमारे पास स्टेट-ऑफ-द-आर्ट हेमोडायलिसिस यूनिट उपलब्ध है। क्या आप कल ओपीडी विज़िट कर सकती हैं?
[00:24] पेशेंट: कल मुश्किल है, मुझे परिवार से सलाह करनी है। आप मुझे व्हाट्सएप पर प्लान भेज दीजिए।`;

    seedCall.run("CALL-101", "TRH-24190", "Sravani", "outbound", "connected", 142, "/audio/recordings/CALL-101.wav", "telugu", teluguTranscript, "Hot", "Hot", 0, 1, nowSec - 15 * 60);
    seedCall.run("CALL-102", "TRH-24184", "Anil", "outbound", "connected", 98, "/audio/recordings/CALL-102.wav", "hindi", hindiTranscript, "Warm", "Warm", 0, 1, nowSec - 40 * 60);
    // Disagreement example for PRD 11 QA report
    seedCall.run("CALL-103", "TRH-24179", "Divya", "outbound", "connected", 34, "/audio/recordings/CALL-103.wav", "english", "Lead disconnected quickly without confirming interest.", "Cold", "Hot", 1, 0, nowSec - 55 * 60);
  }

  // 5. Seed Reviews
  const reviewCount = sqlite.prepare("SELECT count(*) as count FROM reviews").get() as any;
  if (!reviewCount || reviewCount.count === 0) {
    const seedReview = sqlite.prepare(`
      INSERT INTO reviews (id, lead_id, call_id, confidence, suggested_temperature, suggested_objection, summary_text, structured_remark, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const remarkJson = JSON.stringify({
      leadRequirement: "Super-specialty nephrology consultation and treatment plan.",
      intentUrgency: "High intent. Requires appointment within next 48-72 hours.",
      decisionMaker: "Patient Lakshmi Narayana & Finance Director Priya.",
      primaryObjection: "Consultation package cost and insurance cashless clearance.",
      informationGiven: "Dr. Rao availability, Saturday 11:30 AM slot, cashless TPA desk.",
      commitmentObtained: "Confirmed Saturday 11:30 AM in-clinic review.",
      nextAction: "Call Friday 4:30 PM to confirm insurance documents.",
    });
    seedReview.run("REV-001", "TRH-24190", "CALL-101", 94, "Hot", "Implementation cost", "Enterprise nephrology consultation booked. Finance director Priya is the final approver.", remarkJson, "draft", nowSec - 10 * 60);
  }

  // 6. Seed Follow-up Cadence Tasks (PRD 6 & 8)
  const taskCount = sqlite.prepare("SELECT count(*) as count FROM tasks").get() as any;
  if (!taskCount || taskCount.count === 0) {
    const seedTask = sqlite.prepare(`
      INSERT INTO tasks (id, lead_id, assignee_id, title, due_at, status, touch_type, channel, purpose, is_missed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    // Hot cadence for TRH-24190 (Day 0, Day 2, Day 4 calls)
    seedTask.run("TASK-001", "TRH-24190", "Sravani", "Hot Day 0: Call to confirm insurance paperwork & attendance", nowSec + 3600 * 4, "open", "call", "call", "action", 0, nowSec - 20 * 60);
    seedTask.run("TASK-002", "TRH-24190", "Sravani", "Hot Day 2: Structured touch & pre-consultation checklist", nowSec + 86400 * 2, "open", "call", "call", "trust", 0, nowSec - 20 * 60);
    seedTask.run("TASK-003", "TRH-24190", "Sravani", "Hot Day 4: Post-consultation follow-up & surgical consent", nowSec + 86400 * 4, "open", "call", "call", "procedure", 0, nowSec - 20 * 60);
    // Overdue task triggering PRD 9 escalation
    seedTask.run("TASK-004", "TRH-24184", "Anil", "Warm Day 1: Send pricing scope & doctor profile on WhatsApp", nowSec - 3600 * 2, "open", "message", "whatsapp", "educate", 1, nowSec - 3600 * 6);
  }

  // 7. Seed Appointments (PRD 17)
  const apptCount = sqlite.prepare("SELECT count(*) as count FROM appointments").get() as any;
  if (!apptCount || apptCount.count === 0) {
    const seedAppt = sqlite.prepare(`
      INSERT INTO appointments (id, lead_id, owner_id, starts_at, mode, status, reminded_at, is_no_show, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    seedAppt.run("APPT-001", "TRH-24190", "Maya Rao", nowSec + 48 * 3600, "in_clinic", "booked", nowSec - 5 * 60, 0, nowSec - 15 * 60);
    seedAppt.run("APPT-002", "TRH-24184", "Maya Rao", nowSec + 72 * 3600, "online", "confirmed", nowSec - 10 * 60, 0, nowSec - 30 * 60);
  }

  // 8. Seed Omnichannel Messages (PRD 7 - 48h apart, alternating WhatsApp and RCS)
  const msgCount = sqlite.prepare("SELECT count(*) as count FROM messages").get() as any;
  if (!msgCount || msgCount.count === 0) {
    const seedMsg = sqlite.prepare(`
      INSERT INTO messages (id, lead_id, channel, direction, content, purpose, sequence_number, status, sent_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    seedMsg.run("MSG-001", "TRH-24190", "whatsapp", "outbound", "Namaste Lakshmi Narayana garu, your appointment with Dr. Rao is confirmed for Saturday, 11:30 AM at Meenestham Banjara Hills. Location: https://maps.example/trh", "acknowledge", 1, "delivered", "Sravani", nowSec - 8 * 60);
    seedMsg.run("MSG-002", "TRH-24184", "rcs", "outbound", "Madhavi garu, here is our Comprehensive Urology & Dialysis Guide with patient recovery stories: https://meenestham.in/urology-care", "educate", 2, "delivered", "Anil", nowSec - 30 * 60);
  }

  // 9. Seed Audit Logs (PRD 20 - Immutable trail)
  const auditCount = sqlite.prepare("SELECT count(*) as count FROM audit_logs").get() as any;
  if (!auditCount || auditCount.count === 0) {
    const seedAudit = sqlite.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    seedAudit.run("AUD-001", "system", "SYSTEM_SEED", "system", "trh360", "Production baseline seeded with 5 vertical tenant packs", nowSec);
    seedAudit.run("AUD-002", "Sravani", "TEMPERATURE_SET", "lead", "TRH-24190", "Agent set temperature to 'Hot'. Follow-up cadence auto-generated: 3 calls, 3 messages over 5 days.", nowSec - 15 * 60);
    seedAudit.run("AUD-003", "system", "ESCALATION_ALERT", "task", "TASK-004", "Scheduled touch breached 2-hour SLA window. Escalated to Team Manager Anil M.", nowSec - 3600);
  }

  cachedShim = {
    prepare(query: string) {
      let boundParams: any[] = [];
      return {
        bind(...params: any[]) {
          boundParams = params.map(p => (p instanceof Date ? Math.floor(p.getTime() / 1000) : p));
          return this;
        },
        async all() {
          try {
            const stmt = sqlite.prepare(query);
            const results = stmt.all(...boundParams);
            return { results, success: true, meta: { changes: 0, last_row_id: 0 } };
          } catch (err) {
            console.error("Local D1 query error:", query, err);
            throw err;
          }
        },
        async run() {
          try {
            const stmt = sqlite.prepare(query);
            const result = stmt.run(...boundParams);
            return { success: true, meta: { changes: result.changes, last_row_id: Number(result.lastInsertRowid) } };
          } catch (err) {
            console.error("Local D1 run error:", query, err);
            throw err;
          }
        },
        async first(col?: string) {
          try {
            const stmt = sqlite.prepare(query);
            const row = stmt.get(...boundParams) as any;
            if (!row) return null;
            return col ? row[col] : row;
          } catch (err) {
            console.error("Local D1 first error:", query, err);
            throw err;
          }
        },
        async raw() {
          const stmt = sqlite.prepare(query);
          return stmt.all(...boundParams).map(r => Object.values(r as any));
        }
      };
    },
    async batch(statements: any[]) {
      return Promise.all(statements.map(s => s.all()));
    },
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 1, duration: 0 };
    }
  };

  return cachedShim;
}

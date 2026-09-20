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

  // Ensure core tables exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      role text DEFAULT 'agent' NOT NULL,
      created_at integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leads (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      phone text,
      email text,
      source text DEFAULT 'manual' NOT NULL,
      status text DEFAULT 'new' NOT NULL,
      owner_id text,
      created_at integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calls (
      id text PRIMARY KEY NOT NULL,
      lead_id text NOT NULL,
      agent_id text NOT NULL,
      direction text NOT NULL,
      outcome text DEFAULT 'pending' NOT NULL,
      duration_sec integer DEFAULT 0,
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
      created_at integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id text PRIMARY KEY NOT NULL,
      lead_id text NOT NULL,
      owner_id text NOT NULL,
      starts_at integer NOT NULL,
      mode text DEFAULT 'online' NOT NULL,
      status text DEFAULT 'booked' NOT NULL,
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

  const nowSec = Math.floor(Date.now() / 1000);

  const leadCount = sqlite.prepare("SELECT count(*) as count FROM leads").get() as any;
  if (!leadCount || leadCount.count === 0) {
    const seed = sqlite.prepare(`
      INSERT INTO leads (id, name, phone, email, source, status, owner_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    seed.run("TRH-24190", "Lakshmi Narayana", "+91 98491 22618", "lakshmi@enterprise.example", "Google Search · Enterprise", "qualified", "Sravani", nowSec - 18 * 60);
    seed.run("TRH-24184", "Madhavi Rao", "+91 99850 41172", "madhavi@tech.example", "Meta · Regional campaign", "contacted", "Anil", nowSec - 42 * 60);
    seed.run("TRH-24179", "Mohammed Faizal", "+91 97011 98420", "faizal@commerce.example", "Website · Organic", "contacted", "Divya", nowSec - 60 * 60);
    seed.run("TRH-24172", "Sailaja Devi", "+91 93920 36442", "sailaja@solutions.example", "YouTube · Product guide", "new", "Sravani", nowSec - 24 * 3600);
    seed.run("TRH-24168", "Prakash Reddy", "+91 90102 78256", "prakash@trade.example", "Incoming call", "new", "Kiran", nowSec - 36 * 3600);
  }

  const reviewCount = sqlite.prepare("SELECT count(*) as count FROM reviews").get() as any;
  if (!reviewCount || reviewCount.count === 0) {
    const seedReview = sqlite.prepare(`
      INSERT INTO reviews (id, lead_id, call_id, confidence, suggested_temperature, suggested_objection, summary_text, structured_remark, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const remarkJson = JSON.stringify({
      leadRequirement: "Enterprise CRM rollout before the festive sales cycle.",
      intentUrgency: "High intent. Time-bound need within the next 4–6 weeks.",
      decisionMaker: "Finance director, Priya. Must join the review and approve spend.",
      primaryObjection: "Implementation cost and annual payment terms.",
      informationGiven: "Specialist availability, Saturday slot, and annual payment plan.",
      commitmentObtained: "Solution review accepted for Saturday, 11:30 AM.",
      nextAction: "Call today at 4:30 PM to confirm finance director availability.",
    });
    seedReview.run("REV-001", "TRH-24190", "CALL-101", 91, "Hot", "Implementation cost", "Enterprise CRM rollout requested. Finance director Priya is the final approver.", remarkJson, "draft", nowSec - 10 * 60);
  }

  const taskCount = sqlite.prepare("SELECT count(*) as count FROM tasks").get() as any;
  if (!taskCount || taskCount.count === 0) {
    const seedTask = sqlite.prepare(`
      INSERT INTO tasks (id, lead_id, assignee_id, title, due_at, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    seedTask.run("TASK-001", "TRH-24190", "Sravani", "Confirm finance director availability", nowSec + 4 * 3600, "open", nowSec - 20 * 60);
    seedTask.run("TASK-002", "TRH-24184", "Anil", "Send product pricing brochure on WhatsApp", nowSec + 2 * 3600, "open", nowSec - 30 * 60);
  }

  const apptCount = sqlite.prepare("SELECT count(*) as count FROM appointments").get() as any;
  if (!apptCount || apptCount.count === 0) {
    const seedAppt = sqlite.prepare(`
      INSERT INTO appointments (id, lead_id, owner_id, starts_at, mode, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    seedAppt.run("APPT-001", "TRH-24190", "Maya Rao", nowSec + 48 * 3600, "online", "booked", nowSec - 15 * 60);
  }

  const msgCount = sqlite.prepare("SELECT count(*) as count FROM messages").get() as any;
  if (!msgCount || msgCount.count === 0) {
    const seedMsg = sqlite.prepare(`
      INSERT INTO messages (id, lead_id, channel, direction, content, status, sent_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    seedMsg.run("MSG-001", "TRH-24190", "whatsapp", "outbound", "Pricing explainer, case study, and meeting link for Saturday 11:30 AM.", "delivered", "Sravani", nowSec - 8 * 60);
  }

  const auditCount = sqlite.prepare("SELECT count(*) as count FROM audit_logs").get() as any;
  if (!auditCount || auditCount.count === 0) {
    const seedAudit = sqlite.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    seedAudit.run("AUD-001", "system", "SEED_DATABASE", "system", "trh360", "Initial production baseline seeded successfully", nowSec);
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

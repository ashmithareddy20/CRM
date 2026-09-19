import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

// Find all miniflare D1 sqlite files in .wrangler/state/v3/d1/miniflare-D1DatabaseObject/
const d1Dir = path.resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const files = fs.readdirSync(d1Dir).filter(f => f.endsWith(".sqlite") && !f.startsWith("metadata"));

console.log("Found D1 sqlite files:", files);

const seedLeads = [
  {
    id: "TRH-24190",
    name: "Lakshmi Narayana",
    phone: "+91 98491 22618",
    email: "lakshmi@enterprise.example",
    source: "Google Search · Enterprise",
    status: "qualified",
    owner_id: "Sravani",
    created_at: Math.floor(Date.now() / 1000) - 18 * 60,
  },
  {
    id: "TRH-24184",
    name: "Madhavi Rao",
    phone: "+91 99850 41172",
    email: "madhavi@tech.example",
    source: "Meta · Regional campaign",
    status: "contacted",
    owner_id: "Anil",
    created_at: Math.floor(Date.now() / 1000) - 42 * 60,
  },
  {
    id: "TRH-24179",
    name: "Mohammed Faizal",
    phone: "+91 97011 98420",
    email: "faizal@commerce.example",
    source: "Website · Organic",
    status: "contacted",
    owner_id: "Divya",
    created_at: Math.floor(Date.now() / 1000) - 60 * 60,
  },
  {
    id: "TRH-24172",
    name: "Sailaja Devi",
    phone: "+91 93920 36442",
    email: "sailaja@solutions.example",
    source: "YouTube · Product guide",
    status: "new",
    owner_id: "Sravani",
    created_at: Math.floor(Date.now() / 1000) - 24 * 60 * 60,
  },
  {
    id: "TRH-24168",
    name: "Prakash Reddy",
    phone: "+91 90102 78256",
    email: "prakash@trade.example",
    source: "Incoming call",
    status: "new",
    owner_id: "Kiran",
    created_at: Math.floor(Date.now() / 1000) - 36 * 60 * 60,
  },
];

for (const file of files) {
  const dbPath = path.join(d1Dir, file);
  try {
    const db = new DatabaseSync(dbPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    if (!tables.includes("leads")) {
      console.log(`Skipping ${file} (no leads table)`);
      continue;
    }

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO leads (id, name, phone, email, source, status, owner_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const lead of seedLeads) {
      insertStmt.run(lead.id, lead.name, lead.phone, lead.email, lead.source, lead.status, lead.owner_id, lead.created_at);
    }

    console.log(`Successfully seeded ${seedLeads.length} leads into ${file}`);
    const count = db.prepare("SELECT count(*) as total FROM leads").get();
    console.log(`Total leads in ${file}:`, count.total);
  } catch (err) {
    console.error(`Error processing ${file}:`, err.message);
  }
}

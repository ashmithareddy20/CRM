const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const dir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sqlite') && !f.startsWith('metadata'));
for (const f of files) {
  console.log('=== FILE:', f);
  const db = new DatabaseSync(path.join(dir, f));
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables:', tables.map(t => t.name));
    if (tables.some(t => t.name === 'leads')) {
      console.log('Leads count:', db.prepare('SELECT count(*) as count FROM leads').get());
      const rows = db.prepare('SELECT id, name, phone, createdAt FROM leads ORDER BY createdAt DESC LIMIT 10').all();
      console.log('Recent leads:', rows);
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}


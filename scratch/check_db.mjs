import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sqlite') && !f.startsWith('metadata'));
for (const f of files) {
  console.log('=== FILE:', f);
  const db = new DatabaseSync(path.join(dir, f));
  try {
    const leads = db.prepare("SELECT id, name, phone, created_at FROM leads ORDER BY created_at DESC LIMIT 10").all();
    console.log('Recent leads:');
    console.log(leads);
    const sanvi = db.prepare("SELECT * FROM leads WHERE name LIKE '%Sanvi%' OR phone LIKE '%123456789%'").all();
    console.log('Sanvi search result:', sanvi);
  } catch (e) {
    console.log('Error:', e.message);
  }
}


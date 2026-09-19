import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";

const path = process.argv[2];
if (!path) throw new Error("Usage: node scripts/inspect-db.mjs <sqlite-path>");
const db = new DatabaseSync(path, { readOnly: true });
const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name").all();
const indexes = db.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name").all();
const rowCounts = Object.fromEntries(tables.filter(({ name }) => !name.startsWith("sqlite_")).map(({ name }) => [name, Number(db.prepare(`SELECT count(*) AS count FROM "${name.replaceAll('"', '""')}"`).get().count)]));
const migrations = tables.some(({ name }) => name === "__drizzle_migrations") ? db.prepare("SELECT * FROM __drizzle_migrations ORDER BY created_at").all() : [];
const shape = createHash("sha256").update(JSON.stringify({ tables, indexes })).digest("hex");
console.log(JSON.stringify({ database: path, shape, tables: tables.map(({ name }) => name), rowCounts, migrations }, null, 2));

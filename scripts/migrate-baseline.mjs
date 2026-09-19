import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const value = (name) => args[args.indexOf(name) + 1];
const database = value("--database"); const environment = value("--environment");
if (!database || !["local", "staging"].includes(environment)) throw new Error("Usage: node scripts/migrate-baseline.mjs --database <sqlite-path> --environment <local|staging>");
const db = new DatabaseSync(database);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(({ name }) => name);
const legacy = ["users", "leads", "calls", "notes", "tasks", "appointments"];
const canonicalSql = await readFile("drizzle/baseline/0000_canonical_baseline.sql", "utf8");
const canonicalTables = new Set([...canonicalSql.matchAll(/CREATE TABLE `([\w]+)`/g)].map(([, name]) => name));
const infrastructureTables = new Set(["__drizzle_migrations", "d1_migrations"]);
const isExpected = (name) => name.startsWith("sqlite_") || infrastructureTables.has(name) || legacy.includes(name) || canonicalTables.has(name);
const canonical = tables.includes("crm_tenants") && tables.every(isExpected);
const knownLegacy = tables.every((name) => name.startsWith("sqlite_") || infrastructureTables.has(name) || legacy.includes(name)) && legacy.some((name) => tables.includes(name));
const empty = tables.every((name) => name.startsWith("sqlite_") || infrastructureTables.has(name));
if (!empty && !knownLegacy && !canonical) throw new Error(`Unknown database shape; refusing writes. Found: ${tables.join(", ")}`);
const files = canonical || knownLegacy ? ["drizzle/forward/0000_moaning_cammi.sql", "drizzle/forward/0001_tenant_guards.sql", "drizzle/forward/0002_domain_guards.sql", "drizzle/forward/0003_integrity_review_guards.sql", "drizzle/forward/0004_review_bootstrap_and_dimensions.sql", "drizzle/forward/0005_lifecycle_bootstrap.sql"] : ["drizzle/baseline/0000_canonical_baseline.sql", "drizzle/baseline/0001_tenant_guards.sql", "drizzle/baseline/0002_domain_guards.sql", "drizzle/baseline/0003_integrity_review_guards.sql", "drizzle/baseline/0004_review_bootstrap_and_dimensions.sql", "drizzle/baseline/0005_lifecycle_bootstrap.sql"];
function existingObject(type, name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?").get(type, name));
}
function knownIdempotentReplay(statement, error) {
  const message = String(error.message);
  const executable = statement.replace(/^(?:--[^\n]*\n\s*)+/, "");
  const create = executable.match(/^CREATE\s+(?:UNIQUE\s+)?(TABLE|INDEX|TRIGGER)\s+`?([\w]+)`?/i);
  if (create && /already exists/i.test(message)) return existingObject(create[1].toLowerCase(), create[2]);
  const addColumn = executable.match(/^ALTER\s+TABLE\s+`?([\w]+)`?\s+ADD\s+COLUMN\s+`?([\w]+)`?/i);
  if (addColumn && /duplicate column name/i.test(message)) return Boolean(db.prepare(`SELECT 1 FROM pragma_table_info('${addColumn[1]}') WHERE name = ?`).get(addColumn[2]));
  return false;
}
for (const file of files) {
  const sql = await readFile(file, "utf8");
  for (const statement of sql.split(/--\s*>\s*statement-breakpoint\s*\n/).map((part) => part.trim()).filter(Boolean)) {
    try { db.exec(statement); } catch (error) { if (!knownIdempotentReplay(statement, error)) throw error; }
  }
}
const shape = createHash("sha256").update(tables.sort().join("\n")).digest("hex");
db.prepare("INSERT OR IGNORE INTO crm_migration_reconciliations (id, environment, legacy_shape, baseline_version, inspected_at, checksum) VALUES (?, ?, ?, ?, ?, ?)").run(randomUUID(), environment, empty ? "empty" : knownLegacy ? "legacy" : "canonical", "2026-09-canonical", Date.now(), shape);
console.log(JSON.stringify({ database, environment, startingShape: empty ? "empty" : knownLegacy ? "legacy" : "canonical", status: "reconciled" }));

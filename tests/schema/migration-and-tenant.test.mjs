import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const run = (...args) => execFileSync(process.execPath, args, { cwd: root, encoding: "utf8" });
test("baseline is explicit, repeatable, and tenant guard rejects cross-tenant references", () => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "crm-schema-")), "test.sqlite");
  run("scripts/migrate-baseline.mjs", "--database", file, "--environment", "local");
  run("scripts/seed-backend.mjs", "--database", file, "--environment", "local");
  run("scripts/seed-backend.mjs", "--database", file, "--environment", "local");
  const db = new DatabaseSync(file);
  assert.equal(db.prepare("select count(*) as count from crm_tenants where id='demo-tenant-a'").get().count, 1);
  assert.throws(() => db.prepare("insert into crm_tasks (id,tenant_id,created_at,version,lead_id,title,due_at,status,priority) values ('bad','demo-tenant-b',1,1,'lead-synthetic-qualified','x',1,'open','normal')").run(), /task lead must belong to tenant/);
  assert.throws(() => db.prepare("insert into crm_lead_episodes (id,tenant_id,created_at,version,contact_id,source_id,lifecycle_stage,received_at) values ('bad-stage','demo-tenant-a',1,1,'contact-synthetic-opt-in','source-manual','made_up',1)").run(), /invalid lifecycle stage/);
});

test("recognized partial historical variants converge without replaying duplicate history", () => {
  for (const variant of ["empty", "0000-only", "both-ledger", "manual"]) {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "crm-legacy-")), `${variant}.sqlite`);
    const db = new DatabaseSync(file);
    if (variant === "0000-only" || variant === "both-ledger") db.exec("create table tasks (id text primary key, lead_id text not null, assignee_id text not null, title text not null, due_at integer not null, status text not null, created_at integer not null)");
    if (variant === "both-ledger") db.exec("create table __drizzle_migrations (id integer primary key, hash text, created_at integer)");
    if (variant === "manual") db.exec("create table leads (id text primary key, name text not null, phone text, email text, source text not null, status text not null, owner_id text, created_at integer not null)");
    run("scripts/migrate-baseline.mjs", "--database", file, "--environment", "local");
    assert.equal(db.prepare("select count(*) as count from sqlite_master where type='table' and name='crm_tenants'").get().count, 1, variant);
  }
});

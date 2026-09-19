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

test("integrity indexes allow releases while preventing conflicting active state and duplicate ledgers", () => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "crm-integrity-")), "test.sqlite");
  run("scripts/migrate-baseline.mjs", "--database", file, "--environment", "local");
  run("scripts/seed-backend.mjs", "--database", file, "--environment", "local");
  const db = new DatabaseSync(file); const now = 1_800_000_000_000; const tenant = "demo-tenant-a"; const lead = "lead-synthetic-qualified";
  db.prepare("insert into crm_slot_reservations (id,tenant_id,created_at,version,appointment_id,doctor_id,branch_id,slot_start_at,status) values ('slot-1',?, ?,1,'appt-1','doctor-1','branch-1',?,'active')").run(tenant, now, now);
  assert.throws(() => db.prepare("insert into crm_slot_reservations (id,tenant_id,created_at,version,appointment_id,doctor_id,branch_id,slot_start_at,status) values ('slot-2',?, ?,1,'appt-2','doctor-1','branch-1',?,'active')").run(tenant, now, now), /UNIQUE constraint failed/);
  db.prepare("update crm_slot_reservations set status='released' where id='slot-1'").run();
  db.prepare("insert into crm_slot_reservations (id,tenant_id,created_at,version,appointment_id,doctor_id,branch_id,slot_start_at,status) values ('slot-3',?, ?,1,'appt-3','doctor-1','branch-1',?,'active')").run(tenant, now, now);
  db.prepare("insert into crm_lead_diagnoses (id,tenant_id,created_at,version,lead_id,version_id,primary_reason,evidence_id,recoverability,review_at,status) values ('diag-1',?, ?,1,?,'diagnosis-v1','financial','evidence-1','recoverable',?,'active')").run(tenant, now, lead, now);
  assert.throws(() => db.prepare("insert into crm_lead_diagnoses (id,tenant_id,created_at,version,lead_id,version_id,primary_reason,evidence_id,recoverability,review_at,status) values ('diag-2',?, ?,1,?,'diagnosis-v1','financial','evidence-2','recoverable',?,'active')").run(tenant, now, lead, now), /UNIQUE constraint failed/);
  db.prepare("insert into crm_recovery_enrollments (id,tenant_id,created_at,version,lead_id,diagnosis_id,campaign_id,eligible_at,reactivation_at,reason_snapshot,status) values ('recover-1',?, ?,1,?,'diag-1','campaign-1',?,?,?,'planned')").run(tenant, now, lead, now, now + 1000, "financial");
  assert.throws(() => db.prepare("insert into crm_recovery_enrollments (id,tenant_id,created_at,version,lead_id,diagnosis_id,campaign_id,eligible_at,status) values ('recover-2',?, ?,1,?,'diag-1','campaign-2',?,'active')").run(tenant, now, lead, now), /UNIQUE constraint failed/);
  db.prepare("insert into crm_treatments_completed (id,tenant_id,created_at,version,lead_id,completion_identity,command_id,status,occurred_at,evidence_id) values ('treatment-1',?, ?,1,?,'provider:one','command:one','completed',?,'evidence')").run(tenant, now, lead, now);
  assert.throws(() => db.prepare("insert into crm_treatments_completed (id,tenant_id,created_at,version,lead_id,completion_identity,status,occurred_at,evidence_id) values ('treatment-2',?, ?,1,?,'provider:one','completed',?,'evidence')").run(tenant, now, lead, now), /UNIQUE constraint failed/);
  db.prepare("insert into crm_treatments_completed (id,tenant_id,created_at,version,lead_id,status,occurred_at,evidence_id) values ('treatment-default',?, ?,1,?,'completed',?,'evidence')").run(tenant, now, lead, now);
  assert.equal(db.prepare("select completion_identity from crm_treatments_completed where id='treatment-default'").get().completion_identity, 'legacy:treatment-default');
  assert.equal(db.prepare("select reactivation_at from crm_recovery_enrollments where id='recover-1'").get().reactivation_at, now + 1000);
  db.prepare("insert into crm_revenue_ledger (id,tenant_id,created_at,version,lead_id,treatment_completion_id,kind,amount_minor,currency,occurred_at) values ('revenue-1',?, ?,1,?,'treatment-1','received',100,'INR',?)").run(tenant, now, lead, now);
  db.prepare("insert into crm_revenue_ledger (id,tenant_id,created_at,version,lead_id,kind,amount_minor,currency,reverses_entry_id,occurred_at) values ('reversal-1',?, ?,1,?,'reversal',-100,'INR','revenue-1',?)").run(tenant, now, lead, now);
  assert.throws(() => db.prepare("insert into crm_revenue_ledger (id,tenant_id,created_at,version,lead_id,kind,amount_minor,currency,reverses_entry_id,occurred_at) values ('reversal-2',?, ?,1,?,'reversal',-100,'INR','revenue-1',?)").run(tenant, now, lead, now), /UNIQUE constraint failed/);
  db.prepare("insert into crm_tasks (id,tenant_id,created_at,version,lead_id,title,due_at,status,priority) values ('task-tenant-update',?, ?,1,?,'x',?,'open','normal')").run(tenant, now, lead, now);
  assert.throws(() => db.prepare("update crm_tasks set tenant_id='demo-tenant-b' where id='task-tenant-update'").run(), /task lead must belong to tenant/);
});

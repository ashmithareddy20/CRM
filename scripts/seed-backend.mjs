import { DatabaseSync } from "node:sqlite";

const args = process.argv.slice(2); const take = (flag) => args[args.indexOf(flag) + 1];
const database = take("--database"); const environment = take("--environment");
if (!database || !["local", "staging", "production"].includes(environment)) throw new Error("Usage: node scripts/seed-backend.mjs --database <sqlite-path> --environment <local|staging|production>");
const db = new DatabaseSync(database);
const now = Date.now();
const insert = (sql, values) => db.prepare(sql).run(...values);
const tenant = environment === "production" ? "bootstrap-tenant" : "demo-tenant-a";
const rows = [
  ["crm_tenants", [tenant, environment === "production" ? "Bootstrap tenant" : "Synthetic Care Demo A", tenant, "Asia/Kolkata", "active", now, 1]],
  ["crm_source_taxonomy", ["source-manual", tenant, now, 1, "manual", "Manual entry", 1]],
  ["crm_source_taxonomy", ["source-web", tenant, now, 1, "website", "Website", 1]],
  ["crm_lifecycle_stages", ["stage-received", tenant, now, 1, "received", "Received", 0]],
  ["crm_lifecycle_stages", ["stage-qualified", tenant, now, 1, "qualified", "Qualified", 0]],
  ["crm_lifecycle_reasons", ["reason-not-interested", tenant, now, 1, "not_interested", "Not interested", 1]],
  ["crm_diseases", ["disease-general", tenant, now, 1, "general", "General inquiry", 1]],
  ["crm_score_policies", ["score-policy-v1", tenant, now, 1, "qualification", "v1", '{"classification":"review_required"}', now]],
  ["crm_diagnosis_versions", ["diagnosis-v1", tenant, now, 1, "loss-reasons", "v1", '{"categories":["financial","interest","follow_up_failure","hospital_doctor","competition","lead_quality","contactability"]}']],
];
if (environment !== "production") rows.push(
  ["crm_tenants", ["demo-tenant-b", "Synthetic Care Demo B", "demo-tenant-b", "Asia/Kolkata", "active", now, 1]],
  ["crm_contacts", ["contact-synthetic-opt-in", tenant, now, 1, "synthetic-name", "synthetic-phone", "demo-phone-1", null, null, "active"]],
  ["crm_lead_episodes", ["lead-synthetic-qualified", tenant, now, 1, "contact-synthetic-opt-in", "source-manual", null, null, null, "qualified", now, now, null]],
);
const schemas = {
  crm_tenants: "(id,name,slug,timezone,status,created_at,version)", crm_source_taxonomy: "(id,tenant_id,created_at,version,key,label,active)", crm_lifecycle_stages: "(id,tenant_id,created_at,version,key,label,terminal)", crm_lifecycle_reasons: "(id,tenant_id,created_at,version,key,label,requires_evidence)", crm_diseases: "(id,tenant_id,created_at,version,code,name,active)", crm_score_policies: "(id,tenant_id,created_at,version,key,version_label,rules_json,effective_at)", crm_diagnosis_versions: "(id,tenant_id,created_at,version,key,version_label,definition_json)", crm_contacts: "(id,tenant_id,created_at,version,name_ciphertext,phone_ciphertext,phone_blind_index,email_ciphertext,email_blind_index,status)", crm_lead_episodes: "(id,tenant_id,created_at,version,contact_id,source_id,campaign_id,branch_id,assigned_membership_id,lifecycle_stage,received_at,generated_at,archived_reason)",
};
db.exec("BEGIN");
try { for (const [table, values] of rows) { const columns = schemas[table]; insert(`INSERT OR IGNORE INTO ${table} ${columns} VALUES (${values.map(() => "?").join(",")})`, values); } db.exec("COMMIT"); } catch (error) { db.exec("ROLLBACK"); throw error; }
console.log(JSON.stringify({ database, environment, seeded: rows.length, syntheticPatientRecords: environment !== "production" }));

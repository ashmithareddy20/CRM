import assert from "node:assert/strict";
import test from "node:test";

const BASE_URL = "http://127.0.0.1:5173";

test("GET /api/health returns healthy status", async () => {
  const res = await fetch(`${BASE_URL}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.status, "ok");
});

test("GET /api/leads returns seeded leads array", async () => {
  const res = await fetch(`${BASE_URL}/api/leads`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.data));
  assert.ok(data.data.length >= 1);
});

test("POST, GET, PATCH, DELETE /api/leads lifecycle", async () => {
  // 1. Create a lead
  const createRes = await fetch(`${BASE_URL}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Screen Recording Demo Lead",
      phone: "+91 99999 88888",
      email: "screenrecording@example.com",
      source: "Screen Recording",
      status: "new",
      ownerId: "agent-1",
    }),
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.success, true);
  assert.equal(created.data.name, "Screen Recording Demo Lead");
  const leadId = created.data.id;

  // 2. Fetch single lead by ID
  const getRes = await fetch(`${BASE_URL}/api/leads/${leadId}`);
  assert.equal(getRes.status, 200);
  const fetched = await getRes.json();
  assert.equal(fetched.success, true);
  assert.equal(fetched.data.id, leadId);
  assert.equal(fetched.data.phone, "+91 99999 88888");

  // 3. Update lead
  const patchRes = await fetch(`${BASE_URL}/api/leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "qualified" }),
  });
  assert.equal(patchRes.status, 200);
  const updated = await patchRes.json();
  assert.equal(updated.success, true);
  assert.equal(updated.data.status, "qualified");

  // 4. Delete lead
  const deleteRes = await fetch(`${BASE_URL}/api/leads/${leadId}`, {
    method: "DELETE",
  });
  assert.equal(deleteRes.status, 200);
  const deleted = await deleteRes.json();
  assert.equal(deleted.success, true);

  // 5. Verify it is gone
  const verifyRes = await fetch(`${BASE_URL}/api/leads/${leadId}`);
  assert.equal(verifyRes.status, 404);
});

test("POST /api/calls and GET /api/calls", async () => {
  const callRes = await fetch(`${BASE_URL}/api/calls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leadId: "TRH-24190",
      agentId: "agent-1",
      direction: "outbound",
      outcome: "connected",
      durationSec: 180,
    }),
  });
  assert.equal(callRes.status, 201);
  const callData = await callRes.json();
  assert.equal(callData.success, true);

  const listRes = await fetch(`${BASE_URL}/api/calls?leadId=TRH-24190`);
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.success, true);
  assert.ok(listData.data.length >= 1);
});

test("POST /api/notes and GET /api/notes", async () => {
  const noteRes = await fetch(`${BASE_URL}/api/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leadId: "TRH-24190",
      authorId: "agent-1",
      content: "Automated test note for lead timeline.",
    }),
  });
  assert.equal(noteRes.status, 201);
  const noteData = await noteRes.json();
  assert.equal(noteData.success, true);

  const listRes = await fetch(`${BASE_URL}/api/notes?leadId=TRH-24190`);
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.success, true);
  assert.ok(listData.data.length >= 1);
});

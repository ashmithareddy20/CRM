import assert from "node:assert/strict";
import test from "node:test";

const BASE_URL = "http://127.0.0.1:5173";

test("1. GET /api/health returns healthy status", async () => {
  const res = await fetch(`${BASE_URL}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.status, "ok");
});

test("2. GET /api/leads returns seeded leads array", async () => {
  const res = await fetch(`${BASE_URL}/api/leads`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.data));
  assert.ok(data.data.length >= 1);
});

test("3. POST, GET, PATCH, DELETE /api/leads lifecycle", async () => {
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

  // 2. Fetch single lead by ID (Lead 360 bundle)
  const getRes = await fetch(`${BASE_URL}/api/leads/${leadId}`);
  assert.equal(getRes.status, 200);
  const fetched = await getRes.json();
  assert.equal(fetched.success, true);
  assert.equal(fetched.data.id, leadId);
  assert.equal(fetched.data.phone, "+91 99999 88888");
  assert.ok(Array.isArray(fetched.data.calls));
  assert.ok(Array.isArray(fetched.data.notes));

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

test("4. GET /api/leads/:id/timeline returns chronological journey events", async () => {
  const res = await fetch(`${BASE_URL}/api/leads/TRH-24190/timeline`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.data));
  assert.ok(data.data.length >= 1);
});

test("5. POST /api/calls, GET /api/calls, and POST /api/calls/dial", async () => {
  // Log call
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

  // List calls
  const listRes = await fetch(`${BASE_URL}/api/calls?leadId=TRH-24190`);
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.success, true);
  assert.ok(listData.data.length >= 1);

  // Dial call simulation
  const dialRes = await fetch(`${BASE_URL}/api/calls/dial`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leadId: "TRH-24190",
      agentId: "agent-1",
      phone: "+91 98491 22618",
    }),
  });
  assert.equal(dialRes.status, 200);
  const dialData = await dialRes.json();
  assert.equal(dialData.success, true);
  assert.equal(dialData.data.status, "initiated");
});

test("6. POST /api/notes and GET /api/notes", async () => {
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

test("7. POST, GET, PATCH, DELETE /api/tasks", async () => {
  // Create task
  const createRes = await fetch(`${BASE_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leadId: "TRH-24190",
      assigneeId: "agent-1",
      title: "Follow-up regarding proposal terms",
      dueAt: Date.now() + 3600 * 1000,
      status: "open",
    }),
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.success, true);
  const taskId = created.data.id;

  // List tasks
  const listRes = await fetch(`${BASE_URL}/api/tasks?leadId=TRH-24190`);
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.success, true);
  assert.ok(listData.data.some((t) => t.id === taskId));

  // Patch task (complete)
  const patchRes = await fetch(`${BASE_URL}/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "completed" }),
  });
  assert.equal(patchRes.status, 200);
  const patched = await patchRes.json();
  assert.equal(patched.data.status, "completed");

  // Delete task
  const delRes = await fetch(`${BASE_URL}/api/tasks/${taskId}`, { method: "DELETE" });
  assert.equal(delRes.status, 200);
});

test("8. POST, GET, PATCH, DELETE /api/appointments", async () => {
  // Create appointment
  const createRes = await fetch(`${BASE_URL}/api/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leadId: "TRH-24190",
      ownerId: "Maya Rao",
      mode: "online",
      status: "booked",
    }),
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.success, true);
  const apptId = created.data.id;

  // List appointments
  const listRes = await fetch(`${BASE_URL}/api/appointments?leadId=TRH-24190`);
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.success, true);
  assert.ok(listData.data.some((a) => a.id === apptId));

  // Patch appointment
  const patchRes = await fetch(`${BASE_URL}/api/appointments/${apptId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "confirmed" }),
  });
  assert.equal(patchRes.status, 200);
  const patched = await patchRes.json();
  assert.equal(patched.data.status, "confirmed");

  // Delete appointment
  const delRes = await fetch(`${BASE_URL}/api/appointments/${apptId}`, { method: "DELETE" });
  assert.equal(delRes.status, 200);
});

test("9. AI Reviews: POST, GET, and POST :id/approve (Human Confirmation)", async () => {
  // 1. Create AI draft review
  const createRes = await fetch(`${BASE_URL}/api/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leadId: "TRH-24190",
      confidence: 94,
      suggestedTemperature: "Hot",
      suggestedObjection: "Budget timeline",
      summaryText: "Customer verified interest in annual plan.",
    }),
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.success, true);
  const reviewId = created.data.id;

  // 2. List reviews
  const listRes = await fetch(`${BASE_URL}/api/reviews?leadId=TRH-24190`);
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.success, true);
  assert.ok(listData.data.some((r) => r.id === reviewId));

  // 3. Human confirmation / approval
  const approveRes = await fetch(`${BASE_URL}/api/reviews/${reviewId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewedBy: "Sravani K." }),
  });
  assert.equal(approveRes.status, 200);
  const approved = await approveRes.json();
  assert.equal(approved.success, true);
  assert.equal(approved.data.status, "approved");
  assert.equal(approved.data.reviewedBy, "Sravani K.");
});

test("10. POST /api/messages and GET /api/messages", async () => {
  const sendRes = await fetch(`${BASE_URL}/api/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leadId: "TRH-24190",
      channel: "whatsapp",
      content: "Hello Lakshmi, your enterprise proposal is ready.",
      sentBy: "Sravani K.",
    }),
  });
  assert.equal(sendRes.status, 201);
  const sentData = await sendRes.json();
  assert.equal(sentData.success, true);
  assert.equal(sentData.data.channel, "whatsapp");

  const listRes = await fetch(`${BASE_URL}/api/messages?leadId=TRH-24190`);
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.success, true);
  assert.ok(listData.data.length >= 1);
});

test("11. Analytics: Funnel, Ageing, Cockpit, Executive endpoints", async () => {
  // Funnel
  const funnelRes = await fetch(`${BASE_URL}/api/analytics/funnel`);
  assert.equal(funnelRes.status, 200);
  const funnelData = await funnelRes.json();
  assert.equal(funnelData.success, true);
  assert.ok(Array.isArray(funnelData.data.stages));
  assert.ok(Array.isArray(funnelData.data.leakReasons));

  // Ageing
  const ageingRes = await fetch(`${BASE_URL}/api/analytics/ageing`);
  assert.equal(ageingRes.status, 200);
  const ageingData = await ageingRes.json();
  assert.equal(ageingData.success, true);
  assert.ok(Array.isArray(ageingData.data));

  // Cockpit
  const cockpitRes = await fetch(`${BASE_URL}/api/analytics/cockpit`);
  assert.equal(cockpitRes.status, 200);
  const cockpitData = await cockpitRes.json();
  assert.equal(cockpitData.success, true);
  assert.ok(typeof cockpitData.data.completionRate === "number");

  // Executive
  const execRes = await fetch(`${BASE_URL}/api/analytics/executive`);
  assert.equal(execRes.status, 200);
  const execData = await execRes.json();
  assert.equal(execData.success, true);
  assert.ok(execData.data.attributedRevenue.includes("Cr"));
});

test("12. Auth: POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout", async () => {
  // Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "sravani@crm.example", password: "password123" }),
  });
  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.equal(loginData.success, true);
  assert.ok(loginData.data.token.startsWith("trh360-sess-"));

  // Me
  const meRes = await fetch(`${BASE_URL}/api/auth/me`);
  assert.equal(meRes.status, 200);
  const meData = await meRes.json();
  assert.equal(meData.success, true);
  assert.equal(meData.data.role, "Agent");

  // Logout
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, { method: "POST" });
  assert.equal(logoutRes.status, 200);
  const logoutData = await logoutRes.json();
  assert.equal(logoutData.loggedOut, true);
});

test("13. Admin: GET /api/admin/audit and GET /api/admin/policies", async () => {
  // Audit
  const auditRes = await fetch(`${BASE_URL}/api/admin/audit`);
  assert.equal(auditRes.status, 200);
  const auditData = await auditRes.json();
  assert.equal(auditData.success, true);
  assert.ok(Array.isArray(auditData.data));

  // Policies
  const polRes = await fetch(`${BASE_URL}/api/admin/policies`);
  assert.equal(polRes.status, 200);
  const polData = await polRes.json();
  assert.equal(polData.success, true);
  assert.ok(Array.isArray(polData.data));
  assert.ok(polData.data.length >= 3);
});

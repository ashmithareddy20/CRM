import { describe, expect, it } from "vitest";
import { ApiClient } from "../../lib/api/client";

describe("typed client contract", () => {
  it("adds authenticated idempotent command headers", async () => {
    const client = new ApiClient({
      baseUrl: "https://crm.example.test",
      accessToken: "access-token",
      csrfToken: "csrf-token",
      fetch: async (_input, init) => {
        const headers = new Headers(init?.headers);
        expect(headers.get("Authorization")).toBe("Bearer access-token");
        expect(headers.get("X-CSRF-Token")).toBe("csrf-token");
        expect(headers.get("Idempotency-Key")).toBe("lead:one");
        return Response.json({ success: true, data: { id: "lead-1" } });
      },
    });

    await expect(client.createLead({ sourceId: "source-1", platform: "web", origin: "manual", phone: "+919999999999" }, "lead:one"))
      .resolves.toEqual({ id: "lead-1" });
  });

  it("keeps authorization, conflicts, and validation distinguishable", async () => {
    const reply = (status: number, code: string) => new ApiClient({
      fetch: async () => Response.json({ success: false, error: { code, message: code, requestId: "request-1" }, message: code }, { status }),
    });
    await expect(reply(401, "AUTHENTICATION_REQUIRED").me()).rejects.toMatchObject({ kind: "authentication", status: 401 });
    await expect(reply(403, "FORBIDDEN").me()).rejects.toMatchObject({ kind: "authorization", status: 403 });
    await expect(reply(409, "CONFLICT").me()).rejects.toMatchObject({ kind: "conflict", status: 409 });
    await expect(reply(422, "VALIDATION_FAILED").me()).rejects.toMatchObject({ kind: "validation", status: 422 });
  });
});

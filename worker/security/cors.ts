import { corsOrigins, type SecurityConfigSource } from "./config";

const methods = "GET, HEAD, OPTIONS, POST, PUT, PATCH, DELETE";
const headers = "Authorization, Content-Type, Idempotency-Key, If-Match, X-CSRF-Token, X-Tenant-Id, X-Request-Id";

export function corsHeaders(request: Request, env: SecurityConfigSource): Headers {
  const origin = request.headers.get("Origin");
  const allowed = origin && corsOrigins(env).includes(origin);
  const result = new Headers({ Vary: "Origin" });
  if (allowed) {
    result.set("Access-Control-Allow-Origin", origin);
    result.set("Access-Control-Allow-Credentials", "true");
    result.set("Access-Control-Allow-Methods", methods);
    result.set("Access-Control-Allow-Headers", headers);
    result.set("Access-Control-Max-Age", "600");
  }
  return result;
}

export function corsPreflight(request: Request, env: SecurityConfigSource): Response | undefined {
  if (request.method !== "OPTIONS" || !request.headers.has("Origin")) return undefined;
  const responseHeaders = corsHeaders(request, env);
  return responseHeaders.has("Access-Control-Allow-Origin")
    ? new Response(null, { status: 204, headers: responseHeaders })
    : new Response(null, { status: 403, headers: responseHeaders });
}

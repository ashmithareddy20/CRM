/** Apply to every authenticated/sensitive API response, including errors. */
export function privateResponseHeaders(headers: HeadersInit = {}): Headers { const result = new Headers(headers); result.set("Cache-Control", "no-store, private"); result.set("Pragma", "no-cache"); result.set("X-Content-Type-Options", "nosniff"); result.set("Referrer-Policy", "no-referrer"); return result; }
export function privateJson(data: unknown, init: ResponseInit = {}): Response { return Response.json(data, { ...init, headers: privateResponseHeaders(init.headers) }); }

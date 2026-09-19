import { base64UrlDecode, base64UrlEncode, constantTimeEqual, cryptoBytes, utf8 } from "../security/encoding";
import type { SecurityConfigSource } from "../security/config";

const SESSION_COOKIE = "crm_session";
const CSRF_COOKIE = "crm_csrf";
export interface BrowserSession { id: string; tenantId: string; membershipId: string; subject: string; expiresAt: Date; issuedAt: Date }

async function sessionKey(env: SecurityConfigSource): Promise<CryptoKey> {
  if (!env.SESSION_SIGNING_KEY) throw new Error("Session signing key is unavailable");
  return crypto.subtle.importKey("raw", cryptoBytes(base64UrlDecode(env.SESSION_SIGNING_KEY)), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function sign(value: string, env: SecurityConfigSource): Promise<string> { return base64UrlEncode(new Uint8Array(await crypto.subtle.sign("HMAC", await sessionKey(env), cryptoBytes(utf8(value))))); }
function cookieValue(request: Request, name: string): string | undefined { return request.headers.get("Cookie")?.split(/;\s*/u).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1); }
export async function createSessionCookie(session: BrowserSession, env: SecurityConfigSource, secure = true): Promise<string> {
  const payload = base64UrlEncode(utf8(JSON.stringify({ ...session, expiresAt: session.expiresAt.toISOString(), issuedAt: session.issuedAt.toISOString() })));
  return `${SESSION_COOKIE}=${payload}.${await sign(payload, env)}; Path=/; HttpOnly; SameSite=Lax; ${secure ? "Secure; " : ""}Max-Age=${Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000))}`;
}
export async function readSessionCookie(request: Request, env: SecurityConfigSource, now = new Date()): Promise<BrowserSession | undefined> {
  const raw = cookieValue(request, SESSION_COOKIE); if (!raw) return undefined;
  const [payload, signature] = raw.split("."); if (!payload || !signature) return undefined;
  try {
    if (!constantTimeEqual(base64UrlDecode(signature), base64UrlDecode(await sign(payload, env)))) return undefined;
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as Omit<BrowserSession, "expiresAt" | "issuedAt"> & { expiresAt: string; issuedAt: string };
    const session = { ...parsed, expiresAt: new Date(parsed.expiresAt), issuedAt: new Date(parsed.issuedAt) };
    return session.expiresAt > now && session.id && session.tenantId && session.membershipId ? session : undefined;
  } catch { return undefined; }
}

/** CSRF is signed and binds session ID, expiry and per-issue nonce. Cookie/header equality is not enough. */
export async function createCsrfCookie(session: BrowserSession, env: SecurityConfigSource, secure = true): Promise<{ cookie: string; token: string }> {
  const payload = base64UrlEncode(utf8(JSON.stringify({ sessionId: session.id, expiresAt: session.expiresAt.toISOString(), nonce: base64UrlEncode(crypto.getRandomValues(new Uint8Array(16))) })));
  const token = `${payload}.${await sign(`csrf:${payload}`, env)}`;
  return { token, cookie: `${CSRF_COOKIE}=${token}; Path=/; SameSite=Strict; ${secure ? "Secure; " : ""}Max-Age=${Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000))}` };
}
export async function assertCsrf(request: Request, session: BrowserSession, env: SecurityConfigSource, now = new Date()): Promise<void> {
  const cookie = cookieValue(request, CSRF_COOKIE); const header = request.headers.get("X-CSRF-Token");
  if (!cookie || !header || cookie.length !== header.length || !constantTimeEqual(utf8(cookie), utf8(header))) throw new Error("CSRF token is invalid");
  const [payload, signature] = header.split("."); if (!payload || !signature) throw new Error("CSRF token is invalid");
  try {
    if (!constantTimeEqual(base64UrlDecode(signature), base64UrlDecode(await sign(`csrf:${payload}`, env)))) throw new Error("CSRF token is invalid");
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as { sessionId?: string; expiresAt?: string; nonce?: string };
    if (parsed.sessionId !== session.id || !parsed.nonce || new Date(parsed.expiresAt ?? 0) <= now) throw new Error("CSRF token is invalid");
  } catch { throw new Error("CSRF token is invalid"); }
}
export function clearSessionCookie(secure = true): string { return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; ${secure ? "Secure; " : ""}Max-Age=0`; }
export function clearCsrfCookie(secure = true): string { return `${CSRF_COOKIE}=; Path=/; SameSite=Strict; ${secure ? "Secure; " : ""}Max-Age=0`; }

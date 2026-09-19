import { base64UrlDecode, base64UrlEncode, constantTimeEqual, cryptoBytes, utf8 } from "../security/encoding";
import type { SecurityConfigSource } from "../security/config";

const SESSION_COOKIE = "crm_session";
const CSRF_COOKIE = "crm_csrf";
export interface BrowserSession { id: string; tenantId: string; membershipId: string; subject: string; expiresAt: Date; issuedAt: Date }

async function signingKey(env: SecurityConfigSource): Promise<CryptoKey> {
  if (!env.AUDIT_ANCHOR_KEY) throw new Error("Session signing key is unavailable");
  return crypto.subtle.importKey("raw", cryptoBytes(base64UrlDecode(env.AUDIT_ANCHOR_KEY)), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function sign(value: string, env: SecurityConfigSource): Promise<string> { return base64UrlEncode(new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(env), cryptoBytes(utf8(value))))); }
export async function createSessionCookie(session: BrowserSession, env: SecurityConfigSource, secure = true): Promise<string> {
  const payload = base64UrlEncode(utf8(JSON.stringify({ ...session, expiresAt: session.expiresAt.toISOString(), issuedAt: session.issuedAt.toISOString() })));
  const value = `${payload}.${await sign(payload, env)}`;
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; ${secure ? "Secure; " : ""}Max-Age=${Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000))}`;
}
export async function readSessionCookie(request: Request, env: SecurityConfigSource, now = new Date()): Promise<BrowserSession | undefined> {
  const raw = request.headers.get("Cookie")?.split(/;\s*/u).find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!raw) return undefined; const [payload, signature] = raw.split("."); if (!payload || !signature) return undefined;
  try {
    if (!constantTimeEqual(base64UrlDecode(signature), base64UrlDecode(await sign(payload, env)))) return undefined;
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as Omit<BrowserSession, "expiresAt" | "issuedAt"> & { expiresAt: string; issuedAt: string };
    const session = { ...parsed, expiresAt: new Date(parsed.expiresAt), issuedAt: new Date(parsed.issuedAt) };
    return session.expiresAt > now ? session : undefined;
  } catch { return undefined; }
}
export function createCsrfCookie(secure = true): { cookie: string; token: string } { const token = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32))); return { token, cookie: `${CSRF_COOKIE}=${token}; Path=/; SameSite=Lax; ${secure ? "Secure; " : ""}Max-Age=28800` }; }
export function assertCsrf(request: Request): void { const cookie = request.headers.get("Cookie")?.split(/;\s*/u).find((item) => item.startsWith(`${CSRF_COOKIE}=`))?.slice(CSRF_COOKIE.length + 1); const header = request.headers.get("X-CSRF-Token"); if (!cookie || !header || cookie.length !== header.length || !constantTimeEqual(utf8(cookie), utf8(header))) throw new Error("CSRF token is invalid"); }
export function clearSessionCookie(secure = true): string { return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; ${secure ? "Secure; " : ""}Max-Age=0`; }

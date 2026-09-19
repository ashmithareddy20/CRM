import { ApiError } from "../api/errors";
export interface RateLimitDecision { allowed: boolean; limit: number; remaining: number; resetAt: Date; }
export interface RateLimitStore { take(key: string, limit: number, windowMs: number, now: Date): Promise<RateLimitDecision>; }
export interface RateLimitPolicy { limit: number; windowMs: number; }
export const userRoutePolicy: RateLimitPolicy = { limit: 120, windowMs: 60_000 };
export const webhookPolicy: RateLimitPolicy = { limit: 300, windowMs: 60_000 };
/** Per-isolate fallback only; production should supply a durable Cloudflare/D1/DO-backed store. */
export class MemoryRateLimitStore implements RateLimitStore { private readonly buckets = new Map<string, { count: number; resetAt: number }>(); async take(key: string, limit: number, windowMs: number, now: Date): Promise<RateLimitDecision> { const current = this.buckets.get(key); const resetAt = !current || current.resetAt <= now.getTime() ? now.getTime() + windowMs : current.resetAt; const count = (!current || current.resetAt <= now.getTime() ? 0 : current.count) + 1; this.buckets.set(key, { count, resetAt }); return { allowed: count <= limit, limit, remaining: Math.max(0, limit - count), resetAt: new Date(resetAt) }; } }
function clientKey(request: Request): string { return request.headers.get("CF-Connecting-IP")?.trim().slice(0, 80) || "unknown"; }
export async function limitUserRoute(request: Request, store: RateLimitStore, policy = userRoutePolicy, now = new Date()): Promise<RateLimitDecision> { return requireLimit(await store.take(`user:${clientKey(request)}`, policy.limit, policy.windowMs, now)); }
export async function limitWebhook(request: Request, provider: string, store: RateLimitStore, policy = webhookPolicy, now = new Date()): Promise<RateLimitDecision> { return requireLimit(await store.take(`webhook:${provider}:${clientKey(request)}`, policy.limit, policy.windowMs, now)); }
function requireLimit(decision: RateLimitDecision): RateLimitDecision { if (!decision.allowed) throw new ApiError("RATE_LIMITED", 429, "Too many requests"); return decision; }
export function rateLimitHeaders(decision: RateLimitDecision): Headers { return new Headers({ "RateLimit-Limit": String(decision.limit), "RateLimit-Remaining": String(decision.remaining), "RateLimit-Reset": String(Math.ceil(decision.resetAt.getTime() / 1000)), "Cache-Control": "no-store" }); }

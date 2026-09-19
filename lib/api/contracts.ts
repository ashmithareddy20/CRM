import { z } from "zod";

export const apiVersion = "v1" as const;
export const leadTemperatureSchema = z.enum(["hot", "warm", "cold", "unqualified"]);
export const lifecycleStageSchema = z.enum(["received", "assigned", "contact_attempted", "qualified", "appointment_booked", "converted", "closed"]);
export const callDispositionSchema = z.enum(["pending", "connected", "no_answer", "busy", "invalid_number", "wrong_number", "not_interested"]);

export const ifMatchVersionSchema = z.string().regex(/^\d+$/, "If-Match must be an integer version");
export const idempotencyKeySchema = z.string().min(8).max(255).regex(/^[A-Za-z0-9._:-]+$/, "Idempotency-Key contains unsupported characters");

export type LeadTemperature = z.infer<typeof leadTemperatureSchema>;
export type LifecycleStage = z.infer<typeof lifecycleStageSchema>;
export type CallDisposition = z.infer<typeof callDispositionSchema>;

export interface PageMeta { nextCursor?: string; limit: number; }
export interface SuccessEnvelope<T> { success: true; data: T; meta?: PageMeta; }
export interface ErrorEnvelope { success: false; error: { code: string; message: string; fields?: Record<string, string>; requestId: string }; message: string; }
export type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

export interface CommandPreconditions { idempotencyKey: string; ifMatch?: string; }

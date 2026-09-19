import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { Database } from "../../../db";
import { appointmentEvents, appointmentSeries, doctorAvailability, doctors, slotReservations } from "../../../db/schema";
import { ApiError } from "../../api/errors";

export type AppointmentStatus = "suggested" | "considering" | "booked" | "confirmation_pending" | "confirmed" | "rescheduled" | "cancelled" | "no_show" | "arrived" | "consultation_completed";
export interface AppointmentContext { tenantId: string; actorMembershipId: string; now: Date; }
export interface AppointmentCommand { leadId: string; doctorId: string; branchId: string; startsAt: Date; durationMinutes: number; status?: Extract<AppointmentStatus, "suggested" | "considering" | "booked" | "confirmation_pending">; patientPreference?: string; }
export interface AppointmentRecord { id: string; seriesId: string; leadId: string; doctorId: string; branchId: string; startsAt: Date; endsAt: Date; status: AppointmentStatus; version: number; }
const activeReservationStatuses = new Set<AppointmentStatus>(["booked", "confirmation_pending", "confirmed"]);
const mutableStatuses = new Set<AppointmentStatus>(["booked", "confirmation_pending", "confirmed", "suggested", "considering"]);
const id = () => crypto.randomUUID();

export class AppointmentService {
  constructor(private readonly db: Database, private readonly slotMinutes = 15) {}

  async book(context: AppointmentContext, command: AppointmentCommand): Promise<AppointmentRecord> {
    validateCommand(command, this.slotMinutes, context.now);
    const status = command.status ?? "confirmation_pending";
    const doctor = await this.db.select().from(doctors).where(and(eq(doctors.tenantId, context.tenantId), eq(doctors.id, command.doctorId), eq(doctors.branchId, command.branchId), eq(doctors.active, true))).get();
    if (!doctor) throw new ApiError("NOT_FOUND", 404, "Doctor is unavailable");
    const endsAt = new Date(command.startsAt.getTime() + command.durationMinutes * 60_000);
    const available = await this.db.select({ id: doctorAvailability.id }).from(doctorAvailability).where(and(
      eq(doctorAvailability.tenantId, context.tenantId), eq(doctorAvailability.doctorId, command.doctorId), eq(doctorAvailability.status, "available"),
      lte(doctorAvailability.startsAt, command.startsAt), gte(doctorAvailability.endsAt, endsAt),
    )).get();
    if (!available) throw new ApiError("CONFLICT", 409, "Requested time is outside doctor availability");

    const seriesId = id(); const appointmentId = id();
    const record: AppointmentRecord = { id: appointmentId, seriesId, leadId: command.leadId, doctorId: command.doctorId, branchId: command.branchId, startsAt: command.startsAt, endsAt, status, version: 1 };
    const reservations = activeReservationStatuses.has(status) ? reservationRows(context, record, this.slotMinutes) : [];
    try {
      await this.db.batch([
        this.db.insert(appointmentSeries).values({ id: seriesId, tenantId: context.tenantId, leadId: command.leadId, doctorId: command.doctorId, branchId: command.branchId, status: "active", createdAt: context.now, createdByMembershipId: context.actorMembershipId }),
        this.db.insert(appointmentEvents).values({ ...record, tenantId: context.tenantId, createdAt: context.now, createdByMembershipId: context.actorMembershipId }),
        ...reservations.map((row) => this.db.insert(slotReservations).values(row)),
      ] as Parameters<Database["batch"]>[0]);
    } catch { throw slotConflict(); }
    return record;
  }

  async transition(context: AppointmentContext, appointmentId: string, expectedVersion: number, status: Extract<AppointmentStatus, "confirmed" | "cancelled" | "no_show" | "arrived" | "consultation_completed">, reason?: string): Promise<void> {
    const current = await this.get(context.tenantId, appointmentId);
    if (!current || current.version !== expectedVersion) throw new ApiError("CONFLICT", 409, "Appointment has changed");
    if (!mutableStatuses.has(current.status) && status !== "consultation_completed") throw new ApiError("CONFLICT", 409, "Appointment cannot be changed from its current state");
    if ((status === "cancelled" || status === "no_show") && !reason?.trim()) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { reason: "Cancellation or no-show reason is required" });
    const releases = status === "cancelled" || status === "no_show" ? this.db.update(slotReservations).set({ status: "released", updatedAt: context.now, updatedByMembershipId: context.actorMembershipId }).where(and(eq(slotReservations.tenantId, context.tenantId), eq(slotReservations.appointmentId, appointmentId), eq(slotReservations.status, "active"))) : undefined;
    const update = this.db.update(appointmentEvents).set({ status, updatedAt: context.now, updatedByMembershipId: context.actorMembershipId, version: sql`${appointmentEvents.version} + 1` }).where(and(eq(appointmentEvents.tenantId, context.tenantId), eq(appointmentEvents.id, appointmentId), eq(appointmentEvents.version, expectedVersion)));
    const results = await this.db.batch(releases ? [update, releases] : [update]);
    if ((results[0] as { meta?: { changes?: number } }).meta?.changes !== 1) throw new ApiError("CONFLICT", 409, "Appointment has changed");
  }

  async reschedule(context: AppointmentContext, appointmentId: string, expectedVersion: number, command: Omit<AppointmentCommand, "leadId">): Promise<AppointmentRecord> {
    const current = await this.get(context.tenantId, appointmentId);
    if (!current || current.version !== expectedVersion) throw new ApiError("CONFLICT", 409, "Appointment has changed");
    if (!mutableStatuses.has(current.status)) throw new ApiError("CONFLICT", 409, "Appointment cannot be rescheduled");
    validateCommand({ ...command, leadId: current.leadId }, this.slotMinutes, context.now);
    if (command.branchId !== current.branchId) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { branchId: "Reschedule must remain with the appointment branch" });
    const endsAt = new Date(command.startsAt.getTime() + command.durationMinutes * 60_000);
    const replacement: AppointmentRecord = { id: id(), seriesId: current.seriesId, leadId: current.leadId, doctorId: command.doctorId, branchId: command.branchId, startsAt: command.startsAt, endsAt, status: command.status ?? "confirmation_pending", version: 1 };
    const doctor = await this.db.select({ id: doctors.id }).from(doctors).where(and(eq(doctors.tenantId, context.tenantId), eq(doctors.id, replacement.doctorId), eq(doctors.branchId, replacement.branchId), eq(doctors.active, true))).get();
    const availability = await this.db.select({ id: doctorAvailability.id }).from(doctorAvailability).where(and(eq(doctorAvailability.tenantId, context.tenantId), eq(doctorAvailability.doctorId, replacement.doctorId), eq(doctorAvailability.status, "available"), lte(doctorAvailability.startsAt, replacement.startsAt), gte(doctorAvailability.endsAt, endsAt))).get();
    if (!doctor || !availability) throw new ApiError("CONFLICT", 409, "Requested time is unavailable");
    try {
      const update = this.db.update(appointmentEvents).set({ status: "rescheduled", updatedAt: context.now, updatedByMembershipId: context.actorMembershipId, version: sql`${appointmentEvents.version} + 1` }).where(and(eq(appointmentEvents.tenantId, context.tenantId), eq(appointmentEvents.id, appointmentId), eq(appointmentEvents.version, expectedVersion)));
      // A new immutable appointment event preserves the prior time and confirmation history.
      const statements = [update,
        this.db.update(slotReservations).set({ status: "released", updatedAt: context.now, updatedByMembershipId: context.actorMembershipId }).where(and(eq(slotReservations.tenantId, context.tenantId), eq(slotReservations.appointmentId, appointmentId), eq(slotReservations.status, "active"))),
        this.db.insert(appointmentEvents).values({ ...replacement, tenantId: context.tenantId, createdAt: context.now, createdByMembershipId: context.actorMembershipId }),
        ...reservationRows(context, replacement, this.slotMinutes).map((row) => this.db.insert(slotReservations).values(row)),
      ];
      const [first, ...rest] = statements;
      if (!first) throw new ApiError("INTERNAL_ERROR", 500, "Appointment update is unavailable");
      const results = await this.db.batch([first, ...rest] as unknown as Parameters<Database["batch"]>[0]);
      if ((results[0] as { meta?: { changes?: number } }).meta?.changes !== 1) throw new ApiError("CONFLICT", 409, "Appointment has changed");
    } catch (error) { if (error instanceof ApiError) throw error; throw slotConflict(); }
    return replacement;
  }

  async get(tenantId: string, appointmentId: string): Promise<AppointmentRecord | undefined> {
    const row = await this.db.select().from(appointmentEvents).where(and(eq(appointmentEvents.tenantId, tenantId), eq(appointmentEvents.id, appointmentId))).get();
    return row ? { id: row.id, seriesId: row.seriesId, leadId: row.leadId, doctorId: row.doctorId, branchId: row.branchId, startsAt: row.startsAt, endsAt: row.endsAt, status: row.status as AppointmentStatus, version: row.version } : undefined;
  }
}
function reservationRows(context: AppointmentContext, record: AppointmentRecord, minutes: number) {
  return Array.from({ length: (record.endsAt.getTime() - record.startsAt.getTime()) / (minutes * 60_000) }, (_, index) => ({ id: id(), tenantId: context.tenantId, appointmentId: record.id, doctorId: record.doctorId, branchId: record.branchId, slotStartAt: new Date(record.startsAt.getTime() + index * minutes * 60_000), status: "active", createdAt: context.now, createdByMembershipId: context.actorMembershipId }));
}
function validateCommand(command: AppointmentCommand, minutes: number, now: Date) {
  if (!(command.startsAt instanceof Date) || Number.isNaN(command.startsAt.getTime()) || command.startsAt <= now) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { startsAt: "Appointment must be in the future" });
  if (!Number.isInteger(command.durationMinutes) || command.durationMinutes < minutes || command.durationMinutes > 8 * 60 || command.durationMinutes % minutes) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { durationMinutes: `Duration must be a ${minutes}-minute increment` });
  if (command.startsAt.getTime() % (minutes * 60_000)) throw new ApiError("VALIDATION_FAILED", 422, "Request validation failed", { startsAt: `Start must align to ${minutes}-minute slots` });
}
function slotConflict(): ApiError { return new ApiError("CONFLICT", 409, "Requested appointment slot is no longer available"); }

import type { RecoveryService } from "../domain/recovery/service";
/** Cron/queue integration supplies a tenant scope; scheduled recovery only creates gated touches, it never sends directly. */
export async function scheduleDueRecovery(service: RecoveryService, input: { tenantId: string; now: Date; limit?: number }): Promise<number> {
  return service.scheduleDue(input.tenantId, input.now, input.limit);
}

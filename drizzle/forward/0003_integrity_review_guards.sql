-- Follow-up data-integrity repairs. Historical migration files remain immutable.
-- New nullable identity/link columns permit a safe expand step for existing data;
-- command handlers will make them required as their writes are upgraded.
DROP INDEX IF EXISTS `crm_slot_occupied_uq`;--> statement-breakpoint
CREATE UNIQUE INDEX `crm_slot_active_occupancy_uq`
ON `crm_slot_reservations` (`tenant_id`, `doctor_id`, `branch_id`, `slot_start_at`)
WHERE `status` = 'active';--> statement-breakpoint
CREATE INDEX `crm_slot_lookup_idx` ON `crm_slot_reservations` (`tenant_id`, `doctor_id`, `branch_id`, `slot_start_at`, `status`);--> statement-breakpoint
ALTER TABLE `crm_treatments_completed` ADD COLUMN `completion_identity` text;--> statement-breakpoint
ALTER TABLE `crm_treatments_completed` ADD COLUMN `command_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `crm_treatment_completion_identity_uq` ON `crm_treatments_completed` (`tenant_id`, `completion_identity`) WHERE `completion_identity` IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `crm_treatment_command_uq` ON `crm_treatments_completed` (`tenant_id`, `command_id`) WHERE `command_id` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `crm_revenue_ledger` ADD COLUMN `treatment_completion_id` text;--> statement-breakpoint
CREATE INDEX `crm_revenue_treatment_idx` ON `crm_revenue_ledger` (`tenant_id`, `treatment_completion_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `crm_revenue_reversal_uq` ON `crm_revenue_ledger` (`tenant_id`, `reverses_entry_id`) WHERE `reverses_entry_id` IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `crm_lead_active_diagnosis_uq` ON `crm_lead_diagnoses` (`tenant_id`, `lead_id`) WHERE `status` = 'active';--> statement-breakpoint
DROP INDEX IF EXISTS `crm_recovery_active_uq`;--> statement-breakpoint
ALTER TABLE `crm_recovery_enrollments` ADD COLUMN `reactivation_at` integer;--> statement-breakpoint
ALTER TABLE `crm_recovery_enrollments` ADD COLUMN `reason_snapshot` text;--> statement-breakpoint
CREATE UNIQUE INDEX `crm_recovery_active_lead_uq` ON `crm_recovery_enrollments` (`tenant_id`, `lead_id`) WHERE `status` IN ('planned', 'active', 'paused');--> statement-breakpoint
ALTER TABLE `crm_scheduled_touches` ADD COLUMN `purpose` text NOT NULL DEFAULT 'legacy_unspecified';--> statement-breakpoint
ALTER TABLE `crm_scheduled_touches` ADD COLUMN `requested_channel` text NOT NULL DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE `crm_message_attempts` ADD COLUMN `requested_channel` text NOT NULL DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE `crm_webhook_inbox` ADD COLUMN `attempt_count` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `crm_webhook_inbox` ADD COLUMN `next_attempt_at` integer;--> statement-breakpoint
ALTER TABLE `crm_transactional_outbox` ADD COLUMN `attempt_count` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `crm_transactional_outbox` ADD COLUMN `next_attempt_at` integer;--> statement-breakpoint
DROP INDEX IF EXISTS `crm_inbox_status_idx`;--> statement-breakpoint
CREATE INDEX `crm_inbox_status_idx` ON `crm_webhook_inbox` (`tenant_id`, `status`, `next_attempt_at`, `received_at`);--> statement-breakpoint
DROP INDEX IF EXISTS `crm_outbox_pending_idx`;--> statement-breakpoint
CREATE INDEX `crm_outbox_pending_idx` ON `crm_transactional_outbox` (`tenant_id`, `status`, `next_attempt_at`, `available_at`);--> statement-breakpoint
CREATE INDEX `crm_idempotency_expiry_idx` ON `crm_idempotency_commands` (`tenant_id`, `status`, `expires_at`);
-- `archived_at` is the canonical archive/merge state. `archived_reason` remains
-- temporarily readable for legacy backfill callers and is mirrored only on writes.
CREATE TRIGGER `crm_lead_legacy_archive_reason_update`
AFTER UPDATE OF `archived_reason` ON `crm_lead_episodes`
FOR EACH ROW WHEN NEW.archived_reason IS NOT NULL AND NEW.archived_at IS NULL
BEGIN UPDATE crm_lead_episodes SET archived_at = COALESCE(NEW.updated_at, strftime('%s','now') * 1000) WHERE id = NEW.id AND tenant_id = NEW.tenant_id; END;--> statement-breakpoint
-- Tenant-reference guards must also run when a relationship or tenant scope is edited.
CREATE TRIGGER `crm_lead_contact_tenant_update`
BEFORE UPDATE OF `tenant_id`, `contact_id` ON `crm_lead_episodes`
FOR EACH ROW WHEN NOT EXISTS (SELECT 1 FROM crm_contacts c WHERE c.id = NEW.contact_id AND c.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'lead contact must belong to tenant'); END;--> statement-breakpoint
CREATE TRIGGER `crm_lead_assignment_tenant_update`
BEFORE UPDATE OF `tenant_id`, `assigned_membership_id` ON `crm_lead_episodes`
FOR EACH ROW WHEN NEW.assigned_membership_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM crm_memberships m WHERE m.id = NEW.assigned_membership_id AND m.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'lead membership must belong to tenant'); END;--> statement-breakpoint
CREATE TRIGGER `crm_task_lead_tenant_update`
BEFORE UPDATE OF `tenant_id`, `lead_id` ON `crm_tasks`
FOR EACH ROW WHEN NEW.lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM crm_lead_episodes l WHERE l.id = NEW.lead_id AND l.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'task lead must belong to tenant'); END;--> statement-breakpoint
CREATE TRIGGER `crm_transition_lead_tenant_update`
BEFORE UPDATE OF `tenant_id`, `lead_id` ON `crm_lifecycle_transitions`
FOR EACH ROW WHEN NOT EXISTS (SELECT 1 FROM crm_lead_episodes l WHERE l.id = NEW.lead_id AND l.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'transition lead must belong to tenant'); END;--> statement-breakpoint
CREATE TRIGGER `crm_diagnosis_lead_tenant_insert`
BEFORE INSERT ON `crm_lead_diagnoses`
FOR EACH ROW WHEN NOT EXISTS (SELECT 1 FROM crm_lead_episodes l WHERE l.id = NEW.lead_id AND l.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'diagnosis lead must belong to tenant'); END;--> statement-breakpoint
CREATE TRIGGER `crm_diagnosis_lead_tenant_update`
BEFORE UPDATE OF `tenant_id`, `lead_id` ON `crm_lead_diagnoses`
FOR EACH ROW WHEN NOT EXISTS (SELECT 1 FROM crm_lead_episodes l WHERE l.id = NEW.lead_id AND l.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'diagnosis lead must belong to tenant'); END;--> statement-breakpoint
CREATE TRIGGER `crm_recovery_diagnosis_tenant_insert`
BEFORE INSERT ON `crm_recovery_enrollments`
FOR EACH ROW WHEN NOT EXISTS (SELECT 1 FROM crm_lead_diagnoses d WHERE d.id = NEW.diagnosis_id AND d.lead_id = NEW.lead_id AND d.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'recovery diagnosis must belong to tenant lead'); END;--> statement-breakpoint
CREATE TRIGGER `crm_recovery_diagnosis_tenant_update`
BEFORE UPDATE OF `tenant_id`, `lead_id`, `diagnosis_id` ON `crm_recovery_enrollments`
FOR EACH ROW WHEN NOT EXISTS (SELECT 1 FROM crm_lead_diagnoses d WHERE d.id = NEW.diagnosis_id AND d.lead_id = NEW.lead_id AND d.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'recovery diagnosis must belong to tenant lead'); END;--> statement-breakpoint
CREATE TRIGGER `crm_revenue_treatment_tenant_insert`
BEFORE INSERT ON `crm_revenue_ledger`
FOR EACH ROW WHEN NEW.treatment_completion_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM crm_treatments_completed t WHERE t.id = NEW.treatment_completion_id AND t.lead_id = NEW.lead_id AND t.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'revenue treatment must belong to tenant lead'); END;--> statement-breakpoint
CREATE TRIGGER `crm_revenue_treatment_tenant_update`
BEFORE UPDATE OF `tenant_id`, `lead_id`, `treatment_completion_id` ON `crm_revenue_ledger`
FOR EACH ROW WHEN NEW.treatment_completion_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM crm_treatments_completed t WHERE t.id = NEW.treatment_completion_id AND t.lead_id = NEW.lead_id AND t.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'revenue treatment must belong to tenant lead'); END;
--> statement-breakpoint
CREATE TRIGGER `crm_treatment_lead_tenant_insert`
BEFORE INSERT ON `crm_treatments_completed`
FOR EACH ROW WHEN NOT EXISTS (SELECT 1 FROM crm_lead_episodes l WHERE l.id = NEW.lead_id AND l.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'treatment lead must belong to tenant'); END;--> statement-breakpoint
CREATE TRIGGER `crm_treatment_lead_tenant_update`
BEFORE UPDATE OF `tenant_id`, `lead_id` ON `crm_treatments_completed`
FOR EACH ROW WHEN NOT EXISTS (SELECT 1 FROM crm_lead_episodes l WHERE l.id = NEW.lead_id AND l.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'treatment lead must belong to tenant'); END;
--> statement-breakpoint
UPDATE `crm_recovery_enrollments`
SET `reactivation_at` = COALESCE(`reactivation_at`, `eligible_at`),
    `reason_snapshot` = COALESCE(`reason_snapshot`, 'legacy_unverified')
WHERE `reactivation_at` IS NULL OR `reason_snapshot` IS NULL;--> statement-breakpoint
CREATE TRIGGER `crm_recovery_enrollment_snapshot_default`
AFTER INSERT ON `crm_recovery_enrollments`
FOR EACH ROW WHEN NEW.reactivation_at IS NULL OR NEW.reason_snapshot IS NULL
BEGIN UPDATE crm_recovery_enrollments
SET reactivation_at = COALESCE(NEW.reactivation_at, NEW.eligible_at),
    reason_snapshot = COALESCE(NEW.reason_snapshot, 'legacy_unverified')
WHERE id = NEW.id AND tenant_id = NEW.tenant_id; END;--> statement-breakpoint
UPDATE `crm_treatments_completed`
SET `completion_identity` = COALESCE(`completion_identity`, 'legacy:' || `id`),
    `command_id` = COALESCE(`command_id`, 'legacy:' || `id`)
WHERE `completion_identity` IS NULL OR `command_id` IS NULL;--> statement-breakpoint
CREATE TRIGGER `crm_treatment_identity_default`
AFTER INSERT ON `crm_treatments_completed`
FOR EACH ROW WHEN NEW.completion_identity IS NULL OR NEW.command_id IS NULL
BEGIN UPDATE crm_treatments_completed
SET completion_identity = COALESCE(NEW.completion_identity, 'legacy:' || NEW.id),
    command_id = COALESCE(NEW.command_id, 'legacy:' || NEW.id)
WHERE id = NEW.id AND tenant_id = NEW.tenant_id; END;

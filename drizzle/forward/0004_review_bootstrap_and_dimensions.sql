-- Review follow-up: expand-only bootstrap, consent provenance, and query integrity.
ALTER TABLE `crm_suppressions` ADD COLUMN `evidence_id` text;--> statement-breakpoint
ALTER TABLE `crm_suppressions` ADD COLUMN `actor_membership_id` text NOT NULL DEFAULT 'legacy-system';--> statement-breakpoint
ALTER TABLE `crm_suppressions` ADD COLUMN `supersedes_suppression_id` text;--> statement-breakpoint
ALTER TABLE `crm_suppressions` ADD COLUMN `superseded_at` integer;--> statement-breakpoint
ALTER TABLE `crm_suppressions` ADD COLUMN `effective_at` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `crm_suppressions` ADD COLUMN `expires_at` integer;--> statement-breakpoint
ALTER TABLE `crm_suppressions` ADD COLUMN `state` text NOT NULL DEFAULT 'active';--> statement-breakpoint
UPDATE `crm_suppressions`
SET `effective_at` = COALESCE(`effective_at`, `occurred_at`),
    `state` = CASE WHEN `active` = 1 THEN 'active' ELSE 'superseded' END
WHERE `effective_at` IS NULL OR `state` NOT IN ('active', 'superseded', 'expired', 'revoked');--> statement-breakpoint
CREATE INDEX `crm_suppression_effective_idx` ON `crm_suppressions` (`tenant_id`, `contact_id`, `channel`, `state`, `effective_at`);--> statement-breakpoint
CREATE INDEX `crm_suppression_supersedes_idx` ON `crm_suppressions` (`tenant_id`, `supersedes_suppression_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `crm_revenue_treatment_kind_uq`
ON `crm_revenue_ledger` (`tenant_id`, `treatment_completion_id`, `kind`)
WHERE `treatment_completion_id` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `crm_reporting_fact_cursor_idx` ON `crm_reporting_facts` (`tenant_id`, `occurred_at`, `id`);--> statement-breakpoint
CREATE INDEX `crm_reporting_branch_dimension_idx` ON `crm_reporting_facts` (`tenant_id`, json_extract(`dimensions_json`, '$.branchId'), `occurred_at`, `id`);--> statement-breakpoint
CREATE INDEX `crm_reporting_source_dimension_idx` ON `crm_reporting_facts` (`tenant_id`, json_extract(`dimensions_json`, '$.sourceId'), `occurred_at`, `id`);--> statement-breakpoint
CREATE INDEX `crm_reporting_campaign_dimension_idx` ON `crm_reporting_facts` (`tenant_id`, json_extract(`dimensions_json`, '$.campaignId'), `occurred_at`, `id`);--> statement-breakpoint
CREATE INDEX `crm_reporting_assignee_dimension_idx` ON `crm_reporting_facts` (`tenant_id`, json_extract(`dimensions_json`, '$.assignedMembershipId'), `occurred_at`, `id`);--> statement-breakpoint
CREATE INDEX `crm_reporting_original_assignee_dimension_idx` ON `crm_reporting_facts` (`tenant_id`, json_extract(`dimensions_json`, '$.originalAssignedMembershipId'), `occurred_at`, `id`);--> statement-breakpoint
CREATE INDEX `crm_reporting_channel_dimension_idx` ON `crm_reporting_facts` (`tenant_id`, json_extract(`dimensions_json`, '$.channel'), `occurred_at`, `id`);--> statement-breakpoint
CREATE INDEX `crm_reporting_disease_dimension_idx` ON `crm_reporting_facts` (`tenant_id`, json_extract(`dimensions_json`, '$.diseaseId'), `occurred_at`, `id`);--> statement-breakpoint
CREATE INDEX `crm_reporting_treatment_dimension_idx` ON `crm_reporting_facts` (`tenant_id`, json_extract(`dimensions_json`, '$.treatmentId'), `occurred_at`, `id`);
--> statement-breakpoint
CREATE TRIGGER `crm_suppression_effective_default`
AFTER INSERT ON `crm_suppressions`
FOR EACH ROW WHEN NEW.effective_at = 0
BEGIN UPDATE crm_suppressions SET effective_at = NEW.occurred_at WHERE id = NEW.id AND tenant_id = NEW.tenant_id; END;--> statement-breakpoint
CREATE TRIGGER `crm_suppression_supersession_effective`
AFTER INSERT ON `crm_suppressions`
FOR EACH ROW WHEN NEW.supersedes_suppression_id IS NOT NULL
BEGIN UPDATE crm_suppressions SET state = 'superseded', active = 0, superseded_at = NEW.effective_at WHERE id = NEW.supersedes_suppression_id AND tenant_id = NEW.tenant_id; END;

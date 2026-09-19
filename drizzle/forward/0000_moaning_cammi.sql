CREATE TABLE `crm_branches` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`timezone` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_branches_tenant_id_uq` ON `crm_branches` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `crm_branches_tenant_idx` ON `crm_branches` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `crm_users` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`email_ciphertext` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `crm_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`email_ciphertext` text NOT NULL,
	`role_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_invitations_token_uq` ON `crm_invitations` (`token_hash`);--> statement-breakpoint
CREATE TABLE `crm_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`branch_id` text,
	`team_id` text,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_memberships_tenant_id_uq` ON `crm_memberships` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `crm_memberships_user_tenant_uq` ON `crm_memberships` (`user_id`,`tenant_id`);--> statement-breakpoint
CREATE INDEX `crm_memberships_scope_idx` ON `crm_memberships` (`tenant_id`,`branch_id`,`team_id`);--> statement-breakpoint
CREATE TABLE `crm_oidc_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`issuer` text NOT NULL,
	`subject` text NOT NULL,
	`claims_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_oidc_issuer_subject_uq` ON `crm_oidc_identities` (`issuer`,`subject`);--> statement-breakpoint
CREATE INDEX `crm_oidc_user_idx` ON `crm_oidc_identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `crm_role_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`role_id` text NOT NULL,
	`permission` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_role_permissions_uq` ON `crm_role_permissions` (`tenant_id`,`role_id`,`permission`);--> statement-breakpoint
CREATE TABLE `crm_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`system` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_roles_tenant_key_uq` ON `crm_roles` (`tenant_id`,`key`);--> statement-breakpoint
CREATE TABLE `crm_service_principals` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`credential_hash` text NOT NULL,
	`scopes_json` text NOT NULL,
	`disabled_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_service_principal_credential_uq` ON `crm_service_principals` (`credential_hash`);--> statement-breakpoint
CREATE TABLE `crm_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`membership_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_sessions_token_uq` ON `crm_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `crm_sessions_membership_idx` ON `crm_sessions` (`tenant_id`,`membership_id`);--> statement-breakpoint
CREATE TABLE `crm_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`branch_id` text,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_teams_tenant_id_uq` ON `crm_teams` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `crm_teams_tenant_branch_idx` ON `crm_teams` (`tenant_id`,`branch_id`);--> statement-breakpoint
CREATE TABLE `crm_tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`timezone` text DEFAULT 'Asia/Kolkata' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_tenants_slug_uq` ON `crm_tenants` (`slug`);--> statement-breakpoint
CREATE TABLE `crm_acquisition_touches` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`campaign_id` text,
	`form_id` text,
	`occurred_at` integer NOT NULL,
	`utm_json` text,
	`referrer` text
);
--> statement-breakpoint
CREATE INDEX `crm_acquisition_lead_idx` ON `crm_acquisition_touches` (`tenant_id`,`lead_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `crm_ad_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`campaign_id` text NOT NULL,
	`provider` text NOT NULL,
	`external_id` text,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_ad_sets_external_uq` ON `crm_ad_sets` (`tenant_id`,`provider`,`external_id`);--> statement-breakpoint
CREATE TABLE `crm_assignment_history` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`from_membership_id` text,
	`to_membership_id` text,
	`rule_id` text,
	`reason` text NOT NULL,
	`assigned_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `crm_assignment_history_idx` ON `crm_assignment_history` (`tenant_id`,`lead_id`,`assigned_at`);--> statement-breakpoint
CREATE TABLE `crm_assignment_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`priority` integer NOT NULL,
	`definition_json` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `crm_campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`source_id` text NOT NULL,
	`provider` text NOT NULL,
	`external_id` text,
	`name` text NOT NULL,
	`starts_at` integer,
	`ends_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_campaigns_external_uq` ON `crm_campaigns` (`tenant_id`,`provider`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `crm_campaigns_tenant_id_uq` ON `crm_campaigns` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `crm_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`name_ciphertext` text,
	`phone_ciphertext` text,
	`phone_blind_index` text,
	`email_ciphertext` text,
	`email_blind_index` text,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_contacts_tenant_id_uq` ON `crm_contacts` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `crm_contacts_phone_idx` ON `crm_contacts` (`tenant_id`,`phone_blind_index`);--> statement-breakpoint
CREATE INDEX `crm_contacts_email_idx` ON `crm_contacts` (`tenant_id`,`email_blind_index`);--> statement-breakpoint
CREATE TABLE `crm_creatives` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`ad_set_id` text NOT NULL,
	`provider` text NOT NULL,
	`external_id` text,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_creatives_external_uq` ON `crm_creatives` (`tenant_id`,`provider`,`external_id`);--> statement-breakpoint
CREATE TABLE `crm_dedup_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`candidate_lead_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_dedup_pair_uq` ON `crm_dedup_candidates` (`tenant_id`,`lead_id`,`candidate_lead_id`);--> statement-breakpoint
CREATE TABLE `crm_external_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text,
	`provider` text NOT NULL,
	`external_id` text NOT NULL,
	`payload_ciphertext` text,
	`received_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_external_submission_uq` ON `crm_external_submissions` (`tenant_id`,`provider`,`external_id`);--> statement-breakpoint
CREATE TABLE `crm_lead_episodes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`contact_id` text NOT NULL,
	`source_id` text NOT NULL,
	`campaign_id` text,
	`branch_id` text,
	`assigned_membership_id` text,
	`lifecycle_stage` text DEFAULT 'received' NOT NULL,
	`received_at` integer NOT NULL,
	`generated_at` integer,
	`archived_reason` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_leads_tenant_id_uq` ON `crm_lead_episodes` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `crm_leads_scope_idx` ON `crm_lead_episodes` (`tenant_id`,`lifecycle_stage`,`assigned_membership_id`,`received_at`);--> statement-breakpoint
CREATE INDEX `crm_leads_contact_idx` ON `crm_lead_episodes` (`tenant_id`,`contact_id`);--> statement-breakpoint
CREATE TABLE `crm_lead_forms` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`campaign_id` text,
	`provider` text NOT NULL,
	`external_id` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_lead_forms_external_uq` ON `crm_lead_forms` (`tenant_id`,`provider`,`external_id`);--> statement-breakpoint
CREATE TABLE `crm_lead_merge_links` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`canonical_lead_id` text NOT NULL,
	`merged_lead_id` text NOT NULL,
	`reason` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_merge_merged_uq` ON `crm_lead_merge_links` (`tenant_id`,`merged_lead_id`);--> statement-breakpoint
CREATE TABLE `crm_source_taxonomy` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_source_taxonomy_key_uq` ON `crm_source_taxonomy` (`tenant_id`,`key`);--> statement-breakpoint
CREATE TABLE `crm_diseases` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_diseases_code_uq` ON `crm_diseases` (`tenant_id`,`code`);--> statement-breakpoint
CREATE TABLE `crm_qualification_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`questionnaire_id` text NOT NULL,
	`question_key` text NOT NULL,
	`answer_ciphertext` text,
	`answered_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_answer_uq` ON `crm_qualification_answers` (`tenant_id`,`lead_id`,`questionnaire_id`,`question_key`);--> statement-breakpoint
CREATE INDEX `crm_answers_lead_idx` ON `crm_qualification_answers` (`tenant_id`,`lead_id`);--> statement-breakpoint
CREATE TABLE `crm_qualification_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`policy_id` text NOT NULL,
	`classification` text NOT NULL,
	`total` integer NOT NULL,
	`evidence_json` text NOT NULL,
	`assessed_at` integer NOT NULL,
	`reviewed_by_membership_id` text,
	`override_reason` text
);
--> statement-breakpoint
CREATE INDEX `crm_scores_lead_idx` ON `crm_qualification_scores` (`tenant_id`,`lead_id`,`assessed_at`);--> statement-breakpoint
CREATE TABLE `crm_questionnaires` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`key` text NOT NULL,
	`version_label` text NOT NULL,
	`definition_json` text NOT NULL,
	`effective_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_questionnaires_version_uq` ON `crm_questionnaires` (`tenant_id`,`key`,`version_label`);--> statement-breakpoint
CREATE TABLE `crm_score_components` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`score_id` text NOT NULL,
	`component` text NOT NULL,
	`points` integer NOT NULL,
	`evidence_json` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_score_component_uq` ON `crm_score_components` (`tenant_id`,`score_id`,`component`);--> statement-breakpoint
CREATE TABLE `crm_score_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`key` text NOT NULL,
	`version_label` text NOT NULL,
	`rules_json` text NOT NULL,
	`effective_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_score_policy_version_uq` ON `crm_score_policies` (`tenant_id`,`key`,`version_label`);--> statement-breakpoint
CREATE TABLE `crm_treatments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`disease_id` text,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_treatments_code_uq` ON `crm_treatments` (`tenant_id`,`code`);--> statement-breakpoint
CREATE TABLE `crm_allowed_transitions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`from_stage_id` text NOT NULL,
	`to_stage_id` text NOT NULL,
	`policy_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_allowed_transition_uq` ON `crm_allowed_transitions` (`tenant_id`,`from_stage_id`,`to_stage_id`);--> statement-breakpoint
CREATE TABLE `crm_lead_outcomes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`outcome` text NOT NULL,
	`reason_id` text,
	`diagnosis_id` text,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_outcome_lead_uq` ON `crm_lead_outcomes` (`tenant_id`,`lead_id`);--> statement-breakpoint
CREATE TABLE `crm_lifecycle_reasons` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`stage_id` text,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`requires_evidence` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_lifecycle_reasons_key_uq` ON `crm_lifecycle_reasons` (`tenant_id`,`key`);--> statement-breakpoint
CREATE TABLE `crm_lifecycle_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`terminal` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_lifecycle_stages_key_uq` ON `crm_lifecycle_stages` (`tenant_id`,`key`);--> statement-breakpoint
CREATE TABLE `crm_lifecycle_transitions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`from_stage` text NOT NULL,
	`to_stage` text NOT NULL,
	`reason_id` text,
	`command_id` text NOT NULL,
	`expected_version` integer NOT NULL,
	`occurred_at` integer NOT NULL,
	`evidence_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_transition_command_uq` ON `crm_lifecycle_transitions` (`tenant_id`,`command_id`);--> statement-breakpoint
CREATE INDEX `crm_transitions_lead_idx` ON `crm_lifecycle_transitions` (`tenant_id`,`lead_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `crm_next_action_commitments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`owner_membership_id` text NOT NULL,
	`due_at` integer NOT NULL,
	`action` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `crm_next_actions_due_idx` ON `crm_next_action_commitments` (`tenant_id`,`owner_membership_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `crm_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`content_ciphertext` text NOT NULL,
	`immutable_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `crm_notes_lead_idx` ON `crm_notes` (`tenant_id`,`lead_id`,`immutable_at`);--> statement-breakpoint
CREATE TABLE `crm_call_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`membership_id` text,
	`provider` text,
	`external_id` text,
	`direction` text NOT NULL,
	`disposition` text DEFAULT 'pending' NOT NULL,
	`dialed_at` integer,
	`connected_at` integer,
	`ended_at` integer,
	`legacy_evidence` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_call_provider_event_uq` ON `crm_call_attempts` (`tenant_id`,`provider`,`external_id`);--> statement-breakpoint
CREATE INDEX `crm_calls_lead_idx` ON `crm_call_attempts` (`tenant_id`,`lead_id`,`dialed_at`);--> statement-breakpoint
CREATE TABLE `crm_call_remarks` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`call_attempt_id` text NOT NULL,
	`patient_statement_ciphertext` text,
	`agent_explanation_ciphertext` text,
	`objection` text,
	`next_action` text,
	`next_action_due_at` integer,
	`not_applicable_reason` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_call_remarks_attempt_uq` ON `crm_call_remarks` (`tenant_id`,`call_attempt_id`);--> statement-breakpoint
CREATE TABLE `crm_contact_capabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`contact_id` text NOT NULL,
	`channel` text NOT NULL,
	`capability` text NOT NULL,
	`observed_at` integer NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_capability_uq` ON `crm_contact_capabilities` (`tenant_id`,`contact_id`,`channel`,`capability`,`observed_at`);--> statement-breakpoint
CREATE TABLE `crm_evidence_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text,
	`object_key` text NOT NULL,
	`sha256` text NOT NULL,
	`media_type` text NOT NULL,
	`classification` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_evidence_object_uq` ON `crm_evidence_assets` (`tenant_id`,`object_key`);--> statement-breakpoint
CREATE INDEX `crm_evidence_lead_idx` ON `crm_evidence_assets` (`tenant_id`,`lead_id`);--> statement-breakpoint
CREATE TABLE `crm_note_amendments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`note_id` text NOT NULL,
	`content_ciphertext` text NOT NULL,
	`reason` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `crm_channel_costs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`message_attempt_id` text,
	`channel` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`estimated` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `crm_consent_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`contact_id` text NOT NULL,
	`purpose` text NOT NULL,
	`channel` text,
	`state` text NOT NULL,
	`evidence_id` text,
	`occurred_at` integer NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE INDEX `crm_consent_contact_idx` ON `crm_consent_events` (`tenant_id`,`contact_id`,`purpose`,`channel`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `crm_contact_dispatch_gates` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`contact_id` text NOT NULL,
	`active_touch_id` text,
	`reserved_until` integer,
	`last_accepted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_dispatch_gate_contact_uq` ON `crm_contact_dispatch_gates` (`tenant_id`,`contact_id`);--> statement-breakpoint
CREATE TABLE `crm_content_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`object_key` text NOT NULL,
	`content_hash` text NOT NULL,
	`media_type` text NOT NULL,
	`status` text DEFAULT 'quarantined' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_content_asset_uq` ON `crm_content_assets` (`tenant_id`,`object_key`);--> statement-breakpoint
CREATE TABLE `crm_journey_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`journey_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`purpose` text NOT NULL,
	`channel` text NOT NULL,
	`delay_seconds` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_journey_step_uq` ON `crm_journey_steps` (`tenant_id`,`journey_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `crm_journeys` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`key` text NOT NULL,
	`version_label` text NOT NULL,
	`definition_json` text NOT NULL,
	`active` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_journey_version_uq` ON `crm_journeys` (`tenant_id`,`key`,`version_label`);--> statement-breakpoint
CREATE TABLE `crm_message_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`touch_id` text,
	`contact_id` text NOT NULL,
	`channel` text NOT NULL,
	`purpose` text NOT NULL,
	`template_version_id` text,
	`accepted_content_hash` text,
	`provider` text,
	`provider_message_id` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`accepted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_message_provider_uq` ON `crm_message_attempts` (`tenant_id`,`provider`,`provider_message_id`);--> statement-breakpoint
CREATE INDEX `crm_messages_contact_idx` ON `crm_message_attempts` (`tenant_id`,`contact_id`,`accepted_at`);--> statement-breakpoint
CREATE TABLE `crm_message_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`message_attempt_id` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`payload_ciphertext` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_message_event_uq` ON `crm_message_events` (`tenant_id`,`provider_event_id`);--> statement-breakpoint
CREATE TABLE `crm_scheduled_touches` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`journey_step_id` text,
	`due_at` integer NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`gate_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_scheduled_gate_uq` ON `crm_scheduled_touches` (`tenant_id`,`gate_key`);--> statement-breakpoint
CREATE INDEX `crm_touches_due_idx` ON `crm_scheduled_touches` (`tenant_id`,`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `crm_suppressions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`contact_id` text NOT NULL,
	`channel` text,
	`reason` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `crm_suppression_contact_idx` ON `crm_suppressions` (`tenant_id`,`contact_id`,`channel`,`active`);--> statement-breakpoint
CREATE TABLE `crm_template_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`template_version_id` text NOT NULL,
	`approved_by_membership_id` text NOT NULL,
	`decision` text NOT NULL,
	`decided_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `crm_template_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`template_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`content_ciphertext` text NOT NULL,
	`content_hash` text NOT NULL,
	`approved_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_template_version_uq` ON `crm_template_versions` (`tenant_id`,`template_id`,`version_number`);--> statement-breakpoint
CREATE TABLE `crm_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`key` text NOT NULL,
	`purpose` text NOT NULL,
	`channel` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_templates_key_uq` ON `crm_templates` (`tenant_id`,`key`);--> statement-breakpoint
CREATE TABLE `crm_appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`series_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`doctor_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`status` text DEFAULT 'suggested' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_appointments_tenant_id_uq` ON `crm_appointments` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `crm_appointments_doctor_idx` ON `crm_appointments` (`tenant_id`,`doctor_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `crm_appointment_series` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`doctor_id` text,
	`branch_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `crm_appointment_series_lead_idx` ON `crm_appointment_series` (`tenant_id`,`lead_id`);--> statement-breakpoint
CREATE TABLE `crm_business_calendars` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`branch_id` text,
	`timezone` text NOT NULL,
	`schedule_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `crm_doctor_availability` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`doctor_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`status` text DEFAULT 'available' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `crm_doctor_availability_idx` ON `crm_doctor_availability` (`tenant_id`,`doctor_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `crm_doctors` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`branch_id` text NOT NULL,
	`membership_id` text,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_doctors_tenant_id_uq` ON `crm_doctors` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `crm_escalation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`task_id` text,
	`rule_id` text NOT NULL,
	`threshold` integer NOT NULL,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_escalation_once_uq` ON `crm_escalation_events` (`tenant_id`,`task_id`,`rule_id`,`threshold`);--> statement-breakpoint
CREATE TABLE `crm_escalation_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`key` text NOT NULL,
	`threshold_seconds` integer NOT NULL,
	`definition_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_escalation_rule_uq` ON `crm_escalation_rules` (`tenant_id`,`key`);--> statement-breakpoint
CREATE TABLE `crm_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`membership_id` text NOT NULL,
	`type` text NOT NULL,
	`payload_ciphertext` text,
	`read_at` integer
);
--> statement-breakpoint
CREATE INDEX `crm_notifications_idx` ON `crm_notifications` (`tenant_id`,`membership_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `crm_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text,
	`assignee_membership_id` text,
	`title` text NOT NULL,
	`due_at` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `crm_tasks_queue_idx` ON `crm_tasks` (`tenant_id`,`assignee_membership_id`,`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `crm_sla_clocks` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text,
	`task_id` text,
	`policy_key` text NOT NULL,
	`due_at` integer NOT NULL,
	`status` text DEFAULT 'running' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `crm_sla_due_idx` ON `crm_sla_clocks` (`tenant_id`,`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `crm_slot_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`appointment_id` text NOT NULL,
	`doctor_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`slot_start_at` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_slot_active_occupancy_uq` ON `crm_slot_reservations` (`tenant_id`,`doctor_id`,`branch_id`,`slot_start_at`) WHERE `status` = 'active';--> statement-breakpoint
CREATE TABLE `crm_admissions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`status` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`evidence_id` text
);
--> statement-breakpoint
CREATE INDEX `crm_admissions_lead_idx` ON `crm_admissions` (`tenant_id`,`lead_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `crm_clinical_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`consultation_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`decision` text NOT NULL,
	`details_ciphertext` text,
	`confirmed_by_membership_id` text NOT NULL,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `crm_clinical_decisions_lead_idx` ON `crm_clinical_decisions` (`tenant_id`,`lead_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `crm_consultations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`status` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`evidence_id` text
);
--> statement-breakpoint
CREATE INDEX `crm_consultations_lead_idx` ON `crm_consultations` (`tenant_id`,`lead_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `crm_counseling_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`status` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`evidence_id` text
);
--> statement-breakpoint
CREATE INDEX `crm_counseling_sessions_lead_idx` ON `crm_counseling_sessions` (`tenant_id`,`lead_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `crm_discount_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`requested_by_membership_id` text NOT NULL,
	`requested_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`approved_by_membership_id` text,
	`expires_at` integer
);
--> statement-breakpoint
CREATE TABLE `crm_insurance_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`status` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`evidence_id` text
);
--> statement-breakpoint
CREATE INDEX `crm_insurance_cases_lead_idx` ON `crm_insurance_cases` (`tenant_id`,`lead_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `crm_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_package_code_uq` ON `crm_packages` (`tenant_id`,`code`);--> statement-breakpoint
CREATE TABLE `crm_procedure_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`status` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`evidence_id` text
);
--> statement-breakpoint
CREATE INDEX `crm_procedure_bookings_lead_idx` ON `crm_procedure_bookings` (`tenant_id`,`lead_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `crm_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`issued_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_quote_version_uq` ON `crm_quotes` (`tenant_id`,`lead_id`,`version_number`);--> statement-breakpoint
CREATE TABLE `crm_revenue_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`reverses_entry_id` text,
	`occurred_at` integer NOT NULL,
	`evidence_id` text
);
--> statement-breakpoint
CREATE INDEX `crm_revenue_lead_idx` ON `crm_revenue_ledger` (`tenant_id`,`lead_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `crm_treatments_completed` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`status` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`evidence_id` text
);
--> statement-breakpoint
CREATE INDEX `crm_treatments_completed_lead_idx` ON `crm_treatments_completed` (`tenant_id`,`lead_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `crm_diagnosis_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`key` text NOT NULL,
	`version_label` text NOT NULL,
	`definition_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_diagnosis_version_uq` ON `crm_diagnosis_versions` (`tenant_id`,`key`,`version_label`);--> statement-breakpoint
CREATE TABLE `crm_lead_diagnoses` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`version_id` text NOT NULL,
	`primary_reason` text NOT NULL,
	`secondary_reason` text,
	`evidence_id` text NOT NULL,
	`recoverability` text NOT NULL,
	`review_at` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `crm_diagnoses_lead_idx` ON `crm_lead_diagnoses` (`tenant_id`,`lead_id`,`status`);--> statement-breakpoint
CREATE TABLE `crm_management_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`diagnosis_id` text,
	`finding` text NOT NULL,
	`evidence_id` text,
	`owner_membership_id` text,
	`review_at` integer
);
--> statement-breakpoint
CREATE TABLE `crm_recovery_campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`definition_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `crm_recovery_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`lead_id` text NOT NULL,
	`diagnosis_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`eligible_at` integer NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_recovery_active_uq` ON `crm_recovery_enrollments` (`tenant_id`,`lead_id`,`status`);--> statement-breakpoint
CREATE INDEX `crm_recovery_due_idx` ON `crm_recovery_enrollments` (`tenant_id`,`status`,`eligible_at`);--> statement-breakpoint
CREATE TABLE `crm_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`actor_key` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`request_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`detail_ciphertext` text
);
--> statement-breakpoint
CREATE INDEX `crm_audit_resource_idx` ON `crm_audit_events` (`tenant_id`,`resource_type`,`resource_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `crm_dead_letters` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`job_id` text,
	`reason` text NOT NULL,
	`payload_ciphertext` text,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `crm_durable_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`type` text NOT NULL,
	`payload_ciphertext` text NOT NULL,
	`due_at` integer NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`lease_owner` text,
	`lease_expires_at` integer,
	`attempts` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `crm_jobs_due_idx` ON `crm_durable_jobs` (`tenant_id`,`state`,`due_at`);--> statement-breakpoint
CREATE TABLE `crm_idempotency_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`actor_key` text NOT NULL,
	`operation` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`result_ciphertext` text,
	`status` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_idempotency_uq` ON `crm_idempotency_commands` (`tenant_id`,`actor_key`,`operation`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `crm_migration_reconciliations` (
	`id` text PRIMARY KEY NOT NULL,
	`environment` text NOT NULL,
	`legacy_shape` text NOT NULL,
	`baseline_version` text NOT NULL,
	`inspected_at` integer NOT NULL,
	`checksum` text NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_migration_reconciliation_uq` ON `crm_migration_reconciliations` (`environment`,`checksum`);--> statement-breakpoint
CREATE TABLE `crm_transactional_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`operation_key` text NOT NULL,
	`type` text NOT NULL,
	`payload_ciphertext` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`available_at` integer NOT NULL,
	`published_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_outbox_operation_uq` ON `crm_transactional_outbox` (`tenant_id`,`operation_key`);--> statement-breakpoint
CREATE INDEX `crm_outbox_pending_idx` ON `crm_transactional_outbox` (`status`,`available_at`);--> statement-breakpoint
CREATE TABLE `crm_webhook_inbox` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`provider` text NOT NULL,
	`integration_id` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`payload_ciphertext` text NOT NULL,
	`received_at` integer NOT NULL,
	`status` text DEFAULT 'received' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_inbox_event_uq` ON `crm_webhook_inbox` (`provider`,`integration_id`,`provider_event_id`);--> statement-breakpoint
CREATE INDEX `crm_inbox_status_idx` ON `crm_webhook_inbox` (`tenant_id`,`status`,`received_at`);--> statement-breakpoint
CREATE TABLE `crm_campaign_spend` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`campaign_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `crm_daily_aggregates` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`metric_key` text NOT NULL,
	`local_date` text NOT NULL,
	`dimensions_hash` text NOT NULL,
	`value_json` text NOT NULL,
	`watermark` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_daily_aggregate_uq` ON `crm_daily_aggregates` (`tenant_id`,`metric_key`,`local_date`,`dimensions_hash`);--> statement-breakpoint
CREATE TABLE `crm_kpi_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`key` text NOT NULL,
	`version_label` text NOT NULL,
	`definition_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_kpi_version_uq` ON `crm_kpi_definitions` (`tenant_id`,`key`,`version_label`);--> statement-breakpoint
CREATE TABLE `crm_report_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`type` text NOT NULL,
	`filters_json` text NOT NULL,
	`status` text NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `crm_reporting_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_membership_id` text,
	`updated_at` integer,
	`updated_by_membership_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`source_event_id` text NOT NULL,
	`fact_type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`dimensions_json` text NOT NULL,
	`value_minor` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_reporting_fact_source_uq` ON `crm_reporting_facts` (`tenant_id`,`source_event_id`);--> statement-breakpoint
CREATE INDEX `crm_reporting_fact_idx` ON `crm_reporting_facts` (`tenant_id`,`fact_type`,`occurred_at`);
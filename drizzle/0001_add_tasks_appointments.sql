CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`assignee_id` text NOT NULL,
	`title` text NOT NULL,
	`due_at` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`mode` text DEFAULT 'online' NOT NULL,
	`status` text DEFAULT 'booked' NOT NULL,
	`created_at` integer NOT NULL
);

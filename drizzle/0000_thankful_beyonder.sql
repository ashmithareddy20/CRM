CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`assignee_id` text NOT NULL,
	`title` text NOT NULL,
	`due_at` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL
);--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`mode` text DEFAULT 'online' NOT NULL,
	`status` text DEFAULT 'booked' NOT NULL,
	`created_at` integer NOT NULL
);
CREATE TABLE `calls` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`direction` text NOT NULL,
	`outcome` text DEFAULT 'pending' NOT NULL,
	`duration_sec` integer DEFAULT 0,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`owner_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`author_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'agent' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
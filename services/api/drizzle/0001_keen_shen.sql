CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`challenger_id` text NOT NULL,
	`challenged_id` text,
	`time_control` text NOT NULL,
	`category` text NOT NULL,
	`rated` integer DEFAULT false NOT NULL,
	`preferred_color` text DEFAULT 'random' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`game_id` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`challenger_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`challenged_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `challenges_status_expires_idx` ON `challenges` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `friends` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`friend_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`friend_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `friends_user_friend_idx` ON `friends` (`user_id`,`friend_id`);--> statement-breakpoint
ALTER TABLE `games` ADD `rated` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `games` ADD `game_type` text DEFAULT 'matchmaking' NOT NULL;--> statement-breakpoint
CREATE INDEX `games_white_player_started_idx` ON `games` (`white_player_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `games_black_player_started_idx` ON `games` (`black_player_id`,`started_at`);--> statement-breakpoint
ALTER TABLE `ratings` ADD `bullet_games` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ratings` ADD `bullet_wins` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ratings` ADD `bullet_losses` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ratings` ADD `bullet_draws` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ratings` ADD `blitz_games` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ratings` ADD `blitz_wins` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ratings` ADD `blitz_losses` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ratings` ADD `blitz_draws` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ratings` ADD `rapid_games` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ratings` ADD `rapid_wins` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ratings` ADD `rapid_losses` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ratings` ADD `rapid_draws` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ratings` ADD `classical_games` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ratings` ADD `classical_wins` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ratings` ADD `classical_losses` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ratings` ADD `classical_draws` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `reports` ADD `resolution_notes` text;--> statement-breakpoint
ALTER TABLE `reports` ADD `resolved_by` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `reports` ADD `resolved_at` integer;--> statement-breakpoint
CREATE INDEX `reports_status_idx` ON `reports` (`status`);--> statement-breakpoint
CREATE INDEX `reports_reported_id_idx` ON `reports` (`reported_id`);
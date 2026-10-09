export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS \`user\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`name\` text NOT NULL,
	\`email\` text NOT NULL,
	\`email_verified\` integer DEFAULT false NOT NULL,
	\`image\` text,
	\`created_at\` integer NOT NULL,
	\`updated_at\` integer NOT NULL,
	\`role\` text DEFAULT 'user' NOT NULL,
	\`is_banned\` integer DEFAULT false NOT NULL,
	\`ban_expires_at\` integer
);

CREATE UNIQUE INDEX IF NOT EXISTS \`user_email_unique\` ON \`user\` (\`email\`);

CREATE TABLE IF NOT EXISTS \`session\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`expires_at\` integer NOT NULL,
	\`token\` text NOT NULL,
	\`created_at\` integer NOT NULL,
	\`updated_at\` integer NOT NULL,
	\`ip_address\` text,
	\`user_agent\` text,
	\`user_id\` text NOT NULL,
	FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS \`session_token_unique\` ON \`session\` (\`token\`);

CREATE TABLE IF NOT EXISTS \`account\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`account_id\` text NOT NULL,
	\`provider_id\` text NOT NULL,
	\`user_id\` text NOT NULL,
	\`access_token\` text,
	\`refresh_token\` text,
	\`id_token\` text,
	\`access_token_expires_at\` integer,
	\`refresh_token_expires_at\` integer,
	\`scope\` text,
	\`password\` text,
	\`created_at\` integer NOT NULL,
	\`updated_at\` integer NOT NULL,
	FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS \`verification\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`identifier\` text NOT NULL,
	\`value\` text NOT NULL,
	\`expires_at\` integer NOT NULL,
	\`created_at\` integer,
	\`updated_at\` integer
);

CREATE TABLE IF NOT EXISTS \`ratings\` (
	\`user_id\` text PRIMARY KEY NOT NULL,
	\`bullet_rating\` real DEFAULT 1500 NOT NULL,
	\`bullet_rd\` real DEFAULT 350 NOT NULL,
	\`bullet_vol\` real DEFAULT 0.06 NOT NULL,
	\`bullet_games\` integer DEFAULT 0 NOT NULL,
	\`bullet_wins\` integer DEFAULT 0 NOT NULL,
	\`bullet_losses\` integer DEFAULT 0 NOT NULL,
	\`bullet_draws\` integer DEFAULT 0 NOT NULL,
	\`blitz_rating\` real DEFAULT 1500 NOT NULL,
	\`blitz_rd\` real DEFAULT 350 NOT NULL,
	\`blitz_vol\` real DEFAULT 0.06 NOT NULL,
	\`blitz_games\` integer DEFAULT 0 NOT NULL,
	\`blitz_wins\` integer DEFAULT 0 NOT NULL,
	\`blitz_losses\` integer DEFAULT 0 NOT NULL,
	\`blitz_draws\` integer DEFAULT 0 NOT NULL,
	\`rapid_rating\` real DEFAULT 1500 NOT NULL,
	\`rapid_rd\` real DEFAULT 350 NOT NULL,
	\`rapid_vol\` real DEFAULT 0.06 NOT NULL,
	\`rapid_games\` integer DEFAULT 0 NOT NULL,
	\`rapid_wins\` integer DEFAULT 0 NOT NULL,
	\`rapid_losses\` integer DEFAULT 0 NOT NULL,
	\`rapid_draws\` integer DEFAULT 0 NOT NULL,
	\`classical_rating\` real DEFAULT 1500 NOT NULL,
	\`classical_rd\` real DEFAULT 350 NOT NULL,
	\`classical_vol\` real DEFAULT 0.06 NOT NULL,
	\`classical_games\` integer DEFAULT 0 NOT NULL,
	\`classical_wins\` integer DEFAULT 0 NOT NULL,
	\`classical_losses\` integer DEFAULT 0 NOT NULL,
	\`classical_draws\` integer DEFAULT 0 NOT NULL,
	\`updated_at\` integer NOT NULL,
	FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS \`games\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`white_player_id\` text,
	\`black_player_id\` text,
	\`time_control\` text NOT NULL,
	\`category\` text NOT NULL,
	\`moves\` text NOT NULL,
	\`result\` text NOT NULL,
	\`termination\` text NOT NULL,
	\`rated\` integer DEFAULT true NOT NULL,
	\`game_type\` text DEFAULT 'matchmaking' NOT NULL,
	\`white_rating_before\` real,
	\`white_rating_change\` real,
	\`black_rating_before\` real,
	\`black_rating_change\` real,
	\`started_at\` integer NOT NULL,
	\`ended_at\` integer,
	FOREIGN KEY (\`white_player_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (\`black_player_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX IF NOT EXISTS \`games_white_player_started_idx\` ON \`games\` (\`white_player_id\`, \`started_at\`);
CREATE INDEX IF NOT EXISTS \`games_black_player_started_idx\` ON \`games\` (\`black_player_id\`, \`started_at\`);

CREATE TABLE IF NOT EXISTS \`reports\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`reporter_id\` text NOT NULL,
	\`reported_id\` text NOT NULL,
	\`game_id\` text,
	\`reason\` text NOT NULL,
	\`details\` text,
	\`status\` text DEFAULT 'pending' NOT NULL,
	\`resolution_notes\` text,
	\`resolved_by\` text,
	\`resolved_at\` integer,
	\`created_at\` integer NOT NULL,
	FOREIGN KEY (\`reporter_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (\`reported_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (\`game_id\`) REFERENCES \`games\`(\`id\`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (\`resolved_by\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX IF NOT EXISTS \`reports_status_idx\` ON \`reports\` (\`status\`);
CREATE INDEX IF NOT EXISTS \`reports_reported_id_idx\` ON \`reports\` (\`reported_id\`);

CREATE TABLE IF NOT EXISTS \`audit_logs\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`admin_id\` text NOT NULL,
	\`target_id\` text,
	\`action\` text NOT NULL,
	\`details\` text,
	\`created_at\` integer NOT NULL,
	FOREIGN KEY (\`admin_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS \`friends\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`user_id\` text NOT NULL,
	\`friend_id\` text NOT NULL,
	\`status\` text DEFAULT 'pending' NOT NULL,
	\`created_at\` integer NOT NULL,
	\`updated_at\` integer NOT NULL,
	FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`friend_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS \`friends_user_friend_idx\` ON \`friends\` (\`user_id\`, \`friend_id\`);
CREATE UNIQUE INDEX IF NOT EXISTS \`friends_canonical_pair_idx\` ON \`friends\` (
	CASE WHEN \`user_id\` < \`friend_id\` THEN \`user_id\` ELSE \`friend_id\` END,
	CASE WHEN \`user_id\` < \`friend_id\` THEN \`friend_id\` ELSE \`user_id\` END
);

CREATE TABLE IF NOT EXISTS \`challenges\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`challenger_id\` text NOT NULL,
	\`challenged_id\` text,
	\`time_control\` text NOT NULL,
	\`category\` text NOT NULL,
	\`rated\` integer DEFAULT false NOT NULL,
	\`preferred_color\` text DEFAULT 'random' NOT NULL,
	\`status\` text DEFAULT 'pending' NOT NULL,
	\`game_id\` text,
	\`expires_at\` integer NOT NULL,
	\`created_at\` integer NOT NULL,
	FOREIGN KEY (\`challenger_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`challenged_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS \`challenges_status_expires_idx\` ON \`challenges\` (\`status\`, \`expires_at\`);

CREATE TABLE IF NOT EXISTS \`rating_history\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`user_id\` text NOT NULL,
	\`game_id\` text NOT NULL,
	\`category\` text NOT NULL,
	\`rating_before\` real NOT NULL,
	\`rating_after\` real NOT NULL,
	\`rating_change\` real NOT NULL,
	\`rd_before\` real,
	\`rd_after\` real,
	\`recorded_at\` integer NOT NULL,
	FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`game_id\`) REFERENCES \`games\`(\`id\`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS \`rating_history_user_idx\` ON \`rating_history\` (\`user_id\`, \`recorded_at\`);
`;

export async function applyTestSchema(db: D1Database): Promise<void> {
  const statements = SCHEMA_SQL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await db.prepare(stmt).run();
  }
}

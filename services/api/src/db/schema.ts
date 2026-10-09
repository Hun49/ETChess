import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ============================================================================
// Better Auth Core Tables
// ============================================================================

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  // Custom moderation fields
  role: text("role").notNull().default("user"), // 'user' | 'admin' | 'moderator'
  isBanned: integer("is_banned", { mode: "boolean" }).notNull().default(false),
  banExpiresAt: integer("ban_expires_at", { mode: "timestamp" }),
  experienceLevel: text("experience_level").default("intermediate"),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// ============================================================================
// ET Chess Application Tables
// ============================================================================

export const ratings = sqliteTable("ratings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  bulletRating: real("bullet_rating").notNull().default(1500),
  bulletRd: real("bullet_rd").notNull().default(350),
  bulletVol: real("bullet_vol").notNull().default(0.06),
  bulletGames: integer("bullet_games").notNull().default(0),
  bulletWins: integer("bullet_wins").notNull().default(0),
  bulletLosses: integer("bullet_losses").notNull().default(0),
  bulletDraws: integer("bullet_draws").notNull().default(0),

  blitzRating: real("blitz_rating").notNull().default(1500),
  blitzRd: real("blitz_rd").notNull().default(350),
  blitzVol: real("blitz_vol").notNull().default(0.06),
  blitzGames: integer("blitz_games").notNull().default(0),
  blitzWins: integer("blitz_wins").notNull().default(0),
  blitzLosses: integer("blitz_losses").notNull().default(0),
  blitzDraws: integer("blitz_draws").notNull().default(0),

  rapidRating: real("rapid_rating").notNull().default(1500),
  rapidRd: real("rapid_rd").notNull().default(350),
  rapidVol: real("rapid_vol").notNull().default(0.06),
  rapidGames: integer("rapid_games").notNull().default(0),
  rapidWins: integer("rapid_wins").notNull().default(0),
  rapidLosses: integer("rapid_losses").notNull().default(0),
  rapidDraws: integer("rapid_draws").notNull().default(0),

  classicalRating: real("classical_rating").notNull().default(1500),
  classicalRd: real("classical_rd").notNull().default(350),
  classicalVol: real("classical_vol").notNull().default(0.06),
  classicalGames: integer("classical_games").notNull().default(0),
  classicalWins: integer("classical_wins").notNull().default(0),
  classicalLosses: integer("classical_losses").notNull().default(0),
  classicalDraws: integer("classical_draws").notNull().default(0),

  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const games = sqliteTable(
  "games",
  {
    id: text("id").primaryKey(),
    whitePlayerId: text("white_player_id").references(() => user.id),
    blackPlayerId: text("black_player_id").references(() => user.id),
    timeControl: text("time_control").notNull(), // '1+0', '3+2', etc.
    category: text("category").notNull(), // 'bullet' | 'blitz' | 'rapid' | 'classical'
    moves: text("moves").notNull(), // JSON array of SAN / UCI move objects
    result: text("result").notNull(), // '1-0' | '0-1' | '1/2-1/2' | '*'
    termination: text("termination").notNull(), // 'checkmate', 'timeout', 'forfeit', etc.
    rated: integer("rated", { mode: "boolean" }).notNull().default(true),
    gameType: text("game_type").notNull().default("matchmaking"), // 'matchmaking' | 'challenge' | 'bot'
    whiteRatingBefore: real("white_rating_before"),
    whiteRatingChange: real("white_rating_change"),
    blackRatingBefore: real("black_rating_before"),
    blackRatingChange: real("black_rating_change"),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp" }),
  },
  (table) => [
    index("games_white_player_started_idx").on(table.whitePlayerId, table.startedAt),
    index("games_black_player_started_idx").on(table.blackPlayerId, table.startedAt),
  ],
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => user.id),
    reportedId: text("reported_id")
      .notNull()
      .references(() => user.id),
    gameId: text("game_id").references(() => games.id),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").notNull().default("pending"), // 'pending' | 'resolved' | 'dismissed'
    resolutionNotes: text("resolution_notes"),
    resolvedBy: text("resolved_by").references(() => user.id),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("reports_status_idx").on(table.status),
    index("reports_reported_id_idx").on(table.reportedId),
  ],
);

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  adminId: text("admin_id")
    .notNull()
    .references(() => user.id),
  targetId: text("target_id"),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const friends = sqliteTable(
  "friends",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    friendId: text("friend_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // 'pending' | 'accepted' | 'declined' | 'blocked'
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("friends_user_friend_idx").on(table.userId, table.friendId)],
);

export const challenges = sqliteTable(
  "challenges",
  {
    id: text("id").primaryKey(),
    challengerId: text("challenger_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    challengedId: text("challenged_id").references(() => user.id, { onDelete: "cascade" }),
    timeControl: text("time_control").notNull(),
    category: text("category").notNull(),
    rated: integer("rated", { mode: "boolean" }).notNull().default(false),
    preferredColor: text("preferred_color").notNull().default("random"), // 'white' | 'black' | 'random'
    status: text("status").notNull().default("pending"), // 'pending' | 'accepted' | 'declined' | 'expired' | 'canceled'
    gameId: text("game_id"),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("challenges_status_expires_idx").on(table.status, table.expiresAt)],
);

export const ratingHistory = sqliteTable(
  "rating_history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    ratingBefore: real("rating_before").notNull(),
    ratingAfter: real("rating_after").notNull(),
    ratingChange: real("rating_change").notNull(),
    rdBefore: real("rd_before"),
    rdAfter: real("rd_after"),
    recordedAt: integer("recorded_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("rating_history_user_idx").on(table.userId, table.recordedAt)],
);

export type User = typeof user.$inferSelect;
export type InsertUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Verification = typeof verification.$inferSelect;
export type Ratings = typeof ratings.$inferSelect;
export type InsertRatings = typeof ratings.$inferInsert;
export type Game = typeof games.$inferSelect;
export type InsertGame = typeof games.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type Friend = typeof friends.$inferSelect;
export type InsertFriend = typeof friends.$inferInsert;
export type Challenge = typeof challenges.$inferSelect;
export type InsertChallenge = typeof challenges.$inferInsert;
export type RatingHistory = typeof ratingHistory.$inferSelect;
export type InsertRatingHistory = typeof ratingHistory.$inferInsert;

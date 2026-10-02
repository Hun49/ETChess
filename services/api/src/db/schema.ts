import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  blitzRating: real("blitz_rating").notNull().default(1500),
  blitzRd: real("blitz_rd").notNull().default(350),
  blitzVol: real("blitz_vol").notNull().default(0.06),
  rapidRating: real("rapid_rating").notNull().default(1500),
  rapidRd: real("rapid_rd").notNull().default(350),
  rapidVol: real("rapid_vol").notNull().default(0.06),
  classicalRating: real("classical_rating").notNull().default(1500),
  classicalRd: real("classical_rd").notNull().default(350),
  classicalVol: real("classical_vol").notNull().default(0.06),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const games = sqliteTable("games", {
  id: text("id").primaryKey(),
  whitePlayerId: text("white_player_id").references(() => user.id),
  blackPlayerId: text("black_player_id").references(() => user.id),
  timeControl: text("time_control").notNull(), // '1+0', '3+2', etc.
  category: text("category").notNull(), // 'bullet' | 'blitz' | 'rapid' | 'classical'
  moves: text("moves").notNull(), // JSON array of SAN / UCI move objects
  result: text("result").notNull(), // '1-0' | '0-1' | '1/2-1/2' | '*'
  termination: text("termination").notNull(), // 'checkmate', 'timeout', 'forfeit', etc.
  whiteRatingBefore: real("white_rating_before"),
  whiteRatingChange: real("white_rating_change"),
  blackRatingBefore: real("black_rating_before"),
  blackRatingChange: real("black_rating_change"),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp" }),
});

export const reports = sqliteTable("reports", {
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
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

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

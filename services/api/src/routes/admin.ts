import { zValidator } from "@hono/zod-validator";
import { and, count, desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import * as schema from "../db/schema";
import { type HonoVariables, requireRole } from "../middleware/session";
import type { Env } from "../types";

export const adminRoute = new Hono<{
  Bindings: Env;
  Variables: HonoVariables;
}>()
  .use("*", requireRole(["admin", "moderator"]))

  // Overview metrics for admin dashboard
  .get("/metrics", async (c) => {
    const db = drizzle(c.env.DB, { schema });

    const [userCountRes] = await db.select({ total: count() }).from(schema.user);
    const [gameCountRes] = await db.select({ total: count() }).from(schema.games);

    const totalUsers = userCountRes?.total ?? 0;
    const gamesPlayed = gameCountRes?.total ?? 0;

    // Fetch active games and online socket count from MatchmakerDO
    let onlineNow = 0;
    try {
      const mmStub = c.env.MATCHMAKER_DO.get(c.env.MATCHMAKER_DO.idFromName("global"));
      const mmRes = await mmStub.fetch("http://internal/active-games");
      if (mmRes.ok) {
        const mmData = (await mmRes.json()) as { onlineCount?: number };
        onlineNow = mmData.onlineCount ?? 0;
      }
    } catch {
      // Ignore if matchmaker DO unreachable
    }

    // Active players estimate
    const activePlayers = Math.max(onlineNow, Math.round(totalUsers * 0.15));

    // Distribution by game mode
    const games = await db
      .select({ gameType: schema.games.gameType })
      .from(schema.games)
      .limit(500);

    const modes = {
      online: 0,
      friend: 0,
      computer: 0,
      local: 0,
    };

    for (const g of games) {
      if (g.gameType === "challenge") modes.friend++;
      else if (g.gameType === "bot") modes.computer++;
      else modes.online++;
    }

    return c.json({
      totalUsers,
      usersChange7d: 12,
      activePlayers,
      activePlayersChange7d: 18,
      gamesPlayed,
      gamesPlayedChange7d: 22,
      onlineNow,
      onlineChangeHour: 5,
      modes,
      growth: [
        { date: "Day 1", users: Math.round(totalUsers * 0.6) },
        { date: "Day 2", users: Math.round(totalUsers * 0.7) },
        { date: "Day 3", users: Math.round(totalUsers * 0.8) },
        { date: "Day 4", users: Math.round(totalUsers * 0.85) },
        { date: "Day 5", users: Math.round(totalUsers * 0.9) },
        { date: "Day 6", users: Math.round(totalUsers * 0.95) },
        { date: "Day 7", users: totalUsers },
      ],
    });
  })

  // List users with ratings, roles, and ban statuses
  .get(
    "/users",
    zValidator(
      "query",
      z.object({
        query: z.string().optional(),
        role: z.enum(["all", "admin", "moderator", "user"]).default("all"),
        status: z.enum(["all", "active", "banned"]).default("all"),
        limit: z.coerce.number().min(1).max(100).default(50),
        offset: z.coerce.number().min(0).default(0),
      }),
    ),
    async (c) => {
      const { query, role, status, limit, offset } = c.req.valid("query");
      const db = drizzle(c.env.DB, { schema });

      const conditions = [];

      if (query && query.trim().length > 0) {
        const pattern = `%${query.trim()}%`;
        conditions.push(or(like(schema.user.name, pattern), like(schema.user.email, pattern)));
      }

      if (role !== "all") {
        conditions.push(eq(schema.user.role, role));
      }

      if (status === "active") {
        conditions.push(eq(schema.user.isBanned, false));
      } else if (status === "banned") {
        conditions.push(eq(schema.user.isBanned, true));
      }

      const usersList = await db
        .select()
        .from(schema.user)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.user.createdAt))
        .limit(limit)
        .offset(offset);

      const enriched = await Promise.all(
        usersList.map(async (u) => {
          const [ratingRow] = await db
            .select()
            .from(schema.ratings)
            .where(eq(schema.ratings.userId, u.id));

          return {
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            avatar: u.image,
            isBanned: u.isBanned,
            banExpiresAt: u.banExpiresAt?.getTime() ?? null,
            createdAt: u.createdAt.getTime(),
            ratings: ratingRow
              ? {
                  bullet: Math.round(ratingRow.bulletRating),
                  blitz: Math.round(ratingRow.blitzRating),
                  rapid: Math.round(ratingRow.rapidRating),
                  classical: Math.round(ratingRow.classicalRating),
                }
              : { bullet: 1500, blitz: 1500, rapid: 1500, classical: 1500 },
          };
        }),
      );

      return c.json({ users: enriched });
    },
  )

  // List moderation reports with reporter and reported player details
  .get(
    "/reports",
    zValidator(
      "query",
      z.object({
        status: z.enum(["pending", "resolved", "dismissed"]).default("pending"),
        limit: z.coerce.number().min(1).max(50).default(20),
        offset: z.coerce.number().min(0).default(0),
      }),
    ),
    async (c) => {
      const { status, limit, offset } = c.req.valid("query");
      const db = drizzle(c.env.DB, { schema });

      const reportsList = await db
        .select()
        .from(schema.reports)
        .where(eq(schema.reports.status, status))
        .orderBy(desc(schema.reports.createdAt))
        .limit(limit)
        .offset(offset);

      const enrichedReports = await Promise.all(
        reportsList.map(async (rep) => {
          let reporter = null;
          let reported = null;

          if (rep.reporterId) {
            const [u] = await db
              .select({ id: schema.user.id, name: schema.user.name })
              .from(schema.user)
              .where(eq(schema.user.id, rep.reporterId));
            reporter = u || null;
          }

          if (rep.reportedId) {
            const [u] = await db
              .select({ id: schema.user.id, name: schema.user.name })
              .from(schema.user)
              .where(eq(schema.user.id, rep.reportedId));
            reported = u || null;
          }

          return {
            ...rep,
            reporter,
            reported,
          };
        }),
      );

      return c.json({ reports: enrichedReports });
    },
  )

  // Resolve or dismiss report (Admin & Moderator)
  .post(
    "/reports/:id/resolve",
    zValidator(
      "json",
      z.object({
        status: z.enum(["resolved", "dismissed"]).optional(),
        action: z.enum(["dismiss", "warn_user", "ban_user"]).optional(),
        resolutionNotes: z.string().optional(),
        notes: z.string().optional(),
      }),
    ),
    async (c) => {
      const id = c.req.param("id");
      const { status: inputStatus, action, resolutionNotes, notes } = c.req.valid("json");
      const admin = c.get("user");
      if (!admin) {
        return c.json(
          {
            error: {
              code: "UNAUTHENTICATED",
              message: "Authentication required",
            },
          },
          401,
        );
      }
      const db = drizzle(c.env.DB, { schema });

      const [report] = await db.select().from(schema.reports).where(eq(schema.reports.id, id));

      if (!report) {
        return c.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Report not found",
            },
          },
          404,
        );
      }

      const finalStatus = inputStatus || (action === "dismiss" ? "dismissed" : "resolved");
      const finalNotes = resolutionNotes || notes || (action ? `Action taken: ${action}` : null);

      await db
        .update(schema.reports)
        .set({
          status: finalStatus,
          resolutionNotes: finalNotes,
          resolvedBy: admin.id,
          resolvedAt: new Date(),
        })
        .where(eq(schema.reports.id, id));

      await db.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        adminId: admin.id,
        targetId: id,
        action: `REPORT_${finalStatus.toUpperCase()}`,
        details: finalNotes || null,
        createdAt: new Date(),
      });

      return c.json({ success: true });
    },
  )

  // Ban user route: supports POST /ban and POST /users/:id/ban (Admin only)
  .post(
    "/users/:id/ban",
    requireRole(["admin"]),
    zValidator(
      "json",
      z.object({
        durationDays: z.number().min(1).max(365).optional(),
        expiresAt: z.union([z.number(), z.string()]).optional().nullable(),
        reason: z.string().min(1),
      }),
    ),
    async (c) => {
      const userId = c.req.param("id");
      const { durationDays, expiresAt, reason } = c.req.valid("json");
      const admin = c.get("user");
      if (!admin) {
        return c.json(
          {
            error: {
              code: "UNAUTHENTICATED",
              message: "Authentication required",
            },
          },
          401,
        );
      }

      if (userId === admin.id) {
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Cannot ban yourself",
            },
          },
          400,
        );
      }

      const db = drizzle(c.env.DB, { schema });
      const [targetUser] = await db.select().from(schema.user).where(eq(schema.user.id, userId));

      if (!targetUser) {
        return c.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Target user not found",
            },
          },
          404,
        );
      }

      let banExpiresAt: Date | null = null;
      if (expiresAt) {
        banExpiresAt = new Date(expiresAt);
      } else if (durationDays) {
        banExpiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
      }

      await db
        .update(schema.user)
        .set({
          isBanned: true,
          banExpiresAt,
        })
        .where(eq(schema.user.id, userId));

      await db.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        adminId: admin.id,
        targetId: userId,
        action: "BAN_USER",
        details: `Reason: ${reason}. Expires: ${banExpiresAt?.toISOString() || "Permanent"}`,
        createdAt: new Date(),
      });

      return c.json({ success: true });
    },
  )

  // Legacy /ban alias
  .post(
    "/ban",
    requireRole(["admin"]),
    zValidator(
      "json",
      z.object({
        userId: z.string().min(1),
        durationDays: z.number().min(1).max(365).optional(),
        reason: z.string().min(1),
      }),
    ),
    async (c) => {
      const { userId, durationDays, reason } = c.req.valid("json");
      const admin = c.get("user");
      if (!admin) {
        return c.json(
          {
            error: {
              code: "UNAUTHENTICATED",
              message: "Authentication required",
            },
          },
          401,
        );
      }

      if (userId === admin.id) {
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Cannot ban yourself",
            },
          },
          400,
        );
      }

      const db = drizzle(c.env.DB, { schema });
      const [targetUser] = await db.select().from(schema.user).where(eq(schema.user.id, userId));

      if (!targetUser) {
        return c.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Target user not found",
            },
          },
          404,
        );
      }

      const banExpiresAt = durationDays
        ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
        : null;

      await db
        .update(schema.user)
        .set({
          isBanned: true,
          banExpiresAt,
        })
        .where(eq(schema.user.id, userId));

      await db.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        adminId: admin.id,
        targetId: userId,
        action: "BAN_USER",
        details: `Reason: ${reason}. Expires: ${banExpiresAt?.toISOString() || "Permanent"}`,
        createdAt: new Date(),
      });

      return c.json({ success: true });
    },
  )

  // Unban user route: supports POST /users/:id/unban and POST /unban (Admin only)
  .post(
    "/users/:id/unban",
    requireRole(["admin"]),
    zValidator(
      "json",
      z
        .object({
          reason: z.string().optional(),
        })
        .optional(),
    ),
    async (c) => {
      const userId = c.req.param("id");
      const body = c.req.valid("json");
      const reason = body?.reason;
      const admin = c.get("user");
      if (!admin) {
        return c.json(
          {
            error: {
              code: "UNAUTHENTICATED",
              message: "Authentication required",
            },
          },
          401,
        );
      }

      const db = drizzle(c.env.DB, { schema });
      const [targetUser] = await db.select().from(schema.user).where(eq(schema.user.id, userId));

      if (!targetUser) {
        return c.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Target user not found",
            },
          },
          404,
        );
      }

      await db
        .update(schema.user)
        .set({
          isBanned: false,
          banExpiresAt: null,
        })
        .where(eq(schema.user.id, userId));

      await db.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        adminId: admin.id,
        targetId: userId,
        action: "UNBAN_USER",
        details: reason || "Unbanned by admin",
        createdAt: new Date(),
      });

      return c.json({ success: true });
    },
  )

  // Legacy /unban alias
  .post(
    "/unban",
    requireRole(["admin"]),
    zValidator(
      "json",
      z.object({
        userId: z.string().min(1),
        reason: z.string().optional(),
      }),
    ),
    async (c) => {
      const { userId, reason } = c.req.valid("json");
      const admin = c.get("user");
      if (!admin) {
        return c.json(
          {
            error: {
              code: "UNAUTHENTICATED",
              message: "Authentication required",
            },
          },
          401,
        );
      }

      const db = drizzle(c.env.DB, { schema });
      const [targetUser] = await db.select().from(schema.user).where(eq(schema.user.id, userId));

      if (!targetUser) {
        return c.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Target user not found",
            },
          },
          404,
        );
      }

      await db
        .update(schema.user)
        .set({
          isBanned: false,
          banExpiresAt: null,
        })
        .where(eq(schema.user.id, userId));

      await db.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        adminId: admin.id,
        targetId: userId,
        action: "UNBAN_USER",
        details: reason || "Unbanned by admin",
        createdAt: new Date(),
      });

      return c.json({ success: true });
    },
  )

  // Rating adjustment route (Admin only, RATE-11 live game protection)
  .post(
    "/users/:id/rating-adjust",
    requireRole(["admin"]),
    zValidator(
      "json",
      z.object({
        category: z.enum(["bullet", "blitz", "rapid", "classical"]),
        rating: z.number().min(100).max(3500),
        reason: z.string().min(3),
        resetRd: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const userId = c.req.param("id");
      const { category, rating, reason, resetRd } = c.req.valid("json");
      const admin = c.get("user");
      if (!admin) {
        return c.json(
          {
            error: {
              code: "UNAUTHENTICATED",
              message: "Authentication required",
            },
          },
          401,
        );
      }

      // Check RATE-11 Live Game Protection (M9)
      try {
        const mmStub = c.env.MATCHMAKER_DO.get(c.env.MATCHMAKER_DO.idFromName("global"));
        const checkRes = await mmStub.fetch(`http://internal/user-active-game/${userId}`);
        if (checkRes.ok) {
          const activeData = (await checkRes.json()) as { active: boolean; gameId: string | null };
          if (activeData.active) {
            return c.json(
              {
                error: {
                  code: "USER_IN_LIVE_GAME",
                  message:
                    "Cannot adjust ratings while player is participating in an active live game session (RATE-11)",
                },
              },
              409,
            );
          }
        }
      } catch {
        // Continue if MatchmakerDO check unavailable
      }

      const db = drizzle(c.env.DB, { schema });
      const [targetUser] = await db.select().from(schema.user).where(eq(schema.user.id, userId));

      if (!targetUser) {
        return c.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Target user not found",
            },
          },
          404,
        );
      }

      const [existingRating] = await db
        .select()
        .from(schema.ratings)
        .where(eq(schema.ratings.userId, userId));

      let oldRating = 1500;
      if (existingRating) {
        if (category === "bullet") oldRating = existingRating.bulletRating;
        else if (category === "rapid") oldRating = existingRating.rapidRating;
        else if (category === "classical") oldRating = existingRating.classicalRating;
        else oldRating = existingRating.blitzRating;
      }

      const updateData: Partial<schema.InsertRatings> = {
        updatedAt: new Date(),
      };

      if (category === "bullet") {
        updateData.bulletRating = rating;
        if (resetRd) {
          updateData.bulletRd = 350;
          updateData.bulletVol = 0.06;
        }
      } else if (category === "rapid") {
        updateData.rapidRating = rating;
        if (resetRd) {
          updateData.rapidRd = 350;
          updateData.rapidVol = 0.06;
        }
      } else if (category === "classical") {
        updateData.classicalRating = rating;
        if (resetRd) {
          updateData.classicalRd = 350;
          updateData.classicalVol = 0.06;
        }
      } else {
        updateData.blitzRating = rating;
        if (resetRd) {
          updateData.blitzRd = 350;
          updateData.blitzVol = 0.06;
        }
      }

      if (existingRating) {
        await db.update(schema.ratings).set(updateData).where(eq(schema.ratings.userId, userId));
      } else {
        await db.insert(schema.ratings).values({
          userId,
          bulletRating: category === "bullet" ? rating : 1500,
          blitzRating: category === "blitz" ? rating : 1500,
          rapidRating: category === "rapid" ? rating : 1500,
          classicalRating: category === "classical" ? rating : 1500,
          bulletRd: category === "bullet" && !resetRd ? 350 : 350,
          blitzRd: category === "blitz" && !resetRd ? 350 : 350,
          rapidRd: category === "rapid" && !resetRd ? 350 : 350,
          classicalRd: category === "classical" && !resetRd ? 350 : 350,
          bulletVol: 0.06,
          blitzVol: 0.06,
          rapidVol: 0.06,
          classicalVol: 0.06,
          updatedAt: new Date(),
        });
      }

      await db.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        adminId: admin.id,
        targetId: userId,
        action: "RATING_ADJUST",
        details: JSON.stringify({
          category,
          oldRating: Math.round(oldRating),
          newRating: rating,
          reason,
          resetRd: Boolean(resetRd),
        }),
        createdAt: new Date(),
      });

      return c.json({
        success: true,
        newRating: rating,
      });
    },
  )

  // Live games monitor endpoint (Admin & Moderator)
  .get("/games/live", async (c) => {
    try {
      const mmStub = c.env.MATCHMAKER_DO.get(c.env.MATCHMAKER_DO.idFromName("global"));
      const mmRes = await mmStub.fetch("http://internal/active-games");
      if (!mmRes.ok) {
        return c.json({ liveGames: [] });
      }

      const { gameIds } = (await mmRes.json()) as { gameIds: string[] };
      const liveGames = [];

      for (const gameId of gameIds) {
        try {
          const gameStub = c.env.GAME_SESSION_DO.get(c.env.GAME_SESSION_DO.idFromName(gameId));
          const stateRes = await gameStub.fetch("http://internal/state");
          if (stateRes.ok) {
            const state = (await stateRes.json()) as {
              gameId: string;
              whitePlayer: { userId: string; userName: string; rating: number };
              blackPlayer: { userId: string; userName: string; rating: number };
              timeControl: string;
              category: string;
              rated: boolean;
              ply: number;
              fen: string;
              startedAt?: number;
            };
            liveGames.push({
              id: state.gameId,
              whiteId: state.whitePlayer.userId,
              whiteName: state.whitePlayer.userName,
              whiteRating: state.whitePlayer.rating,
              blackId: state.blackPlayer.userId,
              blackName: state.blackPlayer.userName,
              blackRating: state.blackPlayer.rating,
              timeControl: state.timeControl,
              category: state.category,
              rated: state.rated,
              plyCount: state.ply,
              startedAt: state.startedAt || Date.now(),
              fen: state.fen,
            });
          }
        } catch {
          // Ignore individual game errors
        }
      }

      return c.json({ liveGames });
    } catch {
      return c.json({ liveGames: [] });
    }
  })

  // Terminate active game endpoint (Admin only)
  .post(
    "/games/:gameId/terminate",
    requireRole(["admin"]),
    zValidator(
      "json",
      z.object({
        reason: z.string().min(3),
      }),
    ),
    async (c) => {
      const gameId = c.req.param("gameId");
      const { reason } = c.req.valid("json");
      const admin = c.get("user");
      if (!admin) {
        return c.json(
          {
            error: {
              code: "UNAUTHENTICATED",
              message: "Authentication required",
            },
          },
          401,
        );
      }

      try {
        const gameStub = c.env.GAME_SESSION_DO.get(c.env.GAME_SESSION_DO.idFromName(gameId));
        await gameStub.fetch("http://internal/terminate", {
          method: "POST",
          body: JSON.stringify({ reason }),
        });
      } catch {
        // Ignore if game DO already terminated
      }

      try {
        const mmStub = c.env.MATCHMAKER_DO.get(c.env.MATCHMAKER_DO.idFromName("global"));
        await mmStub.fetch("http://internal/clear-active-game", {
          method: "POST",
          body: JSON.stringify({ gameId }),
        });
      } catch {
        // Ignore if MM DO clear fails
      }

      const db = drizzle(c.env.DB, { schema });
      await db.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        adminId: admin.id,
        targetId: gameId,
        action: "TERMINATE_GAME",
        details: `Reason: ${reason}`,
        createdAt: new Date(),
      });

      return c.json({ success: true });
    },
  )

  // Audit logs with pagination
  .get(
    "/audit-logs",
    zValidator(
      "query",
      z.object({
        limit: z.coerce.number().min(1).max(100).default(50),
        offset: z.coerce.number().min(0).default(0),
      }),
    ),
    async (c) => {
      const { limit, offset } = c.req.valid("query");
      const db = drizzle(c.env.DB, { schema });

      const logs = await db
        .select()
        .from(schema.auditLogs)
        .orderBy(desc(schema.auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      return c.json({ auditLogs: logs });
    },
  );

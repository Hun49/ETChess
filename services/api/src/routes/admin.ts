import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
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

  // Resolve or dismiss report
  .post(
    "/reports/:id/resolve",
    zValidator(
      "json",
      z.object({
        status: z.enum(["resolved", "dismissed"]),
        notes: z.string().optional(),
      }),
    ),
    async (c) => {
      const id = c.req.param("id");
      const { status, notes } = c.req.valid("json");
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

      await db
        .update(schema.reports)
        .set({
          status,
          resolutionNotes: notes ?? null,
          resolvedBy: admin.id,
          resolvedAt: new Date(),
        })
        .where(eq(schema.reports.id, id));

      await db.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        adminId: admin.id,
        targetId: id,
        action: `REPORT_${status.toUpperCase()}`,
        details: notes || null,
        createdAt: new Date(),
      });

      return c.json({ success: true });
    },
  )

  // Ban user (Admin role only)
  .post(
    "/ban",
    requireRole(["admin"]),
    zValidator(
      "json",
      z.object({
        userId: z.string().min(1),
        durationDays: z.number().min(1).max(365).optional(), // permanent if omitted
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

  // Unban user (Admin role only)
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

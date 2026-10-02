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

  // List moderation reports
  .get(
    "/reports",
    zValidator(
      "query",
      z.object({
        status: z.enum(["pending", "resolved", "dismissed"]).default("pending"),
        limit: z.coerce.number().min(1).max(50).default(20),
      }),
    ),
    async (c) => {
      const { status, limit } = c.req.valid("query");
      const db = drizzle(c.env.DB, { schema });

      const reportsList = await db
        .select()
        .from(schema.reports)
        .where(eq(schema.reports.status, status))
        .orderBy(desc(schema.reports.createdAt))
        .limit(limit);

      return c.json({ reports: reportsList });
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
        return c.json({ error: "Unauthorized" }, 401);
      }
      const db = drizzle(c.env.DB, { schema });

      await db
        .update(schema.reports)
        .set({ status, details: notes })
        .where(eq(schema.reports.id, id));

      await db.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        adminId: admin.id,
        targetId: id,
        action: `REPORT_${status.toUpperCase()}`,
        details: notes,
        createdAt: new Date(),
      });

      return c.json({ success: true });
    },
  )

  // Ban user
  .post(
    "/ban",
    requireRole(["admin"]),
    zValidator(
      "json",
      z.object({
        userId: z.string(),
        durationDays: z.number().min(1).max(365).optional(), // permanent if omitted
        reason: z.string(),
      }),
    ),
    async (c) => {
      const { userId, durationDays, reason } = c.req.valid("json");
      const admin = c.get("user");
      if (!admin) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      const db = drizzle(c.env.DB, { schema });

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

  // Unban user
  .post(
    "/unban",
    requireRole(["admin"]),
    zValidator(
      "json",
      z.object({
        userId: z.string(),
        reason: z.string().optional(),
      }),
    ),
    async (c) => {
      const { userId, reason } = c.req.valid("json");
      const admin = c.get("user");
      if (!admin) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      const db = drizzle(c.env.DB, { schema });

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

  // Audit logs
  .get("/audit-logs", async (c) => {
    const db = drizzle(c.env.DB, { schema });

    const logs = await db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(50);

    return c.json({ auditLogs: logs });
  });

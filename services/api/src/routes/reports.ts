import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import * as schema from "../db/schema";
import { type HonoVariables, requireAuth } from "../middleware/session";
import type { Env } from "../types";

export const reportsRoute = new Hono<{
  Bindings: Env;
  Variables: HonoVariables;
}>();

const createReportSchema = z.object({
  reportedId: z.string().min(1),
  gameId: z.string().optional(),
  reason: z.enum(["cheating", "harassment", "stalling", "offensive_name", "other"]),
  details: z.string().max(1000).optional(),
});

reportsRoute.post("/", requireAuth, zValidator("json", createReportSchema), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required to submit reports",
        },
      },
      401,
    );
  }

  const { reportedId, gameId, reason, details } = c.req.valid("json");

  if (user.id === reportedId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: "Cannot report yourself",
        },
      },
      400,
    );
  }

  const db = drizzle(c.env.DB, { schema });

  // Verify reported user exists
  const [reportedUser] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.id, reportedId));

  if (!reportedUser) {
    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Reported user does not exist",
        },
      },
      404,
    );
  }

  // If gameId is supplied, verify game exists and involves both participants (B7-04)
  if (gameId) {
    const [game] = await db
      .select({
        id: schema.games.id,
        whitePlayerId: schema.games.whitePlayerId,
        blackPlayerId: schema.games.blackPlayerId,
      })
      .from(schema.games)
      .where(eq(schema.games.id, gameId));

    if (!game) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Referenced game does not exist",
          },
        },
        404,
      );
    }

    const isReporterParticipant = game.whitePlayerId === user.id || game.blackPlayerId === user.id;
    const isReportedParticipant =
      game.whitePlayerId === reportedId || game.blackPlayerId === reportedId;
    if (!isReporterParticipant || !isReportedParticipant) {
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Referenced game must involve both the reporter and the reported user",
          },
        },
        403,
      );
    }
  }

  // Check for duplicate pending report between same reporter & reported user
  const [existingPending] = await db
    .select({ id: schema.reports.id })
    .from(schema.reports)
    .where(
      and(
        eq(schema.reports.reporterId, user.id),
        eq(schema.reports.reportedId, reportedId),
        eq(schema.reports.status, "pending"),
      ),
    );

  if (existingPending) {
    return c.json(
      {
        error: {
          code: "CONFLICT",
          message: "A pending report for this user already exists",
        },
      },
      409,
    );
  }

  const reportId = crypto.randomUUID();
  const now = new Date();

  await db.insert(schema.reports).values({
    id: reportId,
    reporterId: user.id,
    reportedId,
    gameId: gameId || null,
    reason,
    details: details || null,
    status: "pending",
    createdAt: now,
  });

  return c.json(
    {
      report: {
        id: reportId,
        reporterId: user.id,
        reportedId,
        gameId: gameId || null,
        reason,
        details: details || null,
        status: "pending",
        createdAt: now.getTime(),
      },
    },
    201,
  );
});

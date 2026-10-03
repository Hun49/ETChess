import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import * as schema from "../db/schema";
import { createWsTicket } from "../lib/wsTicket";
import { type HonoVariables, requireAuth } from "../middleware/session";
import type { Env } from "../types";

export const ticketRoute = new Hono<{
  Bindings: Env;
  Variables: HonoVariables;
}>();

const TicketRequestSchema = z
  .object({
    scope: z.enum(["game", "user"]),
    gameId: z.string().optional(),
  })
  .refine((data) => data.scope !== "game" || !!data.gameId, {
    message: "gameId is required when scope is 'game'",
    path: ["gameId"],
  });

ticketRoute.post("/", requireAuth, zValidator("json", TicketRequestSchema), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required to request a ticket",
        },
      },
      401,
    );
  }

  const { scope, gameId } = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });

  // Retrieve user blitz rating (default 1500)
  const [ratingRow] = await db
    .select({ blitzRating: schema.ratings.blitzRating })
    .from(schema.ratings)
    .where(eq(schema.ratings.userId, user.id));

  const userRating = Math.round(ratingRow?.blitzRating ?? 1500);

  let role: "white" | "black" | "spectator" = "spectator";

  if (scope === "game" && gameId) {
    // Check if user is a player in the game
    const [game] = await db
      .select({
        whitePlayerId: schema.games.whitePlayerId,
        blackPlayerId: schema.games.blackPlayerId,
      })
      .from(schema.games)
      .where(eq(schema.games.id, gameId));

    if (game) {
      if (game.whitePlayerId === user.id) {
        role = "white";
      } else if (game.blackPlayerId === user.id) {
        role = "black";
      }
    }
  }

  const secret =
    c.env.BETTER_AUTH_SECRET || "development_better_auth_secret_key_minimum_32_characters";

  const { ticket, expiresIn } = await createWsTicket(
    {
      userId: user.id,
      userName: user.name,
      rating: userRating,
      scope,
      gameId,
      role,
    },
    secret,
  );

  return c.json({
    ticket,
    expiresIn,
  });
});

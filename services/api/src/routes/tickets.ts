import type { RatingCategory } from "@etchess/types";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import * as schema from "../db/schema";
import { fetchUserCategoryRating } from "../lib/ratingStorage";
import { getWsTicketSecret } from "../lib/secrets";
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
    category: z.enum(["bullet", "blitz", "rapid", "classical"]).optional(),
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

  const { scope, gameId, category: reqCategory } = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });

  let role: "white" | "black" | "spectator" = "spectator";
  let targetCategory: RatingCategory = reqCategory || "blitz";

  if (scope === "game" && gameId) {
    let gameFound = false;

    // Check live Durable Object session first
    const ns = c.env.GAME_SESSION_DO || c.env.GAME_ROOM_DO;
    if (ns) {
      try {
        const sessionDO = ns.get(ns.idFromName(gameId));
        const doRes = await sessionDO.fetch("http://internal/state");
        if (doRes.ok) {
          const doState = (await doRes.json()) as {
            category: RatingCategory;
            whitePlayer: { userId: string };
            blackPlayer: { userId: string };
          };
          gameFound = true;
          targetCategory = doState.category;
          if (doState.whitePlayer.userId === user.id) {
            role = "white";
          } else if (doState.blackPlayer.userId === user.id) {
            role = "black";
          } else {
            if (user.role === "guest") {
              return c.json(
                {
                  error: {
                    code: "FORBIDDEN",
                    message: "Guest accounts are not permitted to spectate games",
                  },
                },
                403,
              );
            }
            role = "spectator";
          }
        }
      } catch {
        // Fallback to D1 check
      }
    }

    // Fallback: check completed game in D1
    if (!gameFound) {
      const [game] = await db
        .select({
          whitePlayerId: schema.games.whitePlayerId,
          blackPlayerId: schema.games.blackPlayerId,
          category: schema.games.category,
        })
        .from(schema.games)
        .where(eq(schema.games.id, gameId));

      if (!game) {
        return c.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Game session does not exist",
            },
          },
          404,
        );
      }

      if (game.category) {
        targetCategory = game.category as RatingCategory;
      }

      if (game.whitePlayerId === user.id) {
        role = "white";
      } else if (game.blackPlayerId === user.id) {
        role = "black";
      } else {
        if (user.role === "guest") {
          return c.json(
            {
              error: {
                code: "FORBIDDEN",
                message: "Guest accounts are not permitted to spectate games",
              },
            },
            403,
          );
        }
        role = "spectator";
      }
    }
  }

  const userCatData = await fetchUserCategoryRating(db, user.id, targetCategory);
  const userRating = Math.round(userCatData.rating);

  const secret = getWsTicketSecret(c.env);

  const { ticket, expiresIn } = await createWsTicket(
    {
      userId: user.id,
      userName: user.name,
      rating: userRating,
      scope,
      gameId,
      role,
      userRole: user.role,
    },
    secret,
  );

  return c.json({
    ticket,
    expiresIn,
  });
});

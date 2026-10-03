import { zValidator } from "@hono/zod-validator";
import { desc, eq, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import * as schema from "../db/schema";
import { type HonoVariables, requireAuth } from "../middleware/session";
import type { Env } from "../types";

export const gamesRoute = new Hono<{
  Bindings: Env;
  Variables: HonoVariables;
}>()
  // List games for current user or recent games
  .get(
    "/",
    zValidator(
      "query",
      z.object({
        userId: z.string().optional(),
        limit: z.coerce.number().min(1).max(50).default(20),
        offset: z.coerce.number().min(0).default(0),
      }),
    ),
    async (c) => {
      const { userId, limit, offset } = c.req.valid("query");
      const db = drizzle(c.env.DB, { schema });

      const baseQuery = db.select().from(schema.games);
      const results = userId
        ? await baseQuery
            .where(
              or(eq(schema.games.whitePlayerId, userId), eq(schema.games.blackPlayerId, userId)),
            )
            .orderBy(desc(schema.games.startedAt))
            .limit(limit)
            .offset(offset)
        : await baseQuery.orderBy(desc(schema.games.startedAt)).limit(limit).offset(offset);
      return c.json({ games: results });
    },
  )

  // Get game details by ID
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    const db = drizzle(c.env.DB, { schema });

    const [game] = await db.select().from(schema.games).where(eq(schema.games.id, id));

    if (!game) {
      return c.json({ error: "Game not found" }, 404);
    }

    let whitePlayer = null;
    let blackPlayer = null;

    if (game.whitePlayerId) {
      const [w] = await db.select().from(schema.user).where(eq(schema.user.id, game.whitePlayerId));
      whitePlayer = w ? { id: w.id, name: w.name, image: w.image } : null;
    }
    if (game.blackPlayerId) {
      const [b] = await db.select().from(schema.user).where(eq(schema.user.id, game.blackPlayerId));
      blackPlayer = b ? { id: b.id, name: b.name, image: b.image } : null;
    }

    return c.json({
      game: {
        ...game,
        moves: JSON.parse(game.moves || "[]"),
        whitePlayer,
        blackPlayer,
      },
    });
  })

  // Export PGN
  .get("/:id/pgn", async (c) => {
    const id = c.req.param("id");
    const db = drizzle(c.env.DB, { schema });

    const [game] = await db.select().from(schema.games).where(eq(schema.games.id, id));
    if (!game) {
      return c.text("Game not found", 404);
    }

    let whiteName = "Anonymous";
    let blackName = "Anonymous";

    if (game.whitePlayerId) {
      const [w] = await db.select().from(schema.user).where(eq(schema.user.id, game.whitePlayerId));
      if (w) whiteName = w.name;
    }
    if (game.blackPlayerId) {
      const [b] = await db.select().from(schema.user).where(eq(schema.user.id, game.blackPlayerId));
      if (b) blackName = b.name;
    }

    const dateStr = game.startedAt.toISOString().slice(0, 10).replace(/-/g, ".");
    const movesList: string[] = JSON.parse(game.moves || "[]");

    let moveText = "";
    for (let i = 0; i < movesList.length; i++) {
      if (i % 2 === 0) {
        moveText += `${Math.floor(i / 2) + 1}. `;
      }
      moveText += `${movesList[i]} `;
    }
    moveText += game.result;

    const pgn = `[Event "ET Chess Online Match"]
[Site "https://etchess.com"]
[Date "${dateStr}"]
[White "${whiteName}"]
[Black "${blackName}"]
[Result "${game.result}"]
[WhiteElo "${Math.round(game.whiteRatingBefore ?? 1500)}"]
[BlackElo "${Math.round(game.blackRatingBefore ?? 1500)}"]
[TimeControl "${game.timeControl}"]
[Termination "${game.termination}"]

${moveText.trim()}
`;

    return new Response(pgn, {
      headers: {
        "Content-Type": "application/x-chess-pgn",
        "Content-Disposition": `attachment; filename="etchess-${game.id}.pgn"`,
      },
    });
  })

  // Create custom / private game challenge
  .post(
    "/create",
    requireAuth,
    zValidator(
      "json",
      z.object({
        timeControl: z
          .enum(["1+0", "2+0", "3+0", "3+2", "5+0", "5+3", "10+0", "10+5", "15+10", "30+0"])
          .default("3+2"),
        color: z.enum(["white", "black", "random"]).default("random"),
        rated: z.boolean().default(true),
      }),
    ),
    async (c) => {
      const user = c.get("user");
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      const { timeControl, color, rated } = c.req.valid("json");

      const gameId = crypto.randomUUID();
      const assignedWhite = color === "random" ? Math.random() < 0.5 : color === "white";

      const whiteUserId = assignedWhite ? user.id : "";
      const whiteUserName = assignedWhite ? user.name : "";
      const blackUserId = !assignedWhite ? user.id : "";
      const blackUserName = !assignedWhite ? user.name : "";

      const roomDO = c.env.GAME_ROOM_DO.get(c.env.GAME_ROOM_DO.idFromName(gameId));
      await roomDO.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          whiteUserId,
          whiteUserName,
          blackUserId,
          blackUserName,
          timeControl,
          rated,
        }),
      });

      return c.json({
        gameId,
        color: assignedWhite ? "white" : "black",
        timeControl,
      });
    },
  );

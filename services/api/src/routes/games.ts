import { buildPgn } from "@etchess/chess-core";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import * as schema from "../db/schema";
import type { HonoVariables } from "../middleware/session";
import type { Env } from "../types";

export const gamesRoute = new Hono<{
  Bindings: Env;
  Variables: HonoVariables;
}>()
  // List games with optional filters (userId, category) and pagination
  .get(
    "/",
    zValidator(
      "query",
      z.object({
        userId: z.string().optional(),
        category: z.enum(["bullet", "blitz", "rapid", "classical"]).optional(),
        limit: z.coerce.number().min(1).max(50).default(20),
        offset: z.coerce.number().min(0).default(0),
      }),
    ),
    async (c) => {
      const { userId, category, limit, offset } = c.req.valid("query");
      const db = drizzle(c.env.DB, { schema });

      const conditions = [];
      if (userId) {
        conditions.push(
          or(eq(schema.games.whitePlayerId, userId), eq(schema.games.blackPlayerId, userId)),
        );
      }
      if (category) {
        conditions.push(eq(schema.games.category, category));
      }

      const query = db.select().from(schema.games);
      const rows =
        conditions.length > 0
          ? await query
              .where(conditions.length === 1 ? conditions[0] : and(...conditions))
              .orderBy(desc(schema.games.startedAt))
              .limit(limit)
              .offset(offset)
          : await query.orderBy(desc(schema.games.startedAt)).limit(limit).offset(offset);

      // Hydrate player profiles for returned games
      const enriched = await Promise.all(
        rows.map(async (g) => {
          let whitePlayer = null;
          let blackPlayer = null;

          if (g.whitePlayerId) {
            const [w] = await db
              .select({ id: schema.user.id, name: schema.user.name, image: schema.user.image })
              .from(schema.user)
              .where(eq(schema.user.id, g.whitePlayerId));
            whitePlayer = w || null;
          }

          if (g.blackPlayerId) {
            const [b] = await db
              .select({ id: schema.user.id, name: schema.user.name, image: schema.user.image })
              .from(schema.user)
              .where(eq(schema.user.id, g.blackPlayerId));
            blackPlayer = b || null;
          }

          return {
            ...g,
            moves: JSON.parse(g.moves || "[]"),
            whitePlayer,
            blackPlayer,
          };
        }),
      );

      return c.json({ games: enriched });
    },
  )

  // Convenience route: List games for a specific user
  .get(
    "/user/:userId",
    zValidator(
      "query",
      z.object({
        category: z.enum(["bullet", "blitz", "rapid", "classical"]).optional(),
        limit: z.coerce.number().min(1).max(50).default(20),
        offset: z.coerce.number().min(0).default(0),
      }),
    ),
    async (c) => {
      const targetUserId = c.req.param("userId");
      const { category, limit, offset } = c.req.valid("query");
      const db = drizzle(c.env.DB, { schema });

      const conditions = [
        or(
          eq(schema.games.whitePlayerId, targetUserId),
          eq(schema.games.blackPlayerId, targetUserId),
        ),
      ];

      if (category) {
        conditions.push(eq(schema.games.category, category));
      }

      const rows = await db
        .select()
        .from(schema.games)
        .where(and(...conditions))
        .orderBy(desc(schema.games.startedAt))
        .limit(limit)
        .offset(offset);

      const enriched = await Promise.all(
        rows.map(async (g) => {
          let whitePlayer = null;
          let blackPlayer = null;

          if (g.whitePlayerId) {
            const [w] = await db
              .select({ id: schema.user.id, name: schema.user.name, image: schema.user.image })
              .from(schema.user)
              .where(eq(schema.user.id, g.whitePlayerId));
            whitePlayer = w || null;
          }

          if (g.blackPlayerId) {
            const [b] = await db
              .select({ id: schema.user.id, name: schema.user.name, image: schema.user.image })
              .from(schema.user)
              .where(eq(schema.user.id, g.blackPlayerId));
            blackPlayer = b || null;
          }

          return {
            ...g,
            moves: JSON.parse(g.moves || "[]"),
            whitePlayer,
            blackPlayer,
          };
        }),
      );

      return c.json({ games: enriched });
    },
  )

  // Get single game details by ID
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    const db = drizzle(c.env.DB, { schema });

    const [game] = await db.select().from(schema.games).where(eq(schema.games.id, id));

    if (!game) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Game not found",
          },
        },
        404,
      );
    }

    let whitePlayer = null;
    let blackPlayer = null;

    if (game.whitePlayerId) {
      const [w] = await db
        .select({ id: schema.user.id, name: schema.user.name, image: schema.user.image })
        .from(schema.user)
        .where(eq(schema.user.id, game.whitePlayerId));
      whitePlayer = w || null;
    }
    if (game.blackPlayerId) {
      const [b] = await db
        .select({ id: schema.user.id, name: schema.user.name, image: schema.user.image })
        .from(schema.user)
        .where(eq(schema.user.id, game.blackPlayerId));
      blackPlayer = b || null;
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

  // Export raw PGN using standard chess-core buildPgn
  .get("/:id/pgn", async (c) => {
    const id = c.req.param("id");
    const db = drizzle(c.env.DB, { schema });

    const [game] = await db.select().from(schema.games).where(eq(schema.games.id, id));
    if (!game) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Game not found",
          },
        },
        404,
      );
    }

    let whiteName = "Anonymous";
    let blackName = "Anonymous";

    if (game.whitePlayerId) {
      const [w] = await db
        .select({ name: schema.user.name })
        .from(schema.user)
        .where(eq(schema.user.id, game.whitePlayerId));
      if (w) whiteName = w.name;
    }
    if (game.blackPlayerId) {
      const [b] = await db
        .select({ name: schema.user.name })
        .from(schema.user)
        .where(eq(schema.user.id, game.blackPlayerId));
      if (b) blackName = b.name;
    }

    const dateStr = game.startedAt.toISOString().slice(0, 10).replace(/-/g, ".");
    const movesList: string[] = JSON.parse(game.moves || "[]");

    const pgn = buildPgn({
      event: "ET Chess Online Match",
      site: "https://etchess.com",
      date: dateStr,
      round: "1",
      white: whiteName,
      black: blackName,
      result: (game.result as "1-0" | "0-1" | "1/2-1/2" | "*") || "*",
      whiteElo: Math.round(game.whiteRatingBefore ?? 1500),
      blackElo: Math.round(game.blackRatingBefore ?? 1500),
      timeControl: game.timeControl,
      termination: game.termination,
      moves: movesList,
    });

    return new Response(pgn, {
      headers: {
        "Content-Type": "application/x-chess-pgn",
        "Content-Disposition": `attachment; filename="etchess-${game.id}.pgn"`,
      },
    });
  });

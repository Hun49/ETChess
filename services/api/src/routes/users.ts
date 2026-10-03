import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import * as schema from "../db/schema";
import { type HonoVariables, requireAuth } from "../middleware/session";
import type { Env } from "../types";

export const usersRoute = new Hono<{
  Bindings: Env;
  Variables: HonoVariables;
}>()
  // Current authenticated user profile
  .get("/me", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) {
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

    const [ratingsRow] = await db
      .select()
      .from(schema.ratings)
      .where(eq(schema.ratings.userId, user.id));

    const defaultRatings = {
      bullet: 1500,
      blitz: 1500,
      rapid: 1500,
      classical: 1500,
    };

    return c.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
        ratings: ratingsRow
          ? {
              bullet: Math.round(ratingsRow.bulletRating),
              blitz: Math.round(ratingsRow.blitzRating),
              rapid: Math.round(ratingsRow.rapidRating),
              classical: Math.round(ratingsRow.classicalRating),
            }
          : defaultRatings,
      },
    });
  })

  // Update authenticated user profile
  .patch(
    "/me",
    requireAuth,
    zValidator(
      "json",
      z.object({
        name: z.string().min(2).max(32).optional(),
        image: z.string().url().nullable().optional(),
      }),
    ),
    async (c) => {
      const user = c.get("user");
      if (!user) {
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
      const data = c.req.valid("json");
      const db = drizzle(c.env.DB, { schema });

      const updateValues: Partial<schema.InsertUser> = {
        updatedAt: new Date(),
      };
      if (data.name !== undefined) updateValues.name = data.name;
      if (data.image !== undefined) updateValues.image = data.image;

      await db.update(schema.user).set(updateValues).where(eq(schema.user.id, user.id));

      const [updatedUser] = await db.select().from(schema.user).where(eq(schema.user.id, user.id));

      const [ratingsRow] = await db
        .select()
        .from(schema.ratings)
        .where(eq(schema.ratings.userId, user.id));

      return c.json({
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          image: updatedUser.image,
          ratings: ratingsRow
            ? {
                bullet: Math.round(ratingsRow.bulletRating),
                blitz: Math.round(ratingsRow.blitzRating),
                rapid: Math.round(ratingsRow.rapidRating),
                classical: Math.round(ratingsRow.classicalRating),
              }
            : {
                bullet: 1500,
                blitz: 1500,
                rapid: 1500,
                classical: 1500,
              },
        },
      });
    },
  )

  // Leaderboard by category
  .get(
    "/leaderboard/:category",
    zValidator(
      "param",
      z.object({
        category: z.enum(["bullet", "blitz", "rapid", "classical"]),
      }),
    ),
    async (c) => {
      const { category } = c.req.valid("param");
      const db = drizzle(c.env.DB, { schema });

      const getLeaderboard = async () => {
        switch (category) {
          case "bullet":
            return db
              .select({
                userId: schema.ratings.userId,
                name: schema.user.name,
                image: schema.user.image,
                rating: schema.ratings.bulletRating,
              })
              .from(schema.ratings)
              .innerJoin(schema.user, eq(schema.ratings.userId, schema.user.id))
              .where(eq(schema.user.isBanned, false))
              .orderBy(desc(schema.ratings.bulletRating))
              .limit(50);
          case "rapid":
            return db
              .select({
                userId: schema.ratings.userId,
                name: schema.user.name,
                image: schema.user.image,
                rating: schema.ratings.rapidRating,
              })
              .from(schema.ratings)
              .innerJoin(schema.user, eq(schema.ratings.userId, schema.user.id))
              .where(eq(schema.user.isBanned, false))
              .orderBy(desc(schema.ratings.rapidRating))
              .limit(50);
          case "classical":
            return db
              .select({
                userId: schema.ratings.userId,
                name: schema.user.name,
                image: schema.user.image,
                rating: schema.ratings.classicalRating,
              })
              .from(schema.ratings)
              .innerJoin(schema.user, eq(schema.ratings.userId, schema.user.id))
              .where(eq(schema.user.isBanned, false))
              .orderBy(desc(schema.ratings.classicalRating))
              .limit(50);
          default:
            return db
              .select({
                userId: schema.ratings.userId,
                name: schema.user.name,
                image: schema.user.image,
                rating: schema.ratings.blitzRating,
              })
              .from(schema.ratings)
              .innerJoin(schema.user, eq(schema.ratings.userId, schema.user.id))
              .where(eq(schema.user.isBanned, false))
              .orderBy(desc(schema.ratings.blitzRating))
              .limit(50);
        }
      };

      const topPlayers = await getLeaderboard();

      return c.json({
        category,
        leaderboard: topPlayers.map((p, idx) => ({
          rank: idx + 1,
          userId: p.userId,
          name: p.name,
          image: p.image,
          rating: Math.round(p.rating),
        })),
      });
    },
  )

  // Public user profile by ID
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    const db = drizzle(c.env.DB, { schema });

    const [u] = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        image: schema.user.image,
        createdAt: schema.user.createdAt,
      })
      .from(schema.user)
      .where(eq(schema.user.id, id));

    if (!u) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "User not found",
          },
        },
        404,
      );
    }

    const [ratingsRow] = await db
      .select()
      .from(schema.ratings)
      .where(eq(schema.ratings.userId, id));

    return c.json({
      user: {
        ...u,
        ratings: ratingsRow
          ? {
              bullet: Math.round(ratingsRow.bulletRating),
              blitz: Math.round(ratingsRow.blitzRating),
              rapid: Math.round(ratingsRow.rapidRating),
              classical: Math.round(ratingsRow.classicalRating),
            }
          : {
              bullet: 1500,
              blitz: 1500,
              rapid: 1500,
              classical: 1500,
            },
      },
    });
  });

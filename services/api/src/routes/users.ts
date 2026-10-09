import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import * as schema from "../db/schema";
import { type HonoVariables, requireAuth } from "../middleware/session";
import type { Env } from "../types";

const DisallowedNames = new Set([
  "admin",
  "administrator",
  "moderator",
  "mod",
  "system",
  "support",
  "official",
  "etchess",
  "et_chess",
  "root",
  "staff",
  "bot",
  "stockfish",
]);

const NameSchema = z
  .string()
  .trim()
  .min(2, { message: "Username must be at least 2 characters" })
  .max(30, { message: "Username must be at most 30 characters" })
  .regex(/^[a-zA-Z0-9_-]+$/, {
    message: "Username can only contain alphanumeric characters, underscores, and hyphens",
  })
  .refine((val) => !DisallowedNames.has(val.toLowerCase()), {
    message: "This username is reserved and cannot be chosen",
  });

const ImageUrlSchema = z
  .string()
  .refine(
    (url) => {
      if (url.startsWith("/api/")) return true;
      try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Image URL must be a valid http/https URL or an internal /api/ path" },
  )
  .nullable();

export function verifyImageMagicBytes(buffer: Uint8Array, mimeType: string): boolean {
  if (buffer.length < 12) return false;

  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    // JPEG starts with FF D8 FF
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === "image/png") {
    // PNG starts with 89 50 4E 47 0D 0A 1A 0A
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (mimeType === "image/webp") {
    // WebP: RIFF at 0..3, WEBP at 8..11
    const isRiff =
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
    const isWebp =
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    return isRiff && isWebp;
  }

  return false;
}

export const usersRoute = new Hono<{
  Bindings: Env;
  Variables: HonoVariables;
}>()
  // Upload user avatar to R2 storage
  .post("/avatar", requireAuth, async (c) => {
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

    if (!c.env.AVATARS_BUCKET) {
      return c.json(
        {
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Avatar storage service is not configured",
          },
        },
        503,
      );
    }

    const contentType = c.req.header("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return c.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Content-Type must be multipart/form-data",
          },
        },
        400,
      );
    }

    const body = await c.req.parseBody();
    const file = body.file;
    if (!file || typeof file === "string") {
      return c.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "No file uploaded under key 'file'",
          },
        },
        400,
      );
    }

    // Supported formats: JPEG, PNG, WebP
    const allowedMimeTypes: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };

    const ext = allowedMimeTypes[file.type];
    if (!ext) {
      return c.json(
        {
          error: {
            code: "INVALID_FILE_TYPE",
            message: "Avatar must be a JPEG, PNG, or WebP image",
          },
        },
        400,
      );
    }

    // Max file size: 2MB (2 * 1024 * 1024 bytes)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return c.json(
        {
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: "Avatar image must be under 2MB",
          },
        },
        413,
      );
    }

    const key = `avatars/${user.id}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (!verifyImageMagicBytes(bytes, file.type)) {
      return c.json(
        {
          error: {
            code: "INVALID_FILE_SIGNATURE",
            message: "File signature does not match declared image format",
          },
        },
        400,
      );
    }

    // Clean up any stale avatars with different extensions for this user
    const staleCandidates = [
      `avatars/${user.id}.webp`,
      `avatars/${user.id}.png`,
      `avatars/${user.id}.jpg`,
    ];
    for (const staleKey of staleCandidates) {
      if (staleKey !== key) {
        await c.env.AVATARS_BUCKET.delete(staleKey).catch(() => {});
      }
    }

    await c.env.AVATARS_BUCKET.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    const avatarUrl = `/api/users/avatar/${user.id}`;
    const db = drizzle(c.env.DB, { schema });
    await db
      .update(schema.user)
      .set({ image: avatarUrl, updatedAt: new Date() })
      .where(eq(schema.user.id, user.id));

    return c.json({
      success: true,
      avatarUrl,
    });
  })

  // Remove user avatar from R2 storage and reset profile image
  .delete("/avatar", requireAuth, async (c) => {
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

    if (c.env.AVATARS_BUCKET) {
      const candidates = [
        `avatars/${user.id}.webp`,
        `avatars/${user.id}.png`,
        `avatars/${user.id}.jpg`,
      ];
      for (const k of candidates) {
        await c.env.AVATARS_BUCKET.delete(k).catch(() => {});
      }
    }

    const db = drizzle(c.env.DB, { schema });
    await db
      .update(schema.user)
      .set({ image: null, updatedAt: new Date() })
      .where(eq(schema.user.id, user.id));

    return c.json({
      success: true,
      message: "Avatar removed successfully",
    });
  })

  // Fetch user avatar from R2 storage
  .get("/avatar/:id", async (c) => {
    const id = c.req.param("id");
    if (!c.env.AVATARS_BUCKET) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Avatar storage not configured",
          },
        },
        404,
      );
    }

    // Check possible extensions: webp, png, jpg
    const candidates = [`avatars/${id}.webp`, `avatars/${id}.png`, `avatars/${id}.jpg`];
    let object = null;
    for (const key of candidates) {
      object = await c.env.AVATARS_BUCKET.get(key);
      if (object) break;
    }

    if (!object) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Avatar not found",
          },
        },
        404,
      );
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=3600");
    if (object.httpEtag) {
      headers.set("ETag", object.httpEtag);
    }

    return new Response(object.body, { headers });
  })

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

    const [userRow] = await db
      .select({ experienceLevel: schema.user.experienceLevel })
      .from(schema.user)
      .where(eq(schema.user.id, user.id))
      .limit(1);

    const experienceLevel =
      userRow?.experienceLevel ??
      (user as { experienceLevel?: string | null }).experienceLevel ??
      null;

    return c.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
        experienceLevel,
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

  // One-time skill level onboarding for new players
  .post(
    "/me/onboarding",
    requireAuth,
    zValidator(
      "json",
      z.object({
        experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
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
      const { experienceLevel } = c.req.valid("json");
      const db = drizzle(c.env.DB, { schema });

      const startRating =
        experienceLevel === "beginner" ? 500 : experienceLevel === "advanced" ? 1500 : 1000;

      // Update user experience level
      await db
        .update(schema.user)
        .set({
          experienceLevel,
          updatedAt: new Date(),
        })
        .where(eq(schema.user.id, user.id));

      // Check current game count to prevent resetting active players
      const [currentRatings] = await db
        .select()
        .from(schema.ratings)
        .where(eq(schema.ratings.userId, user.id));

      const totalGames =
        (currentRatings?.bulletGames || 0) +
        (currentRatings?.blitzGames || 0) +
        (currentRatings?.rapidGames || 0) +
        (currentRatings?.classicalGames || 0);

      if (!currentRatings || totalGames === 0) {
        // Reset or initialize ratings to chosen skill level
        await db
          .insert(schema.ratings)
          .values({
            userId: user.id,
            bulletRating: startRating,
            bulletRd: 350,
            bulletVol: 0.06,
            blitzRating: startRating,
            blitzRd: 350,
            blitzVol: 0.06,
            rapidRating: startRating,
            rapidRd: 350,
            rapidVol: 0.06,
            classicalRating: startRating,
            classicalRd: 350,
            classicalVol: 0.06,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.ratings.userId,
            set: {
              bulletRating: startRating,
              blitzRating: startRating,
              rapidRating: startRating,
              classicalRating: startRating,
              updatedAt: new Date(),
            },
          });
      }

      return c.json({
        success: true,
        experienceLevel,
        startingRating: startRating,
      });
    },
  )

  // Current active live game for authenticated user (for resume/rejoin)
  .get("/me/live-game", requireAuth, async (c) => {
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

    if (c.env.USER_PRESENCE_DO) {
      try {
        const upStub = c.env.USER_PRESENCE_DO.get(c.env.USER_PRESENCE_DO.idFromName(user.id));
        const res = await upStub.fetch("http://internal/active-game");
        if (res.ok) {
          const data = (await res.json()) as { active: boolean; gameId: string | null };
          return c.json(data);
        }
      } catch {}
    }

    return c.json({ active: false, gameId: null });
  })

  // Update authenticated user profile
  .patch(
    "/me",
    requireAuth,
    zValidator(
      "json",
      z.object({
        name: NameSchema.optional(),
        image: ImageUrlSchema.optional(),
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

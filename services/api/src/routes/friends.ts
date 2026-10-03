import { PRODUCT_RULES } from "@etchess/types";
import { zValidator } from "@hono/zod-validator";
import { and, eq, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import * as schema from "../db/schema";
import { type HonoVariables, requireAuth } from "../middleware/session";
import type { Env } from "../types";

export const friendsRoute = new Hono<{
  Bindings: Env;
  Variables: HonoVariables;
}>();

// All friends endpoints require user authentication
friendsRoute.use("*", requireAuth);

/**
 * GET /api/friends
 * Lists all accepted friends with profile, rating, and status.
 */
friendsRoute.get("/", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "UNAUTHENTICATED", message: "User session required" } }, 401);
  }

  const db = drizzle(c.env.DB, { schema });

  // 1. Fetch all accepted friendships involving this user
  const friendshipRows = await db
    .select()
    .from(schema.friends)
    .where(
      and(
        or(eq(schema.friends.userId, user.id), eq(schema.friends.friendId, user.id)),
        eq(schema.friends.status, "accepted"),
      ),
    );

  if (friendshipRows.length === 0) {
    return c.json({ friends: [] });
  }

  const friendUserIds = friendshipRows.map((f) => (f.userId === user.id ? f.friendId : f.userId));

  // 2. Fetch friend user profiles and ratings
  const friendsList = await Promise.all(
    friendshipRows.map(async (row) => {
      const friendId = row.userId === user.id ? row.friendId : row.userId;

      const [friendUser] = await db
        .select({
          id: schema.user.id,
          name: schema.user.name,
          image: schema.user.image,
        })
        .from(schema.user)
        .where(eq(schema.user.id, friendId));

      const [ratingRow] = await db
        .select({ blitzRating: schema.ratings.blitzRating })
        .from(schema.ratings)
        .where(eq(schema.ratings.userId, friendId));

      return {
        friendshipId: row.id,
        friend: {
          id: friendUser?.id || friendId,
          name: friendUser?.name || "Unknown",
          rating: Math.round(ratingRow?.blitzRating ?? 1500),
          image: friendUser?.image || null,
        },
        status: "online" as const, // Future: read live presence from UserPresenceDO
        currentGameId: null,
        createdAt: row.createdAt.getTime(),
      };
    }),
  );

  return c.json({ friends: friendsList });
});

const FriendRequestSchema = z.object({
  username: z.string().optional(),
  targetUserId: z.string().optional(),
});

/**
 * POST /api/friends/requests
 * Sends a friend request (capped at 200 friends, RULE-14).
 */
friendsRoute.post("/requests", zValidator("json", FriendRequestSchema), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "UNAUTHENTICATED", message: "User session required" } }, 401);
  }

  const { username, targetUserId } = c.req.valid("json");
  if (!username && !targetUserId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: "Either username or targetUserId is required",
        },
      },
      400,
    );
  }

  const db = drizzle(c.env.DB, { schema });

  // 1. Resolve target user
  let targetUser: schema.User | undefined;
  if (targetUserId) {
    const [found] = await db.select().from(schema.user).where(eq(schema.user.id, targetUserId));
    targetUser = found;
  } else if (username) {
    const [found] = await db.select().from(schema.user).where(eq(schema.user.name, username));
    targetUser = found;
  }

  if (!targetUser) {
    return c.json({ error: { code: "NOT_FOUND", message: "User does not exist" } }, 404);
  }

  // 2. Cannot friend yourself
  if (targetUser.id === user.id) {
    return c.json({ error: { code: "VALIDATION_FAILED", message: "Cannot friend yourself" } }, 400);
  }

  // 3. RULE-14 Friend list cap (200)
  const currentFriends = await db
    .select({ id: schema.friends.id })
    .from(schema.friends)
    .where(
      and(
        or(eq(schema.friends.userId, user.id), eq(schema.friends.friendId, user.id)),
        eq(schema.friends.status, "accepted"),
      ),
    );

  if (currentFriends.length >= PRODUCT_RULES.MAX_FRIENDS) {
    return c.json(
      {
        error: {
          code: "CONFLICT",
          message: `Friend list limit (${PRODUCT_RULES.MAX_FRIENDS}) reached`,
        },
      },
      409,
    );
  }

  // 4. Check existing relationship
  const [existing] = await db
    .select()
    .from(schema.friends)
    .where(
      or(
        and(eq(schema.friends.userId, user.id), eq(schema.friends.friendId, targetUser.id)),
        and(eq(schema.friends.userId, targetUser.id), eq(schema.friends.friendId, user.id)),
      ),
    );

  if (existing) {
    if (existing.status === "blocked") {
      return c.json({ error: { code: "CONFLICT", message: "Unable to send friend request" } }, 409);
    }
    if (existing.status === "accepted") {
      return c.json({ error: { code: "CONFLICT", message: "Already friends" } }, 409);
    }
    if (existing.status === "pending") {
      return c.json(
        { error: { code: "CONFLICT", message: "Friend request already pending" } },
        409,
      );
    }
  }

  // 5. Insert new friend request
  const newFriendshipId = crypto.randomUUID();
  const now = new Date();

  await db.insert(schema.friends).values({
    id: newFriendshipId,
    userId: user.id,
    friendId: targetUser.id,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  return c.json(
    {
      friendship: {
        id: newFriendshipId,
        friendId: targetUser.id,
        status: "pending",
        createdAt: now.getTime(),
      },
    },
    201,
  );
});

/**
 * POST /api/friends/requests/:id/accept
 * Accepts a pending friend request (must be addressee).
 */
friendsRoute.post("/requests/:id/accept", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "UNAUTHENTICATED", message: "User session required" } }, 401);
  }

  const requestId = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });

  const [request] = await db.select().from(schema.friends).where(eq(schema.friends.id, requestId));

  if (!request) {
    return c.json({ error: { code: "NOT_FOUND", message: "Friend request not found" } }, 404);
  }

  if (request.friendId !== user.id) {
    return c.json(
      { error: { code: "FORBIDDEN", message: "Only the addressee can accept this request" } },
      403,
    );
  }

  await db
    .update(schema.friends)
    .set({
      status: "accepted",
      updatedAt: new Date(),
    })
    .where(eq(schema.friends.id, requestId));

  return c.json({ success: true, status: "accepted" });
});

/**
 * POST /api/friends/requests/:id/decline
 * Declines a pending friend request (must be addressee).
 */
friendsRoute.post("/requests/:id/decline", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "UNAUTHENTICATED", message: "User session required" } }, 401);
  }

  const requestId = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });

  const [request] = await db.select().from(schema.friends).where(eq(schema.friends.id, requestId));

  if (!request) {
    return c.json({ error: { code: "NOT_FOUND", message: "Friend request not found" } }, 404);
  }

  if (request.friendId !== user.id) {
    return c.json(
      { error: { code: "FORBIDDEN", message: "Only the addressee can decline this request" } },
      403,
    );
  }

  await db
    .update(schema.friends)
    .set({
      status: "declined",
      updatedAt: new Date(),
    })
    .where(eq(schema.friends.id, requestId));

  return c.json({ success: true, status: "declined" });
});

/**
 * POST /api/friends/:friendId/remove
 * Removes an existing friendship.
 */
friendsRoute.post("/:friendId/remove", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "UNAUTHENTICATED", message: "User session required" } }, 401);
  }

  const friendId = c.req.param("friendId");
  const db = drizzle(c.env.DB, { schema });

  await db
    .delete(schema.friends)
    .where(
      or(
        and(eq(schema.friends.userId, user.id), eq(schema.friends.friendId, friendId)),
        and(eq(schema.friends.userId, friendId), eq(schema.friends.friendId, user.id)),
      ),
    );

  return c.json({ success: true });
});

/**
 * POST /api/friends/:friendId/block
 * Blocks another user.
 */
friendsRoute.post("/:friendId/block", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "UNAUTHENTICATED", message: "User session required" } }, 401);
  }

  const friendId = c.req.param("friendId");
  const db = drizzle(c.env.DB, { schema });

  // Update existing or insert blocked relationship
  const [existing] = await db
    .select()
    .from(schema.friends)
    .where(
      or(
        and(eq(schema.friends.userId, user.id), eq(schema.friends.friendId, friendId)),
        and(eq(schema.friends.userId, friendId), eq(schema.friends.friendId, user.id)),
      ),
    );

  const now = new Date();
  if (existing) {
    await db
      .update(schema.friends)
      .set({ status: "blocked", updatedAt: now })
      .where(eq(schema.friends.id, existing.id));
  } else {
    await db.insert(schema.friends).values({
      id: crypto.randomUUID(),
      userId: user.id,
      friendId,
      status: "blocked",
      createdAt: now,
      updatedAt: now,
    });
  }

  return c.json({ success: true, status: "blocked" });
});

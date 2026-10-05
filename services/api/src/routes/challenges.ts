import { shouldRefuseRatedPair } from "@etchess/rating";
import { PROTOCOL_VERSION } from "@etchess/realtime-protocol";
import {
  PRODUCT_RULES,
  type RatingCategory,
  TIME_CONTROLS,
  type TimeControlKey,
  getRatingCategory,
} from "@etchess/types";
import { zValidator } from "@hono/zod-validator";
import { and, eq, gt, isNotNull, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { type Context, Hono } from "hono";
import { z } from "zod";
import * as schema from "../db/schema";
import { notifyUserChannel } from "../lib/notifier";
import { fetchUserCategoryRating } from "../lib/ratingStorage";
import { type HonoVariables, requireAuth } from "../middleware/session";
import type { Env } from "../types";

export const challengesRoute = new Hono<{
  Bindings: Env;
  Variables: HonoVariables;
}>();

// All challenge operations require user authentication
challengesRoute.use("*", requireAuth);

const CreateChallengeSchema = z.object({
  challengedId: z.string().optional(),
  timeControlId: z.string().default("3+2"),
  rated: z.boolean().optional(),
  isRated: z.boolean().optional(),
  preferredColor: z.enum(["random", "white", "black"]).default("random"),
});

/**
 * POST /api/challenges
 * Creates a direct friend challenge or open link challenge.
 */
challengesRoute.post("/", zValidator("json", CreateChallengeSchema), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "UNAUTHENTICATED", message: "User session required" } }, 401);
  }

  const body = c.req.valid("json");
  const timeControlId = (body.timeControlId || "3+2") as TimeControlKey;
  const isRated = body.rated ?? body.isRated ?? false;
  const preferredColor = body.preferredColor || "random";
  const challengedId = body.challengedId || null;

  // 1. Cannot challenge oneself
  if (challengedId && challengedId === user.id) {
    return c.json(
      { error: { code: "VALIDATION_FAILED", message: "Cannot challenge yourself" } },
      400,
    );
  }

  // 1b. Disallow guests from creating rated challenges (H8)
  if (isRated && user.role === "guest") {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Guest accounts cannot create rated challenges. Please sign in.",
        },
      },
      403,
    );
  }

  const db = drizzle(c.env.DB, { schema });

  // 1c. Cannot challenge a blocked user or if blocked by user (M11)
  if (challengedId) {
    const [blockRow] = await db
      .select()
      .from(schema.friends)
      .where(
        and(
          or(
            and(eq(schema.friends.userId, user.id), eq(schema.friends.friendId, challengedId)),
            and(eq(schema.friends.userId, challengedId), eq(schema.friends.friendId, user.id)),
          ),
          eq(schema.friends.status, "blocked"),
        ),
      );

    if (blockRow) {
      return c.json(
        { error: { code: "FORBIDDEN", message: "Cannot challenge a blocked user" } },
        403,
      );
    }
  }

  const now = new Date();

  // 2. RULE-08: Maximum pending outgoing challenges per user (5)
  const pendingOutgoing = await db
    .select({ id: schema.challenges.id })
    .from(schema.challenges)
    .where(
      and(
        eq(schema.challenges.challengerId, user.id),
        eq(schema.challenges.status, "pending"),
        gt(schema.challenges.expiresAt, now),
      ),
    );

  if (pendingOutgoing.length >= PRODUCT_RULES.MAX_PENDING_OUTGOING_CHALLENGES) {
    return c.json(
      {
        error: {
          code: "CONFLICT",
          message: `Maximum pending outgoing challenges (${PRODUCT_RULES.MAX_PENDING_OUTGOING_CHALLENGES}) reached`,
        },
      },
      409,
    );
  }

  // 3. RULE-05: Rated pair cap (5 games per 24h between the same pair)
  if (isRated) {
    if (!challengedId) {
      return c.json(
        { error: { code: "VALIDATION_FAILED", message: "Open link challenges cannot be rated" } },
        400,
      );
    }

    const since24hAgo = new Date(now.getTime() - 86_400_000);
    const recentGames = await db
      .select({ id: schema.games.id })
      .from(schema.games)
      .where(
        and(
          gt(schema.games.startedAt, since24hAgo),
          isNotNull(schema.games.whiteRatingChange),
          or(
            and(
              eq(schema.games.whitePlayerId, user.id),
              eq(schema.games.blackPlayerId, challengedId),
            ),
            and(
              eq(schema.games.whitePlayerId, challengedId),
              eq(schema.games.blackPlayerId, user.id),
            ),
          ),
        ),
      );

    const refusal = shouldRefuseRatedPair({
      recentRatedGamesBetweenPairIn24h: recentGames.length,
    });

    if (refusal.refuse) {
      return c.json(
        {
          error: {
            code: "CONFLICT",
            message: `Maximum rated games limit (${PRODUCT_RULES.RATED_PAIR_CAP_24H} per 24 hours) between these players has been reached.`,
          },
        },
        409,
      );
    }
  }

  // 4. Calculate expiration (RULE-07: 60s for direct challenge, 10 min for link)
  const expiryDurationMs = challengedId
    ? PRODUCT_RULES.CHALLENGE_DIRECT_EXPIRY_MS
    : PRODUCT_RULES.CHALLENGE_LINK_EXPIRY_MS;
  const expiresAt = new Date(now.getTime() + expiryDurationMs);

  const category = getRatingCategory(timeControlId);
  const challengeId = crypto.randomUUID();

  // 5. Insert challenge row
  await db.insert(schema.challenges).values({
    id: challengeId,
    challengerId: user.id,
    challengedId,
    timeControl: timeControlId,
    category,
    rated: isRated,
    preferredColor,
    status: "pending",
    expiresAt,
    createdAt: now,
  });

  // 6. Get challenger rating for notification
  const challengerRatingData = await fetchUserCategoryRating(db, user.id, category);
  const challengerRating = Math.round(challengerRatingData.rating);

  // 7. If direct challenge, notify challenged user in real-time over /ws/user
  if (challengedId) {
    await notifyUserChannel(c.env, challengedId, {
      v: PROTOCOL_VERSION,
      type: "CHALLENGE_RECEIVED",
      serverTime: now.getTime(),
      payload: {
        challengeId,
        challenger: {
          id: user.id,
          name: user.name,
          rating: challengerRating,
          image: user.image ?? null,
        },
        timeControlId,
        rated: isRated,
        preferredColor,
        expiresAt: expiresAt.getTime(),
      },
    });
  }

  return c.json(
    {
      challenge: {
        id: challengeId,
        shareCode: challengeId,
        timeControlId,
        isRated,
        rated: isRated,
        preferredColor,
        expiresAt: expiresAt.getTime(),
      },
    },
    201,
  );
});

/**
 * GET /api/challenges/:id
 * Fetches challenge metadata and status.
 */
challengesRoute.get("/:id", async (c) => {
  const challengeId = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });

  const [challenge] = await db
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.id, challengeId));

  if (!challenge) {
    return c.json({ error: { code: "NOT_FOUND", message: "Challenge not found" } }, 404);
  }

  // Check if expired
  const now = new Date();
  if (challenge.status === "pending" && challenge.expiresAt < now) {
    await db
      .update(schema.challenges)
      .set({ status: "expired" })
      .where(eq(schema.challenges.id, challengeId));
    challenge.status = "expired";
  }

  return c.json({ challenge });
});

/**
 * POST /api/challenges/:id/accept
 * Accepts a challenge, pre-initializes GameSessionDO, and notifies the challenger.
 */
challengesRoute.post("/:id/accept", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "UNAUTHENTICATED", message: "User session required" } }, 401);
  }

  const challengeId = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });

  const [challenge] = await db
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.id, challengeId));

  if (!challenge) {
    return c.json({ error: { code: "NOT_FOUND", message: "Challenge not found" } }, 404);
  }

  // 1. Challenger cannot accept their own challenge
  if (challenge.challengerId === user.id) {
    return c.json(
      { error: { code: "VALIDATION_FAILED", message: "Cannot accept your own challenge" } },
      400,
    );
  }

  // 1b. Disallow guests from accepting rated challenges (H8)
  if (challenge.rated && user.role === "guest") {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Guest accounts cannot accept rated challenges. Please sign in.",
        },
      },
      403,
    );
  }

  // 1c. Block check: neither player may accept if a block exists between them (M11)
  const [blockRow] = await db
    .select()
    .from(schema.friends)
    .where(
      and(
        or(
          and(
            eq(schema.friends.userId, challenge.challengerId),
            eq(schema.friends.friendId, user.id),
          ),
          and(
            eq(schema.friends.userId, user.id),
            eq(schema.friends.friendId, challenge.challengerId),
          ),
        ),
        eq(schema.friends.status, "blocked"),
      ),
    );

  if (blockRow) {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Cannot accept challenge due to a block between players",
        },
      },
      403,
    );
  }

  // 2. Direct challenge addressee check
  if (challenge.challengedId && challenge.challengedId !== user.id) {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Only the challenged player can accept this challenge",
        },
      },
      403,
    );
  }

  // 3. Status and expiration check
  const now = new Date();
  if (challenge.status !== "pending" || challenge.expiresAt < now) {
    if (challenge.status === "pending") {
      await db
        .update(schema.challenges)
        .set({ status: "expired" })
        .where(eq(schema.challenges.id, challengeId));
    }
    return c.json(
      { error: { code: "CONFLICT", message: "Challenge has expired or is no longer pending" } },
      409,
    );
  }

  // 4. Resolve player details and ratings
  const [challenger] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, challenge.challengerId));

  const category = challenge.category as RatingCategory;
  const challengerRatingData = await fetchUserCategoryRating(db, challenge.challengerId, category);
  const accepterRatingData = await fetchUserCategoryRating(db, user.id, category);

  const challengerRating = Math.round(challengerRatingData.rating);
  const accepterRating = Math.round(accepterRatingData.rating);

  // 5. Determine piece colors
  let challengerWhite = false;
  if (challenge.preferredColor === "white") {
    challengerWhite = true;
  } else if (challenge.preferredColor === "black") {
    challengerWhite = false;
  } else {
    challengerWhite = Math.random() < 0.5;
  }

  const whiteUserId = challengerWhite ? challenge.challengerId : user.id;
  const whiteUserName = challengerWhite ? challenger?.name || "Player 1" : user.name;
  const whiteRating = challengerWhite ? challengerRating : accepterRating;
  const whiteRd = challengerWhite ? challengerRatingData.rd : accepterRatingData.rd;
  const whiteVol = challengerWhite ? challengerRatingData.vol : accepterRatingData.vol;

  const blackUserId = challengerWhite ? user.id : challenge.challengerId;
  const blackUserName = challengerWhite ? user.name : challenger?.name || "Player 2";
  const blackRating = challengerWhite ? accepterRating : challengerRating;
  const blackRd = challengerWhite ? accepterRatingData.rd : challengerRatingData.rd;
  const blackVol = challengerWhite ? accepterRatingData.vol : challengerRatingData.vol;

  const gameId = crypto.randomUUID();

  // 6. Atomically claim challenge in D1 via conditional compare-and-set (M11)
  const updatedRows = await db
    .update(schema.challenges)
    .set({
      status: "accepted",
      challengedId: user.id,
      gameId,
    })
    .where(
      and(
        eq(schema.challenges.id, challengeId),
        eq(schema.challenges.status, "pending"),
        gt(schema.challenges.expiresAt, now),
      ),
    )
    .returning();

  if (!updatedRows || updatedRows.length === 0) {
    return c.json(
      {
        error: {
          code: "CONFLICT",
          message: "Challenge has already been accepted or is no longer pending",
        },
      },
      409,
    );
  }

  // 7. Pre-initialize GameSessionDO
  try {
    const ns = c.env.GAME_SESSION_DO;
    const sessionStub = ns.get(ns.idFromName(gameId));
    await sessionStub.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        whiteUserId,
        whiteUserName,
        whiteRating,
        whiteRd,
        whiteVol,
        blackUserId,
        blackUserName,
        blackRating,
        blackRd,
        blackVol,
        timeControl: challenge.timeControl,
        rated: challenge.rated,
        isFriendGame: !challenge.rated, // Casual friend game enables takebacks (RULE-10)
      }),
    });
  } catch (err) {
    console.error("Failed to pre-initialize GameSessionDO for challenge:", err);
  }

  // 8. Notify challenger over /ws/user channel
  await notifyUserChannel(c.env, challenge.challengerId, {
    v: PROTOCOL_VERSION,
    type: "CHALLENGE_ACCEPTED",
    serverTime: Date.now(),
    payload: {
      challengeId,
      gameId,
    },
  });

  return c.json({
    gameId,
    timeControlId: challenge.timeControl,
    rated: challenge.rated,
    assignedColor: challengerWhite ? "black" : "white",
  });
});

/**
 * POST /api/challenges/:id/decline
 * Declines a pending challenge and notifies the challenger.
 */
challengesRoute.post("/:id/decline", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "UNAUTHENTICATED", message: "User session required" } }, 401);
  }

  const challengeId = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });

  const [challenge] = await db
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.id, challengeId));

  if (!challenge) {
    return c.json({ error: { code: "NOT_FOUND", message: "Challenge not found" } }, 404);
  }

  if (challenge.challengedId && challenge.challengedId !== user.id) {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Only the challenged player can decline this challenge",
        },
      },
      403,
    );
  }

  if (challenge.status !== "pending") {
    return c.json({ error: { code: "CONFLICT", message: "Challenge is no longer pending" } }, 409);
  }

  await db
    .update(schema.challenges)
    .set({ status: "declined" })
    .where(eq(schema.challenges.id, challengeId));

  // Notify challenger over /ws/user channel
  await notifyUserChannel(c.env, challenge.challengerId, {
    v: PROTOCOL_VERSION,
    type: "CHALLENGE_DECLINED",
    serverTime: Date.now(),
    payload: {
      challengeId,
      reason: "Declined by opponent",
    },
  });

  return c.json({ success: true, status: "declined" });
});

/**
 * POST /api/challenges/:id/cancel
 * DELETE /api/challenges/:id
 * Cancels a pending challenge initiated by the user.
 */
const handleCancelChallenge = async (
  c: Context<{
    Bindings: Env;
    Variables: HonoVariables;
  }>,
) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "UNAUTHENTICATED", message: "User session required" } }, 401);
  }

  const challengeId = c.req.param("id");
  if (!challengeId) {
    return c.json({ error: { code: "VALIDATION_FAILED", message: "Challenge ID required" } }, 400);
  }

  const db = drizzle(c.env.DB, { schema });

  const [challenge] = await db
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.id, challengeId));

  if (!challenge) {
    return c.json({ error: { code: "NOT_FOUND", message: "Challenge not found" } }, 404);
  }

  if (challenge.challengerId !== user.id) {
    return c.json(
      { error: { code: "FORBIDDEN", message: "Only the challenger can cancel this challenge" } },
      403,
    );
  }

  if (challenge.status !== "pending") {
    return c.json({ error: { code: "CONFLICT", message: "Challenge is no longer pending" } }, 409);
  }

  await db
    .update(schema.challenges)
    .set({ status: "canceled" })
    .where(eq(schema.challenges.id, challengeId));

  if (challenge.challengedId) {
    await notifyUserChannel(c.env, challenge.challengedId, {
      v: PROTOCOL_VERSION,
      type: "CHALLENGE_DECLINED",
      serverTime: Date.now(),
      payload: {
        challengeId,
        reason: "Canceled by challenger",
      },
    });
  }

  return c.json({ success: true, status: "canceled" });
};

challengesRoute.post("/:id/cancel", handleCancelChallenge);
challengesRoute.delete("/:id", handleCancelChallenge);

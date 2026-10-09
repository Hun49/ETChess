import { applyGameResult } from "@etchess/rating";
import type { RatingCategory } from "@etchess/types";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";

export interface CategoryRatingData {
  rating: number;
  rd: number;
  vol: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
}

export function extractCategoryRating(
  row: typeof schema.ratings.$inferSelect | undefined,
  category: RatingCategory,
): CategoryRatingData {
  if (!row) {
    return {
      rating: 1500,
      rd: 350,
      vol: 0.06,
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    };
  }

  switch (category) {
    case "bullet":
      return {
        rating: row.bulletRating ?? 1500,
        rd: row.bulletRd ?? 350,
        vol: row.bulletVol ?? 0.06,
        games: row.bulletGames ?? 0,
        wins: row.bulletWins ?? 0,
        losses: row.bulletLosses ?? 0,
        draws: row.bulletDraws ?? 0,
      };
    case "rapid":
      return {
        rating: row.rapidRating ?? 1500,
        rd: row.rapidRd ?? 350,
        vol: row.rapidVol ?? 0.06,
        games: row.rapidGames ?? 0,
        wins: row.rapidWins ?? 0,
        losses: row.rapidLosses ?? 0,
        draws: row.rapidDraws ?? 0,
      };
    case "classical":
      return {
        rating: row.classicalRating ?? 1500,
        rd: row.classicalRd ?? 350,
        vol: row.classicalVol ?? 0.06,
        games: row.classicalGames ?? 0,
        wins: row.classicalWins ?? 0,
        losses: row.classicalLosses ?? 0,
        draws: row.classicalDraws ?? 0,
      };
    default:
      return {
        rating: row.blitzRating ?? 1500,
        rd: row.blitzRd ?? 350,
        vol: row.blitzVol ?? 0.06,
        games: row.blitzGames ?? 0,
        wins: row.blitzWins ?? 0,
        losses: row.blitzLosses ?? 0,
        draws: row.blitzDraws ?? 0,
      };
  }
}

export async function fetchUserCategoryRating(
  dbOrD1: D1Database | ReturnType<typeof drizzle>,
  userId: string,
  category: RatingCategory,
): Promise<CategoryRatingData> {
  const db =
    "batch" in dbOrD1 && "select" in dbOrD1 ? dbOrD1 : drizzle(dbOrD1 as D1Database, { schema });

  const [row] = await db.select().from(schema.ratings).where(eq(schema.ratings.userId, userId));

  return extractCategoryRating(row, category);
}

export function buildRatingUpdateSet(
  category: RatingCategory,
  newGlicko: { rating: number; rd: number; vol: number },
  existing: CategoryRatingData,
  outcome: "win" | "loss" | "draw",
  diff?: number,
): Record<string, unknown> {
  const isWin = outcome === "win" ? 1 : 0;
  const isLoss = outcome === "loss" ? 1 : 0;
  const isDraw = outcome === "draw" ? 1 : 0;

  const base = {
    updatedAt: new Date(),
  };

  switch (category) {
    case "bullet":
      return {
        ...base,
        bulletRating:
          diff !== undefined
            ? sql`MAX(100, ${schema.ratings.bulletRating} + ${diff})`
            : newGlicko.rating,
        bulletRd: newGlicko.rd,
        bulletVol: newGlicko.vol,
        bulletGames: sql`${schema.ratings.bulletGames} + 1`,
        bulletWins: sql`${schema.ratings.bulletWins} + ${isWin}`,
        bulletLosses: sql`${schema.ratings.bulletLosses} + ${isLoss}`,
        bulletDraws: sql`${schema.ratings.bulletDraws} + ${isDraw}`,
      };
    case "rapid":
      return {
        ...base,
        rapidRating:
          diff !== undefined
            ? sql`MAX(100, ${schema.ratings.rapidRating} + ${diff})`
            : newGlicko.rating,
        rapidRd: newGlicko.rd,
        rapidVol: newGlicko.vol,
        rapidGames: sql`${schema.ratings.rapidGames} + 1`,
        rapidWins: sql`${schema.ratings.rapidWins} + ${isWin}`,
        rapidLosses: sql`${schema.ratings.rapidLosses} + ${isLoss}`,
        rapidDraws: sql`${schema.ratings.rapidDraws} + ${isDraw}`,
      };
    case "classical":
      return {
        ...base,
        classicalRating:
          diff !== undefined
            ? sql`MAX(100, ${schema.ratings.classicalRating} + ${diff})`
            : newGlicko.rating,
        classicalRd: newGlicko.rd,
        classicalVol: newGlicko.vol,
        classicalGames: sql`${schema.ratings.classicalGames} + 1`,
        classicalWins: sql`${schema.ratings.classicalWins} + ${isWin}`,
        classicalLosses: sql`${schema.ratings.classicalLosses} + ${isLoss}`,
        classicalDraws: sql`${schema.ratings.classicalDraws} + ${isDraw}`,
      };
    default:
      return {
        ...base,
        blitzRating:
          diff !== undefined
            ? sql`MAX(100, ${schema.ratings.blitzRating} + ${diff})`
            : newGlicko.rating,
        blitzRd: newGlicko.rd,
        blitzVol: newGlicko.vol,
        blitzGames: sql`${schema.ratings.blitzGames} + 1`,
        blitzWins: sql`${schema.ratings.blitzWins} + ${isWin}`,
        blitzLosses: sql`${schema.ratings.blitzLosses} + ${isLoss}`,
        blitzDraws: sql`${schema.ratings.blitzDraws} + ${isDraw}`,
      };
  }
}

import type { Env } from "../types";

export interface FinalizeSettlementInput {
  gameId: string;
  whiteUserId?: string;
  blackUserId?: string;
  timeControl: string;
  category: RatingCategory;
  moves: string[];
  result: string;
  termination: string;
  rated: boolean;
  gameType?: "matchmaking" | "challenge" | "bot" | string;
  startedAt: number;
  endedAt: number;
}

export interface SettlementResult {
  settled: boolean;
  alreadySettled: boolean;
  whiteRatingBefore?: number;
  whiteRatingAfter?: number;
  whiteRatingDiff?: number;
  blackRatingBefore?: number;
  blackRatingAfter?: number;
  blackRatingDiff?: number;
}

/**
 * Concurrency-safe, transactional, exactly-once game finalization and rating settlement.
 *
 * Implements:
 * - FINAL-01: Exactly-once database settlement guarded by games.id primary key.
 * - RATING-01 / B4-RATE-02: Exactly-once rating update; repeated or concurrent calls cannot re-apply ratings.
 * - RATING-02 / B4-RATE-01: Stale rating baseline race protection; serialized per user via UserPresenceDO,
 *   re-fetching fresh committed baseline under lock so concurrent games converge to defined serialized state.
 * - RATING-03: Rating transaction atomicity; db.batch commits games record, rating updates, and rating history
 *   together in a single D1 transaction.
 */
export async function settleGameRatings(
  dbOrD1: D1Database | ReturnType<typeof drizzle>,
  input: FinalizeSettlementInput,
  env?: Env,
): Promise<SettlementResult> {
  const db =
    "batch" in dbOrD1 && "select" in dbOrD1 ? dbOrD1 : drizzle(dbOrD1 as D1Database, { schema });

  // 1. Acquire distributed per-user settlement locks if env is provided (B4-RATE-01 / INV-08)
  const userIds = [input.whiteUserId, input.blackUserId]
    .filter((id): id is string => Boolean(id))
    .sort();
  const acquiredLocks: { userId: string; lockId: string }[] = [];

  if (env?.USER_PRESENCE_DO && input.rated && userIds.length > 0) {
    for (const uid of userIds) {
      const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(uid));
      let lockAcquired = false;
      const startMs = Date.now();
      while (Date.now() - startMs < 5000) {
        try {
          const lockRes = await upStub.fetch("http://internal/acquire-settlement-lock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leaseMs: 8000 }),
          });
          if (lockRes.ok) {
            const data = (await lockRes.json()) as { lockId: string };
            acquiredLocks.push({ userId: uid, lockId: data.lockId });
            lockAcquired = true;
            break;
          }
        } catch {
          // Retry
        }
        await new Promise((r) => setTimeout(r, 15 + Math.random() * 15));
      }
      if (!lockAcquired) {
        throw new Error(`Timeout acquiring settlement lock for user ${uid}`);
      }
    }
  }

  try {
    // 2. Idempotency Check: if game is already in D1, return without mutating ratings or history
    const [existingGame] = await db
      .select({
        id: schema.games.id,
        whiteRatingBefore: schema.games.whiteRatingBefore,
        whiteRatingChange: schema.games.whiteRatingChange,
        blackRatingBefore: schema.games.blackRatingBefore,
        blackRatingChange: schema.games.blackRatingChange,
      })
      .from(schema.games)
      .where(eq(schema.games.id, input.gameId));

    if (existingGame) {
      return {
        settled: true,
        alreadySettled: true,
        whiteRatingBefore: existingGame.whiteRatingBefore ?? undefined,
        whiteRatingAfter:
          existingGame.whiteRatingBefore != null && existingGame.whiteRatingChange != null
            ? existingGame.whiteRatingBefore + existingGame.whiteRatingChange
            : undefined,
        whiteRatingDiff: existingGame.whiteRatingChange ?? undefined,
        blackRatingBefore: existingGame.blackRatingBefore ?? undefined,
        blackRatingAfter:
          existingGame.blackRatingBefore != null && existingGame.blackRatingChange != null
            ? existingGame.blackRatingBefore + existingGame.blackRatingChange
            : undefined,
        blackRatingDiff: existingGame.blackRatingChange ?? undefined,
      };
    }

    let whiteUpdateSet: Record<string, unknown> | null = null;
    let blackUpdateSet: Record<string, unknown> | null = null;
    let ratingCalc: ReturnType<typeof applyGameResult> | null = null;
    let whiteCurrent: CategoryRatingData | null = null;
    let blackCurrent: CategoryRatingData | null = null;

    // 3. Concurrency-Safe Rating Calculation from fresh committed baseline (B4-RATE-01)
    if (input.rated && input.result !== "aborted" && input.whiteUserId && input.blackUserId) {
      whiteCurrent = await fetchUserCategoryRating(db, input.whiteUserId, input.category);
      blackCurrent = await fetchUserCategoryRating(db, input.blackUserId, input.category);

      const score = input.result === "1-0" ? 1 : input.result === "0-1" ? 0 : 0.5;

      ratingCalc = applyGameResult({
        whiteRating: {
          rating: whiteCurrent.rating,
          deviation: whiteCurrent.rd,
          volatility: whiteCurrent.vol,
        },
        blackRating: {
          rating: blackCurrent.rating,
          deviation: blackCurrent.rd,
          volatility: blackCurrent.vol,
        },
        score,
      });

      const whiteOutcome: "win" | "loss" | "draw" =
        input.result === "1-0" ? "win" : input.result === "0-1" ? "loss" : "draw";
      const blackOutcome: "win" | "loss" | "draw" =
        input.result === "0-1" ? "win" : input.result === "1-0" ? "loss" : "draw";

      whiteUpdateSet = buildRatingUpdateSet(
        input.category,
        {
          rating: ratingCalc.white.ratingAfter,
          rd: ratingCalc.white.rdAfter,
          vol: ratingCalc.white.volatilityAfter,
        },
        whiteCurrent,
        whiteOutcome,
        ratingCalc.white.diff,
      );

      blackUpdateSet = buildRatingUpdateSet(
        input.category,
        {
          rating: ratingCalc.black.ratingAfter,
          rd: ratingCalc.black.rdAfter,
          vol: ratingCalc.black.volatilityAfter,
        },
        blackCurrent,
        blackOutcome,
        ratingCalc.black.diff,
      );
    }

    // 4. Atomic D1 Batch (RATING-03, B4-RATE-02, INV-07)
    // All statements succeed together or fail together.
    const batchStatements = [
      db.insert(schema.games).values({
        id: input.gameId,
        whitePlayerId: input.whiteUserId,
        blackPlayerId: input.blackUserId,
        timeControl: input.timeControl,
        category: input.category,
        moves: JSON.stringify(input.moves),
        result: input.result || "*",
        termination: input.termination || "unknown",
        rated: input.rated,
        gameType: input.gameType || "matchmaking",
        whiteRatingBefore:
          input.result === "aborted" ? null : (ratingCalc?.white.ratingBefore ?? null),
        whiteRatingChange: input.result === "aborted" ? null : (ratingCalc?.white.diff ?? null),
        blackRatingBefore:
          input.result === "aborted" ? null : (ratingCalc?.black.ratingBefore ?? null),
        blackRatingChange: input.result === "aborted" ? null : (ratingCalc?.black.diff ?? null),
        startedAt: new Date(input.startedAt || Date.now()),
        endedAt: new Date(input.endedAt || Date.now()),
      }),
      ...(whiteUpdateSet && input.whiteUserId
        ? [
            db
              .update(schema.ratings)
              .set(whiteUpdateSet)
              .where(eq(schema.ratings.userId, input.whiteUserId)),
          ]
        : []),
      ...(blackUpdateSet && input.blackUserId
        ? [
            db
              .update(schema.ratings)
              .set(blackUpdateSet)
              .where(eq(schema.ratings.userId, input.blackUserId)),
          ]
        : []),
      ...(ratingCalc && whiteCurrent && input.whiteUserId
        ? [
            db.insert(schema.ratingHistory).values({
              id: crypto.randomUUID(),
              userId: input.whiteUserId,
              gameId: input.gameId,
              category: input.category,
              ratingBefore: ratingCalc.white.ratingBefore,
              ratingAfter: ratingCalc.white.ratingAfter,
              ratingChange: ratingCalc.white.diff,
              rdBefore: whiteCurrent.rd,
              rdAfter: ratingCalc.white.rdAfter,
              recordedAt: new Date(input.endedAt || Date.now()),
            }),
          ]
        : []),
      ...(ratingCalc && blackCurrent && input.blackUserId
        ? [
            db.insert(schema.ratingHistory).values({
              id: crypto.randomUUID(),
              userId: input.blackUserId,
              gameId: input.gameId,
              category: input.category,
              ratingBefore: ratingCalc.black.ratingBefore,
              ratingAfter: ratingCalc.black.ratingAfter,
              ratingChange: ratingCalc.black.diff,
              rdBefore: blackCurrent.rd,
              rdAfter: ratingCalc.black.rdAfter,
              recordedAt: new Date(input.endedAt),
            }),
          ]
        : []),
    ];

    // 3b. Verify fencing token / lock validity immediately prior to D1 commit (B6-01, B7-06)
    // If a lease expired during calculation and another worker acquired it, abort before mutating D1.
    if (env?.USER_PRESENCE_DO && acquiredLocks.length > 0) {
      for (const l of acquiredLocks) {
        const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(l.userId));
        const verifyRes = await upStub.fetch(
          `http://internal/verify-settlement-lock?lockId=${encodeURIComponent(l.lockId)}`,
        );
        if (!verifyRes.ok) {
          throw new Error(
            `Settlement lock invalidated for user ${l.userId} prior to D1 commit (stale worker mutation rejected)`,
          );
        }
      }
    }

    try {
      type BatchStatements = Parameters<ReturnType<typeof drizzle>["batch"]>[0];
      await db.batch(batchStatements as unknown as BatchStatements);

      return {
        settled: true,
        alreadySettled: false,
        whiteRatingBefore: ratingCalc?.white.ratingBefore,
        whiteRatingAfter: ratingCalc?.white.ratingAfter,
        whiteRatingDiff: ratingCalc?.white.diff,
        blackRatingBefore: ratingCalc?.black.ratingBefore,
        blackRatingAfter: ratingCalc?.black.ratingAfter,
        blackRatingDiff: ratingCalc?.black.diff,
      };
    } catch (err: unknown) {
      // In concurrent races, another transaction may have committed games.id first
      const [alreadyInserted] = await db
        .select({
          id: schema.games.id,
          whiteRatingBefore: schema.games.whiteRatingBefore,
          whiteRatingChange: schema.games.whiteRatingChange,
          blackRatingBefore: schema.games.blackRatingBefore,
          blackRatingChange: schema.games.blackRatingChange,
        })
        .from(schema.games)
        .where(eq(schema.games.id, input.gameId));

      if (alreadyInserted) {
        return {
          settled: true,
          alreadySettled: true,
          whiteRatingBefore: alreadyInserted.whiteRatingBefore ?? undefined,
          whiteRatingAfter:
            alreadyInserted.whiteRatingBefore != null && alreadyInserted.whiteRatingChange != null
              ? alreadyInserted.whiteRatingBefore + alreadyInserted.whiteRatingChange
              : undefined,
          whiteRatingDiff: alreadyInserted.whiteRatingChange ?? undefined,
          blackRatingBefore: alreadyInserted.blackRatingBefore ?? undefined,
          blackRatingAfter:
            alreadyInserted.blackRatingBefore != null && alreadyInserted.blackRatingChange != null
              ? alreadyInserted.blackRatingBefore + alreadyInserted.blackRatingChange
              : undefined,
          blackRatingDiff: alreadyInserted.blackRatingChange ?? undefined,
        };
      }

      throw err;
    }
  } finally {
    if (env?.USER_PRESENCE_DO && acquiredLocks.length > 0) {
      for (const l of acquiredLocks) {
        try {
          const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(l.userId));
          await upStub.fetch("http://internal/release-settlement-lock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lockId: l.lockId }),
          });
        } catch (releaseErr) {
          // B5-RATE-01: A LOCK_NOT_OWNED (409) means another worker acquired the lock
          // before we released it — this is expected in concurrent settlement; log but don't rethrow.
          console.warn("[ratingStorage] settlement lock release error (non-fatal):", releaseErr);
        }
      }
    }
  }
}

import type { RatingCategory } from "@etchess/types";
import { eq } from "drizzle-orm";
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
): Record<string, unknown> {
  const games = existing.games + 1;
  const wins = existing.wins + (outcome === "win" ? 1 : 0);
  const losses = existing.losses + (outcome === "loss" ? 1 : 0);
  const draws = existing.draws + (outcome === "draw" ? 1 : 0);

  const base = {
    updatedAt: new Date(),
  };

  switch (category) {
    case "bullet":
      return {
        ...base,
        bulletRating: newGlicko.rating,
        bulletRd: newGlicko.rd,
        bulletVol: newGlicko.vol,
        bulletGames: games,
        bulletWins: wins,
        bulletLosses: losses,
        bulletDraws: draws,
      };
    case "rapid":
      return {
        ...base,
        rapidRating: newGlicko.rating,
        rapidRd: newGlicko.rd,
        rapidVol: newGlicko.vol,
        rapidGames: games,
        rapidWins: wins,
        rapidLosses: losses,
        rapidDraws: draws,
      };
    case "classical":
      return {
        ...base,
        classicalRating: newGlicko.rating,
        classicalRd: newGlicko.rd,
        classicalVol: newGlicko.vol,
        classicalGames: games,
        classicalWins: wins,
        classicalLosses: losses,
        classicalDraws: draws,
      };
    default:
      return {
        ...base,
        blitzRating: newGlicko.rating,
        blitzRd: newGlicko.rd,
        blitzVol: newGlicko.vol,
        blitzGames: games,
        blitzWins: wins,
        blitzLosses: losses,
        blitzDraws: draws,
      };
  }
}

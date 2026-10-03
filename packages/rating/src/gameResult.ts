import { type Glicko2Rating, PRODUCT_RULES } from "@etchess/types";
import { DEFAULT_TAU } from "./constants";
import { calculateTwoPlayerMatch } from "./glicko2";

export interface PlayerRatingOutcome {
  ratingBefore: number;
  ratingAfter: number;
  diff: number;
  rdBefore: number;
  rdAfter: number;
  volatilityBefore: number;
  volatilityAfter: number;
  isProvisionalBefore: boolean;
  isProvisionalAfter: boolean;
}

export interface GameRatingCalculationResult {
  white: PlayerRatingOutcome;
  black: PlayerRatingOutcome;
}

export interface ApplyGameResultOptions {
  whiteRating: Glicko2Rating;
  blackRating: Glicko2Rating;
  score: 1 | 0 | 0.5; // 1 = white win, 0 = black win, 0.5 = draw
  tau?: number;
  isProvisionalThreshold?: number;
}

/**
 * Applies a 1-on-1 game result to White and Black Glicko-2 ratings.
 * Pure function returning before/after/diff and provisional status for both players.
 */
export function applyGameResult(options: ApplyGameResultOptions): GameRatingCalculationResult {
  const tau = options.tau ?? DEFAULT_TAU;
  const provThreshold =
    options.isProvisionalThreshold ?? PRODUCT_RULES.GLICKO2_PROVISIONAL_RD_THRESHOLD;

  const match = calculateTwoPlayerMatch(
    options.whiteRating,
    options.blackRating,
    options.score,
    tau,
  );

  return {
    white: {
      ratingBefore: options.whiteRating.rating,
      ratingAfter: match.player1.rating,
      diff: match.player1RatingDiff,
      rdBefore: options.whiteRating.deviation,
      rdAfter: match.player1.deviation,
      volatilityBefore: options.whiteRating.volatility,
      volatilityAfter: match.player1.volatility,
      isProvisionalBefore: options.whiteRating.deviation > provThreshold,
      isProvisionalAfter: match.player1.deviation > provThreshold,
    },
    black: {
      ratingBefore: options.blackRating.rating,
      ratingAfter: match.player2.rating,
      diff: match.player2RatingDiff,
      rdBefore: options.blackRating.deviation,
      rdAfter: match.player2.deviation,
      volatilityBefore: options.blackRating.volatility,
      volatilityAfter: match.player2.volatility,
      isProvisionalBefore: options.blackRating.deviation > provThreshold,
      isProvisionalAfter: match.player2.deviation > provThreshold,
    },
  };
}

export interface RatedPairCheckOptions {
  recentRatedGamesBetweenPairIn24h: number;
  cap?: number;
}

export interface RatedPairCheckResult {
  refuse: boolean;
  reason?: string;
  count: number;
  cap: number;
}

/**
 * RULE-05: Rated pair cap.
 * Prevents rating manipulation / farming by capping rated games between the same two users in a rolling 24h window.
 */
export function shouldRefuseRatedPair(options: RatedPairCheckOptions): RatedPairCheckResult {
  const cap = options.cap ?? PRODUCT_RULES.RATED_PAIR_CAP_24H;
  const count = options.recentRatedGamesBetweenPairIn24h;

  if (count >= cap) {
    return {
      refuse: true,
      reason: `Maximum rated games limit (${cap} per 24 hours) between these players has been reached.`,
      count,
      cap,
    };
  }

  return {
    refuse: false,
    count,
    cap,
  };
}

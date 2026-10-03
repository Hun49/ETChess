import { describe, expect, it } from "vitest";
import { applyGameResult, shouldRefuseRatedPair } from "../src/gameResult";

describe("Game Result and Glicko-2 Updates", () => {
  it("computes rating changes when White wins", () => {
    const white = { rating: 1500, deviation: 200, volatility: 0.06 };
    const black = { rating: 1500, deviation: 200, volatility: 0.06 };

    const result = applyGameResult({
      whiteRating: white,
      blackRating: black,
      score: 1, // White won
    });

    expect(result.white.ratingAfter).toBeGreaterThan(1500);
    expect(result.white.diff).toBeGreaterThan(0);
    expect(result.black.ratingAfter).toBeLessThan(1500);
    expect(result.black.diff).toBeLessThan(0);
    expect(result.white.rdAfter).toBeLessThan(200);
    expect(result.black.rdAfter).toBeLessThan(200);
  });

  it("computes rating changes when Black wins", () => {
    const white = { rating: 1500, deviation: 200, volatility: 0.06 };
    const black = { rating: 1500, deviation: 200, volatility: 0.06 };

    const result = applyGameResult({
      whiteRating: white,
      blackRating: black,
      score: 0, // Black won
    });

    expect(result.white.ratingAfter).toBeLessThan(1500);
    expect(result.white.diff).toBeLessThan(0);
    expect(result.black.ratingAfter).toBeGreaterThan(1500);
    expect(result.black.diff).toBeGreaterThan(0);
  });

  it("computes balanced rating changes on draw between equal players", () => {
    const white = { rating: 1500, deviation: 100, volatility: 0.06 };
    const black = { rating: 1500, deviation: 100, volatility: 0.06 };

    const result = applyGameResult({
      whiteRating: white,
      blackRating: black,
      score: 0.5, // Draw
    });

    expect(result.white.diff).toBe(0);
    expect(result.black.diff).toBe(0);
    expect(result.white.isProvisionalBefore).toBe(false);
    expect(result.black.isProvisionalBefore).toBe(false);
  });

  it("identifies provisional players based on RD threshold (default 110)", () => {
    const white = { rating: 1500, deviation: 350, volatility: 0.06 }; // New player
    const black = { rating: 1800, deviation: 60, volatility: 0.06 }; // Established player

    const result = applyGameResult({
      whiteRating: white,
      blackRating: black,
      score: 1,
    });

    expect(result.white.isProvisionalBefore).toBe(true);
    expect(result.black.isProvisionalBefore).toBe(false);
  });
});

describe("Rated Pair Cap (RULE-05)", () => {
  it("allows rated play when below the cap", () => {
    expect(shouldRefuseRatedPair({ recentRatedGamesBetweenPairIn24h: 0 }).refuse).toBe(false);
    expect(shouldRefuseRatedPair({ recentRatedGamesBetweenPairIn24h: 4 }).refuse).toBe(false);
  });

  it("refuses rated play when cap (default 5) is reached", () => {
    const check = shouldRefuseRatedPair({ recentRatedGamesBetweenPairIn24h: 5 });
    expect(check.refuse).toBe(true);
    expect(check.reason).toContain("Maximum rated games limit (5 per 24 hours)");
  });

  it("respects custom cap", () => {
    expect(shouldRefuseRatedPair({ recentRatedGamesBetweenPairIn24h: 2, cap: 2 }).refuse).toBe(
      true,
    );
  });
});

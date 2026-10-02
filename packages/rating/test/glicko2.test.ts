import type { Glicko2Rating } from "@etchess/types";
import { describe, expect, it } from "vitest";
import {
  calculateRatingUpdate,
  calculateTwoPlayerMatch,
  scaleToGlicko2,
  scaleToStandard,
} from "../src";

describe("Glicko-2 Scaling", () => {
  it("converts between standard and Glicko-2 scales symmetrically", () => {
    const original = { rating: 1500, deviation: 200 };
    const scaled = scaleToGlicko2(original.rating, original.deviation);
    expect(scaled.mu).toBeCloseTo(0, 5);
    expect(scaled.phi).toBeCloseTo(1.15129, 4);

    const reverted = scaleToStandard(scaled.mu, scaled.phi);
    expect(reverted.rating).toBe(1500);
    expect(reverted.deviation).toBe(200);
  });
});

describe("Glickman Paper Example Test Vector", () => {
  it("reproduces Mark Glickman's canonical example calculation", () => {
    const player: Glicko2Rating = {
      rating: 1500,
      deviation: 200,
      volatility: 0.06,
    };

    const matches = [
      {
        rating: { rating: 1400, deviation: 30, volatility: 0.06 },
        score: 1, // Win
      },
      {
        rating: { rating: 1550, deviation: 100, volatility: 0.06 },
        score: 0, // Loss
      },
      {
        rating: { rating: 1700, deviation: 300, volatility: 0.06 },
        score: 0, // Loss
      },
    ];

    const result = calculateRatingUpdate(player, matches, 0.5);

    // Glickman's paper: r' ≈ 1464.06, RD' ≈ 151.52, sigma' ≈ 0.05999
    expect(result.rating).toBe(1464);
    expect(result.deviation).toBe(152);
    expect(result.volatility).toBeCloseTo(0.06, 3);
  });
});

describe("Two-Player 1-on-1 Head-to-Head", () => {
  it("increases winner rating and decreases loser rating", () => {
    const white: Glicko2Rating = {
      rating: 1500,
      deviation: 150,
      volatility: 0.06,
    };
    const black: Glicko2Rating = {
      rating: 1500,
      deviation: 150,
      volatility: 0.06,
    };

    // White wins
    const result = calculateTwoPlayerMatch(white, black, 1);

    expect(result.player1.rating).toBeGreaterThan(1500);
    expect(result.player2.rating).toBeLessThan(1500);
    expect(result.player1RatingDiff).toBeGreaterThan(0);
    expect(result.player2RatingDiff).toBeLessThan(0);

    // RD decreases after playing a game
    expect(result.player1.deviation).toBeLessThan(150);
    expect(result.player2.deviation).toBeLessThan(150);
  });

  it("handles draws fairly between equal players with minimal diff", () => {
    const p1: Glicko2Rating = {
      rating: 1600,
      deviation: 100,
      volatility: 0.06,
    };
    const p2: Glicko2Rating = {
      rating: 1600,
      deviation: 100,
      volatility: 0.06,
    };

    const result = calculateTwoPlayerMatch(p1, p2, 0.5);
    expect(result.player1.rating).toBe(1600);
    expect(result.player2.rating).toBe(1600);
    expect(result.player1RatingDiff).toBe(0);
    expect(result.player2RatingDiff).toBe(0);
  });
});

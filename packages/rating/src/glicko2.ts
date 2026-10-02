import type { Glicko2Rating } from "@etchess/types";
import { CONVERGENCE_TOLERANCE, DEFAULT_TAU, GLICKO2_SCALE, MAX_RD, MIN_RD } from "./constants";

export interface MatchOutcomeResult {
  player1: Glicko2Rating;
  player2: Glicko2Rating;
  player1RatingDiff: number;
  player2RatingDiff: number;
}

export interface OpponentMatch {
  rating: Glicko2Rating;
  score: number; // 1 (win), 0 (loss), 0.5 (draw)
}

/**
 * Scale standard Glicko rating (r, RD) to Glicko-2 scale (mu, phi).
 */
export function scaleToGlicko2(
  rating: number,
  deviation: number,
): {
  mu: number;
  phi: number;
} {
  return {
    mu: (rating - 1500) / GLICKO2_SCALE,
    phi: deviation / GLICKO2_SCALE,
  };
}

/**
 * Scale Glicko-2 rating (mu, phi) back to standard scale (r, RD).
 */
export function scaleToStandard(
  mu: number,
  phi: number,
): {
  rating: number;
  deviation: number;
} {
  return {
    rating: Math.round(mu * GLICKO2_SCALE + 1500),
    deviation: Math.min(MAX_RD, Math.max(MIN_RD, Math.round(phi * GLICKO2_SCALE))),
  };
}

/**
 * Glicko-2 g(phi) reduction function.
 */
export function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

/**
 * Expected score function E(mu, oppMu, oppPhi).
 */
export function expectedScore(mu: number, oppMu: number, oppPhi: number): number {
  return 1 / (1 + Math.exp(-g(oppPhi) * (mu - oppMu)));
}

/**
 * Solves for the new volatility sigma' using the Illinois algorithm (Glickman Step 5).
 */
function determineNewVolatility(
  delta: number,
  phi: number,
  v: number,
  sigma: number,
  tau: number,
): number {
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const d2 = delta * delta;
    const p2PlusVPlusEx = phi * phi + v + ex;
    const part1 = (ex * (d2 - p2PlusVPlusEx)) / (2 * p2PlusVPlusEx * p2PlusVPlusEx);
    const part2 = (x - a) / (tau * tau);
    return part1 - part2;
  };

  let A = a;
  let B: number;
  const d2 = delta * delta;
  const p2PlusV = phi * phi + v;

  if (d2 > p2PlusV) {
    B = Math.log(d2 - p2PlusV);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) {
      k++;
    }
    B = a - k * tau;
  }

  let fA = f(A);
  let fB = f(B);

  while (Math.abs(B - A) > CONVERGENCE_TOLERANCE) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);

    if (fC * fB < 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }

    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}

/**
 * Updates a player's Glicko-2 rating given a collection of matches.
 * Pure function adhering to Mark Glickman's official algorithm.
 */
export function calculateRatingUpdate(
  player: Glicko2Rating,
  matches: OpponentMatch[],
  tau: number = DEFAULT_TAU,
): Glicko2Rating {
  if (matches.length === 0) {
    // If no matches played, rating remains constant, RD increases slightly
    const { mu, phi } = scaleToGlicko2(player.rating, player.deviation);
    const newPhi = Math.sqrt(phi * phi + player.volatility * player.volatility);
    const { rating, deviation } = scaleToStandard(mu, newPhi);
    return { rating, deviation, volatility: player.volatility };
  }

  const { mu, phi } = scaleToGlicko2(player.rating, player.deviation);

  // Step 3: Compute estimated variance v
  let vInv = 0;
  for (const m of matches) {
    const opp = scaleToGlicko2(m.rating.rating, m.rating.deviation);
    const gVal = g(opp.phi);
    const eVal = expectedScore(mu, opp.mu, opp.phi);
    vInv += gVal * gVal * eVal * (1 - eVal);
  }
  const v = 1 / vInv;

  // Step 4: Compute Delta
  let deltaSum = 0;
  for (const m of matches) {
    const opp = scaleToGlicko2(m.rating.rating, m.rating.deviation);
    const gVal = g(opp.phi);
    const eVal = expectedScore(mu, opp.mu, opp.phi);
    deltaSum += gVal * (m.score - eVal);
  }
  const delta = v * deltaSum;

  // Step 5: Determine new volatility sigma'
  const newSigma = determineNewVolatility(delta, phi, v, player.volatility, tau);

  // Step 6: Update rating deviation to pre-rating period value phi*
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);

  // Step 7: Update rating and RD
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * deltaSum;

  // Step 8: Convert back to original scale
  const { rating, deviation } = scaleToStandard(newMu, newPhi);

  return {
    rating,
    deviation,
    volatility: Math.round(newSigma * 100000) / 100000,
  };
}

/**
 * Calculates updated ratings for both players in a 1-on-1 match.
 * outcome: 1 (player 1 won), 0 (player 2 won), 0.5 (draw)
 */
export function calculateTwoPlayerMatch(
  player1: Glicko2Rating,
  player2: Glicko2Rating,
  outcome: 1 | 0 | 0.5,
  tau: number = DEFAULT_TAU,
): MatchOutcomeResult {
  const p1New = calculateRatingUpdate(player1, [{ rating: player2, score: outcome }], tau);
  const p2New = calculateRatingUpdate(player2, [{ rating: player1, score: 1 - outcome }], tau);

  return {
    player1: p1New,
    player2: p2New,
    player1RatingDiff: p1New.rating - player1.rating,
    player2RatingDiff: p2New.rating - player2.rating,
  };
}

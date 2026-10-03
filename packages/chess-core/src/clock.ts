import { type ClockState, PRODUCT_RULES } from "@etchess/types";

export interface ClockUpdateConfig {
  incrementMs: number;
  ply?: number;
  serverMeasuredRttMs?: number;
  lagCreditCapMs?: number;
}

export interface ClockUpdateResult {
  whiteMs: number;
  blackMs: number;
  flagged: boolean;
  flaggedColor?: "w" | "b";
  nextTurn: "w" | "b";
  elapsedMs: number;
  lagCreditMs: number;
}

export interface LagCreditCalculation {
  lagCreditMs: number;
  effectiveElapsedMs: number;
}

/**
 * Calculates lag credit based on server-measured RTT and lag credit cap.
 * RULE-04: lag credit is capped at lagCreditCapMs (default 100ms).
 */
export function calculateLagCredit(options: {
  elapsedMs: number;
  serverMeasuredRttMs?: number;
  lagCreditCapMs?: number;
}): LagCreditCalculation {
  const cap = options.lagCreditCapMs ?? PRODUCT_RULES.LAG_CREDIT_CAP_MS;
  const rawRtt = options.serverMeasuredRttMs ?? 0;
  // Estimated one-way network transit latency is RTT / 2
  const credit = Math.min(Math.max(0, Math.round(rawRtt / 2)), cap);
  const effective = Math.max(0, options.elapsedMs - credit);

  return {
    lagCreditMs: credit,
    effectiveElapsedMs: effective,
  };
}

/**
 * RULE-01: First-move deadline (30s) aborts game if missed.
 * Clocks start ticking only after both players have made their first move (ply >= 2).
 */
export function isClockRunningForPly(ply: number): boolean {
  return ply >= 2;
}

/**
 * Calculates remaining time on the active player's clock after a move is completed.
 * Pure function: calculates elapsed time with lag credit, adds increment to the player who just moved,
 * and toggles the active turn.
 */
export function calculateClockAfterMove(
  clock: ClockState,
  config: ClockUpdateConfig,
  currentTimestampMs: number,
): ClockUpdateResult {
  const rawElapsedMs = Math.max(0, currentTimestampMs - clock.lastMoveTimestamp);

  // If before ply 2 (RULE-01), clocks are held, elapsed time is 0
  const clockRunning = config.ply !== undefined ? isClockRunningForPly(config.ply) : true;
  const { lagCreditMs, effectiveElapsedMs } = clockRunning
    ? calculateLagCredit({
        elapsedMs: rawElapsedMs,
        serverMeasuredRttMs: config.serverMeasuredRttMs,
        lagCreditCapMs: config.lagCreditCapMs,
      })
    : { lagCreditMs: 0, effectiveElapsedMs: 0 };

  let whiteMs = clock.whiteMs;
  let blackMs = clock.blackMs;

  if (clock.activeTurn === "w") {
    whiteMs = whiteMs - effectiveElapsedMs;
    if (whiteMs <= 0) {
      return {
        whiteMs: 0,
        blackMs,
        flagged: true,
        flaggedColor: "w",
        nextTurn: "b",
        elapsedMs: effectiveElapsedMs,
        lagCreditMs,
      };
    }
    // Add increment only if move was made before flagging and clocks are active
    if (clockRunning) {
      whiteMs += config.incrementMs;
    }
  } else {
    blackMs = blackMs - effectiveElapsedMs;
    if (blackMs <= 0) {
      return {
        whiteMs,
        blackMs: 0,
        flagged: true,
        flaggedColor: "b",
        nextTurn: "w",
        elapsedMs: effectiveElapsedMs,
        lagCreditMs,
      };
    }
    // Add increment only if move was made before flagging and clocks are active
    if (clockRunning) {
      blackMs += config.incrementMs;
    }
  }

  return {
    whiteMs,
    blackMs,
    flagged: false,
    nextTurn: clock.activeTurn === "w" ? "b" : "w",
    elapsedMs: effectiveElapsedMs,
    lagCreditMs,
  };
}

/**
 * Calculates current real-time clock balance without applying a move.
 * Useful for client-side rendering ticks and countdown timers.
 */
export function getCurrentClockDisplay(
  clock: ClockState,
  currentTimestampMs: number,
  ply?: number,
): { whiteMs: number; blackMs: number; flagged: boolean } {
  if (ply !== undefined && !isClockRunningForPly(ply)) {
    return {
      whiteMs: clock.whiteMs,
      blackMs: clock.blackMs,
      flagged: false,
    };
  }

  const elapsedMs = Math.max(0, currentTimestampMs - clock.lastMoveTimestamp);

  if (clock.activeTurn === "w") {
    const whiteMs = Math.max(0, clock.whiteMs - elapsedMs);
    return {
      whiteMs,
      blackMs: clock.blackMs,
      flagged: whiteMs === 0,
    };
  }

  const blackMs = Math.max(0, clock.blackMs - elapsedMs);
  return {
    whiteMs: clock.whiteMs,
    blackMs,
    flagged: blackMs === 0,
  };
}

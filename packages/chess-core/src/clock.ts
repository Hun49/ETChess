import type { ClockState } from "@etchess/types";

export interface ClockUpdateConfig {
  incrementMs: number;
}

export interface ClockUpdateResult {
  whiteMs: number;
  blackMs: number;
  flagged: boolean;
  flaggedColor?: "w" | "b";
  nextTurn: "w" | "b";
  elapsedMs: number;
}

/**
 * Calculates remaining time on the active player's clock after a move is completed.
 * Pure function: calculates elapsed time, adds increment to the player who just moved,
 * and toggles the active turn.
 */
export function calculateClockAfterMove(
  clock: ClockState,
  config: ClockUpdateConfig,
  currentTimestampMs: number,
): ClockUpdateResult {
  const elapsedMs = Math.max(0, currentTimestampMs - clock.lastMoveTimestamp);

  let whiteMs = clock.whiteMs;
  let blackMs = clock.blackMs;

  if (clock.activeTurn === "w") {
    whiteMs = whiteMs - elapsedMs;
    if (whiteMs <= 0) {
      return {
        whiteMs: 0,
        blackMs,
        flagged: true,
        flaggedColor: "w",
        nextTurn: "b",
        elapsedMs,
      };
    }
    // Add increment only if move was made before flagging
    whiteMs += config.incrementMs;
  } else {
    blackMs = blackMs - elapsedMs;
    if (blackMs <= 0) {
      return {
        whiteMs,
        blackMs: 0,
        flagged: true,
        flaggedColor: "b",
        nextTurn: "w",
        elapsedMs,
      };
    }
    // Add increment only if move was made before flagging
    blackMs += config.incrementMs;
  }

  return {
    whiteMs,
    blackMs,
    flagged: false,
    nextTurn: clock.activeTurn === "w" ? "b" : "w",
    elapsedMs,
  };
}

/**
 * Calculates current real-time clock balance without applying a move.
 * Useful for client-side rendering ticks and countdown timers.
 */
export function getCurrentClockDisplay(
  clock: ClockState,
  currentTimestampMs: number,
): { whiteMs: number; blackMs: number; flagged: boolean } {
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

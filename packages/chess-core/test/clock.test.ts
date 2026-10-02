import type { ClockState } from "@etchess/types";
import { describe, expect, it } from "vitest";
import { calculateClockAfterMove, getCurrentClockDisplay } from "../src/clock";

describe("Clock calculations", () => {
  it("deducts elapsed time and adds increment for active player", () => {
    const clock: ClockState = {
      whiteMs: 180_000, // 3 min
      blackMs: 180_000,
      lastMoveTimestamp: 1_000_000,
      activeTurn: "w",
    };

    // 5 seconds elapsed, 2 seconds increment
    const result = calculateClockAfterMove(clock, { incrementMs: 2_000 }, 1_005_000);

    expect(result.flagged).toBe(false);
    expect(result.nextTurn).toBe("b");
    // 180,000 - 5,000 + 2,000 = 177,000
    expect(result.whiteMs).toBe(177_000);
    expect(result.blackMs).toBe(180_000);
  });

  it("detects flag fall when elapsed time exceeds remaining balance", () => {
    const clock: ClockState = {
      whiteMs: 3_000, // 3 seconds left
      blackMs: 180_000,
      lastMoveTimestamp: 1_000_000,
      activeTurn: "w",
    };

    // 4 seconds elapsed -> flag fall
    const result = calculateClockAfterMove(clock, { incrementMs: 2_000 }, 1_004_000);

    expect(result.flagged).toBe(true);
    expect(result.flaggedColor).toBe("w");
    expect(result.whiteMs).toBe(0);
  });

  it("calculates real-time clock display without changing turn", () => {
    const clock: ClockState = {
      whiteMs: 60_000,
      blackMs: 60_000,
      lastMoveTimestamp: 10_000,
      activeTurn: "b",
    };

    // 10 seconds elapsed on black's turn
    const display = getCurrentClockDisplay(clock, 20_000);
    expect(display.whiteMs).toBe(60_000);
    expect(display.blackMs).toBe(50_000);
    expect(display.flagged).toBe(false);
  });
});

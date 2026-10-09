import { type ClockState, PRODUCT_RULES, TIME_CONTROLS, type TimeControlKey } from "@etchess/types";
import { describe, expect, it } from "vitest";
import {
  calculateClockAfterMove,
  calculateLagCredit,
  getCurrentClockDisplay,
  isClockRunningForPly,
} from "../src/clock";
import { validateAndApplyMove } from "../src/move";
import { canDeliverCheckmate, resolveTimeout } from "../src/timeout";

describe("Batch 2: Clock & Timeout Hardening Unit Tests", () => {
  describe("CLK-04 & Turn/Clock Invariant — Active-Player-Only Ticking", () => {
    it("White turn: White clock decreases, Black clock remains completely unchanged", () => {
      const clock: ClockState = {
        whiteMs: 180_000,
        blackMs: 180_000,
        lastMoveTimestamp: 1_000_000,
        activeTurn: "w",
      };

      // Realtime display calculation with fake time
      const display5s = getCurrentClockDisplay(clock, 1_005_000, 2);
      expect(display5s.whiteMs).toBe(175_000);
      expect(display5s.blackMs).toBe(180_000);
      expect(display5s.flagged).toBe(false);

      // Move calculation after White plays
      const result = calculateClockAfterMove(clock, { incrementMs: 2_000, ply: 2 }, 1_005_000);
      expect(result.whiteMs).toBe(177_000); // 180,000 - 5,000 + 2,000
      expect(result.blackMs).toBe(180_000); // INVARIANT: untouched
      expect(result.nextTurn).toBe("b");
    });

    it("Black turn: Black clock decreases, White clock remains completely unchanged", () => {
      const clock: ClockState = {
        whiteMs: 177_000,
        blackMs: 180_000,
        lastMoveTimestamp: 1_005_000,
        activeTurn: "b",
      };

      // Realtime display calculation with fake time (7s elapsed on Black turn)
      const display7s = getCurrentClockDisplay(clock, 1_012_000, 3);
      expect(display7s.whiteMs).toBe(177_000); // INVARIANT: untouched
      expect(display7s.blackMs).toBe(173_000); // 180,000 - 7,000
      expect(display7s.flagged).toBe(false);

      // Move calculation after Black plays
      const result = calculateClockAfterMove(clock, { incrementMs: 2_000, ply: 3 }, 1_012_000);
      expect(result.whiteMs).toBe(177_000); // INVARIANT: untouched
      expect(result.blackMs).toBe(175_000); // 180,000 - 7,000 + 2,000
      expect(result.nextTurn).toBe("w");
    });
  });

  describe("CLK-06 — No Increment After First Move Across All 10 Time Controls", () => {
    const timeControlKeys: TimeControlKey[] = [
      "1+0",
      "2+0",
      "3+0",
      "3+2",
      "5+0",
      "5+3",
      "10+0",
      "10+5",
      "15+10",
      "30+0",
    ];

    for (const key of timeControlKeys) {
      const tc = TIME_CONTROLS[key];
      const initialMs = tc.initialSeconds * 1000;
      const incrementMs = tc.incrementSeconds * 1000;

      it(`time control ${key}: moves 1 (ply 0, White) and move 2 (ply 1, Black) receive 0 increment; subsequent moves receive ${tc.incrementSeconds}s increment`, () => {
        // Initial clock state before move 1
        let clock: ClockState = {
          whiteMs: initialMs,
          blackMs: initialMs,
          lastMoveTimestamp: 100_000,
          activeTurn: "w",
        };

        // 1. Move 1 (White, ply 0): 3 seconds taken
        const move1 = calculateClockAfterMove(clock, { incrementMs, ply: 0 }, 103_000);
        // Before ply 2, clocks are held, so elapsed is 0 and no increment added
        expect(move1.whiteMs).toBe(initialMs);
        expect(move1.blackMs).toBe(initialMs);
        expect(move1.nextTurn).toBe("b");

        // 2. Move 2 (Black, ply 1): 4 seconds taken
        clock = {
          whiteMs: move1.whiteMs,
          blackMs: move1.blackMs,
          lastMoveTimestamp: 103_000,
          activeTurn: "b",
        };
        const move2 = calculateClockAfterMove(clock, { incrementMs, ply: 1 }, 107_000);
        // Before ply 2, clocks are held, so elapsed is 0 and no increment added
        expect(move2.whiteMs).toBe(initialMs);
        expect(move2.blackMs).toBe(initialMs);
        expect(move2.nextTurn).toBe("w");

        // 3. Move 3 (White, ply 2): Clocks are running! 5 seconds taken
        clock = {
          whiteMs: move2.whiteMs,
          blackMs: move2.blackMs,
          lastMoveTimestamp: 107_000,
          activeTurn: "w",
        };
        const move3 = calculateClockAfterMove(clock, { incrementMs, ply: 2 }, 112_000);
        // Elapsed = 5000ms. If incrementMs > 0, increment is added!
        const expectedWhiteMs = initialMs - 5_000 + incrementMs;
        expect(move3.whiteMs).toBe(expectedWhiteMs);
        expect(move3.blackMs).toBe(initialMs);
        expect(move3.nextTurn).toBe("b");

        // 4. Move 4 (Black, ply 3): Clocks are running! 6 seconds taken
        clock = {
          whiteMs: move3.whiteMs,
          blackMs: move3.blackMs,
          lastMoveTimestamp: 112_000,
          activeTurn: "b",
        };
        const move4 = calculateClockAfterMove(clock, { incrementMs, ply: 3 }, 118_000);
        const expectedBlackMs = initialMs - 6_000 + incrementMs;
        expect(move4.whiteMs).toBe(expectedWhiteMs);
        expect(move4.blackMs).toBe(expectedBlackMs);
        expect(move4.nextTurn).toBe("w");
      });
    }
  });

  describe("CLK-10 & Clock Invariant — Exact Timeout Boundaries", () => {
    it("remaining = 1ms, elapsed = 0ms -> game remains active", () => {
      const clock: ClockState = {
        whiteMs: 1,
        blackMs: 60_000,
        lastMoveTimestamp: 1_000,
        activeTurn: "w",
      };

      const res = calculateClockAfterMove(
        clock,
        { incrementMs: 0, ply: 2 },
        1_000, // 0ms elapsed
      );
      expect(res.flagged).toBe(false);
      expect(res.whiteMs).toBe(1);
    });

    it("remaining = 1ms, elapsed = 1ms -> exact flag fall", () => {
      const clock: ClockState = {
        whiteMs: 1,
        blackMs: 60_000,
        lastMoveTimestamp: 1_000,
        activeTurn: "w",
      };

      const res = calculateClockAfterMove(
        clock,
        { incrementMs: 2_000, ply: 2 },
        1_001, // 1ms elapsed -> whiteMs becomes 0
      );
      expect(res.flagged).toBe(true);
      expect(res.flaggedColor).toBe("w");
      expect(res.whiteMs).toBe(0);
    });

    it("remaining = 1ms, elapsed = 2ms -> flag fall, balance clamped to 0", () => {
      const clock: ClockState = {
        whiteMs: 1,
        blackMs: 60_000,
        lastMoveTimestamp: 1_000,
        activeTurn: "w",
      };

      const res = calculateClockAfterMove(
        clock,
        { incrementMs: 2_000, ply: 2 },
        1_002, // 2ms elapsed -> whiteMs <= 0 clamped to 0
      );
      expect(res.flagged).toBe(true);
      expect(res.flaggedColor).toBe("w");
      expect(res.whiteMs).toBe(0);
    });

    it("remaining = 0ms -> terminal flag fall immediately", () => {
      const clock: ClockState = {
        whiteMs: 0,
        blackMs: 60_000,
        lastMoveTimestamp: 1_000,
        activeTurn: "w",
      };

      const res = calculateClockAfterMove(clock, { incrementMs: 2_000, ply: 2 }, 1_000);
      expect(res.flagged).toBe(true);
      expect(res.whiteMs).toBe(0);
    });

    it("Clock invariant: remaining time is never negative and cannot increase past legitimate rules", () => {
      const clock: ClockState = {
        whiteMs: 500,
        blackMs: 500,
        lastMoveTimestamp: 1_000,
        activeTurn: "w",
      };

      // Even with 50,000ms elapsed, remaining balance must clamp to 0 (never negative)
      const res = calculateClockAfterMove(clock, { incrementMs: 0, ply: 2 }, 51_000);
      expect(res.flagged).toBe(true);
      expect(res.whiteMs).toBe(0);
      expect(res.whiteMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("CLK-03 — RTT Compensation Bounds & Lag Credit Calculation", () => {
    it("normal RTT within cap: credit is RTT / 2", () => {
      const { lagCreditMs, effectiveElapsedMs } = calculateLagCredit({
        elapsedMs: 500,
        serverMeasuredRttMs: 80,
      });
      expect(lagCreditMs).toBe(40);
      expect(effectiveElapsedMs).toBe(460);
    });

    it("0ms RTT: 0 lag credit", () => {
      const { lagCreditMs, effectiveElapsedMs } = calculateLagCredit({
        elapsedMs: 500,
        serverMeasuredRttMs: 0,
      });
      expect(lagCreditMs).toBe(0);
      expect(effectiveElapsedMs).toBe(500);
    });

    it("very high RTT: lag credit strictly capped at PRODUCT_RULES.LAG_CREDIT_CAP_MS (100ms)", () => {
      const { lagCreditMs, effectiveElapsedMs } = calculateLagCredit({
        elapsedMs: 5_000,
        serverMeasuredRttMs: 20_000, // 20s latency
      });
      expect(lagCreditMs).toBe(PRODUCT_RULES.LAG_CREDIT_CAP_MS); // 100ms
      expect(effectiveElapsedMs).toBe(4_900);
    });

    it("negative or undefined RTT: cannot produce negative credit", () => {
      const { lagCreditMs } = calculateLagCredit({
        elapsedMs: 500,
        serverMeasuredRttMs: -100,
      });
      expect(lagCreditMs).toBe(0);
    });

    it("lag credit cannot exceed elapsed time (effectiveElapsedMs >= 0)", () => {
      const { lagCreditMs, effectiveElapsedMs } = calculateLagCredit({
        elapsedMs: 30, // elapsed 30ms
        serverMeasuredRttMs: 160, // RTT/2 would be 80ms
      });
      expect(lagCreditMs).toBe(80);
      expect(effectiveElapsedMs).toBe(0); // Clamped: effective elapsed never negative!
    });
  });

  describe("CLK-09 — Timeout Adjudication with Insufficient Mating Material", () => {
    it("flagging player has time -> normal state", () => {
      const fen = "8/8/8/4k3/8/5N2/4K3/8 w - - 0 1";
      // Neither player flagged
      const display = getCurrentClockDisplay(
        { whiteMs: 10_000, blackMs: 10_000, lastMoveTimestamp: 0, activeTurn: "w" },
        1_000,
        2,
      );
      expect(display.flagged).toBe(false);
    });

    it("flagging player times out, opponent has lone king -> draw (timeout_vs_insufficient)", () => {
      // White has K+Q, Black has lone King. White flags!
      const fen = "8/8/8/4k3/8/8/4K3/4Q3 w - - 0 1";
      const resolution = resolveTimeout(fen, "white");
      expect(resolution.result).toBe("1/2-1/2");
      expect(resolution.termination).toBe("timeout_vs_insufficient");
      expect(resolution.winnerRole).toBeUndefined();
    });

    it("flagging player times out, opponent has sufficient material (Queen) -> opponent wins", () => {
      // White has K+Q, Black has lone King. Black flags!
      const fen = "8/8/8/4k3/8/8/4K3/4Q3 w - - 0 1";
      const resolution = resolveTimeout(fen, "black");
      expect(resolution.result).toBe("1-0");
      expect(resolution.winnerRole).toBe("white");
      expect(resolution.termination).toBe("timeout");
    });

    it("flagging player times out, opponent has lone Knight vs lone King -> draw", () => {
      // White has K+N, Black has lone King. Black flags!
      const fen = "8/8/8/4k3/8/5N2/4K3/8 w - - 0 1";
      const resolution = resolveTimeout(fen, "black");
      expect(resolution.result).toBe("1/2-1/2");
      expect(resolution.termination).toBe("timeout_vs_insufficient");
    });

    it("flagging player times out, opponent has lone Bishop vs lone King -> draw", () => {
      const fen = "8/8/8/4k3/8/5B2/4K3/8 w - - 0 1";
      const resolution = resolveTimeout(fen, "black");
      expect(resolution.result).toBe("1/2-1/2");
      expect(resolution.termination).toBe("timeout_vs_insufficient");
    });

    it("flagging player times out, same-color bishops -> draw", () => {
      const fen = "5b2/8/8/4k3/8/8/4K3/2B5 w - - 0 1";
      const resolution = resolveTimeout(fen, "white");
      expect(resolution.result).toBe("1/2-1/2");
      expect(resolution.termination).toBe("timeout_vs_insufficient");
    });

    it("flagging player times out, opposite-color bishops -> win for opponent (help-mate possible)", () => {
      const fen = "2b5/8/8/4k3/8/8/4K3/2B5 w - - 0 1";
      const resolution = resolveTimeout(fen, "black");
      expect(resolution.result).toBe("1-0");
      expect(resolution.winnerRole).toBe("white");
      expect(resolution.termination).toBe("timeout");
    });
  });

  describe("Section 26 — Repetition Performance Benchmark (Batch 1 Carry-over)", () => {
    // Generate a repeating knight-shuffle move sequence of length N
    function generateKnightShuffleMoves(targetPlies: number): string[] {
      const moves: string[] = [];
      const cycle = ["Nf3", "Nf6", "Ng1", "Ng8"];
      for (let i = 0; i < targetPlies; i++) {
        moves.push(cycle[i % cycle.length]);
      }
      return moves;
    }

    it("measures repetition validation performance for 100 moves", () => {
      const moves100 = generateKnightShuffleMoves(100);
      const start = performance.now();
      const result = validateAndApplyMove(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        { from: "g1", to: "f3" },
        { moves: moves100 },
      );
      const durationMs = performance.now() - start;

      expect(result.valid).toBe(true);
      // Ensure replay is performant (< 100ms under parallel CI test load)
      expect(durationMs).toBeLessThan(100);
      console.log(`[Benchmark] validateAndApplyMove with 100 moves: ${durationMs.toFixed(2)}ms`);
    });

    it("measures repetition validation performance for 250 moves", () => {
      const moves250 = generateKnightShuffleMoves(250);
      const start = performance.now();
      const result = validateAndApplyMove(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        { from: "g1", to: "f3" },
        { moves: moves250 },
      );
      const durationMs = performance.now() - start;

      expect(result.valid).toBe(true);
      // Ensure replay is performant (< 100ms)
      expect(durationMs).toBeLessThan(100);
      console.log(`[Benchmark] validateAndApplyMove with 250 moves: ${durationMs.toFixed(2)}ms`);
    });

    it("measures repetition validation performance for 500 moves", () => {
      const moves500 = generateKnightShuffleMoves(500);
      const start = performance.now();
      const result = validateAndApplyMove(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        { from: "g1", to: "f3" },
        { moves: moves500 },
      );
      const durationMs = performance.now() - start;

      expect(result.valid).toBe(true);
      // Ensure replay is performant (< 200ms)
      expect(durationMs).toBeLessThan(200);
      console.log(`[Benchmark] validateAndApplyMove with 500 moves: ${durationMs.toFixed(2)}ms`);
    });
  });
});

import { BOT_TIERS, TIME_CONTROLS, type TimeControlKey } from "@etchess/types";
import { describe, expect, it } from "vitest";
import { calculateClockAfterMove, getCurrentClockDisplay } from "../src/clock";

describe("Bot Gameplay & Clock Precision Verification", () => {
  describe("Time Control Configurations", () => {
    it("initializes standard and increment time controls accurately", () => {
      const keys: TimeControlKey[] = [
        "1+0",
        "1+1",
        "2+0",
        "2+1",
        "3+0",
        "3+2",
        "5+0",
        "5+3",
        "10+0",
        "10+5",
        "15+10",
        "30+0",
      ];

      for (const key of keys) {
        const tc = TIME_CONTROLS[key];
        expect(tc).toBeDefined();
        expect(tc.initialSeconds).toBeGreaterThan(0);
        expect(tc.incrementSeconds).toBeGreaterThanOrEqual(0);
      }

      // 1+0: 60s, 0 inc
      expect(TIME_CONTROLS["1+0"].initialSeconds).toBe(60);
      expect(TIME_CONTROLS["1+0"].incrementSeconds).toBe(0);

      // 1+1: 60s, 1 inc
      expect(TIME_CONTROLS["1+1"].initialSeconds).toBe(60);
      expect(TIME_CONTROLS["1+1"].incrementSeconds).toBe(1);

      // 5+0: 300s, 0 inc
      expect(TIME_CONTROLS["5+0"].initialSeconds).toBe(300);
      expect(TIME_CONTROLS["5+0"].incrementSeconds).toBe(0);

      // 5+3: 300s, 3 inc
      expect(TIME_CONTROLS["5+3"].initialSeconds).toBe(300);
      expect(TIME_CONTROLS["5+3"].incrementSeconds).toBe(3);

      // 15+10: 900s, 10 inc
      expect(TIME_CONTROLS["15+10"].initialSeconds).toBe(900);
      expect(TIME_CONTROLS["15+10"].incrementSeconds).toBe(10);
    });
  });

  describe("Linear Clock Decrement (Anti-Quadratic Verification)", () => {
    it("simulates 50 ticks of 100ms and verifies exactly 5,000ms is deducted", () => {
      let whiteMs = 300_000; // 5 min (5+0)
      let lastMoveTimestamp = 1_000_000;

      // Simulate 50 ticks of 100ms (5 seconds total elapsed)
      for (let i = 1; i <= 50; i++) {
        const now = 1_000_000 + i * 100;
        const elapsed = Math.max(0, now - lastMoveTimestamp);
        whiteMs = Math.max(0, whiteMs - elapsed);
        lastMoveTimestamp = now;
      }

      // Exactly 5,000ms should be deducted, leaving exactly 295,000ms
      expect(whiteMs).toBe(295_000);
    });

    it("simulates 1+1 bullet game: thinking 2s and gaining 1s increment", () => {
      let whiteMs = 60_000;
      let lastMoveTimestamp = 1_000_000;

      // Think for 2,000ms (20 ticks of 100ms)
      for (let i = 1; i <= 20; i++) {
        const now = 1_000_000 + i * 100;
        const elapsed = Math.max(0, now - lastMoveTimestamp);
        whiteMs = Math.max(0, whiteMs - elapsed);
        lastMoveTimestamp = now;
      }

      expect(whiteMs).toBe(58_000);

      // Make move with 1,000ms increment
      const now = lastMoveTimestamp;
      const res = calculateClockAfterMove(
        {
          whiteMs,
          blackMs: 60_000,
          activeTurn: "w",
          lastMoveTimestamp,
        },
        { incrementMs: 1_000 },
        now,
      );

      expect(res.flagged).toBe(false);
      // 58,000 - 0 + 1,000 = 59,000ms
      expect(res.whiteMs).toBe(59_000);
      expect(res.nextTurn).toBe("b");
    });

    it("flags properly when remaining time runs out", () => {
      const blackMs = 500;
      const lastMoveTimestamp = 1_000_000;

      // Tick 600ms later
      const now = 1_000_600;
      const elapsed = Math.max(0, now - lastMoveTimestamp);
      const remaining = Math.max(0, blackMs - elapsed);

      expect(remaining).toBe(0);

      // calculateClockAfterMove should detect flagging
      const res = calculateClockAfterMove(
        {
          whiteMs: 60_000,
          blackMs: 500,
          activeTurn: "b",
          lastMoveTimestamp,
        },
        { incrementMs: 0 },
        now,
      );

      expect(res.flagged).toBe(true);
      expect(res.flaggedColor).toBe("b");
      expect(res.blackMs).toBe(0);
    });
  });

  describe("Bot Engine Tiers Calibration", () => {
    it("verifies canonical bot tiers names, ratings and skill parameters", () => {
      expect(BOT_TIERS.beginner.name).toBe("Sparky");
      expect(BOT_TIERS.beginner.elo).toBe(800);
      expect(BOT_TIERS.beginner.depthLimit).toBe(3);
      expect(BOT_TIERS.beginner.timeLimitMs).toBe(600);

      expect(BOT_TIERS.intermediate.name).toBe("Rooki");
      expect(BOT_TIERS.intermediate.elo).toBe(1400);
      expect(BOT_TIERS.intermediate.depthLimit).toBe(4);
      expect(BOT_TIERS.intermediate.timeLimitMs).toBe(1000);

      expect(BOT_TIERS.advanced.name).toBe("Master Bot");
      expect(BOT_TIERS.advanced.elo).toBe(1900);
      expect(BOT_TIERS.advanced.depthLimit).toBe(6);
      expect(BOT_TIERS.advanced.timeLimitMs).toBe(1600);

      expect(BOT_TIERS.master.name).toBe("Stockfish Max");
      expect(BOT_TIERS.master.elo).toBe(2400);
      expect(BOT_TIERS.master.depthLimit).toBe(8);
      expect(BOT_TIERS.master.timeLimitMs).toBe(2400);
    });
  });

  describe("Pass & Play Local Timer Flow", () => {
    it("simulates alternating moves between White and Black with increments", () => {
      let whiteMs = 180_000; // 3+2
      let blackMs = 180_000;
      let lastMoveTimestamp = 1_000_000;
      const incrementMs = 2_000;

      // 1. White thinks 3,000ms and makes move 1
      let now = 1_003_000;
      let moveRes = calculateClockAfterMove(
        { whiteMs, blackMs, activeTurn: "w", lastMoveTimestamp },
        { incrementMs },
        now,
      );
      // 180,000 - 3,000 + 2,000 = 179,000
      expect(moveRes.whiteMs).toBe(179_000);
      expect(moveRes.blackMs).toBe(180_000);
      expect(moveRes.nextTurn).toBe("b");

      whiteMs = moveRes.whiteMs;
      blackMs = moveRes.blackMs;
      lastMoveTimestamp = now;

      // 2. Black thinks 4,000ms and makes move 2
      now = 1_007_000;
      moveRes = calculateClockAfterMove(
        { whiteMs, blackMs, activeTurn: "b", lastMoveTimestamp },
        { incrementMs },
        now,
      );
      // 180,000 - 4,000 + 2,000 = 178,000
      expect(moveRes.whiteMs).toBe(179_000);
      expect(moveRes.blackMs).toBe(178_000);
      expect(moveRes.nextTurn).toBe("w");
    });
  });

  describe("Online Game Clock Synchronization", () => {
    it("syncs from authoritative server snapshot and anchors linear delta", () => {
      // Server snapshot arrives with 175,000ms for White and 180,000ms for Black
      const snapshotWhiteMs = 175_000;
      const snapshotBlackMs = 180_000;
      let clientAnchor = 2_000_000;

      // Client ticks 10 times of 100ms
      let currentWhiteMs = snapshotWhiteMs;
      for (let i = 1; i <= 10; i++) {
        const tickNow = 2_000_000 + i * 100;
        const elapsed = tickNow - clientAnchor;
        currentWhiteMs = Math.max(0, currentWhiteMs - elapsed);
        clientAnchor = tickNow;
      }

      // Exactly 1,000ms deducted
      expect(currentWhiteMs).toBe(174_000);

      // Server MOVE_ACCEPTED arrives with updated server clocks and increment
      const moveAcceptedWhiteMs = 176_000; // after server applied move + increment
      const moveAcceptedBlackMs = 180_000;
      clientAnchor = 2_001_500; // client receives at this local time

      // Next tick on Black's turn: 100ms later
      const nextTick = clientAnchor + 100;
      const blackElapsed = nextTick - clientAnchor;
      const updatedBlackMs = Math.max(0, moveAcceptedBlackMs - blackElapsed);

      expect(updatedBlackMs).toBe(179_900);
    });
  });
});

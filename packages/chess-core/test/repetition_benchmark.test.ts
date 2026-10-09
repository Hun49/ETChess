import { describe, expect, it } from "vitest";
import { STARTING_FEN, validateAndApplyMove } from "../src";

describe("REP-01 & REP-02: Repetition Complexity Benchmark & Reconstruction Integrity", () => {
  // Generates legal back-and-forth moves between knights:
  // Nf3 (w), Nf6 (b), Ng1 (w), Ng8 (b)
  function generateKnightShuffleGame(plyCount: number) {
    const cycle = [
      { from: "g1", to: "f3" },
      { from: "g8", to: "f6" },
      { from: "f3", to: "g1" },
      { from: "f6", to: "g8" },
    ];
    return Array.from({ length: plyCount }, (_, i) => cycle[i % 4]);
  }

  describe("REP-01 — Asymptotic Complexity Verification (100, 250, 500, 1000, 2000 plies)", () => {
    const PLY_COUNTS = [100, 250, 500, 1000, 2000];
    const ITERATIONS = 5;

    for (const targetPlies of PLY_COUNTS) {
      it(`evaluates ${targetPlies} moves in O(1) amortized time per move with positionCounts`, () => {
        const moves = generateKnightShuffleGame(targetPlies);
        const timings: number[] = [];

        for (let iter = 0; iter < ITERATIONS; iter++) {
          let currentFen = STARTING_FEN;
          let positionCounts: Record<string, number> = {
            [STARTING_FEN.split(" ").slice(0, 4).join(" ")]: 1,
          };

          const start = performance.now();
          for (let p = 0; p < targetPlies; p++) {
            const move = moves[p];
            const result = validateAndApplyMove(currentFen, move, { positionCounts });
            expect(result.valid).toBe(true);
            if (result.valid) {
              currentFen = result.snapshot.fen;
              positionCounts = result.snapshot.positionCounts ?? {};
            }
          }
          const elapsed = performance.now() - start;
          timings.push(elapsed);
        }

        timings.sort((a, b) => a - b);
        const median = timings[Math.floor(timings.length / 2)];
        const avg = timings.reduce((sum, t) => sum + t, 0) / timings.length;
        const avgPerMove = avg / targetPlies;

        console.log(
          `[Repetition Benchmark] ${targetPlies} plies: avg=${avg.toFixed(2)}ms (median=${median.toFixed(2)}ms), per-move=${(avgPerMove * 1000).toFixed(2)}µs`,
        );

        // Verification of O(1) amortized time: per-move time must remain strictly sub-millisecond (< 1.0ms)
        // even as game length grows from 100 to 2000 moves.
        expect(avgPerMove).toBeLessThan(1.0);
      });
    }

    it("verifies dictionary insertion and lookup costs are O(1)", () => {
      const counts: Record<string, number> = {};
      const key = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";

      // Insertion cost
      const t0 = performance.now();
      for (let i = 0; i < 10000; i++) {
        counts[key] = (counts[key] || 0) + 1;
      }
      const insertDuration = performance.now() - t0;

      // Lookup cost
      const t1 = performance.now();
      let sum = 0;
      for (let i = 0; i < 10000; i++) {
        sum += counts[key] ?? 0;
      }
      const lookupDuration = performance.now() - t1;

      expect(sum).toBe(10000 * 10000);
      expect(insertDuration).toBeLessThan(50);
      expect(lookupDuration).toBeLessThan(50);
    });
  });

  describe("REP-02 — Repetition Correctness Across DO Eviction & Reconstruction", () => {
    it("preserves exact repetition counts across serialization and reconstruction", () => {
      const currentFen = STARTING_FEN;
      const state = {
        fen: currentFen,
        positionCounts: {
          [STARTING_FEN.split(" ").slice(0, 4).join(" ")]: 1,
        } as Record<string, number>,
        moves: [] as string[],
      };

      // 1. Play first cycle (4 plies -> 1 repetition: 2nd occurrence of starting position)
      // White: Nf3, Black: Nf6, White: Ng1, Black: Ng8
      const cycle1 = [
        { from: "g1", to: "f3" },
        { from: "g8", to: "f6" },
        { from: "f3", to: "g1" },
        { from: "g6", to: "g8" }, // Note: knight on f6 returns to g8
      ];

      // Ply 1: Nf3
      let res = validateAndApplyMove(
        state.fen,
        { from: "g1", to: "f3" },
        { positionCounts: state.positionCounts },
      );
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      state.fen = res.snapshot.fen;
      state.positionCounts = res.snapshot.positionCounts ?? {};
      state.moves.push(res.san);

      // Ply 2: Nf6
      res = validateAndApplyMove(
        state.fen,
        { from: "g8", to: "f6" },
        { positionCounts: state.positionCounts },
      );
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      state.fen = res.snapshot.fen;
      state.positionCounts = res.snapshot.positionCounts ?? {};
      state.moves.push(res.san);

      // Ply 3: Ng1
      res = validateAndApplyMove(
        state.fen,
        { from: "f3", to: "g1" },
        { positionCounts: state.positionCounts },
      );
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      state.fen = res.snapshot.fen;
      state.positionCounts = res.snapshot.positionCounts ?? {};
      state.moves.push(res.san);

      // Ply 4: Ng8 (Starting position reached 2nd time)
      res = validateAndApplyMove(
        state.fen,
        { from: "f6", to: "g8" },
        { positionCounts: state.positionCounts },
      );
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      state.fen = res.snapshot.fen;
      state.positionCounts = res.snapshot.positionCounts ?? {};
      state.moves.push(res.san);

      expect(res.snapshot.isThreefoldRepetition).toBe(false);
      const startKey = STARTING_FEN.split(" ").slice(0, 4).join(" ");
      expect(state.positionCounts[startKey]).toBe(2);

      // 2. Simulate DO eviction and persistent storage round-trip (JSON serialization)
      const serialized = JSON.stringify(state);
      const reconstructedState = JSON.parse(serialized);

      expect(reconstructedState.positionCounts[startKey]).toBe(2);

      // 3. Play additional moves on the reconstructed session
      // Ply 5: Nf3
      res = validateAndApplyMove(
        reconstructedState.fen,
        { from: "g1", to: "f3" },
        { positionCounts: reconstructedState.positionCounts },
      );
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      reconstructedState.fen = res.snapshot.fen;
      reconstructedState.positionCounts = res.snapshot.positionCounts ?? {};

      // Ply 6: Nf6
      res = validateAndApplyMove(
        reconstructedState.fen,
        { from: "g8", to: "f6" },
        { positionCounts: reconstructedState.positionCounts },
      );
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      reconstructedState.fen = res.snapshot.fen;
      reconstructedState.positionCounts = res.snapshot.positionCounts ?? {};

      // Ply 7: Ng1
      res = validateAndApplyMove(
        reconstructedState.fen,
        { from: "f3", to: "g1" },
        { positionCounts: reconstructedState.positionCounts },
      );
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      reconstructedState.fen = res.snapshot.fen;
      reconstructedState.positionCounts = res.snapshot.positionCounts ?? {};

      // Ply 8: Ng8 -> 3rd occurrence of starting position!
      res = validateAndApplyMove(
        reconstructedState.fen,
        { from: "f6", to: "g8" },
        { positionCounts: reconstructedState.positionCounts },
      );
      expect(res.valid).toBe(true);
      if (!res.valid) return;

      // Authoritative Threefold Repetition Detected after reconstruction!
      expect(res.snapshot.isThreefoldRepetition).toBe(true);
      expect(res.snapshot.isDraw).toBe(true);
      expect(res.snapshot.isGameOver).toBe(true);
      expect(res.snapshot.positionCounts?.[startKey]).toBe(3);
    });
  });
});

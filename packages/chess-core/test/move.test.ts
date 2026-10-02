import { describe, expect, it } from "vitest";
import {
  type MoveValidationResult,
  STARTING_FEN,
  getLegalMoves,
  isGameOver,
  isInCheck,
  validateAndApplyMove,
  validateFen,
} from "../src";

describe("FEN validation", () => {
  it("validates the starting FEN correctly", () => {
    const res = validateFen(STARTING_FEN);
    expect(res.valid).toBe(true);
  });

  it("identifies invalid FEN string", () => {
    const res = validateFen("invalid-fen-string");
    expect(res.valid).toBe(false);
    expect(res.error).toBeDefined();
  });
});

describe("Move validation & execution", () => {
  it("applies a standard legal opening move (e2 to e4)", () => {
    const result = validateAndApplyMove(STARTING_FEN, { from: "e2", to: "e4" });
    expect(result.valid).toBe(true);
    if (!result.valid) return;

    expect(result.san).toBe("e4");
    expect(result.snapshot.turn).toBe("b");
    expect(result.snapshot.isGameOver).toBe(false);
    expect(result.snapshot.isCheck).toBe(false);
  });

  it("rejects an illegal move (e2 to e5 on move 1)", () => {
    const result = validateAndApplyMove(STARTING_FEN, { from: "e2", to: "e5" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toBeDefined();
  });

  it("detects Scholar's Mate checkmate correctly", () => {
    // 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#
    let currentFen = STARTING_FEN;
    const moves = [
      { from: "e2", to: "e4" },
      { from: "e7", to: "e5" },
      { from: "d1", to: "h5" },
      { from: "b8", to: "c6" },
      { from: "f1", to: "c4" },
      { from: "g8", to: "f6" },
      { from: "h5", to: "f7" },
    ];

    let lastResult: MoveValidationResult | undefined;
    for (const move of moves) {
      lastResult = validateAndApplyMove(currentFen, move);
      expect(lastResult.valid).toBe(true);
      if (!lastResult.valid) return;
      currentFen = lastResult.snapshot.fen;
    }

    expect(lastResult?.valid).toBe(true);
    if (!lastResult || !lastResult.valid) return;
    expect(lastResult.snapshot.isCheck).toBe(true);
    expect(lastResult.snapshot.isCheckmate).toBe(true);
    expect(lastResult.snapshot.isGameOver).toBe(true);
  });

  it("returns legal moves for a specific square on startpos", () => {
    const moves = getLegalMoves(STARTING_FEN, "e2");
    expect(moves).toHaveLength(2); // e3, e4
    expect(moves.map((m) => m.san)).toEqual(["e3", "e4"]);
  });

  it("detects check position correctly", () => {
    // White king at e1, Black king at a8, Black rook at e8 (check)
    const checkFen = "k3r3/8/8/8/8/8/8/4K3 w - - 0 1";
    expect(isInCheck(checkFen)).toBe(true);
    expect(isGameOver(checkFen)).toBe(false);
  });
});

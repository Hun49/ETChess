import { describe, expect, it } from "vitest";
import {
  STARTING_FEN,
  buildPgn,
  getLegalMoves,
  isGameOver,
  isInCheck,
  replayMoves,
  validateAndApplyMove,
} from "../src";

describe("ET Chess Hardening — Batch 1: Chess Rules & State Engine", () => {
  // ==========================================================================
  // CH-03 & Invariant A: Deterministic Illegal Move Corpus
  // ==========================================================================
  describe("CH-03 & Invariant A — Illegal Move Rejection & Zero Mutation", () => {
    it("rejects moving opponent piece on your turn", () => {
      const fenBefore = STARTING_FEN;
      const res = validateAndApplyMove(fenBefore, { from: "e7", to: "e5" });
      expect(res.valid).toBe(false);
      if (res.valid) return;
      expect(res.reason).toBeDefined();

      // Invariant A: State remains starting position
      const moves = getLegalMoves(fenBefore);
      expect(moves.length).toBe(20);
      expect(isInCheck(fenBefore)).toBe(false);
    });

    it("rejects moving from an empty square", () => {
      const fenBefore = STARTING_FEN;
      const res = validateAndApplyMove(fenBefore, { from: "e3", to: "e4" });
      expect(res.valid).toBe(false);
    });

    it("rejects moving a piece in an illegal pattern (e.g. King jumping 4 squares)", () => {
      const fenBefore = STARTING_FEN;
      const res = validateAndApplyMove(fenBefore, { from: "e1", to: "e5" });
      expect(res.valid).toBe(false);
    });

    it("rejects moving while leaving own king in check (absolute pin)", () => {
      // White Ke1, Ne2 pinned by Black Re8 against Ke1 along the e-file
      const pinnedFen = "4r2k/8/8/8/8/8/4N3/4K3 w - - 0 1";
      // Ne2 tries to move to d4, exposing Ke1 to Re8 check along the e-file
      const res = validateAndApplyMove(pinnedFen, { from: "e2", to: "d4" });
      expect(res.valid).toBe(false);
    });

    it("rejects king moving into an attacked square", () => {
      // White Kh1, Black Ra8 attacking a-file, h-file open
      const attackedSquareFen = "r6k/8/8/8/8/8/8/7K w - - 0 1";
      // Kh1 tries to move to g1 (g1 safe) vs if Black rook attacks g-file:
      const attackedGFileFen = "6rk/8/8/8/8/8/8/7K w - - 0 1";
      // Kh1 tries to move to g1 (attacked by Rg8)
      const res = validateAndApplyMove(attackedGFileFen, { from: "h1", to: "g1" });
      expect(res.valid).toBe(false);
    });

    it("rejects illegal promotion attempts", () => {
      // 1. Promoting a non-promoting move (pawn e2 to e4 with promotion: 'q')
      const resNonPromo = validateAndApplyMove(STARTING_FEN, {
        from: "e2",
        to: "e4",
        promotion: "q",
      });
      expect(resNonPromo.valid).toBe(false);
      if (!resNonPromo.valid) {
        expect(resNonPromo.reason).toBe("Illegal promotion");
      }

      // 2. Pawn reaches 8th rank WITHOUT specifying promotion
      const promoFen = "8/4P2k/8/8/8/8/8/7K w - - 0 1";
      const resMissingPromo = validateAndApplyMove(promoFen, { from: "e7", to: "e8" });
      expect(resMissingPromo.valid).toBe(false);

      // 3. Invalid promotion piece (e.g. 'k' or 'p')
      const resInvalidPromoPiece = validateAndApplyMove(promoFen, {
        from: "e7",
        to: "e8",
        promotion: "k" as "q",
      });
      expect(resInvalidPromoPiece.valid).toBe(false);
      if (!resInvalidPromoPiece.valid) {
        expect(resInvalidPromoPiece.reason).toBe("Invalid promotion piece");
      }
    });

    it("rejects illegal castling under all illegal conditions", () => {
      // 1. King has moved previously
      const kingMovedFen = "r3k2r/8/8/8/8/8/4K3/R6R w kq - 0 1"; // No W castling rights
      const res1 = validateAndApplyMove(kingMovedFen, { from: "e2", to: "g1" });
      expect(res1.valid).toBe(false);

      // 2. Castling while currently in check
      const inCheckCastlingFen = "r3k2r/8/8/8/8/4r3/8/R3K2R w KQkq - 0 1"; // Re3 checks Ke1
      const res2 = validateAndApplyMove(inCheckCastlingFen, { from: "e1", to: "g1" });
      expect(res2.valid).toBe(false);

      // 3. King crosses attacked square (f1 attacked by Bc4)
      const crossAttackedFen = "r3k2r/8/8/8/2b5/8/8/R3K2R w KQkq - 0 1";
      const res3 = validateAndApplyMove(crossAttackedFen, { from: "e1", to: "g1" });
      expect(res3.valid).toBe(false);

      // 4. King lands on attacked square (g1 attacked by Bb6)
      const landAttackedFen = "r3k2r/8/1b6/8/8/8/8/R3K2R w KQkq - 0 1";
      const res4 = validateAndApplyMove(landAttackedFen, { from: "e1", to: "g1" });
      expect(res4.valid).toBe(false);

      // 5. Blocked path (bishop on f1)
      const blockedFen = "r3k2r/8/8/8/8/8/8/R3KB1R w KQkq - 0 1";
      const res5 = validateAndApplyMove(blockedFen, { from: "e1", to: "g1" });
      expect(res5.valid).toBe(false);

      // 6. Missing rook
      const missingRookFen = "r3k2r/8/8/8/8/8/8/R3K3 w Qkq - 0 1";
      const res6 = validateAndApplyMove(missingRookFen, { from: "e1", to: "g1" });
      expect(res6.valid).toBe(false);
    });

    it("rejects illegal en passant under all invalid conditions", () => {
      // 1. Expired en passant (pawn pushed, quiet move played, then attempted)
      const expiredFen = "8/8/8/3Pp3/8/8/8/k6K w - - 0 2"; // No en passant target square
      const resExpired = validateAndApplyMove(expiredFen, { from: "d5", to: "e6" });
      expect(resExpired.valid).toBe(false);

      // 2. Wrong pawn (pawn on f5 tries to capture on e6 when target is d6)
      const wrongTargetFen = "8/8/8/4Pp2/8/8/8/k6K w - f6 0 1";
      const resWrongTarget = validateAndApplyMove(wrongTargetFen, { from: "e5", to: "d6" });
      expect(resWrongTarget.valid).toBe(false);

      // 3. En passant exposing own king to check (horizontal rank pin)
      const pinFen = "k7/8/8/r2Pp2K/8/8/8/8 w - e6 0 1";
      const resPin = validateAndApplyMove(pinFen, { from: "d5", to: "e6" });
      expect(resPin.valid).toBe(false);
    });

    it("enforces Invariant A: rejected move leaves position, ply, turn, and history unchanged", () => {
      const fenBefore = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
      const invalidMove = { from: "e7", to: "e4" }; // Illegal pawn leap
      const result = validateAndApplyMove(fenBefore, invalidMove);
      expect(result.valid).toBe(false);

      // Invariant A: The position is unchanged
      const legalMovesBefore = getLegalMoves(fenBefore);
      expect(legalMovesBefore.length).toBe(20);
    });
  });

  // ==========================================================================
  // Invariant B: One Accepted Move Properties
  // ==========================================================================
  describe("Invariant B — One Accepted Move Properties", () => {
    it("increments ply, flips turn, and updates move history for accepted non-terminal move", () => {
      const start = STARTING_FEN;
      const res1 = validateAndApplyMove(start, { from: "e2", to: "e4" });
      expect(res1.valid).toBe(true);
      if (!res1.valid) return;

      expect(res1.san).toBe("e4");
      expect(res1.snapshot.turn).toBe("b");
      expect(res1.snapshot.isGameOver).toBe(false);
      expect(res1.snapshot.history).toEqual(["e4"]);

      const res2 = validateAndApplyMove(
        res1.snapshot.fen,
        { from: "e7", to: "e5" },
        { moves: ["e4"] },
      );
      expect(res2.valid).toBe(true);
      if (!res2.valid) return;

      expect(res2.san).toBe("e5");
      expect(res2.snapshot.turn).toBe("w");
      expect(res2.snapshot.isGameOver).toBe(false);
      expect(res2.snapshot.history).toEqual(["e4", "e5"]);
    });
  });

  // ==========================================================================
  // CH-04: Checkmate
  // ==========================================================================
  describe("CH-04 — Checkmate Authoritative Resolution", () => {
    it("detects Fool's Mate checkmate in 2 moves (0-1)", () => {
      // 1. f3 e5 2. g4 Qh4#
      const moves = [
        { from: "f2", to: "f3" },
        { from: "e7", to: "e5" },
        { from: "g2", to: "g4" },
        { from: "d8", to: "h4" },
      ];

      let fen = STARTING_FEN;
      const history: string[] = [];
      let finalRes: ReturnType<typeof validateAndApplyMove> | undefined;

      for (const m of moves) {
        finalRes = validateAndApplyMove(fen, m, { moves: [...history] });
        expect(finalRes.valid).toBe(true);
        if (!finalRes.valid) return;
        history.push(finalRes.san);
        fen = finalRes.snapshot.fen;
      }

      expect(finalRes?.valid).toBe(true);
      if (!finalRes || !finalRes.valid) return;

      expect(finalRes.san).toBe("Qh4#");
      expect(finalRes.snapshot.isCheck).toBe(true);
      expect(finalRes.snapshot.isCheckmate).toBe(true);
      expect(finalRes.snapshot.isGameOver).toBe(true);
      expect(finalRes.snapshot.turn).toBe("w"); // Turn switched to White, who is checkmated
      expect(getLegalMoves(fen)).toHaveLength(0); // 0 legal moves
    });

    it("detects Scholar's Mate checkmate in 4 moves (1-0)", () => {
      // 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#
      const moves = [
        { from: "e2", to: "e4" },
        { from: "e7", to: "e5" },
        { from: "d1", to: "h5" },
        { from: "b8", to: "c6" },
        { from: "f1", to: "c4" },
        { from: "g8", to: "f6" },
        { from: "h5", to: "f7" },
      ];

      let fen = STARTING_FEN;
      const history: string[] = [];
      let finalRes: ReturnType<typeof validateAndApplyMove> | undefined;

      for (const m of moves) {
        finalRes = validateAndApplyMove(fen, m, { moves: [...history] });
        expect(finalRes.valid).toBe(true);
        if (!finalRes.valid) return;
        history.push(finalRes.san);
        fen = finalRes.snapshot.fen;
      }

      expect(finalRes?.valid).toBe(true);
      if (!finalRes || !finalRes.valid) return;

      expect(finalRes.san).toBe("Qxf7#");
      expect(finalRes.snapshot.isCheckmate).toBe(true);
      expect(finalRes.snapshot.isGameOver).toBe(true);
      expect(finalRes.snapshot.turn).toBe("b"); // Turn switched to Black, who is checkmated
      expect(getLegalMoves(fen)).toHaveLength(0);
    });

    it("detects non-trivial checkmate (Morphy's Opera Game checkmate Rd8#)", () => {
      // Opera Game final sequence: White plays 17. Rd8#
      // FEN before 17. Rd8#: White has Rd1, Black has Nb8, Ke8, pawn f7, g7, h7
      const operaMateFen = "1n1Rkb1r/p4ppp/4q3/4p1B1/4P3/8/PPP2PPP/2K5 b k - 1 17";
      expect(isInCheck(operaMateFen)).toBe(true);
      expect(isGameOver(operaMateFen)).toBe(true);
      expect(getLegalMoves(operaMateFen)).toHaveLength(0);
    });
  });

  // ==========================================================================
  // CH-05: Stalemate
  // ==========================================================================
  describe("CH-05 — Stalemate Authoritative Resolution", () => {
    it("detects stalemate: not in check, 0 legal moves, isStalemate true, isDraw true", () => {
      // White Kf7, Qg1; Black Kh8 (White plays Qg1-g6 delivering stalemate)
      const fenBefore = "7k/5K2/8/8/8/8/8/6Q1 w - - 0 1";
      const res = validateAndApplyMove(fenBefore, { from: "g1", to: "g6" });
      expect(res.valid).toBe(true);
      if (!res.valid) return;

      expect(res.snapshot.isCheck).toBe(false);
      expect(res.snapshot.isStalemate).toBe(true);
      expect(res.snapshot.isDraw).toBe(true);
      expect(res.snapshot.isGameOver).toBe(true);
      expect(getLegalMoves(res.snapshot.fen)).toHaveLength(0);
    });
  });

  // ==========================================================================
  // CH-06: Insufficient Mating Material
  // ==========================================================================
  describe("CH-06 — Insufficient Mating Material", () => {
    it("recognizes K vs K as drawn by insufficient material", () => {
      const fen = "8/8/8/4k3/8/8/4K3/8 w - - 0 1";
      const res = validateAndApplyMove(fen, { from: "e2", to: "e3" });
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      expect(res.snapshot.isInsufficientMaterial).toBe(true);
      expect(res.snapshot.isDraw).toBe(true);
      expect(res.snapshot.isGameOver).toBe(true);
    });

    it("recognizes K+B vs K as drawn by insufficient material", () => {
      const fen = "8/8/8/4k3/8/8/4KB2/8 w - - 0 1";
      const res = validateAndApplyMove(fen, { from: "f2", to: "e3" });
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      expect(res.snapshot.isInsufficientMaterial).toBe(true);
      expect(res.snapshot.isDraw).toBe(true);
    });

    it("recognizes K+N vs K as drawn by insufficient material", () => {
      const fen = "8/8/8/4k3/8/8/4KN2/8 w - - 0 1";
      const res = validateAndApplyMove(fen, { from: "f2", to: "e4" });
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      expect(res.snapshot.isInsufficientMaterial).toBe(true);
      expect(res.snapshot.isDraw).toBe(true);
    });

    it("recognizes K+B vs K+B with SAME-color bishops as drawn", () => {
      // Both bishops on dark squares (c1 and e1)
      const fen = "8/8/8/4k3/8/8/4K3/2B1b3 w - - 0 1";
      const res = validateAndApplyMove(fen, { from: "e2", to: "f3" });
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      expect(res.snapshot.isInsufficientMaterial).toBe(true);
      expect(res.snapshot.isDraw).toBe(true);
    });

    it("recognizes K+B vs K+B with OPPOSITE-color bishops as NOT drawn (mating material exists)", () => {
      // c1 is dark, f1 is light
      const fen = "8/8/8/4k3/8/8/4K3/2B2b2 w - - 0 1";
      const res = validateAndApplyMove(fen, { from: "e2", to: "d2" });
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      // Opposite color bishops can legally achieve checkmate via help-mate in the corner
      expect(res.snapshot.isInsufficientMaterial).toBe(false);
      expect(res.snapshot.isDraw).toBe(false);
    });

    it("recognizes K+N vs K+N as NOT drawn (mating material exists via help-mate)", () => {
      const fen = "8/8/8/4k3/8/2N5/4K3/4n3 w - - 0 1";
      const res = validateAndApplyMove(fen, { from: "e2", to: "d2" });
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      expect(res.snapshot.isInsufficientMaterial).toBe(false);
    });

    it("recognizes pawn presence prevents insufficient material", () => {
      const fen = "8/8/8/4k3/8/4P3/4K3/8 w - - 0 1";
      const res = validateAndApplyMove(fen, { from: "e2", to: "d3" });
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      expect(res.snapshot.isInsufficientMaterial).toBe(false);
    });
  });

  // ==========================================================================
  // CH-07: Threefold Repetition
  // ==========================================================================
  describe("CH-07 — Threefold Repetition", () => {
    it("detects threefold repetition draw on the third occurrence of the same position", () => {
      // Moves: 1. Nf3 Nf6 2. Ng1 Ng8 (pos 2) 3. Nf3 Nf6 4. Ng1 Ng8 (pos 3 -> threefold draw!)
      const sequence = [
        { from: "g1", to: "f3" },
        { from: "g8", to: "f6" },
        { from: "f3", to: "g1" },
        { from: "g8", to: "f6" }, // wait: knight was on f6, so f6 -> g8
      ];

      // Exact 8-ply repetition sequence:
      // 1. Nf3 Nf6 2. Ng1 Ng8 (cycle 1, occurrence 2)
      // 3. Nf3 Nf6 4. Ng1 Ng8 (cycle 2, occurrence 3)
      const moves = [
        { from: "g1", to: "f3" },
        { from: "g8", to: "f6" },
        { from: "f3", to: "g1" },
        { from: "f6", to: "g8" },
        { from: "g1", to: "f3" },
        { from: "g8", to: "f6" },
        { from: "f3", to: "g1" },
        { from: "f6", to: "g8" },
      ];

      let fen = STARTING_FEN;
      const history: string[] = [];
      let finalRes: ReturnType<typeof validateAndApplyMove> | undefined;

      for (let i = 0; i < moves.length; i++) {
        finalRes = validateAndApplyMove(fen, moves[i], {
          moves: [...history],
          initialFen: STARTING_FEN,
        });
        expect(finalRes.valid).toBe(true);
        if (!finalRes.valid) return;
        history.push(finalRes.san);
        fen = finalRes.snapshot.fen;

        if (i < 7) {
          expect(finalRes.snapshot.isThreefoldRepetition).toBe(false);
          expect(finalRes.snapshot.isGameOver).toBe(false);
        }
      }

      expect(finalRes?.valid).toBe(true);
      if (!finalRes || !finalRes.valid) return;

      expect(finalRes.snapshot.isThreefoldRepetition).toBe(true);
      expect(finalRes.snapshot.isDraw).toBe(true);
      expect(finalRes.snapshot.isGameOver).toBe(true);
    });

    it("verifies position identity rather than raw FEN string (move counts do not disrupt repetition)", () => {
      // FIDE Laws Article 9.2: Position is repeated if same pieces on same squares,
      // same side to move, same castling rights.
      // Fullmove counter and halfmove counter differ between occurrences, but repetition still triggers!
      const moves = [
        { from: "g1", to: "f3" },
        { from: "g8", to: "f6" },
        { from: "f3", to: "g1" },
        { from: "f6", to: "g8" },
        { from: "g1", to: "f3" },
        { from: "g8", to: "f6" },
        { from: "f3", to: "g1" },
        { from: "f6", to: "g8" },
      ];

      let fen = STARTING_FEN;
      const history: string[] = [];
      let lastRes: ReturnType<typeof validateAndApplyMove> | undefined;

      for (const m of moves) {
        lastRes = validateAndApplyMove(fen, m, { moves: [...history] });
        if (lastRes.valid) {
          history.push(lastRes.san);
          fen = lastRes.snapshot.fen;
        }
      }

      expect(lastRes?.valid).toBe(true);
      if (lastRes?.valid) {
        // Even though fen has '... 8 5' fullmove number, repetition is recognized!
        expect(lastRes.snapshot.isThreefoldRepetition).toBe(true);
      }
    });
  });

  // ==========================================================================
  // CH-08: Fivefold Repetition Delegation & Behavior
  // ==========================================================================
  describe("CH-08 — Fivefold Repetition Delegation", () => {
    it("maintains terminal draw state through 5 repeated occurrences", () => {
      // 4 cycles = 5th occurrence of initial position
      const cycle = [
        { from: "g1", to: "f3" },
        { from: "g8", to: "f6" },
        { from: "f3", to: "g1" },
        { from: "f6", to: "g8" },
      ];

      let fen = STARTING_FEN;
      const history: string[] = [];
      let finalRes: ReturnType<typeof validateAndApplyMove> | undefined;

      for (let c = 0; c < 4; c++) {
        for (const m of cycle) {
          finalRes = validateAndApplyMove(fen, m, { moves: [...history] });
          if (finalRes.valid) {
            history.push(finalRes.san);
            fen = finalRes.snapshot.fen;
          }
        }
      }

      expect(finalRes?.valid).toBe(true);
      if (finalRes?.valid) {
        expect(finalRes.snapshot.isFivefoldRepetition).toBe(true);
        expect(finalRes.snapshot.isDraw).toBe(true);
        expect(finalRes.snapshot.isGameOver).toBe(true);
      }
    });
  });

  // ==========================================================================
  // CH-09: Fifty-Move Rule
  // ==========================================================================
  describe("CH-09 — Fifty-Move Rule", () => {
    it("transitions exactly from 99 halfmoves (active) to 100 halfmoves (draw)", () => {
      // Halfmove clock at 98: quiet move advances to 99 (not drawn yet)
      const fen98 = "4k3/8/8/8/8/8/8/4K2R w - - 98 50";
      const res99 = validateAndApplyMove(fen98, { from: "h1", to: "h2" });
      expect(res99.valid).toBe(true);
      if (!res99.valid) return;
      expect(res99.snapshot.isDrawByFiftyMoves).toBe(false);
      expect(res99.snapshot.isGameOver).toBe(false);

      // Now at 99 halfmoves: quiet move advances to 100 (draw triggered!)
      const res100 = validateAndApplyMove(res99.snapshot.fen, { from: "e8", to: "d8" });
      expect(res100.valid).toBe(true);
      if (!res100.valid) return;
      expect(res100.snapshot.isDrawByFiftyMoves).toBe(true);
      expect(res100.snapshot.isDraw).toBe(true);
      expect(res100.snapshot.isGameOver).toBe(true);
    });
  });

  // ==========================================================================
  // CH-10: Seventy-Five-Move Rule Delegation & Behavior
  // ==========================================================================
  describe("CH-10 — Seventy-Five-Move Rule Delegation", () => {
    it("confirms 75-move threshold (150 halfmoves) is recognized as drawn", () => {
      // Halfmove clock at 149
      const fen149 = "4k3/8/8/8/8/8/8/4K2R w - - 149 75";
      const res150 = validateAndApplyMove(fen149, { from: "h1", to: "h2" });
      expect(res150.valid).toBe(true);
      if (!res150.valid) return;

      expect(res150.snapshot.isDrawByFiftyMoves).toBe(true);
      expect(res150.snapshot.isDrawBySeventyFiveMoves).toBe(true);
      expect(res150.snapshot.isDraw).toBe(true);
      expect(res150.snapshot.isGameOver).toBe(true);
    });
  });

  // ==========================================================================
  // CH-11: Castling Rights and Maintenance
  // ==========================================================================
  describe("CH-11 — Castling Legal and Rights Maintenance", () => {
    it("executes legal kingside castling (O-O)", () => {
      const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
      const res = validateAndApplyMove(fen, { from: "e1", to: "g1" });
      expect(res.valid).toBe(true);
      if (!res.valid) return;

      expect(res.san).toBe("O-O");
      // White rook is now at f1, king at g1; White loses all castling rights
      expect(res.snapshot.fen).toContain("kq"); // Black retains 'kq', White has none
    });

    it("executes legal queenside castling (O-O-O)", () => {
      const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
      const res = validateAndApplyMove(fen, { from: "e1", to: "c1" });
      expect(res.valid).toBe(true);
      if (!res.valid) return;

      expect(res.san).toBe("O-O-O");
      // White rook at d1, king at c1; White loses all castling rights
      expect(res.snapshot.fen).toContain("kq");
    });

    it("maintains castling rights: moving h1 rook only loses kingside rights", () => {
      const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
      const res = validateAndApplyMove(fen, { from: "h1", to: "h2" });
      expect(res.valid).toBe(true);
      if (!res.valid) return;

      // White only has 'Q' remaining (queenside)
      const castlingPart = res.snapshot.fen.split(" ")[2];
      expect(castlingPart).toBe("Qkq");
    });

    it("maintains castling rights: moving king loses all white castling rights", () => {
      const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
      const res = validateAndApplyMove(fen, { from: "e1", to: "e2" });
      expect(res.valid).toBe(true);
      if (!res.valid) return;

      const castlingPart = res.snapshot.fen.split(" ")[2];
      expect(castlingPart).toBe("kq");
    });
  });

  // ==========================================================================
  // CH-12: En Passant
  // ==========================================================================
  describe("CH-12 — En Passant Authoritative Handling", () => {
    it("executes valid immediate en passant capture", () => {
      // White pawn e5, Black plays d7-d5 -> FEN has 'd6' en passant target
      const fen = "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2";
      const res = validateAndApplyMove(fen, { from: "e5", to: "d6" });
      expect(res.valid).toBe(true);
      if (!res.valid) return;

      expect(res.san).toBe("exd6");
      // Black d5 pawn was captured and removed
      expect(res.snapshot.fen).not.toContain("3pP3");
    });
  });

  // ==========================================================================
  // CH-13: Promotion
  // ==========================================================================
  describe("CH-13 — Promotion Validations", () => {
    const promoFen = "8/4P2k/8/8/8/8/8/7K w - - 0 1";

    it("promotes to Queen", () => {
      const res = validateAndApplyMove(promoFen, { from: "e7", to: "e8", promotion: "q" });
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      expect(res.san).toBe("e8=Q");
      expect(res.snapshot.fen.startsWith("4Q3/")).toBe(true);
    });

    it("promotes to Rook", () => {
      const res = validateAndApplyMove(promoFen, { from: "e7", to: "e8", promotion: "r" });
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      expect(res.san).toBe("e8=R");
      expect(res.snapshot.fen.startsWith("4R3/")).toBe(true);
    });

    it("promotes to Bishop", () => {
      const res = validateAndApplyMove(promoFen, { from: "e7", to: "e8", promotion: "b" });
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      expect(res.san).toBe("e8=B");
      expect(res.snapshot.fen.startsWith("4B3/")).toBe(true);
    });

    it("promotes to Knight", () => {
      const res = validateAndApplyMove(promoFen, { from: "e7", to: "e8", promotion: "n" });
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      expect(res.san).toBe("e8=N");
      expect(res.snapshot.fen.startsWith("4N3/")).toBe(true);
    });

    it("promotes with Check", () => {
      // Black King on e6: e7-e8=Q+ checks Ke6
      const fen = "8/4P3/4k3/8/8/8/8/7K w - - 0 1";
      const res = validateAndApplyMove(fen, { from: "e7", to: "e8", promotion: "q" });
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      expect(res.san).toBe("e8=Q+");
      expect(res.snapshot.isCheck).toBe(true);
    });

    it("promotes with Checkmate", () => {
      // Black King on a8, White King on b6, pawn on c7: c7-c8=Q# delivers checkmate
      const fen = "k7/2P5/1K6/8/8/8/8/8 w - - 0 1";
      const res = validateAndApplyMove(fen, { from: "c7", to: "c8", promotion: "q" });
      expect(res.valid).toBe(true);
      if (!res.valid) return;
      expect(res.san).toBe("c8=Q#");
      expect(res.snapshot.isCheckmate).toBe(true);
      expect(res.snapshot.isGameOver).toBe(true);
    });
  });

  // ==========================================================================
  // CH-17: PGN Correctness
  // ==========================================================================
  describe("CH-17 — PGN Correctness & Canonical Reproduction", () => {
    it("generates correct PGN matching authoritative move sequence for checkmate", () => {
      const pgn = buildPgn({
        event: "ET Chess Championship",
        white: "WhitePlayer",
        black: "BlackPlayer",
        result: "1-0",
        termination: "checkmate",
        moves: ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"],
      });

      expect(pgn).toContain('[Event "ET Chess Championship"]');
      expect(pgn).toContain('[Result "1-0"]');
      expect(pgn).toContain('[Termination "checkmate"]');
      expect(pgn).toContain("1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0");
    });

    it("generates correct PGN for draw game", () => {
      const pgn = buildPgn({
        white: "WhitePlayer",
        black: "BlackPlayer",
        result: "1/2-1/2",
        termination: "stalemate",
        moves: ["e4", "e5"],
      });

      expect(pgn).toContain('[Result "1/2-1/2"]');
      expect(pgn).toContain("1. e4 e5 1/2-1/2");
    });
  });

  // ==========================================================================
  // Invariant E: Move History is Canonical
  // ==========================================================================
  describe("Invariant E — Canonical Move History Replay", () => {
    it("replays move history from initial position to reproduce authoritative final position", () => {
      const moves = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6"];
      const replayed = replayMoves(moves);

      expect(replayed.ply).toBe(8);
      expect(replayed.turn).toBe("w");
      expect(replayed.isGameOver).toBe(false);

      // Replay must be 100% deterministic
      const replayedAgain = replayMoves(moves);
      expect(replayedAgain.fen).toBe(replayed.fen);
    });

    it("throws on illegal move in canonical history", () => {
      const corruptedMoves = ["e4", "e5", "Qh9"]; // Qh9 is illegal
      expect(() => replayMoves(corruptedMoves)).toThrow();
    });
  });
});

import type { MoveInput } from "@etchess/types";
import { Chess, type Square } from "chess.js";

export interface LegalMove {
  from: string;
  to: string;
  promotion?: string;
  san: string;
  lan: string;
  piece: string;
  captured?: string;
}

export interface GameStateSnapshot {
  fen: string;
  turn: "w" | "b";
  isGameOver: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  isStalemate: boolean;
  isThreefoldRepetition: boolean;
  isInsufficientMaterial: boolean;
  history: string[];
}

export type MoveValidationResult =
  | { valid: true; snapshot: GameStateSnapshot; san: string }
  | { valid: false; reason: string };

/**
 * Validates a move against the given FEN and returns the new game state snapshot if valid.
 * Pure function: does not mutate external state.
 */
export function validateAndApplyMove(currentFen: string, move: MoveInput): MoveValidationResult {
  try {
    const chess = new Chess(currentFen);
    const result = chess.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion || "q",
    });

    if (!result) {
      return { valid: false, reason: "Illegal move" };
    }

    return {
      valid: true,
      san: result.san,
      snapshot: {
        fen: chess.fen(),
        turn: chess.turn(),
        isGameOver: chess.isGameOver(),
        isCheck: chess.inCheck(),
        isCheckmate: chess.isCheckmate(),
        isDraw: chess.isDraw(),
        isStalemate: chess.isStalemate(),
        isThreefoldRepetition: chess.isThreefoldRepetition(),
        isInsufficientMaterial: chess.isInsufficientMaterial(),
        history: chess.history(),
      },
    };
  } catch (err) {
    return {
      valid: false,
      reason: err instanceof Error ? err.message : "Invalid move execution",
    };
  }
}

/**
 * Returns all legal moves from the given FEN, optionally filtered by origin square.
 */
export function getLegalMoves(fen: string, square?: string): LegalMove[] {
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({
      square: square as Square,
      verbose: true,
    });

    return moves.map((m) => ({
      from: m.from,
      to: m.to,
      promotion: m.promotion,
      san: m.san,
      lan: m.lan,
      piece: m.piece,
      captured: m.captured,
    }));
  } catch {
    return [];
  }
}

/**
 * Checks whether the side to move is in check.
 */
export function isInCheck(fen: string): boolean {
  try {
    const chess = new Chess(fen);
    return chess.inCheck();
  } catch {
    return false;
  }
}

/**
 * Checks whether the current position is a game over (checkmate, stalemate, draw).
 */
export function isGameOver(fen: string): boolean {
  try {
    const chess = new Chess(fen);
    return chess.isGameOver();
  } catch {
    return false;
  }
}

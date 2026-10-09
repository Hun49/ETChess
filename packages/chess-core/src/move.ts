import type { MoveInput } from "@etchess/types";
import { Chess, type Square } from "chess.js";
import { STARTING_FEN } from "./fen";

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
  isFivefoldRepetition?: boolean;
  isInsufficientMaterial: boolean;
  isDrawByFiftyMoves: boolean;
  isDrawBySeventyFiveMoves?: boolean;
  history: string[];
  positionKey?: string;
  positionCounts?: Record<string, number>;
}

export type MoveValidationResult =
  | { valid: true; snapshot: GameStateSnapshot; san: string }
  | { valid: false; reason: string };

export interface MoveValidationOptions {
  moves?: string[];
  initialFen?: string;
  positionCounts?: Record<string, number>;
}

const VALID_PROMOTIONS: ReadonlySet<string> = new Set(["q", "r", "b", "n"]);

/**
 * Validates a move against the given FEN and returns the new game state snapshot if valid.
 * Pure function: does not mutate external state.
 * Supports O(1) positionCounts dictionary tracking or history replay for accurate repetition detection.
 */
export function validateAndApplyMove(
  currentFen: string,
  move: MoveInput,
  options?: MoveValidationOptions,
): MoveValidationResult {
  try {
    if (move.promotion && !VALID_PROMOTIONS.has(move.promotion)) {
      return { valid: false, reason: "Invalid promotion piece" };
    }

    const chess = new Chess(currentFen);
    const result = chess.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    });

    if (!result) {
      return { valid: false, reason: "Illegal move" };
    }

    if (move.promotion && !result.promotion) {
      return { valid: false, reason: "Illegal promotion" };
    }

    const newFen = chess.fen();
    const fenTokens = newFen.split(" ");
    const halfMoves = Number.parseInt(fenTokens[4] || "0", 10);
    const positionKey = fenTokens.slice(0, 4).join(" ");

    let isThreefold = false;
    let isFivefold = false;
    let nextPositionCounts: Record<string, number> | undefined;

    if (options?.positionCounts) {
      // O(1) amortized hash-map lookup & update
      nextPositionCounts = { ...options.positionCounts };
      const currentCount = (nextPositionCounts[positionKey] ?? 0) + 1;
      nextPositionCounts[positionKey] = currentCount;
      isThreefold = currentCount >= 3;
      isFivefold = currentCount >= 5;
    } else if (options?.moves && options.moves.length > 0) {
      // Fallback: full move history replay
      const fullChess = new Chess(options.initialFen || STARTING_FEN);
      for (const priorMove of options.moves) {
        fullChess.move(priorMove);
      }
      if (fullChess.fen() === currentFen) {
        fullChess.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion,
        });
        isThreefold = fullChess.isThreefoldRepetition();
        isFivefold = isThreefold;
      } else {
        isThreefold = chess.isThreefoldRepetition();
        isFivefold = isThreefold;
      }
    } else {
      isThreefold = chess.isThreefoldRepetition();
      isFivefold = isThreefold;
    }

    const isSeventyFiveMoves = halfMoves >= 150;
    const isDrawByFifty = chess.isDrawByFiftyMoves();
    const isStalemate = chess.isStalemate();
    const isInsufficient = chess.isInsufficientMaterial();
    const isCheckmate = chess.isCheckmate();
    const isDraw = isStalemate || isThreefold || isInsufficient || isDrawByFifty;
    const isGameOver = isCheckmate || isDraw;

    return {
      valid: true,
      san: result.san,
      snapshot: {
        fen: newFen,
        turn: chess.turn(),
        isGameOver,
        isCheck: chess.inCheck(),
        isCheckmate,
        isDraw,
        isStalemate,
        isThreefoldRepetition: isThreefold,
        isFivefoldRepetition: isFivefold,
        isInsufficientMaterial: isInsufficient,
        isDrawByFiftyMoves: isDrawByFifty,
        isDrawBySeventyFiveMoves: isSeventyFiveMoves,
        history: options?.moves ? [...options.moves, result.san] : chess.history(),
        positionKey,
        positionCounts: nextPositionCounts,
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
 * Replays a sequence of SAN moves from an initial FEN (defaulting to STARTING_FEN).
 * Invariant E: Replaying canonical move history reproduces the exact authoritative position.
 */
export function replayMoves(
  moves: string[],
  initialFen: string = STARTING_FEN,
): { fen: string; turn: "w" | "b"; isGameOver: boolean; ply: number; history: string[] } {
  const chess = new Chess(initialFen);
  for (const move of moves) {
    const result = chess.move(move);
    if (!result) {
      throw new Error(`Illegal move in canonical history: ${move}`);
    }
  }
  return {
    fen: chess.fen(),
    turn: chess.turn(),
    isGameOver: chess.isGameOver(),
    ply: moves.length,
    history: chess.history(),
  };
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

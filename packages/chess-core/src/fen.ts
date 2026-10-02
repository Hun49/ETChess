import { validateFen as chessJsValidateFen } from "chess.js";

export const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function validateFen(fen: string): { valid: boolean; error?: string } {
  const result = chessJsValidateFen(fen);
  return {
    valid: result.ok,
    error: result.error,
  };
}

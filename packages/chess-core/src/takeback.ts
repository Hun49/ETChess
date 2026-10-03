import { Chess } from "chess.js";

export interface CanOfferTakebackOptions {
  isFriendGame: boolean;
  rated: boolean;
  ply: number;
  hasPendingRequest?: boolean;
}

export interface TakebackOfferCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Validates whether a takeback request is legally allowed.
 * RULE-10: Takebacks are strictly permitted in unrated friend games only.
 */
export function canOfferTakeback(options: CanOfferTakebackOptions): TakebackOfferCheckResult {
  if (options.rated) {
    return {
      allowed: false,
      reason: "Takebacks are not allowed in rated games",
    };
  }

  if (!options.isFriendGame) {
    return {
      allowed: false,
      reason: "Takebacks are only allowed in friend matches",
    };
  }

  if (options.hasPendingRequest) {
    return {
      allowed: false,
      reason: "A takeback request is already pending",
    };
  }

  if (options.ply < 1) {
    return {
      allowed: false,
      reason: "Cannot take back moves at the start of the game",
    };
  }

  return { allowed: true };
}

export interface TakebackApplicationResult {
  fen: string;
  ply: number;
  turn: "w" | "b";
  moves: string[];
}

/**
 * Applies a takeback by rewinding the move history by 1 or 2 plies.
 * Pure function: does not mutate inputs.
 */
export function applyTakeback(
  history: string[],
  pliesToRewind: 1 | 2 = 2,
): TakebackApplicationResult {
  const rewindCount = Math.min(history.length, pliesToRewind);
  const remainingMoves = history.slice(0, history.length - rewindCount);

  const chess = new Chess();
  for (const move of remainingMoves) {
    chess.move(move);
  }

  return {
    fen: chess.fen(),
    ply: remainingMoves.length,
    turn: chess.turn(),
    moves: remainingMoves,
  };
}

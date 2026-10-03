import { Chess, type PieceSymbol, type Square } from "chess.js";

export type TimeoutTermination = "timeout" | "timeout_vs_insufficient";

export interface TimeoutResolution {
  result: "1-0" | "0-1" | "1/2-1/2";
  winnerRole?: "white" | "black";
  termination: TimeoutTermination;
}

interface PieceLocation {
  square: Square;
  color: "w" | "b";
  type: PieceSymbol;
}

/**
 * Checks whether two squares on a chessboard share the same color.
 * (file + rank) % 2 determines light vs dark squares.
 */
function areSquaresSameColor(sq1: string, sq2: string): boolean {
  const f1 = sq1.charCodeAt(0) - 97;
  const r1 = Number.parseInt(sq1[1], 10) - 1;
  const f2 = sq2.charCodeAt(0) - 97;
  const r2 = Number.parseInt(sq2[1], 10) - 1;
  return (f1 + r1) % 2 === (f2 + r2) % 2;
}

/**
 * Determines whether a player can deliver checkmate by any possible series of legal moves
 * (FIDE Laws of Chess Article 6.9).
 *
 * If the non-flagged player has:
 * - Lone King: CANNOT mate -> false
 * - King + single Knight against lone King: CANNOT mate -> false
 * - King + single Bishop against lone King: CANNOT mate -> false
 * - King + Bishop against King + Bishop on same-color squares: CANNOT mate -> false
 * - Any pawns, rooks, queens, 2+ minor pieces, or minor piece against opposing piece/pawn: CAN mate -> true
 */
export function canDeliverCheckmate(fen: string, playerColor: "white" | "black"): boolean {
  const chess = new Chess(fen);
  const targetColor = playerColor === "white" ? "w" : "b";
  const oppColor = playerColor === "white" ? "b" : "w";

  const targetPieces: PieceLocation[] = [];
  const oppPieces: PieceLocation[] = [];

  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const file = String.fromCharCode(97 + c);
      const rank = (8 - r).toString();
      const square = `${file}${rank}` as Square;
      if (piece.color === targetColor) {
        targetPieces.push({ square, color: piece.color, type: piece.type });
      } else {
        oppPieces.push({ square, color: piece.color, type: piece.type });
      }
    }
  }

  // Filter out kings (each side always has 1 king)
  const targetNonKings = targetPieces.filter((p) => p.type !== "k");
  const oppNonKings = oppPieces.filter((p) => p.type !== "k");

  // 1. Lone King can never mate
  if (targetNonKings.length === 0) {
    return false;
  }

  // 2. Pawns, Rooks, and Queens can always deliver mate (or promote)
  const hasPawnsRooksQueens = targetNonKings.some((p) => ["p", "r", "q"].includes(p.type));
  if (hasPawnsRooksQueens) {
    return true;
  }

  // 3. Target has two or more minor pieces (e.g. 2 knights, 2 bishops, B+N)
  // Cooperative mate is legally possible
  if (targetNonKings.length >= 2) {
    return true;
  }

  // Target has exactly 1 minor piece (Bishop or Knight)
  const minor = targetNonKings[0];

  // 4. If opponent has a pawn or piece, cooperative mate is possible in the corner
  // (e.g., K+N vs K+P, opponent's piece blocks king)
  // Exception: K+B vs K+B on the SAME colored squares!
  if (oppNonKings.length === 0) {
    // Lone King against single minor piece: checkmate is mathematically impossible
    return false;
  }

  // Opponent has pieces. Check K+B vs K+B with same-colored bishops
  if (minor.type === "b" && oppNonKings.length === 1 && oppNonKings[0].type === "b") {
    const targetBishopSq = minor.square;
    const oppBishopSq = oppNonKings[0].square;
    if (areSquaresSameColor(targetBishopSq, oppBishopSq)) {
      // Both bishops on same color squares: neither side can ever mate the other
      return false;
    }
    // Bishops on opposite colors: cooperative mate in corner is possible
    return true;
  }

  // Minor piece against opposing pawn/piece (e.g. K+N vs K+P, K+B vs K+N) -> help-mate possible
  return true;
}

/**
 * Resolves the game outcome when a player flags (runs out of clock time).
 * Follows FIDE Article 6.9:
 * - If the opponent has insufficient material to mate by any legal series of moves, result is a DRAW (1/2-1/2).
 * - Otherwise, opponent wins (1-0 or 0-1).
 */
export function resolveTimeout(fen: string, flaggedColor: "white" | "black"): TimeoutResolution {
  const opponentColor = flaggedColor === "white" ? "black" : "white";
  const opponentCanMate = canDeliverCheckmate(fen, opponentColor);

  if (!opponentCanMate) {
    return {
      result: "1/2-1/2",
      termination: "timeout_vs_insufficient",
    };
  }

  return {
    result: opponentColor === "white" ? "1-0" : "0-1",
    winnerRole: opponentColor,
    termination: "timeout",
  };
}

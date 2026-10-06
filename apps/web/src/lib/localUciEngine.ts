import type { EngineTransport } from "@etchess/bot-engine";
import { Chess } from "@etchess/chess-core";

// Piece values in centipawns
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Simplified positional piece-square bonuses
const PAWN_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10,
  25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10,
  10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
];

const KNIGHT_TABLE = [
  -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0,
  -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5,
  -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
];

function evaluatePosition(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === "w" ? -30000 : 30000;
  }
  if (chess.isDraw()) {
    return 0;
  }

  let score = 0;
  const board = chess.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const val = PIECE_VALUES[piece.type] ?? 0;
      let positionalBonus = 0;
      const idx = piece.color === "w" ? r * 8 + c : (7 - r) * 8 + c;

      if (piece.type === "p") {
        positionalBonus = PAWN_TABLE[idx] ?? 0;
      } else if (piece.type === "n") {
        positionalBonus = KNIGHT_TABLE[idx] ?? 0;
      }

      const totalVal = val + positionalBonus;
      score += piece.color === "w" ? totalVal : -totalVal;
    }
  }

  return score;
}

function minimax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluatePosition(chess);
  }

  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) {
    return evaluatePosition(chess);
  }

  let currentAlpha = alpha;
  let currentBeta = beta;

  if (isMaximizing) {
    let maxEval = Number.NEGATIVE_INFINITY;
    for (const move of moves) {
      chess.move(move);
      const evaluation = minimax(chess, depth - 1, currentAlpha, currentBeta, false);
      chess.undo();
      maxEval = Math.max(maxEval, evaluation);
      currentAlpha = Math.max(currentAlpha, evaluation);
      if (currentBeta <= currentAlpha) break;
    }
    return maxEval;
  }

  let minEval = Number.POSITIVE_INFINITY;
  for (const move of moves) {
    chess.move(move);
    const evaluation = minimax(chess, depth - 1, currentAlpha, currentBeta, true);
    chess.undo();
    minEval = Math.min(minEval, evaluation);
    currentBeta = Math.min(currentBeta, evaluation);
    if (currentBeta <= currentAlpha) break;
  }
  return minEval;
}

/**
 * Procedural in-browser engine transport adhering to UCI protocol.
 * Powers client-side offline bot play across all difficulty tiers.
 */
export class LocalUciEngineTransport implements EngineTransport {
  private listeners: ((line: string) => void)[] = [];
  private currentFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  private skillLevel = 5;
  private isTerminated = false;

  public send(command: string): void {
    if (this.isTerminated) return;
    const trimmed = command.trim();

    if (trimmed === "uci") {
      this.emit("id name ETChess Local Bot Engine");
      this.emit("id author ETChess");
      this.emit("option name Skill Level type spin default 10 min 0 max 20");
      this.emit("uciok");
      return;
    }

    if (trimmed === "isready") {
      this.emit("readyok");
      return;
    }

    if (trimmed.startsWith("setoption name Skill Level value")) {
      const parts = trimmed.split(" ");
      const val = Number.parseInt(parts[parts.length - 1], 10);
      if (!Number.isNaN(val)) {
        this.skillLevel = Math.max(0, Math.min(20, val));
      }
      return;
    }

    if (trimmed === "ucinewgame") {
      this.currentFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
      return;
    }

    if (trimmed.startsWith("position fen ")) {
      this.currentFen = trimmed.replace("position fen ", "").trim();
      return;
    }

    if (trimmed.startsWith("go")) {
      // Calculate best move asynchronously to avoid blocking UI thread
      setTimeout(() => {
        this.computeBestMove();
      }, 50);
      return;
    }
  }

  public onMessage(callback: (line: string) => void): void {
    this.listeners.push(callback);
  }

  public terminate(): void {
    this.isTerminated = true;
    this.listeners = [];
  }

  private emit(line: string): void {
    for (const listener of this.listeners) {
      listener(line);
    }
  }

  private computeBestMove(): void {
    try {
      const chess = new Chess(this.currentFen);
      const moves = chess.moves({ verbose: true });

      if (moves.length === 0) {
        this.emit("bestmove (none)");
        return;
      }

      // Skill level determines search depth and randomness
      // Skill 0-4: Random or simple captures
      // Skill 5-10: Depth 1-2
      // Skill 11-15: Depth 2-3
      // Skill 16-20: Depth 3-4
      const isWhite = chess.turn() === "w";
      let searchDepth = 1;
      let blunderChance = 0;

      if (this.skillLevel < 4) {
        searchDepth = 1;
        blunderChance = 0.5;
      } else if (this.skillLevel < 9) {
        searchDepth = 2;
        blunderChance = 0.25;
      } else if (this.skillLevel < 15) {
        searchDepth = 3;
        blunderChance = 0.08;
      } else {
        searchDepth = 3;
        blunderChance = 0.0;
      }

      if (Math.random() < blunderChance) {
        // Pick random legal move
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        const promo = randomMove.promotion ? randomMove.promotion : "";
        this.emit(`bestmove ${randomMove.from}${randomMove.to}${promo}`);
        return;
      }

      let bestMove = moves[0];
      let bestVal = isWhite ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;

      for (const move of moves) {
        chess.move(move);
        const val = minimax(
          chess,
          searchDepth - 1,
          Number.NEGATIVE_INFINITY,
          Number.POSITIVE_INFINITY,
          !isWhite,
        );
        chess.undo();

        if (isWhite && val > bestVal) {
          bestVal = val;
          bestMove = move;
        } else if (!isWhite && val < bestVal) {
          bestVal = val;
          bestMove = move;
        }
      }

      const promotion = bestMove.promotion ? bestMove.promotion : "";
      const uciMove = `${bestMove.from}${bestMove.to}${promotion}`;
      this.emit(`bestmove ${uciMove}`);
    } catch {
      // Fallback
      this.emit("bestmove (none)");
    }
  }
}

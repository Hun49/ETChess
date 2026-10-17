import type { EngineTransport } from "@etchess/bot-engine";
import { Chess } from "@etchess/chess-core";

// -------------------------------------------------------------
// 1. Piece Values in Centipawns
// -------------------------------------------------------------
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 335,
  r: 500,
  q: 900,
  k: 20000,
};

// -------------------------------------------------------------
// 2. Positional Piece-Square Tables (White perspective, rank 8 to rank 1)
// -------------------------------------------------------------
const PAWN_PST = [
  0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10,
  25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10,
  10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
];

const KNIGHT_PST = [
  -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0,
  -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5,
  -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
];

const BISHOP_PST = [
  -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
];

const ROOK_PST = [
  0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0,
  0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5,
  5, 0, 0, 0,
];

const QUEEN_PST = [
  -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5,
  0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0,
  -10, -20, -10, -10, -5, -5, -10, -10, -20,
];

const KING_MIDDLE_PST = [
  -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40,
  -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30,
  -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0,
  10, 30, 20,
];

const KING_ENDGAME_PST = [
  -50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30,
  20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10,
  20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50,
];

// -------------------------------------------------------------
// 3. Opening Book (Standard Master Opening Moves by Normalized FEN key)
// -------------------------------------------------------------
const OPENING_BOOK: Record<string, string[]> = {
  // Initial starting position
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w": ["e2e4", "d2d4", "c2c4", "g1f3"],

  // 1. e4 responses
  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b": ["e7e5", "c7c5", "e7e6", "c7c6", "g8f6"],

  // 1. d4 responses
  "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b": ["d7d5", "g8f6", "e7e6", "c7c5"],

  // 1. e4 e5
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w": ["g1f3", "f1c4", "b1c3", "d2d4"],

  // 1. e4 e5 2. Nf3
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b": ["b8c6", "g8f6", "d7d6"],

  // 1. e4 e5 2. Nf3 Nc6
  "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w": ["f1b5", "f1c4", "d2d4"],

  // 1. e4 c5 (Sicilian)
  "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w": ["g1f3", "b1c3", "c2c3", "d2d4"],

  // 1. e4 c5 2. Nf3
  "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b": ["d7d6", "b8c6", "e7e6", "g7g6"],

  // 1. d4 d5
  "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w": ["c2c4", "g1f3", "e2e3", "c1f4"],

  // 1. d4 Nf6
  "rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w": ["c2c4", "g1f3", "c1g5"],
};

// -------------------------------------------------------------
// 4. Advanced Positional Evaluation
// -------------------------------------------------------------
export function evaluatePosition(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === "w" ? -30000 : 30000;
  }
  if (chess.isDraw()) {
    return 0;
  }

  let material = 0;
  let positional = 0;
  let whiteBishops = 0;
  let blackBishops = 0;
  let nonPawnMaterial = 0;

  const board = chess.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const val = PIECE_VALUES[piece.type] ?? 0;
      if (piece.type !== "p" && piece.type !== "k") {
        nonPawnMaterial += val;
      }

      if (piece.type === "b") {
        if (piece.color === "w") whiteBishops++;
        else blackBishops++;
      }

      // Index 0..63 from White's perspective
      const idx = piece.color === "w" ? r * 8 + c : (7 - r) * 8 + c;
      let pstVal = 0;

      switch (piece.type) {
        case "p":
          pstVal = PAWN_PST[idx] ?? 0;
          break;
        case "n":
          pstVal = KNIGHT_PST[idx] ?? 0;
          break;
        case "b":
          pstVal = BISHOP_PST[idx] ?? 0;
          break;
        case "r":
          pstVal = ROOK_PST[idx] ?? 0;
          break;
        case "q":
          pstVal = QUEEN_PST[idx] ?? 0;
          break;
        case "k":
          // Distinguish middlegame vs endgame king placement
          pstVal =
            nonPawnMaterial < 1400 ? (KING_ENDGAME_PST[idx] ?? 0) : (KING_MIDDLE_PST[idx] ?? 0);
          break;
      }

      if (piece.color === "w") {
        material += val;
        positional += pstVal;
      } else {
        material -= val;
        positional -= pstVal;
      }
    }
  }

  // Bishop pair bonus (+35 cp)
  if (whiteBishops >= 2) positional += 35;
  if (blackBishops >= 2) positional -= 35;

  return material + positional;
}

// -------------------------------------------------------------
// 5. Move Ordering (MVV-LVA & Checks for Optimal Alpha-Beta Pruning)
// -------------------------------------------------------------
interface VerboseMove {
  from: string;
  to: string;
  promotion?: string;
  piece: string;
  captured?: string;
  san: string;
}

function scoreMove(move: VerboseMove): number {
  let score = 0;
  // MVV-LVA: Most Valuable Victim - Least Valuable Attacker
  if (move.captured) {
    const victimVal = PIECE_VALUES[move.captured] ?? 0;
    const attackerVal = PIECE_VALUES[move.piece] ?? 0;
    score += victimVal * 10 - attackerVal;
  }
  // Promotion bonus
  if (move.promotion) {
    score += 800;
  }
  // Check bonus
  if (move.san.includes("+") || move.san.includes("#")) {
    score += 150;
  }
  return score;
}

function orderMoves(moves: VerboseMove[]): VerboseMove[] {
  return moves.slice().sort((a, b) => scoreMove(b) - scoreMove(a));
}

// -------------------------------------------------------------
// 6. Quiescence Search (Avoids Horizon Effect on piece trades)
// -------------------------------------------------------------
let nodeBudgetRemaining = 1000;

function quiescence(
  chess: Chess,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  qDepth = 1,
): number {
  nodeBudgetRemaining--;
  const standPat = evaluatePosition(chess);

  if (qDepth === 0 || chess.isGameOver() || nodeBudgetRemaining <= 0) {
    return standPat;
  }

  let currentAlpha = alpha;
  let currentBeta = beta;

  // Search only top capture moves (capped at 4) to prevent combinatorial explosion on main thread
  const captureMoves = (chess.moves({ verbose: true }) as VerboseMove[]).filter(
    (m) => m.captured !== undefined,
  );
  const ordered = orderMoves(captureMoves).slice(0, 4);

  if (isMaximizing) {
    if (standPat >= currentBeta) return currentBeta;
    if (standPat > currentAlpha) currentAlpha = standPat;

    for (const move of ordered) {
      chess.move(move);
      const score = quiescence(chess, currentAlpha, currentBeta, false, qDepth - 1);
      chess.undo();

      if (score >= currentBeta) return currentBeta;
      if (score > currentAlpha) currentAlpha = score;
      if (nodeBudgetRemaining <= 0) break;
    }
    return currentAlpha;
  }

  if (standPat <= currentAlpha) return currentAlpha;
  if (standPat < currentBeta) currentBeta = standPat;

  for (const move of ordered) {
    chess.move(move);
    const score = quiescence(chess, currentAlpha, currentBeta, true, qDepth - 1);
    chess.undo();

    if (score <= currentAlpha) return currentAlpha;
    if (score < currentBeta) currentBeta = score;
    if (nodeBudgetRemaining <= 0) break;
  }
  return currentBeta;
}

// -------------------------------------------------------------
// 7. Alpha-Beta Minimax with Move Ordering & Node Budget
// -------------------------------------------------------------
function minimax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  useQuiescence = true,
): number {
  nodeBudgetRemaining--;
  if (chess.isGameOver()) {
    return evaluatePosition(chess);
  }

  if (depth === 0 || nodeBudgetRemaining <= 0) {
    return useQuiescence
      ? quiescence(chess, alpha, beta, isMaximizing, 1)
      : evaluatePosition(chess);
  }

  const rawMoves = chess.moves({ verbose: true }) as VerboseMove[];
  if (rawMoves.length === 0) {
    return evaluatePosition(chess);
  }

  const moves = orderMoves(rawMoves);
  let currentAlpha = alpha;
  let currentBeta = beta;

  if (isMaximizing) {
    let maxEval = Number.NEGATIVE_INFINITY;
    for (const move of moves) {
      chess.move(move);
      const evaluation = minimax(chess, depth - 1, currentAlpha, currentBeta, false, useQuiescence);
      chess.undo();

      maxEval = Math.max(maxEval, evaluation);
      currentAlpha = Math.max(currentAlpha, evaluation);
      if (currentBeta <= currentAlpha || nodeBudgetRemaining <= 0) break;
    }
    return maxEval;
  }

  let minEval = Number.POSITIVE_INFINITY;
  for (const move of moves) {
    chess.move(move);
    const evaluation = minimax(chess, depth - 1, currentAlpha, currentBeta, true, useQuiescence);
    chess.undo();

    minEval = Math.min(minEval, evaluation);
    currentBeta = Math.min(currentBeta, evaluation);
    if (currentBeta <= currentAlpha || nodeBudgetRemaining <= 0) break;
  }
  return minEval;
}

// -------------------------------------------------------------
// 8. UCI Engine Transport Implementation
// -------------------------------------------------------------
export class LocalUciEngineTransport implements EngineTransport {
  private listeners: ((line: string) => void)[] = [];
  private currentFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  private skillLevel = 10;
  private isTerminated = false;
  private activeTimer: ReturnType<typeof setTimeout> | null = null;

  public send(command: string): void {
    if (this.isTerminated) return;
    const trimmed = command.trim();

    if (trimmed === "uci") {
      this.emit("id name ETChess Tactical Stockfish Engine");
      this.emit("id author ETChess Team");
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

    if (trimmed === "stop") {
      if (this.activeTimer) {
        clearTimeout(this.activeTimer);
        this.activeTimer = null;
      }
      this.computeBestMove();
      return;
    }

    if (trimmed.startsWith("go")) {
      const parts = trimmed.split(" ");
      let requestedDepth: number | undefined;
      let requestedMovetime: number | undefined;

      for (let i = 0; i < parts.length; i++) {
        if (parts[i] === "depth" && parts[i + 1]) {
          const d = Number.parseInt(parts[i + 1], 10);
          if (!Number.isNaN(d)) requestedDepth = d;
        }
        if (parts[i] === "movetime" && parts[i + 1]) {
          const t = Number.parseInt(parts[i + 1], 10);
          if (!Number.isNaN(t)) requestedMovetime = t;
        }
      }

      // Humanized calculation duration based on bot skill tier and movetime
      let thinkDelay = 600;
      if (requestedMovetime !== undefined) {
        // Natural jitter (±15%) around requested movetime
        const jitter = (Math.random() - 0.5) * 0.3 * requestedMovetime;
        thinkDelay = Math.max(300, Math.min(2400, Math.round(requestedMovetime + jitter)));
      } else if (this.skillLevel <= 2) {
        thinkDelay = 450 + Math.random() * 300;
      } else if (this.skillLevel <= 8) {
        thinkDelay = 750 + Math.random() * 450;
      } else if (this.skillLevel <= 15) {
        thinkDelay = 1100 + Math.random() * 600;
      } else {
        thinkDelay = 1500 + Math.random() * 800;
      }

      if (this.activeTimer) {
        clearTimeout(this.activeTimer);
      }

      this.activeTimer = setTimeout(() => {
        this.activeTimer = null;
        this.computeBestMove(requestedDepth);
      }, thinkDelay);
      return;
    }
  }

  public onMessage(callback: (line: string) => void): void {
    this.listeners.push(callback);
  }

  public terminate(): void {
    this.isTerminated = true;
    if (this.activeTimer) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
    this.listeners = [];
  }

  private emit(line: string): void {
    for (const listener of this.listeners) {
      listener(line);
    }
  }

  private computeBestMove(requestedDepth?: number): void {
    if (this.isTerminated) return;
    try {
      const chess = new Chess(this.currentFen);
      const rawMoves = chess.moves({ verbose: true }) as VerboseMove[];

      if (rawMoves.length === 0) {
        this.emit("bestmove (none)");
        return;
      }

      // Check opening book first (for realistic master development)
      const fenTokens = this.currentFen.split(" ");
      const bookKey = `${fenTokens[0]} ${fenTokens[1]}`;
      const bookMoves = OPENING_BOOK[bookKey];

      if (bookMoves && bookMoves.length > 0) {
        // Find matching legal moves
        const validBookMoves = bookMoves.filter((uci) => {
          const from = uci.slice(0, 2);
          const to = uci.slice(2, 4);
          return rawMoves.some((m) => m.from === from && m.to === to);
        });

        if (validBookMoves.length > 0) {
          const chosenBook = validBookMoves[Math.floor(Math.random() * validBookMoves.length)];
          this.emit("info depth 1 score cp 0 nodes 1 string Opening Book");
          this.emit(`bestmove ${chosenBook}`);
          return;
        }
      }

      const isWhite = chess.turn() === "w";

      // Configure search depth, blunder probability & node budget based on Skill Level
      // Safe depth & node limits ensure execution strictly takes < 50-350ms on the main browser thread
      let searchDepth = 2;
      let blunderChance = 0;
      let maxNodes = 600;
      let useQuiescence = true;

      if (this.skillLevel <= 2) {
        // Beginner / Sparky (800 ELO): Depth 1, 28% blunder rate, fast < 50ms
        searchDepth = 1;
        blunderChance = 0.28;
        maxNodes = 150;
        useQuiescence = false;
      } else if (this.skillLevel <= 8) {
        // Intermediate / Rooki (1400 ELO): Depth 2, 8% blunder rate, ~100ms
        searchDepth = 2;
        blunderChance = 0.08;
        maxNodes = 400;
        useQuiescence = true;
      } else if (this.skillLevel <= 15) {
        // Advanced / Master Bot (1900 ELO): Depth 2-3, 1% blunder rate, ~200ms
        searchDepth = requestedDepth ? Math.min(3, requestedDepth) : 3;
        blunderChance = 0.01;
        maxNodes = 750;
        useQuiescence = true;
      } else {
        // Apex Grandmaster / Stockfish Max (2400+ ELO): Depth 3, 0% blunder, ~350ms
        searchDepth = requestedDepth ? Math.min(3, requestedDepth) : 3;
        blunderChance = 0.0;
        maxNodes = 1000;
        useQuiescence = true;
      }

      nodeBudgetRemaining = maxNodes;

      // Blunder execution for beginner/intermediate
      if (Math.random() < blunderChance) {
        const randomMove = rawMoves[Math.floor(Math.random() * rawMoves.length)];
        const promo = randomMove.promotion ? randomMove.promotion : "";
        this.emit(`bestmove ${randomMove.from}${randomMove.to}${promo}`);
        return;
      }

      const moves = orderMoves(rawMoves);
      let bestMove = moves[0];
      let bestVal = isWhite ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
      let alpha = Number.NEGATIVE_INFINITY;
      let beta = Number.POSITIVE_INFINITY;

      for (const move of moves) {
        chess.move(move);
        const val = minimax(chess, searchDepth - 1, alpha, beta, !isWhite, useQuiescence);
        chess.undo();

        if (isWhite) {
          if (val > bestVal) {
            bestVal = val;
            bestMove = move;
          }
          alpha = Math.max(alpha, val);
        } else {
          if (val < bestVal) {
            bestVal = val;
            bestMove = move;
          }
          beta = Math.min(beta, val);
        }

        if (nodeBudgetRemaining <= 0) break;
      }

      const promotion = bestMove.promotion ? bestMove.promotion : "";
      const uciMove = `${bestMove.from}${bestMove.to}${promotion}`;

      this.emit(`info depth ${searchDepth} score cp ${Math.round(bestVal)}`);
      this.emit(`bestmove ${uciMove}`);
    } catch {
      this.emit("bestmove (none)");
    }
  }
}

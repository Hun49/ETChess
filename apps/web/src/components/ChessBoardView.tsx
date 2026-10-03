import { getLegalMoves, isInCheck } from "@etchess/chess-core";
import { AlertCircle, Crown } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { type BoardTheme, useGameStore } from "../store/gameStore";

// Theme square color definitions
const THEME_STYLES: Record<BoardTheme, { light: React.CSSProperties; dark: React.CSSProperties }> =
  {
    slate: {
      light: { backgroundColor: "#cbd5e1" }, // slate-300
      dark: { backgroundColor: "#475569" }, // slate-600
    },
    wood: {
      light: { backgroundColor: "#f0d9b5" },
      dark: { backgroundColor: "#b58863" },
    },
    emerald: {
      light: { backgroundColor: "#e2e8f0" },
      dark: { backgroundColor: "#2d6a4f" },
    },
    ocean: {
      light: { backgroundColor: "#dee3e6" },
      dark: { backgroundColor: "#386687" },
    },
  };

const PIECE_SYMBOLS: Record<string, string> = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
  k: "♚",
};

/**
 * Calculates pieces captured by each side from the board FEN
 */
function getCapturedPieces(fen: string): {
  whiteCaptured: string[];
  blackCaptured: string[];
  whiteScore: number;
  blackScore: number;
} {
  const initialCounts: Record<string, number> = {
    P: 8,
    N: 2,
    B: 2,
    R: 2,
    Q: 1,
    p: 8,
    n: 2,
    b: 2,
    r: 2,
    q: 1,
  };

  const values: Record<string, number> = {
    P: 1,
    N: 3,
    B: 3,
    R: 5,
    Q: 9,
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
  };

  const piecePlacement = fen.split(" ")[0] || "";
  for (const char of piecePlacement) {
    if (initialCounts[char] !== undefined) {
      initialCounts[char]--;
    }
  }

  // Black pieces captured by White (lowercase in initialCounts)
  const whiteCaptured: string[] = [];
  let whiteMaterial = 0;
  for (const piece of ["q", "r", "b", "n", "p"]) {
    const count = initialCounts[piece] || 0;
    for (let i = 0; i < count; i++) {
      whiteCaptured.push(piece);
      whiteMaterial += values[piece];
    }
  }

  // White pieces captured by Black (uppercase in initialCounts)
  const blackCaptured: string[] = [];
  let blackMaterial = 0;
  for (const piece of ["Q", "R", "B", "N", "P"]) {
    const count = initialCounts[piece] || 0;
    for (let i = 0; i < count; i++) {
      blackCaptured.push(piece.toLowerCase());
      blackMaterial += values[piece];
    }
  }

  return {
    whiteCaptured,
    blackCaptured,
    whiteScore: whiteMaterial - blackMaterial,
    blackScore: blackMaterial - whiteMaterial,
  };
}

/**
 * Format milliseconds into MM:SS.d format
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((Math.max(0, ms) % 1000) / 100);

  if (totalSeconds < 10) {
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}.${tenths}`;
  }
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

export const ChessBoardView: React.FC = () => {
  const {
    fen,
    turn,
    boardOrientation,
    boardTheme,
    lastMove,
    isCheck,
    status,
    whitePlayer,
    blackPlayer,
    whiteMs,
    blackMs,
    whiteConnected,
    blackConnected,
    makeMove,
  } = useGameStore();

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);

  // Compute legal moves for selected square
  const legalMovesForSquare = useMemo(() => {
    if (!selectedSquare) return [];
    return getLegalMoves(fen, selectedSquare);
  }, [fen, selectedSquare]);

  // Compute captured pieces
  const { whiteCaptured, blackCaptured, whiteScore, blackScore } = useMemo(
    () => getCapturedPieces(fen),
    [fen],
  );

  // Dynamic square styles for highlights, legal moves, and check
  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // 1. Last Move Highlighting (soft gold tint)
    if (lastMove) {
      styles[lastMove.from] = {
        backgroundColor: "rgba(250, 204, 21, 0.35)",
      };
      styles[lastMove.to] = {
        backgroundColor: "rgba(250, 204, 21, 0.45)",
      };
    }

    // 2. Selected Square (emerald tint)
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: "rgba(16, 185, 129, 0.5)",
      };
    }

    // 3. Legal Targets Highlighting
    for (const move of legalMovesForSquare) {
      if (move.captured) {
        // Target contains an enemy piece: hollow ring highlight
        styles[move.to] = {
          background: "radial-gradient(circle, transparent 65%, rgba(239, 68, 68, 0.6) 66%)",
          borderRadius: "50%",
        };
      } else {
        // Quiet target: centered dot
        styles[move.to] = {
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.7) 22%, transparent 23%)",
          borderRadius: "50%",
        };
      }
    }

    // 4. King in check highlight (red radial glow)
    if (isCheck) {
      // Find king of current side
      const piecePlacement = fen.split(" ")[0];
      const targetKing = turn === "w" ? "K" : "k";
      const rows = piecePlacement.split("/");
      for (let r = 0; r < 8; r++) {
        let col = 0;
        for (const char of rows[r]) {
          if (/\d/.test(char)) {
            col += Number.parseInt(char, 10);
          } else {
            if (char === targetKing) {
              const file = String.fromCharCode(97 + col);
              const rank = 8 - r;
              styles[`${file}${rank}`] = {
                background:
                  "radial-gradient(circle, rgba(239, 68, 68, 0.9) 0%, rgba(239, 68, 68, 0.3) 70%, transparent 100%)",
              };
            }
            col++;
          }
        }
      }
    }

    return styles;
  }, [lastMove, selectedSquare, legalMovesForSquare, isCheck, fen, turn]);

  // Handle Piece Drop
  const handlePieceDrop = ({
    sourceSquare,
    targetSquare,
    piece,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
    piece: { pieceType: string };
  }): boolean => {
    if (!targetSquare) return false;

    // Detect pawn promotion: pawn moving to 8th rank (White) or 1st rank (Black)
    const isPawn =
      piece.pieceType.endsWith("P") ||
      piece.pieceType.endsWith("p") ||
      piece.pieceType.toLowerCase().includes("p");
    const isPromotionRank =
      (turn === "w" && targetSquare[1] === "8") || (turn === "b" && targetSquare[1] === "1");

    if (isPawn && isPromotionRank) {
      setPendingPromotion({ from: sourceSquare, to: targetSquare });
      return false;
    }

    const moveSuccessful = makeMove(sourceSquare, targetSquare);
    setSelectedSquare(null);
    return moveSuccessful;
  };

  // Handle Square Click
  const handleSquareClick = ({ square }: { square: string }): void => {
    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      // Check if clicked square is a legal move target
      const isLegal = legalMovesForSquare.some((m) => m.to === square);
      if (isLegal) {
        // Detect promotion
        const isPromotionRank =
          (turn === "w" && square[1] === "8") || (turn === "b" && square[1] === "1");

        const legalMove = legalMovesForSquare.find((m) => m.to === square);
        if (legalMove?.piece === "p" && isPromotionRank) {
          setPendingPromotion({ from: selectedSquare, to: square });
          setSelectedSquare(null);
          return;
        }

        makeMove(selectedSquare, square);
        setSelectedSquare(null);
        return;
      }
    }

    // Select new square
    setSelectedSquare(square);
  };

  // Execute promotion choice
  const selectPromotion = (promo: "q" | "r" | "b" | "n") => {
    if (!pendingPromotion) return;
    makeMove(pendingPromotion.from, pendingPromotion.to, promo);
    setPendingPromotion(null);
  };

  // Configure players according to board orientation
  const topPlayer = boardOrientation === "white" ? blackPlayer : whitePlayer;
  const bottomPlayer = boardOrientation === "white" ? whitePlayer : blackPlayer;
  const topMs = boardOrientation === "white" ? blackMs : whiteMs;
  const bottomMs = boardOrientation === "white" ? whiteMs : blackMs;
  const topTurn = boardOrientation === "white" ? turn === "b" : turn === "w";
  const bottomTurn = boardOrientation === "white" ? turn === "w" : turn === "b";
  const topConnected = boardOrientation === "white" ? blackConnected : whiteConnected;
  const bottomConnected = boardOrientation === "white" ? whiteConnected : blackConnected;
  const topCaptured = boardOrientation === "white" ? blackCaptured : whiteCaptured;
  const bottomCaptured = boardOrientation === "white" ? whiteCaptured : blackCaptured;
  const topScore = boardOrientation === "white" ? blackScore : whiteScore;
  const bottomScore = boardOrientation === "white" ? whiteScore : blackScore;

  return (
    <div className="relative flex flex-col items-center justify-center w-full max-w-[620px] select-none">
      {/* Top Player Card */}
      <div className="w-full flex items-center justify-between px-3 py-2 bg-neutral-900/60 rounded-xl border border-neutral-800 mb-2">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-800 font-bold text-xs text-neutral-300">
              {topPlayer.name.charAt(0).toUpperCase()}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-neutral-950 ${
                topConnected ? "bg-emerald-500" : "bg-red-500 animate-ping"
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white max-w-[140px] truncate">
                {topPlayer.name}
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                ({Math.round(topPlayer.rating)})
              </span>
            </div>
            {/* Captured Pieces */}
            <div className="flex items-center gap-1 text-xs text-neutral-400 font-mono">
              <span>{topCaptured.map((p) => PIECE_SYMBOLS[p] || "").join("")}</span>
              {topScore > 0 && (
                <span className="text-[10px] font-bold text-emerald-400">+{topScore}</span>
              )}
            </div>
          </div>
        </div>

        {/* Top Clock */}
        <div
          className={`flex items-center justify-center px-4 py-1.5 rounded-xl font-mono text-lg font-bold tracking-wider border transition-all ${
            topTurn && status === "active"
              ? topMs < 20000
                ? "bg-red-950/80 border-red-500 text-red-400 animate-pulse"
                : "bg-neutral-800 border-emerald-500/50 text-white shadow-md shadow-emerald-500/10"
              : "bg-neutral-950/80 border-neutral-800 text-neutral-400"
          }`}
        >
          {formatTime(topMs)}
        </div>
      </div>

      {/* Chess Board Container */}
      <div className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-2xl border-2 border-neutral-800 bg-neutral-950">
        <Chessboard
          options={{
            position: fen,
            boardOrientation,
            showNotation: true,
            allowDragging: status === "active",
            onPieceDrop: handlePieceDrop,
            onSquareClick: handleSquareClick,
            squareStyles,
            lightSquareStyle: THEME_STYLES[boardTheme].light,
            darkSquareStyle: THEME_STYLES[boardTheme].dark,
            boardStyle: {
              borderRadius: "1rem",
            },
          }}
        />

        {/* Promotion Selector Overlay */}
        {pendingPromotion && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-2xl">
              <div className="text-center text-xs font-bold uppercase tracking-wider text-neutral-300 mb-3">
                Promote Pawn
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(["q", "r", "b", "n"] as const).map((promo) => (
                  <button
                    key={promo}
                    type="button"
                    onClick={() => selectPromotion(promo)}
                    className="flex h-14 w-14 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-800 text-3xl text-white hover:border-emerald-500 hover:bg-emerald-950/40 transition-all cursor-pointer"
                  >
                    {PIECE_SYMBOLS[promo]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Player Card */}
      <div className="w-full flex items-center justify-between px-3 py-2 bg-neutral-900/60 rounded-xl border border-neutral-800 mt-2">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-bold text-xs">
              {bottomPlayer.name.charAt(0).toUpperCase()}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-neutral-950 ${
                bottomConnected ? "bg-emerald-500" : "bg-red-500 animate-ping"
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white max-w-[140px] truncate">
                {bottomPlayer.name}
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                ({Math.round(bottomPlayer.rating)})
              </span>
            </div>
            {/* Captured Pieces */}
            <div className="flex items-center gap-1 text-xs text-neutral-400 font-mono">
              <span>{bottomCaptured.map((p) => PIECE_SYMBOLS[p] || "").join("")}</span>
              {bottomScore > 0 && (
                <span className="text-[10px] font-bold text-emerald-400">+{bottomScore}</span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Clock */}
        <div
          className={`flex items-center justify-center px-4 py-1.5 rounded-xl font-mono text-lg font-bold tracking-wider border transition-all ${
            bottomTurn && status === "active"
              ? bottomMs < 20000
                ? "bg-red-950/80 border-red-500 text-red-400 animate-pulse"
                : "bg-neutral-800 border-emerald-500/50 text-white shadow-md shadow-emerald-500/10"
              : "bg-neutral-950/80 border-neutral-800 text-neutral-400"
          }`}
        >
          {formatTime(bottomMs)}
        </div>
      </div>
    </div>
  );
};

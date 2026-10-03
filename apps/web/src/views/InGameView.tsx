import { getLegalMoves, isInCheck } from "@etchess/chess-core";
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Crown,
  Eye,
  Flag,
  Handshake,
  MessageSquare,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { type BoardTheme, useGameStore } from "../store/gameStore";

// Captured pieces helper
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

  const whiteCaptured: string[] = [];
  let whiteMaterial = 0;
  for (const piece of ["q", "r", "b", "n", "p"]) {
    const count = initialCounts[piece] || 0;
    for (let i = 0; i < count; i++) {
      whiteCaptured.push(piece);
      whiteMaterial += values[piece];
    }
  }

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

const PIECE_GLYPHS: Record<string, string> = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
  k: "♚",
};

function formatClockTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((Math.max(0, ms) % 1000) / 100);

  if (totalSeconds < 10) {
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}.${tenths}`;
  }
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

export const InGameView: React.FC = () => {
  const {
    fen,
    turn,
    playerColor,
    boardOrientation,
    boardTheme,
    lastMove,
    isCheck,
    status,
    mode,
    whitePlayer,
    blackPlayer,
    whiteMs,
    blackMs,
    moves,
    chatMessages,
    latencyMs,
    whiteConnected,
    blackConnected,
    drawOfferedBy,
    rematchOfferedBy,
    makeMove,
    resign,
    offerDraw,
    respondDraw,
    sendChatMessage,
    flipBoard,
    isSoundMuted,
    toggleSound,
    setActiveView,
    settings,
  } = useGameStore();

  const [activeTab, setActiveTab] = useState<"moves" | "chat">("moves");
  const [chatInput, setChatInput] = useState("");
  const [confirmResign, setConfirmResign] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const movesScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current && chatMessages.length > 0) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages.length]);

  // Auto-scroll moves
  useEffect(() => {
    if (movesScrollRef.current && moves.length > 0) {
      movesScrollRef.current.scrollTop = movesScrollRef.current.scrollHeight;
    }
  }, [moves.length]);

  // If game ends, user can click to see game over view or analysis
  useEffect(() => {
    if (status === "ended") {
      const timeout = setTimeout(() => {
        setActiveView("game_over");
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [status, setActiveView]);

  const isWhiteOrientation = boardOrientation === "white";
  const topPlayer = isWhiteOrientation ? blackPlayer : whitePlayer;
  const bottomPlayer = isWhiteOrientation ? whitePlayer : blackPlayer;
  const topClockMs = isWhiteOrientation ? blackMs : whiteMs;
  const bottomClockMs = isWhiteOrientation ? whiteMs : blackMs;
  const isTopTurn = isWhiteOrientation ? turn === "b" : turn === "w";
  const isBottomTurn = isWhiteOrientation ? turn === "w" : turn === "b";

  const { whiteCaptured, blackCaptured, whiteScore, blackScore } = useMemo(
    () => getCapturedPieces(fen),
    [fen],
  );

  const topCaptured = isWhiteOrientation ? blackCaptured : whiteCaptured;
  const bottomCaptured = isWhiteOrientation ? whiteCaptured : blackCaptured;
  const topScore = isWhiteOrientation ? blackScore : whiteScore;
  const bottomScore = isWhiteOrientation ? whiteScore : blackScore;

  // Legal moves for selected square
  const legalMovesForSquare = useMemo(() => {
    if (!selectedSquare) return [];
    return getLegalMoves(fen, selectedSquare);
  }, [fen, selectedSquare]);

  // Custom square styles
  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    if (lastMove) {
      styles[lastMove.from] = {
        backgroundColor: "rgba(0, 230, 153, 0.25)",
      };
      styles[lastMove.to] = {
        backgroundColor: "rgba(0, 230, 153, 0.4)",
      };
    }

    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: "rgba(0, 230, 153, 0.5)",
      };
    }

    for (const move of legalMovesForSquare) {
      if (move.captured) {
        styles[move.to] = {
          background: "radial-gradient(circle, transparent 60%, rgba(239, 68, 68, 0.7) 64%)",
          borderRadius: "50%",
        };
      } else {
        styles[move.to] = {
          background: "radial-gradient(circle, rgba(0, 230, 153, 0.8) 22%, transparent 24%)",
          borderRadius: "50%",
        };
      }
    }

    if (isCheck) {
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
                  "radial-gradient(circle, rgba(239, 68, 68, 0.95) 0%, rgba(239, 68, 68, 0.4) 65%, transparent 100%)",
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

    const success = makeMove(sourceSquare, targetSquare);
    if (success) {
      setSelectedSquare(null);
    }
    return success;
  };

  const handleSquareClick = ({ square }: { square: string }) => {
    if (pendingPromotion) return;

    if (!selectedSquare) {
      setSelectedSquare(square);
      return;
    }

    const targetSquare = square;
    const isPromotionRank =
      (turn === "w" && targetSquare[1] === "8") || (turn === "b" && targetSquare[1] === "1");

    const piecePlacement = fen.split(" ")[0];
    const fileIdx = selectedSquare.charCodeAt(0) - 97;
    const rankIdx = 8 - Number.parseInt(selectedSquare[1], 10);
    const rows = piecePlacement.split("/");
    let isPawn = false;
    if (rows[rankIdx]) {
      let col = 0;
      for (const char of rows[rankIdx]) {
        if (/\d/.test(char)) {
          col += Number.parseInt(char, 10);
        } else {
          if (col === fileIdx && (char === "P" || char === "p")) {
            isPawn = true;
            break;
          }
          col++;
        }
      }
    }

    if (isPawn && isPromotionRank) {
      setPendingPromotion({ from: selectedSquare, to: targetSquare });
      return;
    }

    const success = makeMove(selectedSquare, targetSquare);
    if (success) {
      setSelectedSquare(null);
    } else {
      setSelectedSquare(square);
    }
  };

  const handlePromotionSelect = (piece: "q" | "r" | "b" | "n") => {
    if (!pendingPromotion) return;
    makeMove(pendingPromotion.from, pendingPromotion.to, piece);
    setPendingPromotion(null);
    setSelectedSquare(null);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput.trim());
    setChatInput("");
  };

  // Move pairs
  const movePairs: { num: number; white: string; black?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  // Board themes mapping
  const boardColors = useMemo(() => {
    switch (settings.boardTheme || boardTheme) {
      case "wood":
        return { light: "#f0d9b5", dark: "#b58863" };
      case "blue":
        return { light: "#dee3e6", dark: "#386687" };
      case "dark":
        return { light: "#334155", dark: "#1e293b" };
      default:
        return { light: "#e2e8f0", dark: "#2d6a4f" };
    }
  }, [settings.boardTheme, boardTheme]);

  const opponentColor = playerColor === "white" ? "black" : "white";
  const opponentConnected = opponentColor === "white" ? whiteConnected : blackConnected;
  const isIncomingDraw = drawOfferedBy !== null && drawOfferedBy !== playerColor;

  return (
    <div className="flex h-full w-full flex-col lg:flex-row overflow-hidden bg-[#081214]">
      {/* Promotion Dialog Modal */}
      {pendingPromotion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="w-80 rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 shadow-2xl text-center">
            <h3 className="text-sm font-bold text-white mb-1">Promote Pawn</h3>
            <p className="text-xs text-[#8ba3a8] mb-4">Choose your new piece</p>
            <div className="grid grid-cols-4 gap-2">
              {(["q", "r", "b", "n"] as const).map((piece) => (
                <button
                  key={piece}
                  type="button"
                  onClick={() => handlePromotionSelect(piece)}
                  className="flex h-16 flex-col items-center justify-center rounded-xl border border-[#162e33] bg-[#0e1e22] text-3xl hover:border-[#00e699] hover:bg-[#00e699]/10 transition-colors"
                >
                  {PIECE_GLYPHS[piece]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Board Center Column */}
      <div className="flex flex-1 flex-col items-center justify-center p-2 sm:p-4 lg:p-6 overflow-y-auto">
        <div className="w-full max-w-[580px] flex flex-col gap-2">
          {/* Opponent Disconnect Banner */}
          {!opponentConnected && status === "active" && mode === "online" && (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 animate-pulse">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Opponent disconnected. 60s countdown to forfeit.</span>
            </div>
          )}

          {/* Incoming Draw Offer Banner */}
          {isIncomingDraw && status === "active" && (
            <div className="flex items-center justify-between rounded-xl border border-[#00e699]/40 bg-[#00e699]/10 p-2.5">
              <div className="flex items-center gap-2">
                <Handshake className="h-4 w-4 text-[#00e699]" />
                <span className="text-xs font-semibold text-white">Draw Offered by Opponent</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => respondDraw(true)}
                  className="flex items-center gap-1 rounded-lg bg-[#00e699] px-2.5 py-1 text-xs font-bold text-[#081214] hover:bg-[#00c885] transition-colors"
                >
                  <Check className="h-3 w-3" /> Accept
                </button>
                <button
                  type="button"
                  onClick={() => respondDraw(false)}
                  className="flex items-center gap-1 rounded-lg bg-[#14282c] px-2.5 py-1 text-xs font-medium text-neutral-300 hover:bg-[#1a3439] transition-colors"
                >
                  <X className="h-3 w-3" /> Decline
                </button>
              </div>
            </div>
          )}

          {/* Top Player (Opponent) Bar */}
          <div className="flex items-center justify-between rounded-xl border border-[#14282c] bg-[#0b171a] px-3 py-2 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0e1e22] border border-[#162e33] text-sm font-bold text-white">
                  {topPlayer.name.slice(0, 2).toUpperCase()}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b171a] ${
                    opponentConnected ? "bg-[#00e699]" : "bg-neutral-500"
                  }`}
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-white">{topPlayer.name}</span>
                  <span className="rounded bg-[#0e1e22] px-1.5 py-0.5 text-[10px] font-mono text-[#8ba3a8]">
                    {topPlayer.rating}
                  </span>
                </div>
                {/* Captured Pieces & Score */}
                <div className="flex items-center gap-1 text-[11px] text-[#8ba3a8]">
                  <div className="flex tracking-tight">
                    {topCaptured.map((p, idx) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: captured pieces list
                      <span key={idx}>{PIECE_GLYPHS[p]}</span>
                    ))}
                  </div>
                  {topScore > 0 && (
                    <span className="text-[10px] font-bold text-[#00e699]">+{topScore}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Opponent Clock */}
            <div
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-sm sm:text-base font-bold transition-all ${
                isTopTurn
                  ? topClockMs < 20000
                    ? "bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse"
                    : "bg-[#00e699]/15 text-[#00e699] border border-[#00e699]/30"
                  : "bg-[#0e1e22] text-[#8ba3a8] border border-[#14282c]"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>{formatClockTime(topClockMs)}</span>
            </div>
          </div>

          {/* Interactive Chess Board Container */}
          <div className="relative aspect-square w-full rounded-2xl border-2 border-[#14282c] overflow-hidden shadow-2xl bg-[#0b171a]">
            <Chessboard
              options={{
                position: fen,
                boardOrientation,
                showNotation: settings.coordinates,
                allowDragging: status === "active",
                onPieceDrop: handlePieceDrop,
                onSquareClick: handleSquareClick,
                squareStyles,
                lightSquareStyle: { backgroundColor: boardColors.light },
                darkSquareStyle: { backgroundColor: boardColors.dark },
                animationDurationInMs: settings.animations ? 200 : 0,
              }}
            />
          </div>

          {/* Bottom Player (You) Bar */}
          <div className="flex items-center justify-between rounded-xl border border-[#14282c] bg-[#0b171a] px-3 py-2 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00e699]/20 border border-[#00e699]/40 text-sm font-bold text-[#00e699]">
                  {bottomPlayer.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b171a] bg-[#00e699]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-white">
                    {bottomPlayer.name}
                  </span>
                  <span className="rounded bg-[#0e1e22] px-1.5 py-0.5 text-[10px] font-mono text-[#8ba3a8]">
                    {bottomPlayer.rating}
                  </span>
                </div>
                {/* Captured Pieces & Score */}
                <div className="flex items-center gap-1 text-[11px] text-[#8ba3a8]">
                  <div className="flex tracking-tight">
                    {bottomCaptured.map((p, idx) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: captured pieces list
                      <span key={idx}>{PIECE_GLYPHS[p]}</span>
                    ))}
                  </div>
                  {bottomScore > 0 && (
                    <span className="text-[10px] font-bold text-[#00e699]">+{bottomScore}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Clock */}
            <div
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-sm sm:text-base font-bold transition-all ${
                isBottomTurn
                  ? bottomClockMs < 20000
                    ? "bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse"
                    : "bg-[#00e699] text-[#081214] shadow-lg shadow-[#00e699]/20"
                  : "bg-[#0e1e22] text-[#8ba3a8] border border-[#14282c]"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>{formatClockTime(bottomClockMs)}</span>
            </div>
          </div>

          {/* Quick Mobile Action Buttons Bar */}
          <div className="flex lg:hidden items-center justify-between gap-1.5 pt-1">
            <button
              type="button"
              onClick={offerDraw}
              disabled={drawOfferedBy === playerColor || status !== "active"}
              className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-[#14282c] bg-[#0b171a] py-2 text-xs font-semibold text-neutral-300 disabled:opacity-40"
            >
              <Handshake className="h-3.5 w-3.5" />
              <span>Draw</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirmResign) {
                  resign();
                  setConfirmResign(false);
                } else {
                  setConfirmResign(true);
                }
              }}
              disabled={status !== "active"}
              className={`flex-1 flex items-center justify-center gap-1 rounded-xl border py-2 text-xs font-bold disabled:opacity-40 transition-colors ${
                confirmResign
                  ? "border-red-500 bg-red-600 text-white"
                  : "border-[#14282c] bg-[#0b171a] text-red-400"
              }`}
            >
              <Flag className="h-3.5 w-3.5" />
              <span>{confirmResign ? "Confirm" : "Resign"}</span>
            </button>
            <button
              type="button"
              onClick={flipBoard}
              className="flex items-center justify-center rounded-xl border border-[#14282c] bg-[#0b171a] px-3 py-2 text-neutral-300"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop In-Game Sidebar */}
      <div className="w-full lg:w-80 xl:w-96 flex flex-col border-t lg:border-t-0 lg:border-l border-[#14282c] bg-[#0b171a] h-72 lg:h-full">
        {/* Tab Header: Moves vs Chat */}
        <div className="flex border-b border-[#14282c] p-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("moves")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
              activeTab === "moves"
                ? "bg-[#0e1e22] text-[#00e699] border border-[#162e33]"
                : "text-[#8ba3a8] hover:text-white"
            }`}
          >
            <span>Moves ({moves.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
              activeTab === "chat"
                ? "bg-[#0e1e22] text-[#00e699] border border-[#162e33]"
                : "text-[#8ba3a8] hover:text-white"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Chat ({chatMessages.length})</span>
          </button>
        </div>

        {/* Tab 1: Moves History */}
        {activeTab === "moves" && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div
              ref={movesScrollRef}
              className="flex-1 overflow-y-auto p-3 font-mono text-xs select-none space-y-1"
            >
              {movePairs.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center text-center text-xs text-[#8ba3a8] italic">
                  <span>No moves yet</span>
                  <span className="text-[11px] text-[#5d7378] mt-1">Make a move to start</span>
                </div>
              ) : (
                movePairs.map((pair, idx) => {
                  const isCurrentWhite = moves.length === pair.num * 2 - 1;
                  const isCurrentBlack = moves.length === pair.num * 2;
                  return (
                    <div
                      key={pair.num}
                      className="grid grid-cols-12 rounded-lg px-2.5 py-1.5 hover:bg-[#0e1e22] transition-colors"
                    >
                      <span className="col-span-2 text-[#5d7378] font-semibold">{pair.num}.</span>
                      <span
                        className={`col-span-5 font-semibold px-1 rounded ${
                          isCurrentWhite ? "bg-[#00e699]/15 text-[#00e699]" : "text-neutral-200"
                        }`}
                      >
                        {pair.white}
                      </span>
                      <span
                        className={`col-span-5 font-semibold px-1 rounded ${
                          isCurrentBlack ? "bg-[#00e699]/15 text-[#00e699]" : "text-neutral-400"
                        }`}
                      >
                        {pair.black || ""}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Action Bar at the bottom of moves panel */}
            <div className="border-t border-[#14282c] p-3 space-y-2 bg-[#081214]/60">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={offerDraw}
                  disabled={drawOfferedBy === playerColor || status !== "active"}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[#14282c] bg-[#0e1e22] py-2.5 text-xs font-semibold text-neutral-300 hover:border-[#00e699]/30 hover:text-white transition-colors disabled:opacity-40"
                >
                  <Handshake className="h-3.5 w-3.5 text-[#00e699]" />
                  <span>{drawOfferedBy === playerColor ? "Draw Offered" : "Offer Draw"}</span>
                </button>

                {confirmResign ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        resign();
                        setConfirmResign(false);
                      }}
                      className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-500 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmResign(false)}
                      className="rounded-xl bg-[#14282c] px-2.5 py-2.5 text-xs text-neutral-400 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmResign(true)}
                    disabled={status !== "active"}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    <span>Resign</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-[#8ba3a8] pt-1">
                <button
                  type="button"
                  onClick={flipBoard}
                  className="flex items-center gap-1 text-[11px] text-[#8ba3a8] hover:text-[#00e699] transition-colors"
                >
                  <RotateCcw className="h-3 w-3" /> Flip Board
                </button>
                <button
                  type="button"
                  onClick={toggleSound}
                  className="flex items-center gap-1 text-[11px] text-[#8ba3a8] hover:text-[#00e699] transition-colors"
                >
                  {isSoundMuted ? (
                    <>
                      <VolumeX className="h-3 w-3 text-red-400" /> Sound Off
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3 w-3 text-[#00e699]" /> Sound On
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: In-Game Chat */}
        {activeTab === "chat" && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
              {chatMessages.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center text-center text-[#8ba3a8]">
                  <MessageSquare className="h-6 w-6 text-[#162e33] mb-2" />
                  <span>No messages yet.</span>
                  <span className="text-[11px] text-[#5d7378]">Say good luck!</span>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} className="rounded-lg bg-[#0e1e22] p-2 border border-[#14282c]">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-[10px] font-bold ${
                          msg.senderRole === "white"
                            ? "text-neutral-200"
                            : msg.senderRole === "black"
                              ? "text-[#8ba3a8]"
                              : "text-[#00e699]"
                        }`}
                      >
                        {msg.sender}
                      </span>
                      <span className="text-[9px] text-[#5d7378]">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-white text-xs leading-relaxed break-words">{msg.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Chat Input */}
            <form
              onSubmit={handleSendMessage}
              className="border-t border-[#14282c] p-2.5 flex gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Send a message..."
                maxLength={200}
                className="flex-1 rounded-xl border border-[#162e33] bg-[#0e1e22] px-3 py-2 text-xs text-white placeholder-[#5d7378] focus:border-[#00e699] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00e699] text-[#081214] font-bold disabled:opacity-40 hover:bg-[#00c885] transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

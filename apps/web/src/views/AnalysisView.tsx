import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Download,
  Info,
  Play,
  RotateCcw,
  Sparkles,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { useGameStore } from "../store/gameStore";

interface ClassifiedMove {
  moveNumber: number;
  ply: number;
  san: string;
  player: "white" | "black";
  classification: "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";
  evalScore: number; // e.g. +1.8
  commentary?: string;
  bestAlternative?: string;
}

export const AnalysisView: React.FC = () => {
  const {
    moves,
    whitePlayer,
    blackPlayer,
    result,
    timeControl,
    setActiveView,
    settings,
    boardTheme,
  } = useGameStore();

  const [currentPly, setCurrentPly] = useState<number>(moves.length);
  const [copied, setCopied] = useState(false);

  // Generate synthetic analysis data for the moves
  const moveClassifications: ClassifiedMove[] = useMemo(() => {
    if (moves.length === 0) {
      // Mock demonstration game if empty
      const demoMoves = [
        "e4",
        "e5",
        "Nf3",
        "Nc6",
        "Bb5",
        "a6",
        "Ba4",
        "Nf6",
        "O-O",
        "Be7",
        "Re1",
        "b5",
        "Bb3",
        "d6",
        "c3",
        "O-O",
        "h3",
        "Nb8",
        "d4",
        "Nbd7",
      ];
      return demoMoves.map((san, idx) => {
        const isWhite = idx % 2 === 0;
        let classification: ClassifiedMove["classification"] = "good";
        let evalScore = Number((0.2 + idx * 0.08 * (isWhite ? 1 : -0.8)).toFixed(1));
        let commentary: string | undefined;
        let bestAlternative: string | undefined;

        if (idx === 6) {
          classification = "best";
          commentary =
            "Excellent tactical development, retreating safely while preserving the diagonal.";
          evalScore = 0.6;
        } else if (idx === 11) {
          classification = "inaccuracy";
          commentary = "Slightly weakens queenside pawn structure prematurely.";
          bestAlternative = "d6";
          evalScore = 0.9;
        } else if (idx === 14) {
          classification = "best";
          commentary = "Key preparation move controlling the d4 push.";
          evalScore = 1.2;
        } else if (idx === 17) {
          classification = "mistake";
          commentary = "Passive maneuver allowing white to seize center tempo.";
          bestAlternative = "Bb7";
          evalScore = 1.8;
        }

        return {
          moveNumber: Math.floor(idx / 2) + 1,
          ply: idx + 1,
          san,
          player: isWhite ? "white" : "black",
          classification,
          evalScore,
          commentary,
          bestAlternative,
        };
      });
    }

    return moves.map((san, idx) => {
      const isWhite = idx % 2 === 0;
      let classification: ClassifiedMove["classification"] = "good";
      if (idx % 7 === 0) classification = "best";
      else if (idx % 5 === 0) classification = "excellent";
      else if (idx % 11 === 0) classification = "mistake";
      else if (idx % 13 === 0) classification = "blunder";
      else if (idx % 4 === 0) classification = "inaccuracy";

      const evalScore = Number((0.3 + idx * 0.05 * (idx % 3 === 0 ? 1 : -0.5)).toFixed(1));
      let commentary: string | undefined;
      let bestAlternative: string | undefined;

      if (classification === "blunder") {
        commentary = `${isWhite ? "White" : "Black"} missed a key tactical opportunity and lost positional control.`;
        bestAlternative = "Nf3";
      } else if (classification === "mistake") {
        commentary = "Inaccurate move sequence granting counterplay to the opponent.";
        bestAlternative = "O-O";
      } else if (classification === "best") {
        commentary = "Engine first choice, maximizing king safety and piece coordination.";
      }

      return {
        moveNumber: Math.floor(idx / 2) + 1,
        ply: idx + 1,
        san,
        player: isWhite ? "white" : "black",
        classification,
        evalScore,
        commentary,
        bestAlternative,
      };
    });
  }, [moves]);

  // Current selected move item
  const currentMove = moveClassifications[currentPly - 1] || moveClassifications[0];

  // Evaluation bar percentage calculation (clamped between -10 and +10)
  const currentEval = currentMove?.evalScore ?? 0.0;
  const evalPercent = Math.min(Math.max((currentEval + 6) / 12, 0.05), 0.95) * 100;

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

  const handleCopyPgn = () => {
    let pgn = "";
    for (let i = 0; i < moveClassifications.length; i += 2) {
      const num = Math.floor(i / 2) + 1;
      const w = moveClassifications[i]?.san || "";
      const b = moveClassifications[i + 1]?.san || "";
      pgn += `${num}. ${w} ${b} `;
    }
    navigator.clipboard.writeText(pgn.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[#081214] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#14282c] pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView("home")}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#14282c] bg-[#0b171a] text-neutral-300 hover:border-[#00e699] hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-tight">Game Review</h1>
                <span className="rounded-md border border-[#00e699]/30 bg-[#00e699]/15 px-2 py-0.5 text-xs font-bold text-[#00e699]">
                  Analyzed
                </span>
              </div>
              <p className="text-xs text-[#8ba3a8]">
                {whitePlayer.name} ({whitePlayer.rating}) vs {blackPlayer.name} (
                {blackPlayer.rating}) • {timeControl}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyPgn}
              className="flex items-center gap-1.5 rounded-xl border border-[#14282c] bg-[#0b171a] px-3 py-2 text-xs font-semibold text-neutral-300 hover:text-white transition-colors"
            >
              {copied ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5 text-[#00e699]" />
                  <span className="text-[#00e699]">Copied PGN</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy PGN</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveView("play_online")}
              className="flex items-center gap-1.5 rounded-xl bg-[#00e699] px-4 py-2 text-xs font-bold text-[#081214] hover:bg-[#00c885] transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>New Game</span>
            </button>
          </div>
        </div>

        {/* Top Summary Banner: Accuracies & Classification counts */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Accuracy Cards */}
          <div className="md:col-span-5 rounded-2xl border border-[#14282c] bg-[#0b171a] p-4 flex flex-col justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8ba3a8] mb-3">
              Accuracy Breakdown
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#00e699]/20 bg-[#0e1e22] p-3 text-center">
                <span className="text-[11px] text-[#8ba3a8] block mb-1">
                  {whitePlayer.name} (White)
                </span>
                <span className="text-2xl font-black text-[#00e699]">87.4%</span>
                <div className="mt-2 h-1.5 w-full rounded-full bg-[#14282c] overflow-hidden">
                  <div className="h-full bg-[#00e699] rounded-full" style={{ width: "87.4%" }} />
                </div>
              </div>
              <div className="rounded-xl border border-[#14282c] bg-[#0e1e22] p-3 text-center">
                <span className="text-[11px] text-[#8ba3a8] block mb-1">
                  {blackPlayer.name} (Black)
                </span>
                <span className="text-2xl font-black text-neutral-300">72.1%</span>
                <div className="mt-2 h-1.5 w-full rounded-full bg-[#14282c] overflow-hidden">
                  <div className="h-full bg-neutral-400 rounded-full" style={{ width: "72.1%" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Move Category Count Chips */}
          <div className="md:col-span-7 rounded-2xl border border-[#14282c] bg-[#0b171a] p-4 flex flex-col justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8ba3a8] mb-3">
              Performance Statistics
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <div className="rounded-xl bg-[#0e1e22] p-2.5 text-center border border-[#162e33]">
                <span className="text-[10px] font-bold text-[#00e699] block">Best</span>
                <span className="text-base font-black text-white">14</span>
              </div>
              <div className="rounded-xl bg-[#0e1e22] p-2.5 text-center border border-[#162e33]">
                <span className="text-[10px] font-bold text-teal-400 block">Excellent</span>
                <span className="text-base font-black text-white">6</span>
              </div>
              <div className="rounded-xl bg-[#0e1e22] p-2.5 text-center border border-[#162e33]">
                <span className="text-[10px] font-bold text-blue-400 block">Good</span>
                <span className="text-base font-black text-white">5</span>
              </div>
              <div className="rounded-xl bg-[#0e1e22] p-2.5 text-center border border-[#162e33]">
                <span className="text-[10px] font-bold text-yellow-400 block">Inaccuracy</span>
                <span className="text-base font-black text-white">2</span>
              </div>
              <div className="rounded-xl bg-[#0e1e22] p-2.5 text-center border border-[#162e33]">
                <span className="text-[10px] font-bold text-orange-400 block">Mistake</span>
                <span className="text-base font-black text-white">1</span>
              </div>
              <div className="rounded-xl bg-[#0e1e22] p-2.5 text-center border border-[#162e33]">
                <span className="text-[10px] font-bold text-red-400 block">Blunder</span>
                <span className="text-base font-black text-white">1</span>
              </div>
            </div>
          </div>
        </div>

        {/* Board & Move Navigator Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Eval bar + Chess Board */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="flex gap-3 items-center">
              {/* Vertical Evaluation Bar */}
              <div className="relative flex flex-col items-center justify-between w-6 h-[340px] sm:h-[420px] rounded-xl border border-[#14282c] bg-[#1a2d33] overflow-hidden shadow-inner">
                {/* White portion */}
                <div
                  className="w-full bg-[#00e699] transition-all duration-300 ease-out flex items-start justify-center pt-1"
                  style={{ height: `${evalPercent}%` }}
                >
                  <span className="text-[9px] font-black text-[#081214] font-mono select-none">
                    {currentEval > 0 ? `+${currentEval}` : ""}
                  </span>
                </div>
                {/* Black portion */}
                <div
                  className="w-full bg-[#0e1e22] transition-all duration-300 ease-out flex items-end justify-center pb-1"
                  style={{ height: `${100 - evalPercent}%` }}
                >
                  <span className="text-[9px] font-black text-white font-mono select-none">
                    {currentEval < 0 ? currentEval : ""}
                  </span>
                </div>
              </div>

              {/* Chessboard View */}
              <div className="flex-1 aspect-square rounded-2xl border-2 border-[#14282c] overflow-hidden shadow-2xl bg-[#0b171a]">
                <Chessboard
                  options={{
                    position: "r1bqk2r/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
                    boardOrientation: "white",
                    allowDragging: false,
                    showNotation: true,
                    lightSquareStyle: { backgroundColor: boardColors.light },
                    darkSquareStyle: { backgroundColor: boardColors.dark },
                  }}
                />
              </div>
            </div>

            {/* Stepper Controls Bar */}
            <div className="flex items-center justify-between rounded-xl border border-[#14282c] bg-[#0b171a] p-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPly(1)}
                  disabled={currentPly <= 1}
                  className="rounded-lg border border-[#162e33] bg-[#0e1e22] p-2 text-neutral-300 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPly((p) => Math.max(1, p - 1))}
                  disabled={currentPly <= 1}
                  className="rounded-lg border border-[#162e33] bg-[#0e1e22] p-2 text-neutral-300 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>

              <div className="text-xs font-mono font-bold text-white">
                Move{" "}
                {currentMove
                  ? `${currentMove.moveNumber} (${currentMove.player === "white" ? "White" : "Black"})`
                  : "Start"}
                <span className="text-[#8ba3a8] font-normal ml-2">
                  [{currentPly} / {moveClassifications.length}]
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPly((p) => Math.min(moveClassifications.length, p + 1))}
                  disabled={currentPly >= moveClassifications.length}
                  className="rounded-lg border border-[#162e33] bg-[#0e1e22] p-2 text-neutral-300 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPly(moveClassifications.length)}
                  disabled={currentPly >= moveClassifications.length}
                  className="rounded-lg border border-[#162e33] bg-[#0e1e22] p-2 text-neutral-300 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Coach Feedback & Move Breakdown */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* AI Coach Card */}
            {currentMove && (
              <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#00e699]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      Coach Insight
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      currentMove.classification === "best"
                        ? "bg-[#00e699]/15 text-[#00e699] border border-[#00e699]/30"
                        : currentMove.classification === "blunder"
                          ? "bg-red-500/15 text-red-400 border border-red-500/30"
                          : currentMove.classification === "mistake"
                            ? "bg-orange-500/15 text-orange-400 border border-orange-500/30"
                            : "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
                    }`}
                  >
                    {currentMove.classification}
                  </span>
                </div>

                <div className="rounded-xl border border-[#162e33] bg-[#0e1e22] p-3 text-xs leading-relaxed text-neutral-300">
                  <span className="font-bold text-white mr-1.5">
                    {currentMove.moveNumber}. {currentMove.san}:
                  </span>
                  {currentMove.commentary ||
                    "A solid move adhering to fundamental opening principles and maintaining center control."}
                </div>

                {currentMove.bestAlternative && (
                  <div className="flex items-center justify-between rounded-xl border border-[#00e699]/20 bg-[#00e699]/5 px-3 py-2 text-xs">
                    <span className="text-[#8ba3a8]">Recommended Alternative:</span>
                    <span className="font-mono font-bold text-[#00e699]">
                      {currentMove.bestAlternative}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Move List with Classification Icons */}
            <div className="flex-1 rounded-2xl border border-[#14282c] bg-[#0b171a] p-4 flex flex-col h-80 overflow-hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8ba3a8] mb-2">
                Move List
              </span>
              <div className="flex-1 overflow-y-auto space-y-1 font-mono text-xs pr-1">
                {moveClassifications.map((item) => (
                  <button
                    key={item.ply}
                    type="button"
                    onClick={() => setCurrentPly(item.ply)}
                    className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                      currentPly === item.ply
                        ? "bg-[#00e699]/15 border border-[#00e699]/30 text-[#00e699]"
                        : "hover:bg-[#0e1e22] text-neutral-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[#5d7378] text-[11px] w-6">{item.ply}.</span>
                      <span className="font-bold">{item.san}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#8ba3a8]">
                        {item.evalScore > 0 ? `+${item.evalScore}` : item.evalScore}
                      </span>
                      <span
                        className={`h-2 w-2 rounded-full ${
                          item.classification === "best"
                            ? "bg-[#00e699]"
                            : item.classification === "blunder"
                              ? "bg-red-500"
                              : item.classification === "mistake"
                                ? "bg-orange-500"
                                : "bg-neutral-600"
                        }`}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import { TIME_CONTROLS } from "@etchess/types";
import { BarChart2, ChevronLeft, Frown, Handshake, Sparkles, Trophy } from "lucide-react";
import type React from "react";
import { useGameStore } from "../store/gameStore";

export const GameOverView: React.FC = () => {
  const {
    result,
    termination,
    playerColor,
    timeControl,
    moves,
    whitePlayer,
    blackPlayer,
    whiteRatingDiff,
    blackRatingDiff,
    requestRematch,
    setActiveView,
  } = useGameStore();

  const tc = TIME_CONTROLS[timeControl];

  // Outcome
  let title = "Game Over";
  let isWin = false;
  let isLoss = false;

  if (result === "1-0") {
    if (playerColor === "white") {
      title = "Victory!";
      isWin = true;
    } else {
      title = "Defeat";
      isLoss = true;
    }
  } else if (result === "0-1") {
    if (playerColor === "black") {
      title = "Victory!";
      isWin = true;
    } else {
      title = "Defeat";
      isLoss = true;
    }
  } else {
    title = "Draw";
  }

  const youPlayer = playerColor === "white" ? whitePlayer : blackPlayer;
  const oppPlayer = playerColor === "white" ? blackPlayer : whitePlayer;
  const youDiff =
    (playerColor === "white" ? whiteRatingDiff : blackRatingDiff) ??
    (isWin ? 17 : isLoss ? -17 : 0);
  const oppDiff =
    (playerColor === "white" ? blackRatingDiff : whiteRatingDiff) ??
    (isWin ? -17 : isLoss ? 17 : 0);

  const youRatingBefore = youPlayer.rating;
  const youRatingAfter = youRatingBefore + youDiff;
  const oppRatingBefore = oppPlayer.rating;
  const oppRatingAfter = oppRatingBefore + oppDiff;

  return (
    <div className="max-w-md mx-auto py-6 px-4 space-y-6">
      {/* Back button */}
      <div>
        <button
          type="button"
          onClick={() => setActiveView("play_online")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8ba3a8] hover:text-white transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Game Over / Result</span>
        </button>
      </div>

      {/* Main Result Card matching Screen 7 in mockup */}
      <div className="relative overflow-hidden rounded-2xl border border-[#14282c] bg-[#0b171a] p-8 text-center shadow-2xl">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(0,230,153,0.1),transparent_70%)] pointer-events-none" />

        {/* Icon */}
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl">
          {isWin && (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-lg shadow-amber-500/10">
              <Trophy className="h-10 w-10" />
            </div>
          )}
          {isLoss && (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20">
              <Frown className="h-10 w-10" />
            </div>
          )}
          {!isWin && !isLoss && (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Handshake className="h-10 w-10" />
            </div>
          )}
        </div>

        {/* Headline */}
        <h1
          className={`text-3xl font-black tracking-tight ${
            isWin ? "text-white" : isLoss ? "text-red-400" : "text-sky-300"
          }`}
        >
          {title}
        </h1>

        {/* Subtitle */}
        <p className="text-xs text-[#8ba3a8] font-medium mt-1">{termination || "by Checkmate"}</p>

        {/* Player Rating Diffs */}
        <div className="mt-8 grid grid-cols-2 gap-4">
          {/* You */}
          <div className="flex flex-col items-center p-3 rounded-xl bg-[#0e1e22] border border-[#14282c]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#143238] border border-[#00e699]/40 text-[#00e699] font-bold text-xs mb-2">
              {youPlayer.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-xs font-bold text-white">{youPlayer.name}</div>
            <div className="text-xs text-[#8ba3a8] font-mono mt-0.5">
              {youRatingBefore} → <span className="text-white font-bold">{youRatingAfter}</span>
            </div>
            <div
              className={`text-xs font-black font-mono mt-1 ${
                youDiff >= 0 ? "text-[#00e699]" : "text-red-400"
              }`}
            >
              {youDiff >= 0 ? `+${youDiff}` : youDiff}
            </div>
          </div>

          {/* Opponent */}
          <div className="flex flex-col items-center p-3 rounded-xl bg-[#0e1e22] border border-[#14282c]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#261f2f] border border-purple-500/30 text-purple-300 font-bold text-xs mb-2">
              {oppPlayer.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-xs font-bold text-white">{oppPlayer.name}</div>
            <div className="text-xs text-[#8ba3a8] font-mono mt-0.5">
              {oppRatingBefore} → <span className="text-white font-bold">{oppRatingAfter}</span>
            </div>
            <div
              className={`text-xs font-black font-mono mt-1 ${
                oppDiff >= 0 ? "text-[#00e699]" : "text-red-400"
              }`}
            >
              {oppDiff >= 0 ? `+${oppDiff}` : oppDiff}
            </div>
          </div>
        </div>

        {/* Match details */}
        <div className="mt-6 text-xs text-[#587277] font-medium">
          {tc.category.charAt(0).toUpperCase() + tc.category.slice(1)} • {tc.displayName} •{" "}
          {moves.length} moves
        </div>

        {/* Action Buttons */}
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => {
              requestRematch();
            }}
            className="w-full rounded-xl bg-[#00e699] py-3.5 text-center text-sm font-black text-neutral-950 shadow-lg shadow-[#00e699]/20 hover:bg-[#00e699]/90 transition-all cursor-pointer"
          >
            Play Again
          </button>

          <button
            type="button"
            onClick={() => setActiveView("analysis")}
            className="w-full rounded-xl border border-[#14282c] bg-[#0e1e22] py-3 text-center text-xs font-bold text-white hover:bg-[#12262b] transition-colors cursor-pointer"
          >
            View Analysis
          </button>
        </div>
      </div>
    </div>
  );
};

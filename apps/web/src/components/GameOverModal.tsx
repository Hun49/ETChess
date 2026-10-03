import { Eye, Frown, Handshake, Plus, Share2, Sparkles, Trophy } from "lucide-react";
import type React from "react";
import { useGameStore } from "../store/gameStore";

export const GameOverModal: React.FC = () => {
  const {
    activeModal,
    closeModal,
    result,
    termination,
    playerColor,
    mode,
    whiteRatingDiff,
    blackRatingDiff,
    requestRematch,
    rematchOfferedBy,
    openModal,
  } = useGameStore();

  if (activeModal !== "game_over") return null;

  // Determine user outcome
  let title = "Game Ended";
  let outcomeType: "win" | "loss" | "draw" = "draw";

  if (result === "1-0") {
    if (playerColor === "white") {
      title = "Victory!";
      outcomeType = "win";
    } else {
      title = "Defeat";
      outcomeType = "loss";
    }
  } else if (result === "0-1") {
    if (playerColor === "black") {
      title = "Victory!";
      outcomeType = "win";
    } else {
      title = "Defeat";
      outcomeType = "loss";
    }
  } else if (result === "1/2-1/2") {
    title = "Draw";
    outcomeType = "draw";
  }

  const ratingDiff = playerColor === "white" ? whiteRatingDiff : blackRatingDiff;

  return (
    <dialog
      open
      aria-labelledby="game-over-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/85 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 border-none w-full h-full max-w-none max-h-none m-0"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 p-8 text-center shadow-2xl">
        {/* Outcome Icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg">
          {outcomeType === "win" && (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Trophy className="h-8 w-8" />
            </div>
          )}
          {outcomeType === "loss" && (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30">
              <Frown className="h-8 w-8" />
            </div>
          )}
          {outcomeType === "draw" && (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Handshake className="h-8 w-8" />
            </div>
          )}
        </div>

        {/* Title */}
        <h2
          id="game-over-title"
          className={`text-2xl font-black tracking-tight ${
            outcomeType === "win"
              ? "text-amber-400"
              : outcomeType === "loss"
                ? "text-red-400"
                : "text-sky-400"
          }`}
        >
          {title}
        </h2>

        {/* Termination Reason */}
        <p className="mt-1 text-xs text-neutral-300 font-medium">
          {termination || "Game completed"}
        </p>

        {/* Result score badge */}
        <div className="mt-3 inline-flex items-center rounded-lg bg-neutral-950 px-3 py-1 font-mono text-sm font-bold text-neutral-200 border border-neutral-800">
          {result}
        </div>

        {/* Rating Diff (for rated online games) */}
        {mode === "online" && ratingDiff !== undefined && (
          <div className="mt-3 text-xs font-semibold">
            {ratingDiff >= 0 ? (
              <span className="text-emerald-400">+{ratingDiff} Rating</span>
            ) : (
              <span className="text-red-400">{ratingDiff} Rating</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={() => {
              closeModal();
              requestRematch();
            }}
            disabled={rematchOfferedBy === playerColor}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:from-emerald-500 hover:to-teal-400 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            <span>{rematchOfferedBy === playerColor ? "Rematch Sent" : "Rematch"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              closeModal();
              openModal("play");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800 py-2.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Game</span>
          </button>

          <button
            type="button"
            onClick={closeModal}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-medium text-neutral-400 hover:text-white transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Review Board</span>
          </button>
        </div>
      </div>
    </dialog>
  );
};

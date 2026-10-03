import { TIME_CONTROLS } from "@etchess/types";
import { Loader2, X, Zap } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";

export const MatchmakingModal: React.FC = () => {
  const { mode, timeControl, rated, leaveMatchmaking } = useGameStore();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (mode !== "matchmaking") {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [mode]);

  if (mode !== "matchmaking") return null;

  const tc = TIME_CONTROLS[timeControl];
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

  return (
    <dialog
      open
      aria-labelledby="matchmaking-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/85 backdrop-blur-md animate-in fade-in duration-200 border-none w-full h-full max-w-none max-h-none m-0"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 p-8 text-center shadow-2xl">
        {/* Pulsing Radar Rings Animation */}
        <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
          <div className="absolute h-full w-full animate-ping rounded-full bg-emerald-500/10 duration-1000" />
          <div className="absolute h-18 w-18 animate-pulse rounded-full bg-emerald-500/20" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 shadow-lg shadow-emerald-500/30 text-white">
            <Zap className="h-6 w-6" />
          </div>
        </div>

        <h2 id="matchmaking-title" className="text-lg font-bold text-white tracking-tight">
          Searching for Opponent...
        </h2>
        <p className="mt-1 text-xs text-neutral-400">Matchmaker DO queueing on Cloudflare edge</p>

        {/* Selected parameters */}
        <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-2 border border-neutral-800 text-xs">
          <span className="font-semibold text-white">{tc.displayName}</span>
          <span className="text-neutral-500">•</span>
          <span className="text-neutral-400 uppercase tracking-wider">{tc.category}</span>
          <span className="text-neutral-500">•</span>
          <span className="text-emerald-400 font-medium">{rated ? "Rated" : "Casual"}</span>
        </div>

        {/* Elapsed Timer */}
        <div className="mt-5 text-2xl font-mono font-bold text-neutral-200">{timeFormatted}</div>

        {/* Cancel Button */}
        <div className="mt-6">
          <button
            type="button"
            onClick={leaveMatchmaking}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-800 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors cursor-pointer"
          >
            Cancel Queue
          </button>
        </div>
      </div>
    </dialog>
  );
};

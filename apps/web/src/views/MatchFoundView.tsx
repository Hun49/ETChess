import { TIME_CONTROLS } from "@etchess/types";
import { Swords } from "lucide-react";
import type React from "react";
import { useGameStore } from "../store/gameStore";

export const MatchFoundView: React.FC = () => {
  const { timeControl, matchFoundCountdown, whitePlayer, blackPlayer, setActiveView } =
    useGameStore();

  const tc = TIME_CONTROLS[timeControl];

  return (
    <div className="max-w-md mx-auto py-12 px-4 text-center space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Match Found!</h1>
        <p className="text-xs text-[#8ba3a8] font-medium mt-1">
          {tc.category.charAt(0).toUpperCase() + tc.category.slice(1)} • {tc.displayName}
        </p>
      </div>

      {/* Players Facing Off */}
      <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-6 shadow-xl">
        <div className="flex items-center justify-around">
          {/* You */}
          <div className="flex flex-col items-center space-y-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#143238] border-2 border-[#00e699] text-[#00e699] text-xl font-black shadow-lg shadow-[#00e699]/15">
              {whitePlayer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-bold text-white">{whitePlayer.name}</div>
              <div className="text-xs text-[#8ba3a8] font-mono">
                {Math.round(whitePlayer.rating)}
              </div>
            </div>
          </div>

          {/* VS Icon */}
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0e1e22] text-[#00e699] border border-[#14282c]">
            <Swords className="h-5 w-5" />
          </div>

          {/* Opponent */}
          <div className="flex flex-col items-center space-y-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#261f2f] border-2 border-purple-500/50 text-purple-300 text-xl font-black shadow-lg">
              {blackPlayer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-bold text-white">{blackPlayer.name}</div>
              <div className="text-xs text-[#8ba3a8] font-mono">
                {Math.round(blackPlayer.rating)}
              </div>
            </div>
          </div>
        </div>

        {/* Countdown Ring */}
        <div className="mt-8 flex flex-col items-center justify-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#00e699] bg-[#081214] text-3xl font-black text-white font-mono shadow-xl shadow-[#00e699]/20 animate-pulse">
            {matchFoundCountdown}
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-[#587277] font-mono">
            <span className={matchFoundCountdown === 3 ? "text-[#00e699] font-bold" : ""}>3</span>
            <span>•</span>
            <span className={matchFoundCountdown === 2 ? "text-[#00e699] font-bold" : ""}>2</span>
            <span>•</span>
            <span className={matchFoundCountdown === 1 ? "text-[#00e699] font-bold" : ""}>1</span>
          </div>
        </div>
      </div>

      {/* Start Button */}
      <div>
        <button
          type="button"
          onClick={() => setActiveView("game")}
          className="w-full rounded-xl bg-[#00e699] py-3.5 text-center text-sm font-black text-neutral-950 shadow-lg shadow-[#00e699]/20 hover:bg-[#00e699]/90 transition-all cursor-pointer"
        >
          Start Game
        </button>
      </div>
    </div>
  );
};

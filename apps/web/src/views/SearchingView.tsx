import { TIME_CONTROLS } from "@etchess/types";
import type React from "react";
import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";

export const SearchingView: React.FC = () => {
  const { timeControl, leaveMatchmaking, whitePlayer } = useGameStore();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const tc = TIME_CONTROLS[timeControl];
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

  return (
    <div className="max-w-md mx-auto py-12 px-4 text-center space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
          Searching for opponent...
        </h1>
        <p className="text-xs text-[#8ba3a8] font-medium mt-1">
          {tc.category.charAt(0).toUpperCase() + tc.category.slice(1)} • {tc.displayName}
        </p>
      </div>

      {/* Pulsing Knight Radar Visual matching mockup */}
      <div className="relative mx-auto flex h-48 w-48 items-center justify-center">
        {/* Outer concentric rings */}
        <div className="absolute h-48 w-48 rounded-full border border-[#00e699]/15 animate-ping duration-1000" />
        <div className="absolute h-40 w-40 rounded-full border border-[#00e699]/25 animate-pulse" />
        <div className="absolute h-32 w-32 rounded-full border border-[#00e699]/40" />

        {/* Center glowing knight circle */}
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[#0a2024] border-2 border-[#00e699] text-[#00e699] shadow-xl shadow-[#00e699]/25">
          <svg
            className="w-10 h-10 fill-current"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>Radar Knight</title>
            <path d="M19 22H5v-2h14v2zm-2.5-4H7.5l.5-4h8l.5 4zm-4.5-6h-2V7h2v5zm4-6H8V4h8v2z" />
          </svg>
        </div>
      </div>

      {/* Wait time and elapsed */}
      <div className="space-y-1">
        <div className="text-xs text-[#8ba3a8]">Estimated wait time: 0:45</div>
        <div className="font-mono text-sm text-[#00e699] font-bold">Elapsed: {timeFormatted}</div>
      </div>

      {/* Cancel Button */}
      <div>
        <button
          type="button"
          onClick={leaveMatchmaking}
          className="w-full max-w-xs mx-auto rounded-xl border border-[#14282c] bg-[#0e1e22] py-3 text-xs font-bold text-[#8ba3a8] hover:text-white hover:border-[#1a383e] transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>

      {/* Your Rating Card at bottom */}
      <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-4 text-center max-w-xs mx-auto">
        <div className="text-[11px] text-[#587277]">Your rating</div>
        <div className="text-lg font-black text-white font-mono mt-0.5">
          {Math.round(whitePlayer.rating || 1567)}
        </div>
      </div>
    </div>
  );
};

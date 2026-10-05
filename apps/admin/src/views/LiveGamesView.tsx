import { AlertTriangle, Eye, Radio, RefreshCw } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { getLiveGames, terminateGame } from "../api.js";
import type { LiveGameItem } from "../types.js";

interface LiveGamesViewProps {
  onInspectGame: (game: LiveGameItem) => void;
}

export const LiveGamesView: React.FC<LiveGamesViewProps> = ({ onInspectGame }) => {
  const [games, setGames] = useState<LiveGameItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [terminateReason, setTerminateReason] = useState("");

  const refreshGames = async () => {
    setLoading(true);
    try {
      const live = await getLiveGames();
      setGames(live);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshGames();
    const interval = setInterval(refreshGames, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTerminate = async (gameId: string) => {
    if (!terminateReason.trim()) return;
    try {
      await terminateGame(gameId, terminateReason);
      setTerminatingId(null);
      setTerminateReason("");
      refreshGames();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6 max-w-[1600px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Live Games Monitor
            </h2>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              {games.length} Live
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Realtime authoritative inspection and moderation of in-progress games across all Durable
            Objects.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshGames}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#121c26] border border-[#1e2d3d] hover:border-emerald-500/30 text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Grid of Live Games */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {games.map((g) => {
          const elapsedSec = Math.max(0, Math.floor((Date.now() - g.startedAt) / 1000));
          const elapsedMin = Math.floor(elapsedSec / 60);

          return (
            <div
              key={g.id}
              className="bg-[#121c26] border border-[#1e2d3d] hover:border-emerald-500/30 rounded-2xl p-5 flex flex-col justify-between shadow-sm transition-all"
            >
              <div>
                {/* Card Top */}
                <div className="flex items-center justify-between pb-3 border-b border-[#1a2634]">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span className="font-mono text-xs font-semibold text-slate-300">{g.id}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-[#0d1520] border border-[#1e2d3d] text-[10px] font-semibold text-slate-300">
                    {g.category.toUpperCase()} • {g.timeControl} {g.rated ? "(Rated)" : "(Casual)"}
                  </span>
                </div>

                {/* Players */}
                <div className="my-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-400" />
                      <span className="font-semibold text-white">{g.whiteName}</span>
                    </div>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {g.whiteRating}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-600" />
                      <span className="font-semibold text-white">{g.blackName}</span>
                    </div>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {g.blackRating}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex justify-between items-center bg-[#0d1520] p-2.5 rounded-xl border border-[#1e2d3d] text-[11px] text-slate-400">
                  <span>
                    Current Ply: <strong className="text-white font-mono">{g.plyCount}</strong>
                  </span>
                  <span>
                    Duration:{" "}
                    <strong className="text-white font-mono">
                      {elapsedMin}m {elapsedSec % 60}s
                    </strong>
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 pt-3 border-t border-[#1a2634] flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onInspectGame(g)}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  <span>Inspect Board</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTerminatingId(g.id)}
                  title="Terminate Game"
                  className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                </button>
              </div>

              {/* In-Card Terminate Confirmation */}
              {terminatingId === g.id && (
                <div className="mt-3 p-3 rounded-xl bg-[#0d1520] border border-rose-500/40 space-y-2 animate-in fade-in duration-150">
                  <p className="text-[10px] text-rose-400 font-semibold">
                    Terminate & abort match without rating changes:
                  </p>
                  <input
                    type="text"
                    placeholder="Reason (e.g. Engine assist / Griefing)..."
                    value={terminateReason}
                    onChange={(e) => setTerminateReason(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#121c26] border border-[#233549] rounded-lg text-xs text-white placeholder-slate-500 outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleTerminate(g.id)}
                      disabled={!terminateReason.trim()}
                      className="flex-1 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTerminatingId(null);
                        setTerminateReason("");
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#1a2634] text-slate-300 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

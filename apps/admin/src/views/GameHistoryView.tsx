import { Download, Eye, History, Search } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { getRecentGames } from "../api.js";
import type { RecentGameItem } from "../types.js";

interface GameHistoryViewProps {
  onInspectGame: (game: RecentGameItem) => void;
}

export const GameHistoryView: React.FC<GameHistoryViewProps> = ({ onInspectGame }) => {
  const [games, setGames] = useState<RecentGameItem[]>([]);
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState("all");

  useEffect(() => {
    getRecentGames().then(setGames);
  }, []);

  const filteredGames = games.filter((g) => {
    const matchesQuery =
      g.id.toLowerCase().includes(query.toLowerCase()) ||
      g.whiteName.toLowerCase().includes(query.toLowerCase()) ||
      g.blackName.toLowerCase().includes(query.toLowerCase());
    const matchesMode = modeFilter === "all" || g.mode.toLowerCase() === modeFilter.toLowerCase();
    return matchesQuery && matchesMode;
  });

  const handleDownloadPgn = (e: React.MouseEvent, game: RecentGameItem) => {
    e.stopPropagation();
    const pgnContent =
      game.pgn ||
      `[Event "ET-Chess ${game.mode}"]\n[White "${game.whiteName}"]\n[Black "${game.blackName}"]\n[Result "${game.result}"]\n[Termination "${game.termination}"]\n\n1. e4 e5 2. Nf3 Nc6 *`;
    const blob = new Blob([pgnContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${game.id.replace("#", "")}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 p-6 space-y-6 max-w-[1600px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Game History & Archives
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit completed platform matches, review PGNs, inspect move lists, and export games.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by player or ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-[#121c26] border border-[#1e2d3d] rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/50 w-56 shadow-inner"
            />
          </div>

          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="px-3 py-2 bg-[#121c26] border border-[#1e2d3d] rounded-xl text-xs text-slate-300 outline-none focus:border-emerald-500/50"
          >
            <option value="all">All Modes</option>
            <option value="online">Online</option>
            <option value="friend">Friend</option>
            <option value="computer">Computer</option>
            <option value="local">Local</option>
          </select>
        </div>
      </div>

      {/* Games Table */}
      <div className="bg-[#121c26] border border-[#1e2d3d] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1a2634] text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-[#0d1520]/50">
                <th className="py-3 pl-4">Game ID</th>
                <th className="py-3">White Player</th>
                <th className="py-3">Black Player</th>
                <th className="py-3">Mode</th>
                <th className="py-3">Time Control</th>
                <th className="py-3 text-center">Result</th>
                <th className="py-3 text-center">Rating Δ</th>
                <th className="py-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a2634]/60">
              {filteredGames.map((g) => (
                <tr
                  key={g.id}
                  onClick={() => onInspectGame(g)}
                  className="hover:bg-[#162230] transition-colors cursor-pointer group"
                >
                  <td className="py-3 pl-4 font-mono font-semibold text-slate-300 group-hover:text-emerald-400 transition-colors">
                    {g.id}
                  </td>
                  <td className="py-3 font-semibold text-white">{g.whiteName}</td>
                  <td className="py-3 font-semibold text-white">{g.blackName}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-md bg-[#0d1520] border border-[#1e2d3d] text-[10px] font-medium text-slate-300">
                      {g.mode}
                    </span>
                  </td>
                  <td className="py-3 text-slate-300 font-medium">{g.timeControl}</td>
                  <td className="py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        g.result === "1-0"
                          ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                          : g.result === "0-1"
                            ? "bg-rose-500/15 border border-rose-500/30 text-rose-400"
                            : "bg-slate-500/15 border border-slate-500/30 text-slate-400"
                      }`}
                    >
                      {g.result}
                    </span>
                  </td>
                  <td className="py-3 text-center font-mono font-semibold">
                    {g.ratingChange > 0 ? (
                      <span className="text-emerald-400">+{g.ratingChange}</span>
                    ) : g.ratingChange < 0 ? (
                      <span className="text-rose-400">{g.ratingChange}</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="py-3 text-right pr-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleDownloadPgn(e, g)}
                        title="Download PGN"
                        className="p-1.5 rounded-lg bg-[#0d1520] border border-[#1e2d3d] hover:border-emerald-500/40 text-slate-400 hover:text-emerald-400 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onInspectGame(g)}
                        title="Inspect Board"
                        className="p-1.5 rounded-lg bg-[#0d1520] border border-[#1e2d3d] hover:border-emerald-500/40 text-slate-400 hover:text-emerald-400 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import type React from "react";
import type { RecentGameItem } from "../types.js";

interface RecentGamesTableProps {
  games: RecentGameItem[];
  onSelectGame: (game: RecentGameItem) => void;
  onViewAll: () => void;
}

export const RecentGamesTable: React.FC<RecentGamesTableProps> = ({
  games,
  onSelectGame,
  onViewAll,
}) => {
  return (
    <div className="bg-[#121c26] border border-[#1e2d3d] rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">Recent Games</h3>
          <p className="text-xs text-slate-400 mt-0.5">Latest finished games</p>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          View All
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#1a2634] text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="pb-3 pl-2">ID</th>
              <th className="pb-3">Players</th>
              <th className="pb-3">Mode</th>
              <th className="pb-3">Time Control</th>
              <th className="pb-3 text-center">Result</th>
              <th className="pb-3 text-center">Rating Change</th>
              <th className="pb-3 text-right pr-2">Finished At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a2634]/60">
            {games.map((g) => {
              const isWin = g.result === "1-0";
              const isLoss = g.result === "0-1";
              const isDraw = g.result === "1/2-1/2";

              return (
                <tr
                  key={g.id}
                  onClick={() => onSelectGame(g)}
                  className="hover:bg-[#162230] transition-colors cursor-pointer group"
                >
                  <td className="py-3 pl-2 font-mono text-slate-400 group-hover:text-emerald-400 transition-colors">
                    {g.id}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      {/* White Player */}
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-slate-700 border border-slate-500 overflow-hidden flex items-center justify-center text-[10px] text-white">
                          {g.whiteName[0]}
                        </div>
                        <span className="font-medium text-slate-200">{g.whiteName}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">vs</span>
                      {/* Black Player */}
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-600 overflow-hidden flex items-center justify-center text-[10px] text-slate-300">
                          {g.blackName[0]}
                        </div>
                        <span className="font-medium text-slate-200">{g.blackName}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-md bg-[#1a2634] text-[11px] font-medium text-slate-300">
                      {g.mode}
                    </span>
                  </td>
                  <td className="py-3 text-slate-300 font-medium">{g.timeControl}</td>
                  <td className="py-3 text-center">
                    {isWin && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                        Win
                      </span>
                    )}
                    {isLoss && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-bold">
                        Loss
                      </span>
                    )}
                    {isDraw && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-500/15 border border-slate-500/30 text-slate-300 text-[10px] font-bold">
                        Draw
                      </span>
                    )}
                    {!isWin && !isLoss && !isDraw && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
                        Aborted
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-center font-semibold">
                    {g.ratingChange > 0 && (
                      <span className="text-emerald-400">+{g.ratingChange}</span>
                    )}
                    {g.ratingChange < 0 && <span className="text-rose-400">{g.ratingChange}</span>}
                    {g.ratingChange === 0 && <span className="text-slate-400">0</span>}
                  </td>
                  <td className="py-3 text-right pr-2 text-slate-400 text-[11px]">
                    {Math.round((Date.now() - g.finishedAt) / 60000)}m ago
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

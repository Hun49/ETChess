import type React from "react";
import type { LiveGameItem } from "../types.js";

interface LiveGamesWidgetProps {
  games: LiveGameItem[];
  onSelectGame: (game: LiveGameItem) => void;
  onViewAll: () => void;
}

export const LiveGamesWidget: React.FC<LiveGamesWidgetProps> = ({
  games,
  onSelectGame,
  onViewAll,
}) => {
  return (
    <div className="bg-[#121c26] border border-[#1e2d3d] rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">Live Games</h3>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          View All
        </button>
      </div>

      <div className="space-y-3">
        {games.slice(0, 4).map((g) => (
          <div
            key={g.id}
            onClick={() => onSelectGame(g)}
            className="p-3 rounded-xl bg-[#0d1520] border border-[#1a2634] hover:border-emerald-500/30 hover:bg-[#162230] transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <p className="text-xs font-semibold text-slate-200 group-hover:text-emerald-400 transition-colors">
                  {g.whiteName} vs {g.blackName}
                </p>
              </div>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 pl-3.5">
              {g.category.charAt(0).toUpperCase() + g.category.slice(1)} • {g.timeControl}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

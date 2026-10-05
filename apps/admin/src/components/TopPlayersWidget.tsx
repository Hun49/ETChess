import type React from "react";

interface TopPlayersWidgetProps {
  onViewAll?: () => void;
}

export const TopPlayersWidget: React.FC<TopPlayersWidgetProps> = ({ onViewAll }) => {
  const players = [
    {
      rank: 1,
      name: "ChessMaster",
      handle: "@ethio_master",
      rating: 1987,
      avatar:
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80",
    },
    {
      rank: 2,
      name: "AlexRook",
      handle: "@alex_chess",
      rating: 1964,
      avatar:
        "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=80&q=80",
    },
    {
      rank: 3,
      name: "Nebiyu",
      handle: "@nebiyu_t",
      rating: 1912,
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80",
    },
    {
      rank: 4,
      name: "Ayana",
      handle: "@ayana_k",
      rating: 1875,
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80",
    },
    {
      rank: 5,
      name: "Zewdu",
      handle: "@zewdu_b",
      rating: 1846,
      avatar:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&q=80",
    },
  ];

  return (
    <div className="bg-[#121c26] border border-[#1e2d3d] rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">Top Players (Blitz)</h3>
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            View All
          </button>
        )}
      </div>

      <div className="space-y-3">
        {players.map((p) => (
          <div
            key={p.rank}
            className="flex items-center justify-between p-2 rounded-xl hover:bg-[#162230] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="w-5 text-center text-xs font-bold text-slate-400 font-mono">
                {p.rank}
              </span>
              <img
                src={p.avatar}
                alt={p.name}
                className="w-8 h-8 rounded-full object-cover border border-[#233549]"
              />
              <div>
                <p className="text-xs font-semibold text-slate-200">{p.name}</p>
                <p className="text-[10px] text-slate-400">{p.handle}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-400 font-mono">{p.rating}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

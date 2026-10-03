import type { RatingCategory } from "@etchess/types";
import { Clock, Flame, Loader2, Medal, ShieldCheck, Trophy, X, Zap } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useGameStore } from "../store/gameStore";

interface LeaderboardEntry {
  userId: string;
  name: string;
  rating: number;
  rd: number;
  gamesPlayed: number;
  wins: number;
}

export const LeaderboardModal: React.FC = () => {
  const { activeModal, closeModal } = useGameStore();
  const [category, setCategory] = useState<RatingCategory>("blitz");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeModal === "leaderboard") {
      setLoading(true);
      api.api.users.leaderboard[":category"]
        .$get({ param: { category } })
        .then((res) => {
          if (res.ok) return res.json();
          return null;
        })
        .then((data) => {
          if (data && "leaderboard" in data) {
            setEntries(data.leaderboard as unknown as LeaderboardEntry[]);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [activeModal, category]);

  if (activeModal !== "leaderboard") return null;

  const categories: { key: RatingCategory; label: string; icon: typeof Zap }[] = [
    { key: "blitz", label: "Blitz", icon: Zap },
    { key: "rapid", label: "Rapid", icon: Clock },
    { key: "bullet", label: "Bullet", icon: Flame },
    { key: "classical", label: "Classical", icon: ShieldCheck },
  ];

  return (
    <dialog
      open
      aria-labelledby="leaderboard-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200 border-none w-full h-full max-w-none max-h-none m-0"
    >
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl sm:p-8">
        {/* Close Button */}
        <button
          type="button"
          onClick={closeModal}
          aria-label="Close leaderboard"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h2 id="leaderboard-title" className="text-xl font-bold text-white tracking-tight">
              Global Leaderboards
            </h2>
            <p className="text-xs text-neutral-400">Glicko-2 competitive standings updated live</p>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mt-5 grid grid-cols-4 gap-1 rounded-xl bg-neutral-950 p-1 border border-neutral-800">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = category === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategory(cat.key)}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-neutral-800 text-amber-400 shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Leaderboard Table */}
        <div className="mt-6 max-h-80 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center">
              <Trophy className="h-8 w-8 text-neutral-600 mb-2" />
              <p className="text-sm font-medium text-neutral-400">
                No rated games played in this category yet
              </p>
              <p className="text-xs text-neutral-500 mt-1">Be the first to claim the #1 rank!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {entries.map((entry, index) => {
                const rank = index + 1;
                return (
                  <div
                    key={entry.userId}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-neutral-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg font-bold text-xs">
                        {rank === 1 && <Medal className="h-5 w-5 text-amber-400" />}
                        {rank === 2 && <Medal className="h-5 w-5 text-neutral-300" />}
                        {rank === 3 && <Medal className="h-5 w-5 text-amber-700" />}
                        {rank > 3 && <span className="text-neutral-500">{rank}</span>}
                      </div>
                      <div className="font-semibold text-sm text-white">{entry.name}</div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-bold text-sm text-neutral-100">
                          {Math.round(entry.rating)}
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          {entry.wins}W • {entry.gamesPlayed} games
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};

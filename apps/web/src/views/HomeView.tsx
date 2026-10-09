import {
  ArrowRight,
  Clock,
  Cpu,
  Flame,
  Globe,
  Monitor,
  Shield,
  Sparkles,
  Swords,
  UserCheck,
  Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { api, useSession } from "../lib/api";
import { useGameStore } from "../store/gameStore";

interface HomeRecentGame {
  id: string;
  whitePlayerId: string | null;
  blackPlayerId: string | null;
  whitePlayer?: { name: string } | null;
  blackPlayer?: { name: string } | null;
  result: string | null;
  category?: string | null;
  timeControl: string;
}

export const HomeView: React.FC = () => {
  const { setActiveView, openModal, isGuest, guestSkillLevel } = useGameStore();
  const { data: session } = useSession();

  const [recentGames, setRecentGames] = useState<HomeRecentGame[]>([]);
  const [ratings, setRatings] = useState<{ bullet: number; blitz: number; rapid: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) {
      setRecentGames([]);
      setRatings(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      try {
        // Fetch recent games for current user
        const gamesRes = await api.api.games.$get({
          query: { userId: session.user.id, limit: "5" },
        });
        if (gamesRes.ok) {
          const gamesData = await gamesRes.json();
          if (isMounted && gamesData?.games) {
            setRecentGames(gamesData.games);
          }
        }

        // Fetch user ratings
        const userRes = await api.api.users.me.$get();
        if (userRes.ok) {
          const userData = await userRes.json();
          if (isMounted && userData?.user?.ratings) {
            setRatings(userData.user.ratings);
          }
        }
      } catch (err) {
        console.error("Failed to fetch home lobby stats:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Clean Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0a181c] via-[#0d2227] to-[#081518] border border-[#162e33] p-6 md:p-10 shadow-xl">
        <div className="relative z-10 max-w-xl space-y-4">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Play. Learn. Improve.
          </h1>
          <p className="text-sm md:text-base text-[#8ba3a8] font-normal">
            The modern chess experience for everyone.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setActiveView("play_online")}
              className="inline-flex items-center gap-2 rounded-xl bg-[#00e699] px-6 py-3 text-sm font-bold text-neutral-950 shadow-lg shadow-[#00e699]/20 hover:bg-[#00e699]/90 transition-all cursor-pointer"
            >
              <span>Play Now</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. 4 Play Mode Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Play Online */}
        <button
          type="button"
          onClick={() => setActiveView("play_online")}
          className="group flex flex-col justify-between rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 text-left hover:border-[#00e699]/40 hover:bg-[#0e2024] transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0e2428] text-[#00e699] border border-[#16363d]">
              <Globe className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-[#4a6469] group-hover:text-[#00e699] group-hover:translate-x-0.5 transition-all" />
          </div>
          <div className="mt-4">
            <div className="text-sm font-bold text-white group-hover:text-[#00e699] transition-colors">
              Play Online
            </div>
            <div className="text-xs text-[#8ba3a8] mt-0.5">
              {isGuest ? `Match guests (${guestSkillLevel})` : "Find an opponent"}
            </div>
          </div>
        </button>

        {/* Play a Friend */}
        <button
          type="button"
          onClick={() => {
            if (isGuest) {
              setActiveView("play_friend");
            } else {
              setActiveView("play_friend");
            }
          }}
          className="group flex flex-col justify-between rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 text-left hover:border-[#00e699]/40 hover:bg-[#0e2024] transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0e2428] text-[#00e699] border border-[#16363d]">
              <UserCheck className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-[#4a6469] group-hover:text-[#00e699] group-hover:translate-x-0.5 transition-all" />
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white group-hover:text-[#00e699] transition-colors">
                Play a Friend
              </span>
              {isGuest && (
                <span className="rounded bg-amber-500/10 text-[9px] font-bold text-amber-400 px-1 py-0.5 border border-amber-500/20">
                  Account Req.
                </span>
              )}
            </div>
            <div className="text-xs text-[#8ba3a8] mt-0.5">Challenge your friends</div>
          </div>
        </button>

        {/* Play Computer */}
        <button
          type="button"
          onClick={() => setActiveView("play_computer")}
          className="group flex flex-col justify-between rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 text-left hover:border-[#00e699]/40 hover:bg-[#0e2024] transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0e2428] text-[#00e699] border border-[#16363d]">
              <Cpu className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-[#4a6469] group-hover:text-[#00e699] group-hover:translate-x-0.5 transition-all" />
          </div>
          <div className="mt-4">
            <div className="text-sm font-bold text-white group-hover:text-[#00e699] transition-colors">
              Play Computer
            </div>
            <div className="text-xs text-[#8ba3a8] mt-0.5">Practice & improve</div>
          </div>
        </button>

        {/* Local Play */}
        <button
          type="button"
          onClick={() => setActiveView("play_local")}
          className="group flex flex-col justify-between rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 text-left hover:border-[#00e699]/40 hover:bg-[#0e2024] transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0e2428] text-[#00e699] border border-[#16363d]">
              <Monitor className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-[#4a6469] group-hover:text-[#00e699] group-hover:translate-x-0.5 transition-all" />
          </div>
          <div className="mt-4">
            <div className="text-sm font-bold text-white group-hover:text-[#00e699] transition-colors">
              Local Play
            </div>
            <div className="text-xs text-[#8ba3a8] mt-0.5">Same device pass & play</div>
          </div>
        </button>
      </div>

      {/* 3. Bottom Grid: Recent Games & Your Ratings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Games */}
        <div className="lg:col-span-7 rounded-2xl border border-[#14282c] bg-[#0b171a] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">Recent Games</h2>
            {recentGames.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveView("history")}
                className="text-xs font-semibold text-[#00e699] hover:underline cursor-pointer"
              >
                View All
              </button>
            )}
          </div>

          {recentGames.length > 0 ? (
            <div className="space-y-2.5">
              {recentGames.map((game) => {
                const isWhite = game.whitePlayerId === session?.user?.id;
                const opponentName = isWhite
                  ? game.blackPlayer?.name || "Anonymous Opponent"
                  : game.whitePlayer?.name || "Anonymous Opponent";
                const isWinner =
                  (game.result === "1-0" && isWhite) || (game.result === "0-1" && !isWhite);
                const isDraw = game.result === "1/2-1/2";

                return (
                  <div
                    key={game.id}
                    className="flex items-center justify-between rounded-xl bg-[#0e1e22] px-3.5 py-2.5 border border-[#14282c]/80 hover:bg-[#12262b] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#16343b] text-white font-bold text-xs uppercase">
                        {opponentName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">You vs {opponentName}</div>
                        <div className="text-[10px] text-[#8ba3a8] capitalize">
                          {game.category || "Standard"} • {game.timeControl}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold border ${
                          isWinner
                            ? "bg-[#00e699]/15 text-[#00e699] border-[#00e699]/30"
                            : isDraw
                              ? "bg-neutral-800 text-neutral-300 border-neutral-700"
                              : "bg-red-500/15 text-red-400 border-red-500/30"
                        }`}
                      >
                        {isWinner ? "Win" : isDraw ? "Draw" : "Loss"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4 rounded-xl bg-[#0e1e22]/50 border border-dashed border-[#14282c]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#14282c] text-[#8ba3a8] mb-3">
                <Swords className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-white">No games played yet</p>
              <p className="text-[11px] text-[#587277] max-w-xs mt-1">
                {isGuest
                  ? "Guest sessions play unrated casual games. Start a match or create an account to save match history!"
                  : "Your database match history is clean. Play your first match to record stats!"}
              </p>
              <button
                type="button"
                onClick={() => setActiveView("play_online")}
                className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg bg-[#00e699]/10 hover:bg-[#00e699]/20 border border-[#00e699]/30 text-[#00e699] px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer"
              >
                <span>Play a Game</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Your Ratings */}
        <div className="lg:col-span-5 rounded-2xl border border-[#14282c] bg-[#0b171a] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">Your Ratings</h2>
            {!isGuest && (
              <button
                type="button"
                onClick={() => setActiveView("profile")}
                className="text-xs font-semibold text-[#00e699] hover:underline cursor-pointer"
              >
                View Profile
              </button>
            )}
          </div>

          {isGuest ? (
            <div className="p-4 rounded-xl bg-[#0e1e22] border border-[#14282c] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Guest Session</span>
                <span className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-400 capitalize">
                  {guestSkillLevel} Tier
                </span>
              </div>
              <p className="text-[11px] text-[#8ba3a8] leading-relaxed">
                Guest accounts play unrated casual matches. Create a free account to track your ELO
                rating across Bullet, Blitz, and Rapid!
              </p>
              <button
                type="button"
                onClick={() => openModal("auth")}
                className="w-full py-2.5 rounded-xl bg-[#00e699] text-[#081214] font-bold text-xs hover:bg-[#00c885] transition-colors cursor-pointer shadow-md shadow-[#00e699]/10"
              >
                Sign Up to Get Rated
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Bullet */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e1e22] border border-[#14282c]/80">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                    <Flame className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Bullet</div>
                    <div className="text-[10px] text-[#8ba3a8] font-mono">
                      {ratings?.bullet ?? 1000}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#00e699]">Active</span>
              </div>

              {/* Blitz */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e1e22] border border-[#14282c]/80">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00e699]/10 text-[#00e699]">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Blitz</div>
                    <div className="text-[10px] text-[#8ba3a8] font-mono">
                      {ratings?.blitz ?? 1000}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#00e699]">Active</span>
              </div>

              {/* Rapid */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e1e22] border border-[#14282c]/80">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Rapid</div>
                    <div className="text-[10px] text-[#8ba3a8] font-mono">
                      {ratings?.rapid ?? 1000}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#00e699]">Active</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

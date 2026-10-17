import {
  ArrowRight,
  Bot,
  Clock,
  Cpu,
  Flame,
  Globe,
  Monitor,
  Shield,
  Sparkles,
  Swords,
  UserCheck,
  UserPlus,
  Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { api, useSession } from "../lib/api";
import { GUEST_LIMITS, REGISTERED_LIMITS, getQuotaRemaining } from "../lib/quota";
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
  const { setActiveView, openModal, isGuest, guestSkillLevel, guestName } = useGameStore();
  const { data: session } = useSession();

  const [recentGames, setRecentGames] = useState<HomeRecentGame[]>([]);
  const [ratings, setRatings] = useState<{ bullet: number; blitz: number; rapid: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  // Quota counts for today
  const quota = getQuotaRemaining(isGuest, session?.user?.id);

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
    <div className="space-y-6 pb-12 overflow-y-auto px-4 md:px-8 py-6">
      {/* 1. Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0a181c] via-[#0d2227] to-[#081518] border border-[#162e33] p-6 md:p-10 shadow-xl">
        <div className="relative z-10 max-w-xl space-y-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#00e699]/15 border border-[#00e699]/30 px-3 py-1 text-[11px] font-bold text-[#00e699] uppercase tracking-wider">
              {isGuest ? "Guest Access" : "Welcome Back"}
            </span>
            {!isGuest && session?.user && (
              <div className="flex items-center gap-1.5 text-xs text-neutral-300 font-semibold">
                <span>{session.user.name}</span>
                <VerifiedBadge size="sm" />
              </div>
            )}
          </div>

          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
            {isGuest ? "Play Free Chess Instantly." : "Play. Learn. Improve."}
          </h1>

          <p className="text-sm md:text-base text-[#8ba3a8] font-normal leading-relaxed">
            {isGuest
              ? "Enjoy casual unrated matchmaking against other guests and practice against computer bots."
              : "Compete in rated Glicko-2 matches, challenge friends, and review your moves with engine analysis."}
          </p>

          {/* Quota Badges for Guest */}
          {isGuest && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="rounded-lg bg-[#0e1e22] border border-[#162e33] px-2.5 py-1 text-xs text-neutral-300 font-medium">
                Online: <strong className="text-[#00e699]">{quota.onlineGamesRemaining}</strong>/
                {GUEST_LIMITS.maxOnlineGames} daily
              </span>
              <span className="rounded-lg bg-[#0e1e22] border border-[#162e33] px-2.5 py-1 text-xs text-neutral-300 font-medium">
                Bots: <strong className="text-[#00e699]">{quota.botGamesRemaining}</strong>/
                {GUEST_LIMITS.maxBotGames} daily
              </span>
              <span className="rounded-lg bg-[#0e1e22] border border-[#162e33] px-2.5 py-1 text-xs text-neutral-300 font-medium">
                Analysis: <strong className="text-[#00e699]">{quota.analysesRemaining}</strong>/
                {GUEST_LIMITS.maxAnalyses} daily
              </span>
            </div>
          )}

          {/* CTAs */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView("play_online")}
              className="inline-flex items-center gap-2 rounded-xl bg-[#00e699] px-6 py-3 text-sm font-bold text-neutral-950 shadow-lg shadow-[#00e699]/20 hover:bg-[#00c885] transition-all cursor-pointer"
            >
              <span>{isGuest ? "Play Online as Guest" : "Play Online"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            {isGuest && (
              <button
                type="button"
                onClick={() => openModal("auth")}
                className="inline-flex items-center gap-2 rounded-xl border border-[#00e699]/40 bg-[#00e699]/10 px-5 py-3 text-sm font-bold text-[#00e699] hover:bg-[#00e699]/20 transition-all cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>Create Free Account</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Guest Sign-in Promotion Nudge ("Ad") */}
      {isGuest && (
        <div className="rounded-2xl border border-[#00e699]/30 bg-gradient-to-r from-[#00e699]/10 via-[#0a2024] to-[#0b171a] p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#00e699]" />
              <span className="text-xs font-black uppercase tracking-wider text-[#00e699]">
                Unlock Full ET-Chess Experience
              </span>
            </div>
            <p className="text-xs text-[#cbd5e1] leading-relaxed">
              Create an account with Google or GitHub to get <strong>unlimited online play</strong>,{" "}
              <strong>friend challenges</strong>, <strong>10 daily game analyses</strong>, starting
              ELO rating, and a <strong>verified player badge</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openModal("auth")}
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#00e699] px-5 py-2.5 text-xs font-black text-neutral-950 hover:bg-[#00c885] transition-all cursor-pointer shadow-md shadow-[#00e699]/20"
          >
            <span>Sign In with Google / GitHub</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 3. 4 Play Mode Cards */}
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
              {isGuest
                ? `${quota.onlineGamesRemaining} of ${GUEST_LIMITS.maxOnlineGames} games remaining`
                : "Unlimited rated matchmaking"}
            </div>
          </div>
        </button>

        {/* Play a Friend */}
        <button
          type="button"
          onClick={() => {
            if (isGuest) {
              openModal("auth");
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
            <div className="text-xs text-[#8ba3a8] mt-0.5">
              {isGuest ? "Sign in to send challenge links" : "Challenge friends with link"}
            </div>
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
            <div className="text-xs text-[#8ba3a8] mt-0.5">
              {isGuest
                ? `${quota.botGamesRemaining} of ${GUEST_LIMITS.maxBotGames} bot games remaining`
                : "Unlimited Stockfish practice"}
            </div>
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

      {/* 4. Bottom Grid: Match History & Ratings */}
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
                  ? game.blackPlayer?.name || "Opponent"
                  : game.whitePlayer?.name || "Opponent";
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
                  ? "Guest sessions play unrated casual games. Create an account to permanently record your match history!"
                  : "Play your first match to start recording your game history!"}
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

        {/* Your Ratings / Quota Meter */}
        <div className="lg:col-span-5 rounded-2xl border border-[#14282c] bg-[#0b171a] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">
              {isGuest ? "Guest Daily Passes" : "Your Ratings"}
            </h2>
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
            <div className="p-4 rounded-xl bg-[#0e1e22] border border-[#14282c] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Guest Session</span>
                <span className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-400 capitalize">
                  {guestSkillLevel} Tier (Unrated)
                </span>
              </div>

              {/* Progress meters */}
              <div className="space-y-2.5">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#8ba3a8]">Online Matchmaking</span>
                    <span className="font-mono text-white font-bold">
                      {quota.onlineGamesRemaining} / {GUEST_LIMITS.maxOnlineGames} left
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#14282c] overflow-hidden">
                    <div
                      className="h-full bg-[#00e699] transition-all"
                      style={{
                        width: `${(quota.onlineGamesRemaining / GUEST_LIMITS.maxOnlineGames) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#8ba3a8]">Bot Practice</span>
                    <span className="font-mono text-white font-bold">
                      {quota.botGamesRemaining} / {GUEST_LIMITS.maxBotGames} left
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#14282c] overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 transition-all"
                      style={{
                        width: `${(quota.botGamesRemaining / GUEST_LIMITS.maxBotGames) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#8ba3a8]">Game Analysis</span>
                    <span className="font-mono text-white font-bold">
                      {quota.analysesRemaining} / {GUEST_LIMITS.maxAnalyses} left
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#14282c] overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all"
                      style={{
                        width: `${(quota.analysesRemaining / GUEST_LIMITS.maxAnalyses) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[#8ba3a8] leading-relaxed">
                Guest games are unrated. Create an account to unlock unlimited games, friend
                invites, and your calibrated starting ELO rating!
              </p>

              <button
                type="button"
                onClick={() => openModal("auth")}
                className="w-full py-2.5 rounded-xl bg-[#00e699] text-[#081214] font-bold text-xs hover:bg-[#00c885] transition-colors cursor-pointer shadow-md shadow-[#00e699]/10"
              >
                Sign In to Unlock Unlimited
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

              {/* Daily Analyses Remaining for Registered */}
              <div className="p-3 rounded-xl bg-[#081214] border border-[#162e33] flex items-center justify-between text-xs">
                <span className="text-[#8ba3a8]">Analyses Today:</span>
                <span className="font-bold text-[#00e699] font-mono">
                  {quota.analysesRemaining} / {REGISTERED_LIMITS.maxAnalyses} remaining
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Clock,
  Edit3,
  Flame,
  Globe,
  Loader2,
  LogOut,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Target,
  Trophy,
  UserPlus,
  Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { api, authClient, useSession } from "../lib/api";
import { useGameStore } from "../store/gameStore";

interface UserProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  image?: string | null;
  experienceLevel?: string | null;
  ratings: {
    bullet: number;
    blitz: number;
    rapid: number;
    classical: number;
  };
}

interface GameRecord {
  id: string;
  whitePlayerId: string | null;
  blackPlayerId: string | null;
  result: string | null;
  category?: string | null;
}

export const ProfileView: React.FC = () => {
  const { setActiveView, isGuest, guestName, setIsGuest, openModal } = useGameStore();
  const { data: session } = useSession();

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;

    let isMounted = true;
    setLoading(true);

    const fetchData = async () => {
      try {
        const [meRes, gamesRes] = await Promise.all([
          api.api.users.me.$get(),
          api.api.games.$get({ query: { userId: session.user.id, limit: "50" } }),
        ]);

        if (meRes.ok) {
          const meData = await meRes.json();
          if (isMounted && meData?.user) {
            setProfile(meData.user as unknown as UserProfileData);
          }
        }

        if (gamesRes.ok) {
          const gamesData = await gamesRes.json();
          if (isMounted && gamesData?.games) {
            setGames(gamesData.games as unknown as GameRecord[]);
          }
        }
      } catch (err) {
        console.error("Failed to fetch user profile data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      setIsGuest(true);
      setActiveView("home");
      window.location.reload();
    } catch (err) {
      console.error("Failed to sign out:", err);
    }
  };

  const userName = profile?.name || session?.user?.name || (isGuest ? guestName : "Player");
  const userEmail = profile?.email || session?.user?.email;

  // Real career stats computed from real games in database
  const totalGames = games.length;
  let wins = 0;
  let losses = 0;
  let draws = 0;

  for (const g of games) {
    const isWhite = g.whitePlayerId === session?.user?.id;
    if ((g.result === "1-0" && isWhite) || (g.result === "0-1" && !isWhite)) {
      wins += 1;
    } else if (g.result === "1/2-1/2") {
      draws += 1;
    } else if (g.result) {
      losses += 1;
    }
  }

  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  // Ratings with calibrated fallbacks
  const ratings = profile?.ratings || {
    bullet: 1000,
    blitz: 1000,
    rapid: 1000,
    classical: 1000,
  };

  const expLevel = profile?.experienceLevel;
  const expLabel =
    expLevel === "beginner"
      ? "Beginner (500 Starting ELO)"
      : expLevel === "advanced"
        ? "Advanced (1500 Starting ELO)"
        : expLevel === "intermediate"
          ? "Intermediate (1000 Starting ELO)"
          : "Standard Rating";

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[#081214] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Header Navigation */}
        <div className="flex items-center justify-between border-b border-[#14282c] pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView("home")}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#14282c] bg-[#0b171a] text-neutral-300 hover:border-[#00e699] hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Player Profile</h1>
              <p className="text-xs text-[#8ba3a8]">
                Lifetime chess ratings, statistics, and account settings
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveView("settings")}
            className="flex items-center gap-1.5 rounded-xl border border-[#14282c] bg-[#0b171a] px-3 py-2 text-xs font-semibold text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>
        </div>

        {/* Guest View Notice */}
        {isGuest ? (
          <div className="rounded-3xl border border-[#162e33] bg-[#0b171a] p-8 text-center space-y-5 shadow-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Shield className="h-8 w-8" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h2 className="text-2xl font-black text-white">{guestName} (Guest)</h2>
              <p className="text-xs text-[#8ba3a8] leading-relaxed">
                Guest sessions play casual unrated matches and do not track rating progression or
                save match history. Create a free account with Google or GitHub to calibrate your
                starting ELO, edit your profile, and receive a verified badge!
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => openModal("auth")}
                className="inline-flex items-center gap-2 rounded-xl bg-[#00e699] px-6 py-3 text-xs font-black text-neutral-950 hover:bg-[#00c885] transition-all cursor-pointer shadow-lg shadow-[#00e699]/20"
              >
                <UserPlus className="h-4 w-4" />
                <span>Sign In to Unlock Profile & ELO</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Registered Profile Identity Card */}
            <div className="relative overflow-hidden rounded-3xl border border-[#14282c] bg-[#0b171a] p-6 shadow-xl">
              <div className="absolute right-0 top-0 h-64 w-64 translate-x-12 -translate-y-12 rounded-full bg-[#00e699]/5 blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                {/* Avatar with online dot */}
                <div className="relative">
                  {profile?.image || session?.user?.image ? (
                    <img
                      src={profile?.image || session?.user?.image || ""}
                      alt={userName}
                      className="h-20 w-20 rounded-2xl object-cover border-2 border-[#00e699]/40 shadow-lg shadow-[#00e699]/10"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00e699]/30 to-[#0e1e22] border-2 border-[#00e699]/40 text-2xl font-black text-[#00e699] shadow-lg shadow-[#00e699]/10">
                      {userName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-[#0b171a] bg-[#00e699]" />
                </div>

                {/* Info details */}
                <div className="flex-1 text-center sm:text-left space-y-1.5">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                    <h2 className="text-2xl font-black text-white">{userName}</h2>
                    {/* Official Verified Badge - NO PRO BADGE */}
                    <VerifiedBadge size="md" showLabel />
                    {expLevel && (
                      <span className="rounded-md border border-[#162e33] bg-[#0e1e22] px-2 py-0.5 text-[10px] font-bold text-[#8ba3a8]">
                        {expLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-[#8ba3a8]">
                    {userEmail || `@${userName.toLowerCase().replace(/\s+/g, "")}`}
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-1 text-xs text-[#8ba3a8]">
                    <div className="flex items-center gap-1.5">
                      <Swords className="h-3.5 w-3.5 text-[#00e699]" />
                      <span className="font-bold text-white">{totalGames} Games Played</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Trophy className="h-3.5 w-3.5 text-amber-400" />
                      <span className="font-bold text-white">{wins} Wins</span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions: Edit Profile & Sign Out */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openModal("edit_profile")}
                    className="flex items-center gap-1.5 rounded-xl border border-[#162e33] bg-[#0e1e22] px-3.5 py-2 text-xs font-bold text-neutral-200 hover:border-[#00e699] hover:text-white transition-colors cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-[#00e699]" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex items-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Real Rating Cards (Bullet, Blitz, Rapid) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Bullet Card */}
              <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 hover:border-[#00e699]/30 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
                      <Zap className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Bullet
                    </span>
                  </div>
                  <span className="text-xs text-[#8ba3a8]">1+0, 2+0</span>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-black text-white">{ratings.bullet}</span>
                  <span className="text-xs font-bold text-[#00e699]">Active Rating</span>
                </div>
                <div className="text-[11px] text-[#8ba3a8]">
                  Fast-paced calculation time control
                </div>
              </div>

              {/* Blitz Card */}
              <div className="rounded-2xl border border-[#00e699]/30 bg-[#0b171a] p-5 shadow-lg shadow-[#00e699]/5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00e699]/15 text-[#00e699]">
                      <Flame className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Blitz
                    </span>
                  </div>
                  <span className="text-xs text-[#8ba3a8]">3+0, 3+2, 5+3</span>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-black text-[#00e699]">{ratings.blitz}</span>
                  <span className="text-xs font-bold text-[#00e699]">Active Rating</span>
                </div>
                <div className="text-[11px] text-[#8ba3a8]">Standard competitive online blitz</div>
              </div>

              {/* Rapid Card */}
              <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 hover:border-[#00e699]/30 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                      <Target className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Rapid
                    </span>
                  </div>
                  <span className="text-xs text-[#8ba3a8]">10+0, 15+10</span>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-black text-white">{ratings.rapid}</span>
                  <span className="text-xs font-bold text-[#00e699]">Active Rating</span>
                </div>
                <div className="text-[11px] text-[#8ba3a8]">
                  Full calculation classical thinking time
                </div>
              </div>
            </div>

            {/* Real Career Statistics Card (No Fake Data) */}
            <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8ba3a8]">
                Career Statistics
              </h3>

              {totalGames > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-[#162e33] bg-[#0e1e22] p-4 text-center">
                    <span className="text-[11px] text-[#8ba3a8] block mb-1">Total Matches</span>
                    <span className="text-2xl font-black text-white">{totalGames}</span>
                  </div>
                  <div className="rounded-xl border border-[#162e33] bg-[#0e1e22] p-4 text-center">
                    <span className="text-[11px] text-[#8ba3a8] block mb-1">Win Rate</span>
                    <span className="text-2xl font-black text-[#00e699]">{winRate}%</span>
                  </div>
                  <div className="rounded-xl border border-[#162e33] bg-[#0e1e22] p-4 text-center">
                    <span className="text-[11px] text-[#8ba3a8] block mb-1">Record (W-L-D)</span>
                    <span className="text-lg font-bold font-mono text-white">
                      {wins} - {losses} - {draws}
                    </span>
                  </div>
                  <div className="rounded-xl border border-[#162e33] bg-[#0e1e22] p-4 text-center">
                    <span className="text-[11px] text-[#8ba3a8] block mb-1">Status</span>
                    <span className="text-sm font-bold text-[#00e699]">Active Ranked</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#162e33] bg-[#0e1e22]/50 p-6 text-center space-y-2">
                  <p className="text-sm font-bold text-white">No rated matches played yet</p>
                  <p className="text-xs text-[#8ba3a8] max-w-sm mx-auto">
                    Your calibrated starting rating is active! Play your first match online to build
                    your career record and climb the leaderboard.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveView("play_online")}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#00e699] px-4 py-2 text-xs font-bold text-neutral-950 hover:bg-[#00c885] transition-colors cursor-pointer"
                    >
                      <Swords className="h-3.5 w-3.5" />
                      <span>Play Your First Game</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

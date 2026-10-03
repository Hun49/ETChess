import {
  ArrowRight,
  Clock,
  Cpu,
  Flame,
  Globe,
  Monitor,
  Sparkles,
  UserCheck,
  Zap,
} from "lucide-react";
import type React from "react";
import { useGameStore } from "../store/gameStore";

export const HomeView: React.FC = () => {
  const { setActiveView } = useGameStore();

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Hero Card matching Screen 1 in mockup */}
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

        {/* 3D Chess Knight visual element */}
        <div className="absolute right-4 md:right-12 bottom-0 top-0 flex items-center pointer-events-none opacity-30 md:opacity-80">
          <div className="w-48 h-48 md:w-64 md:h-64 relative flex items-center justify-center">
            <svg
              className="w-full h-full text-[#143238] drop-shadow-[0_10px_30px_rgba(0,230,153,0.15)]"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>Chess Knight Banner</title>
              <path d="M19 22H5v-2h14v2zm-2.5-4H7.5l.5-4h8l.5 4zm-4.5-6h-2V7h2v5zm4-6H8V4h8v2z" />
            </svg>
          </div>
        </div>
      </div>

      {/* 2. 4 Play Mode Cards matching mockup */}
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
            <div className="text-xs text-[#8ba3a8] mt-0.5">Find an opponent</div>
          </div>
        </button>

        {/* Play a Friend */}
        <button
          type="button"
          onClick={() => setActiveView("play_friend")}
          className="group flex flex-col justify-between rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 text-left hover:border-[#00e699]/40 hover:bg-[#0e2024] transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0e2428] text-[#00e699] border border-[#16363d]">
              <UserCheck className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-[#4a6469] group-hover:text-[#00e699] group-hover:translate-x-0.5 transition-all" />
          </div>
          <div className="mt-4">
            <div className="text-sm font-bold text-white group-hover:text-[#00e699] transition-colors">
              Play a Friend
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
            <div className="text-xs text-[#8ba3a8] mt-0.5">Same device</div>
          </div>
        </button>
      </div>

      {/* 3. Bottom Grid: Recent Games & Your Ratings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Games */}
        <div className="lg:col-span-7 rounded-2xl border border-[#14282c] bg-[#0b171a] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">Recent Games</h2>
            <button
              type="button"
              onClick={() => setActiveView("history")}
              className="text-xs font-semibold text-[#00e699] hover:underline"
            >
              View All
            </button>
          </div>

          <div className="space-y-2.5">
            {/* Game 1 */}
            <div className="flex items-center justify-between rounded-xl bg-[#0e1e22] px-3.5 py-2.5 border border-[#14282c]/80 hover:bg-[#12262b] transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#16343b] text-white font-bold text-xs">
                  A
                </div>
                <div>
                  <div className="text-xs font-bold text-white">You vs AlexRook</div>
                  <div className="text-[10px] text-[#8ba3a8]">Blitz • 3+2</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-[#00e699]/15 px-2 py-0.5 text-[11px] font-bold text-[#00e699] border border-[#00e699]/30">
                  Win +17
                </span>
                <span className="text-[10px] text-[#587277]">2 hours ago</span>
              </div>
            </div>

            {/* Game 2 */}
            <div className="flex items-center justify-between rounded-xl bg-[#0e1e22] px-3.5 py-2.5 border border-[#14282c]/80 hover:bg-[#12262b] transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#261f2f] text-purple-300 font-bold text-xs">
                  S
                </div>
                <div>
                  <div className="text-xs font-bold text-white">ShadowKnight vs You</div>
                  <div className="text-[10px] text-[#8ba3a8]">Rapid • 10+0</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-400 border border-red-500/30">
                  Loss -12
                </span>
                <span className="text-[10px] text-[#587277]">5 hours ago</span>
              </div>
            </div>

            {/* Game 3 */}
            <div className="flex items-center justify-between rounded-xl bg-[#0e1e22] px-3.5 py-2.5 border border-[#14282c]/80 hover:bg-[#12262b] transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1f2832] text-blue-300 font-bold text-xs">
                  Q
                </div>
                <div>
                  <div className="text-xs font-bold text-white">You vs QueenBishop</div>
                  <div className="text-[10px] text-[#8ba3a8]">Blitz • 3+2</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-neutral-800 px-2 py-0.5 text-[11px] font-bold text-neutral-300 border border-neutral-700">
                  Draw 0
                </span>
                <span className="text-[10px] text-[#587277]">1 day ago</span>
              </div>
            </div>
          </div>
        </div>

        {/* Your Ratings */}
        <div className="lg:col-span-5 rounded-2xl border border-[#14282c] bg-[#0b171a] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">Your Ratings</h2>
            <button
              type="button"
              onClick={() => setActiveView("profile")}
              className="text-xs font-semibold text-[#00e699] hover:underline"
            >
              View All
            </button>
          </div>

          <div className="space-y-3">
            {/* Bullet */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e1e22] border border-[#14282c]/80">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                  <Flame className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Bullet</div>
                  <div className="text-[10px] text-[#8ba3a8]">1420</div>
                </div>
              </div>
              <span className="text-xs font-bold text-[#00e699]">+12</span>
            </div>

            {/* Blitz */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e1e22] border border-[#14282c]/80">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00e699]/10 text-[#00e699]">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Blitz</div>
                  <div className="text-[10px] text-[#8ba3a8]">1567</div>
                </div>
              </div>
              <span className="text-xs font-bold text-[#00e699]">+17</span>
            </div>

            {/* Rapid */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e1e22] border border-[#14282c]/80">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Rapid</div>
                  <div className="text-[10px] text-[#8ba3a8]">1321</div>
                </div>
              </div>
              <span className="text-xs font-bold text-red-400">-5</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

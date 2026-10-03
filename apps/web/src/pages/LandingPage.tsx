import { STARTING_FEN } from "@etchess/chess-core";
import {
  ArrowRight,
  Bot,
  Clock,
  Cpu,
  Flame,
  Shield,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import type React from "react";
import { Chessboard } from "react-chessboard";
import { useGameStore } from "../store/gameStore";

export const LandingPage: React.FC = () => {
  const { openModal, joinMatchmaking, startBotGame, startPassAndPlay } = useGameStore();

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-12 md:py-20 lg:py-24 border-b border-neutral-800/80 bg-gradient-to-b from-neutral-950 via-neutral-950 to-neutral-900/40">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Hero Content */}
            <div className="lg:col-span-7 space-y-6 text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Next-Gen Realtime Chess Architecture</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1]">
                Play Chess with{" "}
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                  Zero Latency
                </span>
                . Anywhere.
              </h1>

              {/* Subtitle */}
              <p className="max-w-2xl text-base sm:text-lg text-neutral-400 leading-relaxed">
                Powered by Cloudflare Durable Objects with WebSocket Hibernation, instant rollback
                netcode, client-side Stockfish WASM bots, and strict 60-second forfeit anti-ghosting
                alarms.
              </p>

              {/* Primary Call-to-Action Buttons */}
              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => joinMatchmaking("3+2", true)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-emerald-600/25 hover:from-emerald-500 hover:to-teal-400 transition-all cursor-pointer"
                >
                  <Zap className="h-4 w-4" />
                  <span>Quick Play 3+2 Blitz</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => openModal("play")}
                  className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900/90 px-6 py-3.5 text-sm font-semibold text-neutral-200 hover:bg-neutral-800 hover:text-white transition-all cursor-pointer"
                >
                  <span>All Game Modes</span>
                </button>
              </div>

              {/* Quick Mode Cards */}
              <div className="pt-6 grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => joinMatchmaking("10+0", true)}
                  className="flex flex-col items-start rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-3 hover:border-neutral-700 hover:bg-neutral-900/80 transition-all text-left"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 mb-2">
                    <Clock className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-white">10+0 Rapid</span>
                  <span className="text-[11px] text-neutral-400">Competitive Glicko-2</span>
                </button>

                <button
                  type="button"
                  onClick={() => startBotGame("intermediate", "white", "5+0")}
                  className="flex flex-col items-start rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-3 hover:border-neutral-700 hover:bg-neutral-900/80 transition-all text-left"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400 mb-2">
                    <Bot className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-white">Play vs Bot</span>
                  <span className="text-[11px] text-neutral-400">Offline WASM Engine</span>
                </button>

                <button
                  type="button"
                  onClick={() => startPassAndPlay("10+0")}
                  className="flex flex-col items-start rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-3 hover:border-neutral-700 hover:bg-neutral-900/80 transition-all text-left"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 mb-2">
                    <Users className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-white">Pass & Play</span>
                  <span className="text-[11px] text-neutral-400">Same Device Board</span>
                </button>
              </div>
            </div>

            {/* Right Hero Board Preview */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-[420px] rounded-2xl p-2 bg-gradient-to-b from-neutral-800 to-neutral-900 shadow-2xl border border-neutral-700/60">
                <div className="aspect-square rounded-xl overflow-hidden pointer-events-none">
                  <Chessboard
                    options={{
                      position: STARTING_FEN,
                      boardOrientation: "white",
                      showNotation: false,
                      allowDragging: false,
                      lightSquareStyle: { backgroundColor: "#cbd5e1" },
                      darkSquareStyle: { backgroundColor: "#475569" },
                    }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between px-3 py-1.5 text-xs text-neutral-400">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Live Match Ready
                  </span>
                  <span className="font-mono text-[11px]">ET Chess Core v0.1</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Section */}
      <section className="py-16 md:py-24 bg-neutral-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Engineered for Serious Chess Players
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              State-of-the-art distributed systems combined with professional chess mechanics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 mb-4">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Sub-50ms Edge Sync</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Cloudflare Workers and Durable Objects run in hundreds of edge data centers
                worldwide, keeping move latency imperceptible.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 mb-4">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Strict 60s Forfeit Alarms</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Persistent DO storage alarms strictly enforce 60-second abandonment forfeits,
                eliminating stall tactics and disconnect abuse.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 mb-4">
                <Cpu className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">100% Client-Side Bots</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Train offline with Stockfish UCI engines running entirely in your browser with 4
                calibrated skill levels and zero server overhead.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 mb-4">
                <Trophy className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Glicko-2 Rating Precision</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Separate Bullet, Blitz, Rapid, and Classical ratings tracking rating deviation (RD)
                and volatility for mathematically sound matchmaking.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

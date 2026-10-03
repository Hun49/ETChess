import { Palette, Sparkles, Trophy, User as UserIcon, Volume2, VolumeX, Wifi } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { signOut, useSession } from "../lib/api";
import { type BoardTheme, useGameStore } from "../store/gameStore";

const THEMES: { id: BoardTheme; label: string; color: string }[] = [
  { id: "slate", label: "Slate", color: "bg-slate-700" },
  { id: "wood", label: "Wood", color: "bg-amber-700" },
  { id: "emerald", label: "Emerald", color: "bg-emerald-700" },
  { id: "ocean", label: "Ocean", color: "bg-sky-700" },
];

export const Navbar: React.FC = () => {
  const {
    mode,
    isSoundMuted,
    toggleSound,
    boardTheme,
    setBoardTheme,
    latencyMs,
    openModal,
    resetToIdle,
  } = useGameStore();

  const { data: session } = useSession();
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => resetToIdle()}
            className="flex items-center gap-2.5 transition-opacity hover:opacity-90 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-md shadow-emerald-500/20 text-neutral-950 font-black text-xl">
              ET
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-lg text-white">ET Chess</span>
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 font-medium hidden sm:block">
                Ultra-Low Latency DO Chess
              </p>
            </div>
          </button>

          {/* Quick Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={() => openModal("play")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode !== "idle"
                  ? "text-emerald-400 bg-emerald-500/10"
                  : "text-neutral-300 hover:text-white hover:bg-neutral-800/60"
              }`}
            >
              Play
            </button>
            <button
              type="button"
              onClick={() => openModal("leaderboard")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-neutral-300 hover:text-white hover:bg-neutral-800/60 transition-colors"
            >
              <Trophy className="h-4 w-4 text-amber-400" />
              Leaderboard
            </button>
          </nav>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2.5">
          {/* Latency / Ping Indicator (active when online) */}
          {mode === "online" && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-neutral-300">
              <Wifi
                className={`h-3.5 w-3.5 ${
                  latencyMs < 60
                    ? "text-emerald-400"
                    : latencyMs < 140
                      ? "text-amber-400"
                      : "text-red-400"
                }`}
              />
              <span>{latencyMs}ms</span>
            </div>
          )}

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            aria-label={isSoundMuted ? "Unmute sound" : "Mute sound"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            {isSoundMuted ? (
              <VolumeX className="h-4 w-4 text-neutral-500" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            )}
          </button>

          {/* Theme Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
              aria-label="Change Board Theme"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <Palette className="h-4 w-4" />
            </button>

            {themeDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-36 rounded-xl border border-neutral-800 bg-neutral-900/95 p-1.5 shadow-2xl backdrop-blur-md z-50"
                onMouseLeave={() => setThemeDropdownOpen(false)}
              >
                <div className="px-2 py-1 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  Board Theme
                </div>
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setBoardTheme(t.id);
                      setThemeDropdownOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                      boardTheme === t.id
                        ? "bg-neutral-800 text-emerald-400"
                        : "text-neutral-300 hover:bg-neutral-800/60 hover:text-white"
                    }`}
                  >
                    <span className={`h-3 w-3 rounded-full ${t.color}`} />
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User Profile / Auth Button */}
          {session?.user ? (
            <button
              type="button"
              onClick={() => openModal("profile")}
              className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600/30 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                {session.user.name ? session.user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <span className="max-w-[120px] truncate">{session.user.name}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openModal("auth")}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
            >
              <UserIcon className="h-4 w-4" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

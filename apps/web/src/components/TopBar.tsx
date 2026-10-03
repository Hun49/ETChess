import { Bell, Search, User, Volume2, VolumeX, Wifi } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useSession } from "../lib/api";
import { useGameStore } from "../store/gameStore";

export const TopBar: React.FC = () => {
  const { mode, latencyMs, isSoundMuted, toggleSound, openModal, setActiveView } = useGameStore();

  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState("");

  const userName = session?.user?.name || "AlexRook";

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-[#14282c] bg-[#081214]/90 px-4 md:px-8 backdrop-blur-md">
      {/* Search Input matching mockup */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#587277]">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players, games, or openings..."
            className="w-full rounded-xl border border-[#14282c] bg-[#0e1e22] py-2 pl-9 pr-8 text-xs text-white placeholder-[#587277] focus:border-[#00e699] focus:outline-none transition-colors"
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
            <span className="rounded bg-[#14282c] px-1.5 py-0.5 text-[10px] font-mono text-[#587277]">
              /
            </span>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 ml-4">
        {/* Real-time Latency (when in online match) */}
        {mode === "online" && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0e1e22] border border-[#14282c] text-xs text-[#8ba3a8]">
            <Wifi
              className={`h-3.5 w-3.5 ${
                latencyMs < 60
                  ? "text-[#00e699]"
                  : latencyMs < 140
                    ? "text-amber-400"
                    : "text-red-400"
              }`}
            />
            <span className="font-mono text-[11px]">{latencyMs}ms</span>
          </div>
        )}

        {/* Audio Toggle */}
        <button
          type="button"
          onClick={toggleSound}
          aria-label={isSoundMuted ? "Unmute" : "Mute"}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#14282c] bg-[#0e1e22] text-[#8ba3a8] hover:text-white transition-colors"
        >
          {isSoundMuted ? (
            <VolumeX className="h-4 w-4 text-neutral-500" />
          ) : (
            <Volume2 className="h-4 w-4 text-[#00e699]" />
          )}
        </button>

        {/* Notifications Bell */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[#14282c] bg-[#0e1e22] text-[#8ba3a8] hover:text-white transition-colors"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#00e699]" />
        </button>

        {/* User Profile Avatar */}
        {session?.user ? (
          <button
            type="button"
            onClick={() => setActiveView("profile")}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-[#0e1e22] transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#18363c] text-white font-bold text-xs border border-[#234e57]">
              {userName.charAt(0).toUpperCase()}
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openModal("auth")}
            className="flex items-center gap-1.5 rounded-xl bg-[#00e699] px-3 py-1.5 text-xs font-bold text-neutral-950 shadow-sm hover:bg-[#00e699]/90 transition-all cursor-pointer"
          >
            <User className="h-3.5 w-3.5" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};

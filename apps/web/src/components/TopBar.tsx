import { Bell, User, Volume2, VolumeX, Wifi } from "lucide-react";
import type React from "react";
import { useSession } from "../lib/api";
import { useGameStore } from "../store/gameStore";
import { VerifiedBadge } from "./VerifiedBadge";

export const TopBar: React.FC = () => {
  const {
    mode,
    latencyMs,
    isSoundMuted,
    toggleSound,
    openModal,
    setActiveView,
    guestName,
    notifications,
    toggleNotificationDrawer,
  } = useGameStore();

  const { data: session } = useSession();

  const userName = session?.user?.name || guestName;
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-[#14282c] bg-[#081214]/90 px-4 md:px-8 backdrop-blur-md">
      {/* Left Title / Breadcrumb */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-extrabold tracking-tight text-white">ET-Chess</span>
        <span className="text-[10px] text-[#587277] font-mono">v1.0</span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
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

        {/* Notifications Bell (Opens Side Drawer) */}
        <button
          type="button"
          onClick={toggleNotificationDrawer}
          aria-label="Notifications"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[#14282c] bg-[#0e1e22] text-[#8ba3a8] hover:text-white transition-colors cursor-pointer"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#00e699] px-1 text-[9px] font-black text-neutral-950 shadow-sm">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* User Profile Avatar / Guest Mode */}
        {session?.user ? (
          <button
            type="button"
            onClick={() => setActiveView("profile")}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-[#0e1e22] transition-colors"
          >
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-[#18363c] text-white font-bold text-xs border border-[#234e57]">
              {userName.charAt(0).toUpperCase()}
              {session.user.emailVerified && (
                <span className="absolute -top-1 -right-1">
                  <VerifiedBadge size="sm" />
                </span>
              )}
            </div>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block rounded-lg border border-[#162e33] bg-[#0e1e22] px-2.5 py-1 text-[11px] font-mono text-[#8ba3a8]">
              {guestName}
            </span>
            <button
              type="button"
              onClick={() => openModal("auth")}
              className="flex items-center gap-1.5 rounded-xl bg-[#00e699] px-3 py-1.5 text-xs font-bold text-neutral-950 shadow-sm hover:bg-[#00e699]/90 transition-all cursor-pointer"
            >
              <User className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

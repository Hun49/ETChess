import {
  ChevronDown,
  ChevronRight,
  Cpu,
  Globe,
  History,
  Home,
  Monitor,
  Settings,
  Swords,
  User,
  UserCheck,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useSession } from "../lib/api";
import { type AppView, useGameStore } from "../store/gameStore";
import { VerifiedBadge } from "./VerifiedBadge";

export const Sidebar: React.FC = () => {
  const { activeView, setActiveView, openModal, guestName } = useGameStore();
  const { data: session } = useSession();
  const [playMenuOpen, setPlayMenuOpen] = useState(true);

  const isPlayActive =
    activeView === "play_online" ||
    activeView === "play_friend" ||
    activeView === "play_computer" ||
    activeView === "play_local" ||
    activeView === "searching" ||
    activeView === "match_found" ||
    activeView === "game";

  const userName = session?.user?.name || guestName;

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 bg-[#081214] border-r border-[#14282c] select-none h-screen sticky top-0">
      {/* Brand Header - Clean Text Typography */}
      <div className="flex items-center px-6 py-6 border-b border-[#14282c]/60">
        <button
          type="button"
          onClick={() => setActiveView("home")}
          className="text-left focus:outline-none group cursor-pointer"
        >
          <span className="font-black text-xl tracking-tight text-white group-hover:text-[#00e699] transition-colors">
            ET-Chess
          </span>
          <p className="text-[10px] text-[#8ba3a8] font-medium leading-none mt-1">
            Play. Learn. Improve.
          </p>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {/* Home */}
        <button
          type="button"
          onClick={() => setActiveView("home")}
          className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeView === "home"
              ? "bg-[#102428] text-[#00e699] shadow-sm"
              : "text-[#8ba3a8] hover:text-white hover:bg-[#0e1e22]"
          }`}
        >
          <Home className="h-4 w-4" />
          <span>Home</span>
        </button>

        {/* Play (Expandable) */}
        <div>
          <button
            type="button"
            onClick={() => {
              setPlayMenuOpen(!playMenuOpen);
              if (!isPlayActive) setActiveView("play_online");
            }}
            className={`flex w-full items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              isPlayActive
                ? "bg-[#102428] text-[#00e699]"
                : "text-[#8ba3a8] hover:text-white hover:bg-[#0e1e22]"
            }`}
          >
            <div className="flex items-center gap-3">
              <Swords className="h-4 w-4" />
              <span>Play</span>
            </div>
            {playMenuOpen ? (
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            )}
          </button>

          {playMenuOpen && (
            <div className="ml-7 mt-1 space-y-1 pl-2 border-l border-[#162e33]">
              <button
                type="button"
                onClick={() => setActiveView("play_online")}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeView === "play_online" ||
                  activeView === "searching" ||
                  activeView === "match_found"
                    ? "text-[#00e699] bg-[#00e699]/10 font-semibold"
                    : "text-[#8ba3a8] hover:text-white"
                }`}
              >
                <Globe className="h-3 w-3" />
                <span>Online</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView("play_friend")}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeView === "play_friend"
                    ? "text-[#00e699] bg-[#00e699]/10 font-semibold"
                    : "text-[#8ba3a8] hover:text-white"
                }`}
              >
                <UserCheck className="h-3 w-3" />
                <span>Friend</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView("play_computer")}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeView === "play_computer"
                    ? "text-[#00e699] bg-[#00e699]/10 font-semibold"
                    : "text-[#8ba3a8] hover:text-white"
                }`}
              >
                <Cpu className="h-3 w-3" />
                <span>Computer</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView("play_local")}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeView === "play_local"
                    ? "text-[#00e699] bg-[#00e699]/10 font-semibold"
                    : "text-[#8ba3a8] hover:text-white"
                }`}
              >
                <Monitor className="h-3 w-3" />
                <span>Local</span>
              </button>
            </div>
          )}
        </div>

        {/* History */}
        <button
          type="button"
          onClick={() => setActiveView("history")}
          className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeView === "history"
              ? "bg-[#102428] text-[#00e699] shadow-sm"
              : "text-[#8ba3a8] hover:text-white hover:bg-[#0e1e22]"
          }`}
        >
          <History className="h-4 w-4" />
          <span>History</span>
        </button>

        {/* Profile */}
        <button
          type="button"
          onClick={() => setActiveView("profile")}
          className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeView === "profile"
              ? "bg-[#102428] text-[#00e699] shadow-sm"
              : "text-[#8ba3a8] hover:text-white hover:bg-[#0e1e22]"
          }`}
        >
          <User className="h-4 w-4" />
          <span>Profile</span>
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={() => setActiveView("settings")}
          className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeView === "settings"
              ? "bg-[#102428] text-[#00e699] shadow-sm"
              : "text-[#8ba3a8] hover:text-white hover:bg-[#0e1e22]"
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </button>
      </nav>

      {/* User Profile Card at Bottom */}
      <div className="p-3 border-t border-[#14282c]/80">
        {session?.user ? (
          <button
            type="button"
            onClick={() => setActiveView("profile")}
            className="flex w-full items-center gap-3 p-2 rounded-xl bg-[#0e1e22] hover:bg-[#122429] transition-colors border border-[#162c31]"
          >
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#18363c] text-white font-bold text-xs border border-[#234e57]">
                {userName.charAt(0).toUpperCase()}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#00e699] ring-2 ring-[#081214]" />
            </div>
            <div className="text-left overflow-hidden">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white truncate">
                <span className="truncate">{userName}</span>
                {session.user.emailVerified && <VerifiedBadge size="sm" />}
              </div>
              <div className="text-[10px] text-[#00e699] font-medium flex items-center gap-1">
                <span>Online</span>
              </div>
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openModal("auth")}
            className="flex w-full items-center gap-3 p-2 rounded-xl bg-[#0e1e22] hover:bg-[#14282c] transition-colors border border-[#162c31]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#00e699]/15 text-[#00e699] font-bold text-xs border border-[#00e699]/30">
              <User className="h-4 w-4" />
            </div>
            <div className="text-left overflow-hidden">
              <div className="text-xs font-bold text-white truncate">{guestName}</div>
              <div className="text-[10px] text-[#00e699] font-medium">Click to Sign Up</div>
            </div>
          </button>
        )}
      </div>
    </aside>
  );
};

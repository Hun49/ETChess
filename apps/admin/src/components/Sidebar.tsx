import {
  Award,
  BarChart2,
  History,
  LayoutDashboard,
  Mail,
  Radio,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  TrendingUp,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import type React from "react";
import type { AdminView } from "../types.js";

interface SidebarProps {
  currentView: AdminView;
  onSelectView: (view: AdminView) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onSelectView }) => {
  return (
    <aside className="w-64 bg-[#0d1520] border-r border-[#1a2634] flex flex-col justify-between shrink-0 select-none">
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="p-5 flex items-center gap-3 border-b border-[#1a2634]/60">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-950/40">
            {/* ET Chess Knight Logo Icon with Ethiopian Tri-Color Flare */}
            <svg viewBox="0 0 45 45" className="w-7 h-7 drop-shadow-md" aria-hidden="true">
              <path
                d="M 22,10 C 32.5,11 38.5,18 38,39 H 15 C 15,30 25,32.5 23,17"
                fill="#10b981"
                stroke="#059669"
                strokeWidth="1.5"
              />
              <path
                d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.96,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 6,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 14,9.5 15.5,9 16.5,9 C 17.5,9 19,10 19,10.5 C 19,12 19.5,13 21,13 C 22.5,13 23.5,12 24,10.5 Z"
                fill="#f59e0b"
                stroke="#d97706"
                strokeWidth="1.5"
              />
              <circle cx="9.5" cy="25.5" r="1.5" fill="#ef4444" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-lg text-white tracking-tight flex items-center gap-1.5">
              ET-Chess
            </h1>
            <p className="text-[11px] font-medium text-slate-400">Admin Panel</p>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="px-3 py-4 space-y-6 overflow-y-auto max-h-[calc(100vh-190px)]">
          {/* Main Dashboard */}
          <div>
            <button
              type="button"
              onClick={() => onSelectView("dashboard")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                currentView === "dashboard"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#131d2a]"
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-emerald-400" />
              <span>Dashboard</span>
            </button>
          </div>

          {/* Group: USERS */}
          <div className="space-y-1">
            <span className="px-3 text-[11px] font-semibold text-slate-500 tracking-wider uppercase">
              Users
            </span>
            <button
              type="button"
              onClick={() => onSelectView("users")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === "users"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#131d2a]"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Users</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectView("verifications")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === "verifications"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#131d2a]"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Verifications</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectView("bans")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === "bans"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#131d2a]"
              }`}
            >
              <UserX className="w-4 h-4" />
              <span>Bans & Suspensions</span>
            </button>
          </div>

          {/* Group: GAMES */}
          <div className="space-y-1">
            <span className="px-3 text-[11px] font-semibold text-slate-500 tracking-wider uppercase">
              Games
            </span>
            <button
              type="button"
              onClick={() => onSelectView("live-games")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === "live-games"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#131d2a]"
              }`}
            >
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <div className="flex items-center justify-between w-full">
                <span>Live Games</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
            </button>
            <button
              type="button"
              onClick={() => onSelectView("game-history")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === "game-history"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#131d2a]"
              }`}
            >
              <History className="w-4 h-4" />
              <span>Game History</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectView("settlements")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === "settlements"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#131d2a]"
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Settlements</span>
            </button>
          </div>

          {/* Group: RATINGS */}
          <div className="space-y-1">
            <span className="px-3 text-[11px] font-semibold text-slate-500 tracking-wider uppercase">
              Ratings
            </span>
            <button
              type="button"
              onClick={() => onSelectView("ratings-overview")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === "ratings-overview"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#131d2a]"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Ratings Overview</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectView("rating-adjustments")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === "rating-adjustments"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#131d2a]"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Rating Adjustments</span>
            </button>
          </div>

          {/* Group: CHALLENGES */}
          <div className="space-y-1">
            <span className="px-3 text-[11px] font-semibold text-slate-500 tracking-wider uppercase">
              Challenges
            </span>
            <button
              type="button"
              onClick={() => onSelectView("friend-challenges")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === "friend-challenges"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#131d2a]"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Friend Challenges</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectView("pending-invites")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === "pending-invites"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#131d2a]"
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Pending Invites</span>
            </button>
          </div>

          {/* Group: SYSTEM */}
          <div className="space-y-1">
            <span className="px-3 text-[11px] font-semibold text-slate-500 tracking-wider uppercase">
              System
            </span>
            <button
              type="button"
              onClick={() => onSelectView("logs")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === "logs"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#131d2a]"
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>Logs</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectView("analytics")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === "analytics"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#131d2a]"
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>Analytics</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectView("settings")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === "settings"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#131d2a]"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="p-4 border-t border-[#1a2634]/60 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <span className="text-emerald-400 font-bold text-xs">ET</span>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-300">ET-Chess</p>
          <p className="text-[10px] text-slate-500">Play. Learn. Improve. • v1.0.0</p>
        </div>
      </div>
    </aside>
  );
};

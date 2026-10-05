import { Bell, Command, Moon, Radio, Search, ShieldAlert, Sun, Users, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import type { AdminView } from "../types.js";

interface HeaderProps {
  onNavigate: (view: AdminView) => void;
}

export const Header: React.FC<HeaderProps> = ({ onNavigate }) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDark, setIsDark] = useState(true);

  return (
    <>
      <header className="h-16 px-6 bg-[#0b1118]/80 backdrop-blur-md border-b border-[#1a2634] flex items-center justify-between sticky top-0 z-30">
        {/* Search bar */}
        <div className="flex-1 max-w-xl">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-2 bg-[#121c26] border border-[#1e2d3d] hover:border-emerald-500/40 rounded-xl text-slate-400 text-xs transition-all shadow-inner"
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-4 h-4 text-slate-400" />
              <span>Search users, games, or anything...</span>
            </div>
            <kbd className="hidden sm:flex items-center gap-0.5 px-2 py-0.5 bg-[#1a2634] border border-[#233549] rounded text-[10px] font-mono text-slate-300">
              <Command className="w-3 h-3" />K
            </kbd>
          </button>
        </div>

        {/* Right tools and profile */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button
            type="button"
            className="relative p-2 rounded-xl bg-[#121c26] border border-[#1e2d3d] text-slate-400 hover:text-slate-200 hover:border-emerald-500/30 transition-all"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0b1118]" />
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-xl bg-[#121c26] border border-[#1e2d3d] text-slate-400 hover:text-slate-200 hover:border-emerald-500/30 transition-all"
            title="Toggle theme"
          >
            {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* User profile */}
          <div className="flex items-center gap-3 pl-2 border-l border-[#1a2634]">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-md shadow-emerald-950/50">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
                  alt="Administrator Avatar"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0b1118]" />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-slate-200 leading-tight">Hundaol Worku</p>
              <p className="text-[10px] text-emerald-400 font-medium">Administrator</p>
            </div>
          </div>
        </div>
      </header>

      {/* ⌘K Command Palette Modal */}
      {isSearchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
          onClick={() => setIsSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-[#121c26] border border-[#233549] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 border-b border-[#1e2d3d] flex items-center gap-3">
              <Search className="w-5 h-5 text-emerald-400" />
              <input
                type="text"
                placeholder="Type a command, player name, or game ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1e2d3d]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Quick Navigation
              </div>
              <button
                type="button"
                onClick={() => {
                  onNavigate("live-games");
                  setIsSearchOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors"
              >
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>Jump to Live Games Monitor</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate("users");
                  setIsSearchOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors"
              >
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Search & Manage Users</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate("bans");
                  setIsSearchOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors"
              >
                <ShieldAlert className="w-4 h-4 text-emerald-400" />
                <span>Reports & Pending Moderation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

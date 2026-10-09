import {
  ArrowLeft,
  Bell,
  Check,
  CheckCircle,
  Eye,
  Globe,
  HelpCircle,
  Layout,
  Lock,
  LogOut,
  Moon,
  Palette,
  Shield,
  Sliders,
  Sparkles,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { signOut, useSession } from "../lib/api";
import { type BoardTheme, useGameStore } from "../store/gameStore";

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    setActiveView,
    boardTheme,
    setBoardTheme,
    isSoundMuted,
    toggleSound,
    isGuest,
    guestName,
    openModal,
    setIsGuest,
  } = useGameStore();
  const { data: session } = useSession();

  const [activeTab, setActiveTab] = useState<"board" | "audio" | "gameplay" | "account">("board");
  const [savedToast, setSavedToast] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      setIsGuest(true);
      window.location.reload();
    } catch (err) {
      console.error("Failed to sign out:", err);
      setIsSigningOut(false);
    }
  };

  const triggerToast = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  const themes: {
    id: "classic" | "wood" | "blue" | "dark";
    name: string;
    light: string;
    dark: string;
  }[] = [
    { id: "classic", name: "Classic Mint", light: "#e2e8f0", dark: "#2d6a4f" },
    { id: "wood", name: "Walnut Wood", light: "#f0d9b5", dark: "#b58863" },
    { id: "blue", name: "Ocean Marine", light: "#dee3e6", dark: "#386687" },
    { id: "dark", name: "Slate Charcoal", light: "#334155", dark: "#1e293b" },
  ];

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[#081214] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#14282c] pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView("home")}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#14282c] bg-[#0b171a] text-neutral-300 hover:border-[#00e699] hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">
                Preferences & Settings
              </h1>
              <p className="text-xs text-[#8ba3a8]">
                Personalize board graphics, audio feedback, and move helpers
              </p>
            </div>
          </div>

          {savedToast && (
            <div className="flex items-center gap-1.5 rounded-xl border border-[#00e699]/30 bg-[#00e699]/15 px-3 py-1.5 text-xs font-bold text-[#00e699] animate-fade-in">
              <Check className="h-3.5 w-3.5" />
              <span>Saved</span>
            </div>
          )}
        </div>

        {/* Tab Selector */}
        <div className="flex rounded-2xl border border-[#14282c] bg-[#0b171a] p-1.5 gap-1 overflow-x-auto">
          {(
            [
              { id: "board", label: "Board & Theme", icon: Palette },
              { id: "audio", label: "Sound & Audio", icon: Volume2 },
              { id: "gameplay", label: "Gameplay", icon: Sliders },
              { id: "account", label: "Account", icon: User },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-[#0e1e22] text-[#00e699] border border-[#162e33] shadow-sm"
                    : "text-[#8ba3a8] hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: Board Theme */}
        {activeTab === "board" && (
          <div className="space-y-6">
            {/* Theme Picker Grid */}
            <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8ba3a8]">
                Board Color Scheme
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {themes.map((t) => {
                  const isSelected = (settings.boardTheme || "classic") === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        updateSettings({ boardTheme: t.id });
                        setBoardTheme(t.id as BoardTheme);
                        triggerToast();
                      }}
                      className={`flex flex-col items-center rounded-2xl border p-3.5 transition-all text-center ${
                        isSelected
                          ? "border-[#00e699] bg-[#00e699]/10 shadow-md shadow-[#00e699]/10"
                          : "border-[#162e33] bg-[#0e1e22] hover:border-[#22444c]"
                      }`}
                    >
                      {/* 2x2 miniature board preview */}
                      <div className="mb-3 h-14 w-14 overflow-hidden rounded-xl border border-[#14282c] grid grid-cols-2 shadow-inner">
                        <div style={{ backgroundColor: t.light }} />
                        <div style={{ backgroundColor: t.dark }} />
                        <div style={{ backgroundColor: t.dark }} />
                        <div style={{ backgroundColor: t.light }} />
                      </div>
                      <span className="text-xs font-bold text-white mb-0.5">{t.name}</span>
                      {isSelected && (
                        <span className="text-[10px] font-bold text-[#00e699] flex items-center gap-1">
                          <Check className="h-3 w-3" /> Active
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Board Visual Options */}
            <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8ba3a8] block mb-2">
                Visual Elements
              </span>

              {/* Coordinates Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-[#162e33] bg-[#0e1e22] p-3.5">
                <div>
                  <span className="text-xs font-bold text-white block">Board Coordinates</span>
                  <span className="text-[11px] text-[#8ba3a8]">
                    Show letters (a-h) and numbers (1-8) along board edges
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    updateSettings({ coordinates: !settings.coordinates });
                    triggerToast();
                  }}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    settings.coordinates ? "bg-[#00e699]" : "bg-neutral-800"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.coordinates ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Move Animations Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-[#162e33] bg-[#0e1e22] p-3.5">
                <div>
                  <span className="text-xs font-bold text-white block">Piece Animations</span>
                  <span className="text-[11px] text-[#8ba3a8]">
                    Smooth sliding animation when pieces move
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    updateSettings({ animations: !settings.animations });
                    triggerToast();
                  }}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    settings.animations ? "bg-[#00e699]" : "bg-neutral-800"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.animations ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Piece Style Selector */}
              <div className="flex items-center justify-between rounded-xl border border-[#162e33] bg-[#0e1e22] p-3.5">
                <div>
                  <span className="text-xs font-bold text-white block">Piece Artwork</span>
                  <span className="text-[11px] text-[#8ba3a8]">Standard SVG piece font</span>
                </div>
                <div className="flex rounded-lg border border-[#14282c] bg-[#0b171a] p-1 gap-1">
                  {(["classic", "modern", "minimal"] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => {
                        updateSettings({ pieceStyle: style });
                        triggerToast();
                      }}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-bold capitalize transition-all ${
                        settings.pieceStyle === style
                          ? "bg-[#00e699] text-[#081214]"
                          : "text-[#8ba3a8] hover:text-white"
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Sound & Audio */}
        {activeTab === "audio" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-[#14282c] pb-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8ba3a8] block">
                    Sound Effects
                  </span>
                  <span className="text-[11px] text-[#8ba3a8]">Toggle individual game sounds</span>
                </div>
                <button
                  type="button"
                  onClick={toggleSound}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                    isSoundMuted
                      ? "border-red-500/30 bg-red-500/10 text-red-400"
                      : "border-[#00e699]/30 bg-[#00e699]/15 text-[#00e699]"
                  }`}
                >
                  {isSoundMuted ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                  <span>{isSoundMuted ? "All Sound Muted" : "Sound Enabled"}</span>
                </button>
              </div>

              {/* Move Sound */}
              <div className="flex items-center justify-between rounded-xl border border-[#162e33] bg-[#0e1e22] p-3.5">
                <div>
                  <span className="text-xs font-bold text-white block">Move Sound</span>
                  <span className="text-[11px] text-[#8ba3a8]">
                    Gentle wood thud on regular moves
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    updateSettings({ moveSound: !settings.moveSound });
                    triggerToast();
                  }}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    settings.moveSound ? "bg-[#00e699]" : "bg-neutral-800"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.moveSound ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Capture Sound */}
              <div className="flex items-center justify-between rounded-xl border border-[#162e33] bg-[#0e1e22] p-3.5">
                <div>
                  <span className="text-xs font-bold text-white block">Capture Sound</span>
                  <span className="text-[11px] text-[#8ba3a8]">
                    Crisp strike sound when pieces are taken
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    updateSettings({ captureSound: !settings.captureSound });
                    triggerToast();
                  }}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    settings.captureSound ? "bg-[#00e699]" : "bg-neutral-800"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.captureSound ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Check Alert */}
              <div className="flex items-center justify-between rounded-xl border border-[#162e33] bg-[#0e1e22] p-3.5">
                <div>
                  <span className="text-xs font-bold text-white block">Check Warning Sound</span>
                  <span className="text-[11px] text-[#8ba3a8]">
                    Distinct chime when a king is checked
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    updateSettings({ checkSound: !settings.checkSound });
                    triggerToast();
                  }}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    settings.checkSound ? "bg-[#00e699]" : "bg-neutral-800"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.checkSound ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Low Clock Alert */}
              <div className="flex items-center justify-between rounded-xl border border-[#162e33] bg-[#0e1e22] p-3.5">
                <div>
                  <span className="text-xs font-bold text-white block">Low Time Warning</span>
                  <span className="text-[11px] text-[#8ba3a8]">
                    Audio warning when clock drops under 20 seconds
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    updateSettings({ clockWarning: !settings.clockWarning });
                    triggerToast();
                  }}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    settings.clockWarning ? "bg-[#00e699]" : "bg-neutral-800"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.clockWarning ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Gameplay */}
        {activeTab === "gameplay" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8ba3a8] block mb-2">
                Move Input & Behavior
              </span>

              {/* Confirm Resignation */}
              <div className="flex items-center justify-between rounded-xl border border-[#162e33] bg-[#0e1e22] p-3.5">
                <div>
                  <span className="text-xs font-bold text-white block">Confirm Resignation</span>
                  <span className="text-[11px] text-[#8ba3a8]">
                    Requires secondary click confirmation before resigning
                  </span>
                </div>
                <div className="h-6 w-11 rounded-full bg-[#00e699] flex items-center px-1">
                  <span className="h-4 w-4 rounded-full bg-white translate-x-5" />
                </div>
              </div>

              {/* Auto Queen */}
              <div className="flex items-center justify-between rounded-xl border border-[#162e33] bg-[#0e1e22] p-3.5">
                <div>
                  <span className="text-xs font-bold text-white block">Pawn Promotion Dialog</span>
                  <span className="text-[11px] text-[#8ba3a8]">
                    Always choose between Queen, Rook, Bishop, Knight
                  </span>
                </div>
                <div className="h-6 w-11 rounded-full bg-[#00e699] flex items-center px-1">
                  <span className="h-4 w-4 rounded-full bg-white translate-x-5" />
                </div>
              </div>

              {/* Premoves */}
              <div className="flex items-center justify-between rounded-xl border border-[#162e33] bg-[#0e1e22] p-3.5">
                <div>
                  <span className="text-xs font-bold text-white block">Allow Premoves</span>
                  <span className="text-[11px] text-[#8ba3a8]">
                    Queue moves while opponent's clock is ticking
                  </span>
                </div>
                <div className="h-6 w-11 rounded-full bg-[#00e699] flex items-center px-1">
                  <span className="h-4 w-4 rounded-full bg-white translate-x-5" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Account */}
        {activeTab === "account" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8ba3a8] block">
                Account Information
              </span>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-[#162e33] bg-[#0e1e22] p-3.5">
                  <span className="text-xs text-[#8ba3a8]">Username</span>
                  <span className="text-xs font-bold text-white">
                    {session?.user?.name || (isGuest ? guestName : "Anonymous")}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#162e33] bg-[#0e1e22] p-3.5">
                  <span className="text-xs text-[#8ba3a8]">Email</span>
                  <span className="text-xs font-bold text-white font-mono">
                    {session?.user?.email || (isGuest ? "Not configured (Guest)" : "None")}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#162e33] bg-[#0e1e22] p-3.5">
                  <span className="text-xs text-[#8ba3a8]">Account Status</span>
                  <span
                    className={`text-xs font-bold ${
                      session?.user?.emailVerified
                        ? "text-[#00e699]"
                        : session?.user
                          ? "text-amber-400"
                          : "text-[#8ba3a8]"
                    }`}
                  >
                    {session?.user?.emailVerified
                      ? "Active • Verified"
                      : session?.user
                        ? "Active • Unverified"
                        : "Guest Session (Unregistered)"}
                  </span>
                </div>

                {/* Account Actions */}
                <div className="pt-2">
                  {session?.user ? (
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/25 px-4 py-3 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>{isSigningOut ? "Signing Out..." : "Sign Out of Account"}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openModal("auth")}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#00e699] px-4 py-3 text-xs font-bold text-neutral-950 hover:bg-[#00c885] transition-all cursor-pointer shadow-md shadow-[#00e699]/10"
                    >
                      <User className="h-4 w-4" />
                      <span>Sign In / Create Account</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

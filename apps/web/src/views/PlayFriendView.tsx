import type { TimeControlKey } from "@etchess/types";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Flame,
  Globe,
  QrCode,
  Radio,
  Share2,
  Shield,
  ShieldAlert,
  Shuffle,
  Sparkles,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useSession } from "../lib/api";
import { useGameStore } from "../store/gameStore";

export const PlayFriendView: React.FC = () => {
  const {
    friendChallenge,
    createFriendChallenge,
    cancelFriendChallenge,
    setActiveView,
    isGuest,
    openModal,
  } = useGameStore();
  const { data: session } = useSession();

  const [selectedTc, setSelectedTc] = useState<TimeControlKey>("3+2");
  const [selectedColor, setSelectedColor] = useState<"white" | "black" | "random">("random");
  const [isRated, setIsRated] = useState(true);
  const [allowTakeback, setAllowTakeback] = useState(false);
  const [allowTimeGift, setAllowTimeGift] = useState(true);
  const [copied, setCopied] = useState(false);

  // Time controls grouped
  const timeCategories = [
    {
      category: "Bullet",
      icon: Zap,
      tcs: [
        { key: "1+0" as const, label: "1 min", sub: "1+0" },
        { key: "2+0" as const, label: "2 min", sub: "2+0" },
      ],
    },
    {
      category: "Blitz",
      icon: Flame,
      tcs: [
        { key: "3+0" as const, label: "3 min", sub: "3+0" },
        { key: "3+2" as const, label: "3 | 2", sub: "3+2" },
        { key: "5+0" as const, label: "5 min", sub: "5+0" },
        { key: "5+3" as const, label: "5 | 3", sub: "5+3" },
      ],
    },
    {
      category: "Rapid",
      icon: Clock,
      tcs: [
        { key: "10+0" as const, label: "10 min", sub: "10+0" },
        { key: "10+5" as const, label: "10 | 5", sub: "10+5" },
        { key: "15+10" as const, label: "15 | 10", sub: "15+10" },
      ],
    },
  ];

  const handleCreate = () => {
    createFriendChallenge({
      timeControl: selectedTc,
      color: selectedColor,
      rated: isRated,
      takeback: allowTakeback,
      timeGift: allowTimeGift,
    });
  };

  const challengeUrl = friendChallenge
    ? `${window.location.origin}/?challenge=${friendChallenge.id}`
    : "";

  const handleCopyLink = () => {
    if (!challengeUrl) return;
    navigator.clipboard.writeText(challengeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[#081214] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        {/* Header */}
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
              <h1 className="text-xl font-black text-white tracking-tight">Play a Friend</h1>
              <p className="text-xs text-[#8ba3a8]">
                Generate an invite link and challenge someone in real-time
              </p>
            </div>
          </div>
        </div>

        {/* Guest Lockout State */}
        {isGuest || !session?.user ? (
          <div className="rounded-3xl border border-[#14282c] bg-[#0b171a] p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h2 className="text-xl font-black text-white">Registered Account Required</h2>
              <p className="text-xs text-[#8ba3a8] leading-relaxed">
                Guest accounts can only play casual unrated matchmaking against other online guests
                or practice against the computer. To add friends, generate private challenge links,
                and play friend games, please create a free account.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => openModal("auth")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#00e699] px-6 py-3 text-xs font-black text-[#081214] shadow-lg shadow-[#00e699]/15 hover:bg-[#00c885] transition-all cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>Create Free Account</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView("play_online")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-[#162e33] bg-[#0e1e22] px-6 py-3 text-xs font-bold text-white hover:bg-[#122429] transition-all cursor-pointer"
              >
                <span>Play Guest Online</span>
              </button>
            </div>
          </div>
        ) : friendChallenge ? (
          <div className="rounded-3xl border border-[#14282c] bg-[#0b171a] p-6 sm:p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute right-0 top-0 h-64 w-64 translate-x-12 -translate-y-12 rounded-full bg-[#00e699]/10 blur-3xl pointer-events-none" />

            {/* Radar Pulsing Animation */}
            <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
              <span className="absolute h-full w-full rounded-full bg-[#00e699]/10 animate-ping" />
              <span className="absolute h-20 w-20 rounded-full bg-[#00e699]/20 animate-pulse" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00e699] text-[#081214] shadow-xl shadow-[#00e699]/20">
                <Users className="h-8 w-8" />
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-black text-white">Challenge Ready!</h2>
              <p className="text-xs text-[#8ba3a8] mt-1 max-w-md mx-auto">
                Share this link with your friend. The game will automatically launch as soon as they
                open the link.
              </p>
            </div>

            {/* Challenge Info Badge */}
            <div className="inline-flex items-center gap-2 rounded-xl border border-[#162e33] bg-[#0e1e22] px-4 py-2 text-xs font-mono text-neutral-200">
              <span className="font-bold text-[#00e699]">{friendChallenge.timeControl}</span>
              <span>•</span>
              <span className="capitalize">{friendChallenge.color}</span>
              <span>•</span>
              <span>{friendChallenge.rated ? "Rated" : "Casual"}</span>
            </div>

            {/* Invite Link Copy Box */}
            <div className="flex items-center gap-2 rounded-2xl border border-[#162e33] bg-[#0e1e22] p-2">
              <input
                type="text"
                readOnly
                value={challengeUrl}
                className="flex-1 bg-transparent px-3 text-xs font-mono text-white focus:outline-none truncate"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 rounded-xl bg-[#00e699] px-4 py-2.5 text-xs font-bold text-[#081214] hover:bg-[#00c885] transition-colors shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>

            {/* QR Code Placeholder Card */}
            <div className="rounded-2xl border border-[#14282c] bg-[#081214]/60 p-4 max-w-xs mx-auto flex items-center gap-3 text-left">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0e1e22] border border-[#162e33] text-[#00e699]">
                <QrCode className="h-6 w-6" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-white block">Scan to Play Mobile</span>
                <span className="text-[11px] text-[#8ba3a8]">
                  Your friend can open camera and scan
                </span>
              </div>
            </div>

            {/* Cancel Button */}
            <div>
              <button
                type="button"
                onClick={cancelFriendChallenge}
                className="rounded-xl border border-neutral-800 bg-[#0e1e22] px-5 py-2.5 text-xs font-semibold text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors"
              >
                Cancel Challenge
              </button>
            </div>
          </div>
        ) : (
          /* SCREEN 11: Setup Challenge Form */
          <div className="space-y-6">
            {/* Time Control Section */}
            <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8ba3a8]">
                1. Select Time Control
              </span>

              <div className="space-y-4">
                {timeCategories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <div key={cat.category} className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
                        <Icon className="h-3.5 w-3.5 text-[#00e699]" />
                        <span>{cat.category}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {cat.tcs.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setSelectedTc(item.key)}
                            className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all ${
                              selectedTc === item.key
                                ? "border-[#00e699] bg-[#00e699]/10 text-white shadow-sm shadow-[#00e699]/20"
                                : "border-[#162e33] bg-[#0e1e22] text-[#8ba3a8] hover:border-[#22444c] hover:text-white"
                            }`}
                          >
                            <span className="text-xs font-bold">{item.label}</span>
                            <span className="text-[10px] text-[#5d7378] font-mono">{item.sub}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Choose Color Section */}
            <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8ba3a8]">
                2. Choose Your Side
              </span>

              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedColor("white")}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition-all ${
                    selectedColor === "white"
                      ? "border-[#00e699] bg-[#00e699]/10 text-white"
                      : "border-[#162e33] bg-[#0e1e22] text-[#8ba3a8] hover:border-[#22444c]"
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#081214] text-xl font-bold shadow-md">
                    ♔
                  </div>
                  <span className="text-xs font-bold">White</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedColor("random")}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition-all ${
                    selectedColor === "random"
                      ? "border-[#00e699] bg-[#00e699]/10 text-white"
                      : "border-[#162e33] bg-[#0e1e22] text-[#8ba3a8] hover:border-[#22444c]"
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-white via-neutral-400 to-black text-white text-xl font-bold shadow-md">
                    <Shuffle className="h-5 w-5 text-neutral-900" />
                  </div>
                  <span className="text-xs font-bold">Random</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedColor("black")}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition-all ${
                    selectedColor === "black"
                      ? "border-[#00e699] bg-[#00e699]/10 text-white"
                      : "border-[#162e33] bg-[#0e1e22] text-[#8ba3a8] hover:border-[#22444c]"
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black border border-neutral-700 text-white text-xl font-bold shadow-md">
                    ♚
                  </div>
                  <span className="text-xs font-bold">Black</span>
                </button>
              </div>
            </div>

            {/* Match Options Toggles */}
            <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8ba3a8] block mb-2">
                3. Match Options
              </span>

              {/* Rated Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-[#162e33] bg-[#0e1e22] p-3">
                <div>
                  <span className="text-xs font-bold text-white block">Rated Match</span>
                  <span className="text-[11px] text-[#8ba3a8]">Affects online rating points</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRated(!isRated)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    isRated ? "bg-[#00e699]" : "bg-neutral-800"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isRated ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Takebacks */}
              <div className="flex items-center justify-between rounded-xl border border-[#162e33] bg-[#0e1e22] p-3">
                <div>
                  <span className="text-xs font-bold text-white block">Allow Takebacks</span>
                  <span className="text-[11px] text-[#8ba3a8]">
                    Players can request to undo moves
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAllowTakeback(!allowTakeback)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    allowTakeback ? "bg-[#00e699]" : "bg-neutral-800"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      allowTakeback ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Time Gift */}
              <div className="flex items-center justify-between rounded-xl border border-[#162e33] bg-[#0e1e22] p-3">
                <div>
                  <span className="text-xs font-bold text-white block">Allow Time Gifts</span>
                  <span className="text-[11px] text-[#8ba3a8]">
                    Give +15s to friend's clock during game
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAllowTimeGift(!allowTimeGift)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    allowTimeGift ? "bg-[#00e699]" : "bg-neutral-800"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      allowTimeGift ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Create CTA Button */}
            <button
              type="button"
              onClick={handleCreate}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#00e699] py-4 text-sm font-black text-[#081214] shadow-xl shadow-[#00e699]/20 hover:bg-[#00c885] transition-all"
            >
              <Share2 className="h-4 w-4" />
              <span>Create Challenge Link</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

import type { BotTier, TimeControlKey } from "@etchess/types";
import {
  ArrowLeft,
  Bot,
  Brain,
  Clock,
  Cpu,
  Flame,
  Play,
  Shield,
  Shuffle,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useGameStore } from "../store/gameStore";

interface BotLevel {
  id: BotTier;
  name: string;
  rating: number;
  description: string;
  avatarColor: string;
  icon: typeof Bot;
}

const BOT_TIERS: BotLevel[] = [
  {
    id: "beginner",
    name: "Tinkerer Bot",
    rating: 800,
    description:
      "Makes occasional tactical blunders. Great for beginners learning piece coordination.",
    avatarColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    icon: Bot,
  },
  {
    id: "intermediate",
    name: "Tactician Bot",
    rating: 1500,
    description: "Sharp tactical awareness and active piece development. Punishes mistakes.",
    avatarColor: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    icon: Brain,
  },
  {
    id: "advanced",
    name: "Master Bot",
    rating: 1850,
    description:
      "Deep positional maneuvering and endgame technique. Tough challenge for club players.",
    avatarColor: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    icon: Shield,
  },
  {
    id: "master",
    name: "Apex Grandmaster",
    rating: 2200,
    description: "Grandmaster-level Stockfish evaluation. Unforgiving precision across all phases.",
    avatarColor: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    icon: Trophy,
  },
];

export const PlayComputerView: React.FC = () => {
  const { startBotGame, setActiveView } = useGameStore();

  const [selectedTier, setSelectedTier] = useState<BotTier>("intermediate");
  const [selectedTc, setSelectedTc] = useState<TimeControlKey>("3+2");
  const [selectedColor, setSelectedColor] = useState<"white" | "black" | "random">("random");

  const timeOptions: { key: TimeControlKey; label: string; desc: string }[] = [
    { key: "1+0", label: "Bullet 1m", desc: "Fast & frantic" },
    { key: "3+2", label: "Blitz 3|2", desc: "Balanced standard" },
    { key: "5+3", label: "Blitz 5|3", desc: "Solid thinking time" },
    { key: "10+0", label: "Rapid 10m", desc: "Full calculation" },
  ];

  const handleStartGame = () => {
    startBotGame(selectedTier, selectedColor, selectedTc);
    setActiveView("game");
  };

  const currentBot = BOT_TIERS.find((b) => b.id === selectedTier) || BOT_TIERS[2];

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[#081214] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
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
              <h1 className="text-xl font-black text-white tracking-tight">Play vs Computer</h1>
              <p className="text-xs text-[#8ba3a8]">
                Challenge AI bots designed with varied skill tiers and playing styles
              </p>
            </div>
          </div>
        </div>

        {/* Bot Level Selector */}
        <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8ba3a8]">
            1. Select Bot Difficulty
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {BOT_TIERS.map((tier) => {
              const Icon = tier.icon;
              const isSelected = selectedTier === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelectedTier(tier.id)}
                  className={`flex flex-col text-left rounded-2xl border p-4 transition-all ${
                    isSelected
                      ? "border-[#00e699] bg-[#00e699]/10 shadow-md shadow-[#00e699]/10"
                      : "border-[#162e33] bg-[#0e1e22] hover:border-[#22444c]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border ${tier.avatarColor}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-xs font-bold text-white bg-[#0b171a] px-2 py-0.5 rounded-lg border border-[#14282c]">
                      {tier.rating}
                    </span>
                  </div>

                  <span className="text-sm font-bold text-white mb-1">{tier.name}</span>
                  <p className="text-[11px] text-[#8ba3a8] leading-snug line-clamp-2">
                    {tier.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Control & Color Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Time Control Options */}
          <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8ba3a8] block">
              2. Time Control
            </span>
            <div className="grid grid-cols-2 gap-2">
              {timeOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSelectedTc(opt.key)}
                  className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
                    selectedTc === opt.key
                      ? "border-[#00e699] bg-[#00e699]/10 text-white"
                      : "border-[#162e33] bg-[#0e1e22] text-[#8ba3a8] hover:border-[#22444c] hover:text-white"
                  }`}
                >
                  <span className="text-xs font-bold">{opt.label}</span>
                  <span className="text-[10px] text-[#5d7378]">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div className="rounded-2xl border border-[#14282c] bg-[#0b171a] p-5 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8ba3a8] block">
              3. Play As
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedColor("white")}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 transition-all ${
                  selectedColor === "white"
                    ? "border-[#00e699] bg-[#00e699]/10 text-white"
                    : "border-[#162e33] bg-[#0e1e22] text-[#8ba3a8]"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#081214] text-lg font-bold">
                  ♔
                </div>
                <span className="text-xs font-bold">White</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedColor("random")}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 transition-all ${
                  selectedColor === "random"
                    ? "border-[#00e699] bg-[#00e699]/10 text-white"
                    : "border-[#162e33] bg-[#0e1e22] text-[#8ba3a8]"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-white to-neutral-800 text-white">
                  <Shuffle className="h-4 w-4 text-neutral-900" />
                </div>
                <span className="text-xs font-bold">Random</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedColor("black")}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 transition-all ${
                  selectedColor === "black"
                    ? "border-[#00e699] bg-[#00e699]/10 text-white"
                    : "border-[#162e33] bg-[#0e1e22] text-[#8ba3a8]"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black border border-neutral-700 text-white text-lg font-bold">
                  ♚
                </div>
                <span className="text-xs font-bold">Black</span>
              </button>
            </div>
          </div>
        </div>

        {/* Start Game CTA */}
        <button
          type="button"
          onClick={handleStartGame}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#00e699] py-4 text-sm font-black text-[#081214] shadow-xl shadow-[#00e699]/20 hover:bg-[#00c885] transition-all"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>Start Match vs {currentBot.name}</span>
        </button>
      </div>
    </div>
  );
};

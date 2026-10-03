import { type BotTier, TIME_CONTROLS, type TimeControlKey } from "@etchess/types";
import { Bot, Check, Clock, Flame, Shield, Users, X, Zap } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useGameStore } from "../store/gameStore";

const BOT_TIER_OPTIONS: { id: BotTier; name: string; elo: number; description: string }[] = [
  {
    id: "beginner",
    name: "Beginner",
    elo: 800,
    description: "Makes frequent tactical blunders, perfect for learning",
  },
  {
    id: "intermediate",
    name: "Intermediate",
    elo: 1300,
    description: "Solid fundamentals, searches 2 moves ahead",
  },
  {
    id: "advanced",
    name: "Advanced",
    elo: 2000,
    description: "Tactical vision and positional awareness",
  },
  {
    id: "master",
    name: "Master",
    elo: 2800,
    description: "Deep calculations, punishing inaccuracies",
  },
];

export const PlayModal: React.FC = () => {
  const { activeModal, closeModal, joinMatchmaking, startBotGame, startPassAndPlay } =
    useGameStore();

  const [tab, setTab] = useState<"online" | "bot" | "local">("online");
  const [selectedTc, setSelectedTc] = useState<TimeControlKey>("3+2");
  const [rated, setRated] = useState(true);

  // Bot tab state
  const [botTier, setBotTier] = useState<BotTier>("intermediate");
  const [botColor, setBotColor] = useState<"white" | "random" | "black">("white");

  if (activeModal !== "play") return null;

  const timeControlList = Object.values(TIME_CONTROLS);

  const handleStartGame = () => {
    if (tab === "online") {
      joinMatchmaking(selectedTc, rated);
    } else if (tab === "bot") {
      startBotGame(botTier, botColor, selectedTc);
    } else {
      startPassAndPlay(selectedTc);
    }
  };

  return (
    <dialog
      open
      aria-labelledby="play-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200 border-none w-full h-full max-w-none max-h-none m-0"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl sm:p-8">
        {/* Close Button */}
        <button
          type="button"
          onClick={closeModal}
          aria-label="Close modal"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Title */}
        <h2 id="play-modal-title" className="text-xl font-bold text-white tracking-tight">
          Start a Game
        </h2>
        <p className="mt-1 text-xs text-neutral-400">
          Choose a play mode and time control to start playing immediately
        </p>

        {/* Tabs */}
        <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-neutral-950 p-1 border border-neutral-800">
          <button
            type="button"
            onClick={() => setTab("online")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
              tab === "online"
                ? "bg-neutral-800 text-emerald-400 shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Online
          </button>
          <button
            type="button"
            onClick={() => setTab("bot")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
              tab === "bot"
                ? "bg-neutral-800 text-emerald-400 shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            vs Bot
          </button>
          <button
            type="button"
            onClick={() => setTab("local")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
              tab === "local"
                ? "bg-neutral-800 text-emerald-400 shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Pass & Play
          </button>
        </div>

        {/* Content based on tab */}
        <div className="mt-6 space-y-5">
          {/* Time Control Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-neutral-300">Time Control</span>
              <span className="text-[11px] text-neutral-400">
                {TIME_CONTROLS[selectedTc].displayName} ({TIME_CONTROLS[selectedTc].category})
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-4">
              {timeControlList.map((tc) => {
                const isSelected = selectedTc === tc.key;
                return (
                  <button
                    key={tc.key}
                    type="button"
                    onClick={() => setSelectedTc(tc.key)}
                    className={`flex flex-col items-center justify-center rounded-xl border p-2.5 transition-all text-center cursor-pointer ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-950/30 text-white shadow-sm ring-1 ring-emerald-500"
                        : "border-neutral-800 bg-neutral-950/60 text-neutral-300 hover:border-neutral-700 hover:text-white"
                    }`}
                  >
                    <span className="text-sm font-bold">{tc.displayName}</span>
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider">
                      {tc.category}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Specific Options */}
          {tab === "online" && (
            <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Shield className="h-4 w-4 text-emerald-400" />
                <div>
                  <div className="text-xs font-semibold text-white">Rated Game</div>
                  <div className="text-[11px] text-neutral-400">
                    Affects your Glicko-2 leaderboard rating
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={rated}
                onClick={() => setRated(!rated)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  rated ? "bg-emerald-600" : "bg-neutral-800"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    rated ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          )}

          {tab === "bot" && (
            <div className="space-y-4">
              {/* Bot Difficulty Selector */}
              <div>
                <div className="block text-xs font-medium text-neutral-300 mb-2">
                  Bot Difficulty Tier
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {BOT_TIER_OPTIONS.map((tier) => {
                    const isSelected = botTier === tier.id;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setBotTier(tier.id)}
                        className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition-all ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-950/30 text-white ring-1 ring-emerald-500"
                            : "border-neutral-800 bg-neutral-950/60 text-neutral-300 hover:border-neutral-700 hover:text-white"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-xs font-bold text-white">{tier.name}</span>
                          <span className="text-[11px] font-semibold text-emerald-400">
                            ~{tier.elo}
                          </span>
                        </div>
                        <span className="mt-0.5 text-[10px] text-neutral-400 line-clamp-1">
                          {tier.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Play As Color */}
              <div>
                <div className="block text-xs font-medium text-neutral-300 mb-2">Play as</div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBotColor("white")}
                    className={`rounded-xl border py-2 text-xs font-semibold transition-all ${
                      botColor === "white"
                        ? "border-emerald-500 bg-neutral-800 text-white ring-1 ring-emerald-500"
                        : "border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white"
                    }`}
                  >
                    White
                  </button>
                  <button
                    type="button"
                    onClick={() => setBotColor("random")}
                    className={`rounded-xl border py-2 text-xs font-semibold transition-all ${
                      botColor === "random"
                        ? "border-emerald-500 bg-neutral-800 text-white ring-1 ring-emerald-500"
                        : "border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white"
                    }`}
                  >
                    Random
                  </button>
                  <button
                    type="button"
                    onClick={() => setBotColor("black")}
                    className={`rounded-xl border py-2 text-xs font-semibold transition-all ${
                      botColor === "black"
                        ? "border-emerald-500 bg-neutral-800 text-white ring-1 ring-emerald-500"
                        : "border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white"
                    }`}
                  >
                    Black
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Start Game CTA */}
        <div className="mt-8">
          <button
            type="button"
            onClick={handleStartGame}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:from-emerald-500 hover:to-teal-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
          >
            {tab === "online" && (
              <>
                <Zap className="h-4 w-4" />
                <span>Find Match ({TIME_CONTROLS[selectedTc].displayName})</span>
              </>
            )}
            {tab === "bot" && (
              <>
                <Bot className="h-4 w-4" />
                <span>Challenge Bot</span>
              </>
            )}
            {tab === "local" && (
              <>
                <Users className="h-4 w-4" />
                <span>Start Local Game</span>
              </>
            )}
          </button>
        </div>
      </div>
    </dialog>
  );
};

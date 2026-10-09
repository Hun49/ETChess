import type { TimeControlKey } from "@etchess/types";
import { AlertCircle, Clock, Flame, Shield, Sparkles, User, Zap } from "lucide-react";
import type React from "react";
import { useState } from "react";
import type { GuestSkillLevel } from "../store/gameStore";
import { useGameStore } from "../store/gameStore";

export const PlayOnlineView: React.FC = () => {
  const { joinMatchmaking, isGuest, guestName, guestSkillLevel, setGuestSkillLevel, openModal } =
    useGameStore();

  const [selectedTc, setSelectedTc] = useState<TimeControlKey>("3+2");
  const [rated, setRated] = useState(!isGuest);
  const [fastMatch, setFastMatch] = useState(true);

  const handleFindMatch = () => {
    // Guests are strictly unrated and match with other guests in their chosen skill level
    joinMatchmaking(selectedTc, isGuest ? false : rated);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4 pb-16">
      {/* Title */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            {isGuest ? "Guest Matchmaking" : "Play Online"}
          </h1>
          {isGuest && (
            <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-400">
              {guestName} • Unrated
            </span>
          )}
        </div>
        <p className="text-xs text-[#8ba3a8] mt-1">
          {isGuest
            ? "Pair strictly with other guests searching online in your selected skill tier."
            : "Choose your time control and compete on the global leaderboard."}
        </p>
      </div>

      {/* Guest Mode Banner & Skill Tier Selection */}
      {isGuest && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Choose Your Skill Tier
            </span>
            <button
              type="button"
              onClick={() => openModal("auth")}
              className="text-xs font-bold text-[#00e699] hover:underline cursor-pointer"
            >
              Sign Up for Rated Leaderboard →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {(
              [
                { tier: "beginner", label: "Beginner", desc: "Learning rules" },
                { tier: "intermediate", label: "Intermediate", desc: "Club player" },
                { tier: "advanced", label: "Advanced", desc: "Experienced" },
                { tier: "master", label: "Master", desc: "Expert / GM" },
              ] as const
            ).map((item) => (
              <button
                key={item.tier}
                type="button"
                onClick={() => setGuestSkillLevel(item.tier)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  guestSkillLevel === item.tier
                    ? "border-[#00e699] bg-[#00e699]/15 text-white ring-1 ring-[#00e699] shadow-md shadow-[#00e699]/10"
                    : "border-[#14282c] bg-[#0b171a] text-[#8ba3a8] hover:border-[#1a383e] hover:text-white"
                }`}
              >
                <div className="text-xs font-bold text-white capitalize">{item.label}</div>
                <div className="text-[10px] text-[#587277] mt-0.5">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Time Controls Container */}
      <div className="space-y-5 rounded-2xl border border-[#14282c] bg-[#0b171a] p-6 shadow-xl">
        {/* Bullet Section */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-2.5">
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            <span>Bullet</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedTc("1+0")}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all cursor-pointer ${
                selectedTc === "1+0"
                  ? "border-[#00e699] bg-[#00e699]/10 text-white shadow-md shadow-[#00e699]/10 ring-1 ring-[#00e699]"
                  : "border-[#14282c] bg-[#0e1e22] text-[#8ba3a8] hover:border-[#1a383e] hover:text-white"
              }`}
            >
              <span className="text-sm font-bold text-white">1+0</span>
              <span className="text-[11px] text-[#587277] mt-0.5">1 min</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTc("2+0")}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all cursor-pointer ${
                selectedTc === "2+0"
                  ? "border-[#00e699] bg-[#00e699]/10 text-white shadow-md shadow-[#00e699]/10 ring-1 ring-[#00e699]"
                  : "border-[#14282c] bg-[#0e1e22] text-[#8ba3a8] hover:border-[#1a383e] hover:text-white"
              }`}
            >
              <span className="text-sm font-bold text-white">2+0</span>
              <span className="text-[11px] text-[#587277] mt-0.5">2 min</span>
            </button>
          </div>
        </div>

        {/* Blitz Section */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-2.5">
            <Zap className="h-3.5 w-3.5 text-[#00e699]" />
            <span>Blitz</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setSelectedTc("3+0")}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all cursor-pointer ${
                selectedTc === "3+0"
                  ? "border-[#00e699] bg-[#00e699]/10 text-white shadow-md shadow-[#00e699]/10 ring-1 ring-[#00e699]"
                  : "border-[#14282c] bg-[#0e1e22] text-[#8ba3a8] hover:border-[#1a383e] hover:text-white"
              }`}
            >
              <span className="text-sm font-bold text-white">3+0</span>
              <span className="text-[11px] text-[#587277] mt-0.5">3 min</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTc("3+2")}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all cursor-pointer ${
                selectedTc === "3+2"
                  ? "border-[#00e699] bg-[#00e699]/10 text-white shadow-md shadow-[#00e699]/10 ring-1 ring-[#00e699]"
                  : "border-[#14282c] bg-[#0e1e22] text-[#8ba3a8] hover:border-[#1a383e] hover:text-white"
              }`}
            >
              <span className="text-sm font-bold text-white">3+2</span>
              <span className="text-[11px] text-[#00e699] font-medium mt-0.5">3 min + 2s</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTc("5+0")}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all cursor-pointer ${
                selectedTc === "5+0"
                  ? "border-[#00e699] bg-[#00e699]/10 text-white shadow-md shadow-[#00e699]/10 ring-1 ring-[#00e699]"
                  : "border-[#14282c] bg-[#0e1e22] text-[#8ba3a8] hover:border-[#1a383e] hover:text-white"
              }`}
            >
              <span className="text-sm font-bold text-white">5+0</span>
              <span className="text-[11px] text-[#587277] mt-0.5">5 min</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTc("5+3")}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all cursor-pointer ${
                selectedTc === "5+3"
                  ? "border-[#00e699] bg-[#00e699]/10 text-white shadow-md shadow-[#00e699]/10 ring-1 ring-[#00e699]"
                  : "border-[#14282c] bg-[#0e1e22] text-[#8ba3a8] hover:border-[#1a383e] hover:text-white"
              }`}
            >
              <span className="text-sm font-bold text-white">5+3</span>
              <span className="text-[11px] text-[#587277] mt-0.5">5 min + 3s</span>
            </button>
          </div>
        </div>

        {/* Rapid Section */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-2.5">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            <span>Rapid</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setSelectedTc("10+0")}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all cursor-pointer ${
                selectedTc === "10+0"
                  ? "border-[#00e699] bg-[#00e699]/10 text-white shadow-md shadow-[#00e699]/10 ring-1 ring-[#00e699]"
                  : "border-[#14282c] bg-[#0e1e22] text-[#8ba3a8] hover:border-[#1a383e] hover:text-white"
              }`}
            >
              <span className="text-sm font-bold text-white">10+0</span>
              <span className="text-[11px] text-[#587277] mt-0.5">10 min</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTc("10+5")}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all cursor-pointer ${
                selectedTc === "10+5"
                  ? "border-[#00e699] bg-[#00e699]/10 text-white shadow-md shadow-[#00e699]/10 ring-1 ring-[#00e699]"
                  : "border-[#14282c] bg-[#0e1e22] text-[#8ba3a8] hover:border-[#1a383e] hover:text-white"
              }`}
            >
              <span className="text-sm font-bold text-white">10+5</span>
              <span className="text-[11px] text-[#587277] mt-0.5">10 min + 5s</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTc("15+10")}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all cursor-pointer ${
                selectedTc === "15+10"
                  ? "border-[#00e699] bg-[#00e699]/10 text-white shadow-md shadow-[#00e699]/10 ring-1 ring-[#00e699]"
                  : "border-[#14282c] bg-[#0e1e22] text-[#8ba3a8] hover:border-[#1a383e] hover:text-white"
              }`}
            >
              <span className="text-sm font-bold text-white">15+10</span>
              <span className="text-[11px] text-[#587277] mt-0.5">15 min + 10s</span>
            </button>
          </div>
        </div>

        {/* Big Find Match CTA */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleFindMatch}
            className="w-full rounded-xl bg-[#00e699] py-3.5 text-center text-sm font-extrabold text-neutral-950 shadow-lg shadow-[#00e699]/20 hover:bg-[#00e699]/90 transition-all cursor-pointer"
          >
            {isGuest ? `Find Guest Match (${guestSkillLevel.toUpperCase()})` : "Find Match"}
          </button>
        </div>

        {/* Bottom Options Row */}
        <div className="pt-2 flex items-center justify-around border-t border-[#14282c] text-xs text-[#8ba3a8]">
          {/* Rated / Casual Indicator */}
          {isGuest ? (
            <div className="flex items-center gap-1.5 text-amber-400">
              <Shield className="h-4 w-4 text-amber-400" />
              <span>Casual (Guest Unrated)</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setRated(!rated)}
              className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer"
            >
              <Shield className={`h-4 w-4 ${rated ? "text-[#00e699]" : "text-[#587277]"}`} />
              <span className={rated ? "text-white font-medium" : ""}>
                {rated ? "Rated" : "Casual"}
              </span>
            </button>
          )}

          {/* Standard Chess Indicator */}
          <div className="flex items-center gap-2">
            <span className="text-base">♟</span>
            <span>Standard Chess</span>
          </div>

          {/* Fast Match Toggle */}
          <button
            type="button"
            onClick={() => setFastMatch(!fastMatch)}
            className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer"
          >
            <Zap className={`h-4 w-4 ${fastMatch ? "text-[#00e699]" : "text-[#587277]"}`} />
            <span className={fastMatch ? "text-white font-medium" : ""}>Fast Match</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import { Check, Crown, Loader2, Sparkles, Swords, Zap } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { api, useSession } from "../lib/api";
import { useGameStore } from "../store/gameStore";

type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export const SkillOnboardingModal: React.FC = () => {
  const { data: session } = useSession();
  const { isGuest } = useGameStore();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<ExperienceLevel>("intermediate");
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Only check for authenticated non-guest users
    if (!session?.user || isGuest) {
      setIsOpen(false);
      return;
    }

    const checkOnboardingStatus = async () => {
      setCheckingStatus(true);
      try {
        const res = await api.api.users.me.$get();
        if (res.ok) {
          const data = await res.json();
          // If experienceLevel is null/empty, user needs onboarding
          if (isMounted && data?.user && !data.user.experienceLevel) {
            setIsOpen(true);
          }
        }
      } catch (err) {
        console.error("Failed to check skill onboarding status:", err);
      } finally {
        if (isMounted) setCheckingStatus(false);
      }
    };

    checkOnboardingStatus();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id, isGuest]);

  if (!isOpen || checkingStatus) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await api.api.users.me.onboarding.$post({
        json: {
          experienceLevel: selectedLevel,
        },
      });

      if (res.ok) {
        setIsOpen(false);
        // Refresh page so ratings and lobby instantly update with the chosen starting ELO
        window.location.reload();
      }
    } catch (err) {
      console.error("Failed to save starting skill level:", err);
    } finally {
      setLoading(false);
    }
  };

  const options: Array<{
    level: ExperienceLevel;
    title: string;
    elo: number;
    description: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    {
      level: "beginner",
      title: "Beginner",
      elo: 500,
      description: "Learning the basics, piece movements, and fundamental checkmates.",
      icon: <Swords className="h-5 w-5 text-emerald-400" />,
      color: "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/70",
    },
    {
      level: "intermediate",
      title: "Intermediate",
      elo: 1000,
      description: "Familiar with tactics, standard openings, and mid-game strategy.",
      icon: <Zap className="h-5 w-5 text-[#00e699]" />,
      color: "border-[#00e699]/50 bg-[#00e699]/10 hover:border-[#00e699]",
    },
    {
      level: "advanced",
      title: "Advanced",
      elo: 1500,
      description: "Experienced club or tournament competitor with sharp tactical vision.",
      icon: <Crown className="h-5 w-5 text-amber-400" />,
      color: "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/70",
    },
  ];

  return (
    <dialog
      open
      aria-labelledby="skill-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md border-none w-full h-full max-w-none max-h-none m-0 animate-fade-in"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[#14282c] bg-[#0b171a] p-6 sm:p-8 shadow-2xl text-neutral-100">
        {/* Glow ambient background effect */}
        <div className="absolute right-0 top-0 h-56 w-56 translate-x-12 -translate-y-12 rounded-full bg-[#00e699]/15 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0e1e22] border border-[#00e699]/40 text-[#00e699] mb-4 shadow-lg shadow-[#00e699]/10">
            <Sparkles className="h-7 w-7 text-[#00e699]" />
          </div>
          <h2 id="skill-modal-title" className="text-2xl font-black text-white tracking-tight">
            Choose Your Starting Skill Level
          </h2>
          <p className="mt-2 text-xs text-[#8ba3a8] leading-relaxed max-w-sm mx-auto">
            Welcome to ET Chess! Select your approximate experience level so we can pair you with
            evenly matched opponents right from your first game.
          </p>
        </div>

        {/* Level Options Cards */}
        <div className="mt-6 flex flex-col gap-3">
          {options.map((opt) => {
            const isSelected = selectedLevel === opt.level;
            return (
              <button
                key={opt.level}
                type="button"
                onClick={() => setSelectedLevel(opt.level)}
                className={`relative flex items-start gap-4 rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                  isSelected
                    ? "border-[#00e699] bg-[#00e699]/10 shadow-lg shadow-[#00e699]/10 ring-1 ring-[#00e699]"
                    : "border-[#14282c] bg-[#0e1e22] hover:border-[#1e3e44]"
                }`}
              >
                <div className="mt-0.5 rounded-xl bg-[#081214] border border-[#162e33] p-2.5 shrink-0">
                  {opt.icon}
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{opt.title}</span>
                    <span className="rounded-full bg-[#081214] border border-[#162e33] px-2 py-0.5 text-[10px] font-mono font-bold text-[#00e699]">
                      {opt.elo} ELO
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#8ba3a8] leading-relaxed">{opt.description}</p>
                </div>
                <div
                  className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                    isSelected
                      ? "border-[#00e699] bg-[#00e699] text-black"
                      : "border-[#22444c] bg-transparent text-transparent"
                  }`}
                >
                  <Check className="h-3 w-3 stroke-[3]" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className="mt-6 w-full flex items-center justify-center gap-2 rounded-2xl bg-[#00e699] hover:bg-[#00c985] text-black font-black text-xs py-3.5 px-4 uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-[#00e699]/20"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-black" />
              <span>Calibrating Starting Rating...</span>
            </>
          ) : (
            <span>Confirm & Enter Chess Lobby</span>
          )}
        </button>

        <p className="mt-4 text-center text-[10px] text-[#587277]">
          Your rating updates after every rated game according to Glicko-2 rating mechanics.
        </p>
      </div>
    </dialog>
  );
};

import { AlertCircle, Bot, Globe, Loader2, Sparkles, Swords, Trophy, Users, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { signIn } from "../lib/api";
import { GUEST_LIMITS, REGISTERED_LIMITS } from "../lib/quota";
import { useGameStore } from "../store/gameStore";

export const LimitReachedModal: React.FC = () => {
  const { activeModal, closeModal, limitModalType, isGuest } = useGameStore();
  const [loadingProvider, setLoadingProvider] = useState<"google" | "github" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeModal === "limit_reached") {
        closeModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeModal, closeModal]);

  if (activeModal !== "limit_reached") return null;

  const handleSocialSignIn = async (provider: "google" | "github") => {
    setErrorMessage(null);
    setLoadingProvider(provider);

    try {
      const callbackURL = window.location.origin;
      const res = await signIn.social({
        provider,
        callbackURL,
      });

      if (res?.error) {
        setErrorMessage(res.error.message || `Failed to initiate ${provider} sign in.`);
        setLoadingProvider(null);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : `An unexpected error occurred during ${provider} sign in.`,
      );
      setLoadingProvider(null);
    }
  };

  const getDetails = () => {
    switch (limitModalType) {
      case "online":
        return {
          title: "Daily Online Limit Reached",
          desc: `Guest accounts are limited to ${GUEST_LIMITS.maxOnlineGames} online games per day. Sign in to unlock unlimited games!`,
          icon: Globe,
        };
      case "bot":
        return {
          title: "Daily Bot Practice Limit Reached",
          desc: `Guest accounts can play up to ${GUEST_LIMITS.maxBotGames} bot games per day. Sign in to practice with bots without limits!`,
          icon: Bot,
        };
      case "analysis":
        return {
          title: "Daily Analysis Limit Reached",
          desc: isGuest
            ? `Guests can analyze ${GUEST_LIMITS.maxAnalyses} game per day. Sign in to get up to ${REGISTERED_LIMITS.maxAnalyses} deep game analyses daily!`
            : `You have reached your daily quota of ${REGISTERED_LIMITS.maxAnalyses} game analyses. Your quota resets at midnight!`,
          icon: Sparkles,
        };
      default:
        return {
          title: "Daily Limit Reached",
          desc: "Create a free account to unlock unlimited games and premium features.",
          icon: Swords,
        };
    }
  };

  const info = getDetails();
  const IconComponent = info.icon;

  return (
    <dialog
      open
      aria-labelledby="limit-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md border-none w-full h-full max-w-none max-h-none m-0 animate-fade-in"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#162e33] bg-[#0b171a] p-6 sm:p-8 shadow-2xl">
        {/* Subtle decorative glow */}
        <div className="absolute right-0 top-0 h-48 w-48 -translate-y-12 translate-x-12 rounded-full bg-[#00e699]/10 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={closeModal}
          aria-label="Close modal"
          className="absolute right-4 top-4 rounded-xl p-2 text-[#8ba3a8] hover:bg-[#0e2024] hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00e699]/15 border border-[#00e699]/30 text-[#00e699] shadow-lg shadow-[#00e699]/10">
          <IconComponent className="h-7 w-7" />
        </div>

        {/* Title & Description */}
        <div className="text-center space-y-1.5">
          <h2 id="limit-modal-title" className="text-xl font-black text-white tracking-tight">
            {info.title}
          </h2>
          <p className="text-xs text-[#8ba3a8] leading-relaxed max-w-sm mx-auto">{info.desc}</p>
        </div>

        {/* Perk Comparison Box */}
        <div className="my-5 rounded-2xl border border-[#162e33] bg-[#081214] p-4 space-y-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#00e699] block">
            Unlock With A Free Account:
          </span>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-[#cbd5e1]">
            <div className="flex items-center gap-1.5">
              <span className="text-[#00e699] font-bold">✓</span>
              <span>Unlimited Online Play</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#00e699] font-bold">✓</span>
              <span>Unlimited Bot Matches</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#00e699] font-bold">✓</span>
              <span>Play With Friends</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#00e699] font-bold">✓</span>
              <span>10 Analyses Daily</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#00e699] font-bold">✓</span>
              <span>Calibrated Starting ELO</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#00e699] font-bold">✓</span>
              <span>Verified Player Badge</span>
            </div>
          </div>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Social Sign-In Buttons */}
        <div className="space-y-2.5">
          {/* Google Button */}
          <button
            type="button"
            disabled={loadingProvider !== null}
            onClick={() => handleSocialSignIn("google")}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-[#223d44] bg-[#0e2025] hover:bg-[#12282e] hover:border-[#00e699]/40 py-3 px-4 text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-50"
          >
            {loadingProvider === "google" ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#00e699]" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          {/* GitHub Button */}
          <button
            type="button"
            disabled={loadingProvider !== null}
            onClick={() => handleSocialSignIn("github")}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-[#223d44] bg-[#0e2025] hover:bg-[#12282e] hover:border-[#00e699]/40 py-3 px-4 text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-50"
          >
            {loadingProvider === "github" ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#00e699]" />
            ) : (
              <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
            )}
            <span>Continue with GitHub</span>
          </button>
        </div>

        {/* Footer Note */}
        <p className="mt-4 text-center text-[10px] text-[#587277]">
          Zero passwords or OTP codes needed. 1-click verified login.
        </p>
      </div>
    </dialog>
  );
};

import { AlertCircle, Loader2, Sparkles, User, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { signIn } from "../lib/api";
import { useGameStore } from "../store/gameStore";

export const AuthModal: React.FC = () => {
  const { activeModal, closeModal, setIsGuest } = useGameStore();
  const [loadingProvider, setLoadingProvider] = useState<"google" | "github" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeModal === "auth") {
        closeModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeModal, closeModal]);

  if (activeModal !== "auth") return null;

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

  const handleGuestPlay = () => {
    setIsGuest(true);
    closeModal();
  };

  return (
    <dialog
      open
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md border-none w-full h-full max-w-none max-h-none m-0 animate-fade-in"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#14282c] bg-[#0b171a] p-6 sm:p-8 shadow-2xl text-neutral-100">
        {/* Glow ambient background effect */}
        <div className="absolute right-0 top-0 h-48 w-48 translate-x-8 -translate-y-8 rounded-full bg-[#00e699]/10 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={closeModal}
          aria-label="Close modal"
          className="absolute right-4 top-4 rounded-xl p-2 text-[#8ba3a8] hover:text-white hover:bg-[#0e1e22] border border-transparent hover:border-[#162e33] transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#00e699]/20 to-[#0e1e22] border border-[#00e699]/40 text-[#00e699] font-black text-2xl mb-4 shadow-lg shadow-[#00e699]/10">
            ET
          </div>
          <h2 id="auth-modal-title" className="text-2xl font-black text-white tracking-tight">
            Welcome to ET Chess
          </h2>
          <p className="mt-2 text-xs text-[#8ba3a8] leading-relaxed max-w-xs mx-auto">
            Sign in with your verified social account to compete on the global leaderboard, track
            live ratings, and save your match history.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Social Action Buttons */}
        <div className="mt-6 flex flex-col gap-3">
          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={() => handleSocialSignIn("google")}
            disabled={loadingProvider !== null}
            className="w-full flex items-center justify-center gap-3 rounded-2xl border border-[#162e33] bg-[#0e1e22] py-3.5 px-4 text-xs font-bold text-white hover:bg-[#122429] hover:border-[#22444c] active:scale-[0.99] transition-all disabled:opacity-50 shadow-sm cursor-pointer"
          >
            {loadingProvider === "google" ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#00e699]" />
            ) : (
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            )}
            <span>
              {loadingProvider === "google" ? "Connecting to Google..." : "Continue with Google"}
            </span>
          </button>

          {/* GitHub Sign-In Button */}
          <button
            type="button"
            onClick={() => handleSocialSignIn("github")}
            disabled={loadingProvider !== null}
            className="w-full flex items-center justify-center gap-3 rounded-2xl border border-[#162e33] bg-[#0e1e22] py-3.5 px-4 text-xs font-bold text-white hover:bg-[#122429] hover:border-[#22444c] active:scale-[0.99] transition-all disabled:opacity-50 shadow-sm cursor-pointer"
          >
            {loadingProvider === "github" ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#00e699]" />
            ) : (
              <svg
                className="h-4 w-4 shrink-0 fill-current text-white"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
            )}
            <span>
              {loadingProvider === "github" ? "Connecting to GitHub..." : "Continue with GitHub"}
            </span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="w-full border-t border-[#14282c]" />
          <span className="absolute bg-[#0b171a] px-3 text-[10px] uppercase font-bold text-[#587277]">
            or explore
          </span>
        </div>

        {/* Guest Play Button */}
        <button
          type="button"
          onClick={handleGuestPlay}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border border-[#14282c] bg-transparent py-3 px-4 text-xs font-semibold text-[#8ba3a8] hover:text-white hover:bg-[#0e1e22] hover:border-[#162e33] active:scale-[0.99] transition-all cursor-pointer"
        >
          <User className="h-3.5 w-3.5" />
          <span>Play as Guest (Casual Mode)</span>
        </button>

        {/* Footer info */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-center text-[10px] text-[#587277]">
          <Sparkles className="h-3 w-3 text-[#00e699]/70 shrink-0" />
          <span>Verified instant access &bull; Zero passwords to remember</span>
        </div>
      </div>
    </dialog>
  );
};

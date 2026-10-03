import { ArrowRight, Loader2, Lock, Mail, User, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { signIn, signUp } from "../lib/api";
import { useGameStore } from "../store/gameStore";

export const AuthModal: React.FC = () => {
  const { activeModal, closeModal } = useGameStore();
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      if (tab === "signin") {
        const res = await signIn.email({
          email,
          password,
        });
        if (res.error) {
          setErrorMessage(
            res.error.message || "Failed to sign in. Please verify your credentials.",
          );
        } else {
          closeModal();
        }
      } else {
        const res = await signUp.email({
          email,
          password,
          name: name.trim() || email.split("@")[0],
        });
        if (res.error) {
          setErrorMessage(
            res.error.message || "Failed to create account. Please check input requirements.",
          );
        } else {
          closeModal();
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog
      open
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200 border-none w-full h-full max-w-none max-h-none m-0"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl shadow-emerald-950/20 sm:p-8">
        {/* Close Button */}
        <button
          type="button"
          onClick={closeModal}
          aria-label="Close modal"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-lg shadow-emerald-500/20 text-neutral-950 font-black text-2xl mb-3">
            ET
          </div>
          <h2 id="auth-modal-title" className="text-xl font-bold text-white tracking-tight">
            {tab === "signin" ? "Welcome back to ET Chess" : "Join ET Chess Community"}
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            {tab === "signin"
              ? "Sign in to track your Glicko-2 ratings and match history"
              : "Create an account for rated multiplayer and leaderboards"}
          </p>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex rounded-xl bg-neutral-950 p-1 border border-neutral-800/80">
          <button
            type="button"
            onClick={() => {
              setTab("signin");
              setErrorMessage(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
              tab === "signin"
                ? "bg-neutral-800 text-white shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("signup");
              setErrorMessage(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
              tab === "signup"
                ? "bg-neutral-800 text-white shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form Error Banner */}
        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400">
            {errorMessage}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {tab === "signup" && (
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5" htmlFor="name">
                Username
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="GrandmasterX"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 py-2.5 pl-9 pr-3 text-sm text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5" htmlFor="email">
              Email Address
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                <Mail className="h-4 w-4" />
              </div>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="player@example.com"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 py-2.5 pl-9 pr-3 text-sm text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 py-2.5 pl-9 pr-3 text-sm text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:from-emerald-500 hover:to-teal-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-neutral-900 transition-all disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>{tab === "signin" ? "Sign In" : "Create Account"}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </dialog>
  );
};

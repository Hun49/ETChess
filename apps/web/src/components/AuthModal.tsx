import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "lucide-react";
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  // Real-time password validation logic
  const isPasswordEntered = password.length > 0;
  const isConfirmEntered = confirmPassword.length > 0;
  const isLengthValid = password.length >= 8;
  const isMatch = isPasswordEntered && isConfirmEntered && password === confirmPassword;
  const isMismatch = isConfirmEntered && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (tab === "signup") {
      if (!name.trim()) {
        setErrorMessage("Please enter an account name.");
        return;
      }
      if (!isLengthValid) {
        setErrorMessage("Password must be at least 8 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match. Please verify your password entry.");
        return;
      }
    }

    setLoading(true);

    try {
      if (tab === "signin") {
        const res = await signIn.email({
          email: email.trim(),
          password,
        });
        if (res.error) {
          setErrorMessage(
            res.error.message || "Failed to sign in. Please verify your credentials.",
          );
        } else {
          setSuccessMessage("Welcome back! Signing in...");
          setTimeout(() => {
            closeModal();
          }, 800);
        }
      } else {
        const res = await signUp.email({
          email: email.trim(),
          password,
          name: name.trim(),
        });
        if (res.error) {
          setErrorMessage(
            res.error.message || "Failed to create account. Please check your inputs.",
          );
        } else {
          setSuccessMessage("Account created successfully! Welcome to ET Chess.");
          setTimeout(() => {
            closeModal();
          }, 1000);
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
          className="absolute right-4 top-4 rounded-xl p-2 text-[#8ba3a8] hover:text-white hover:bg-[#0e1e22] border border-transparent hover:border-[#162e33] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#00e699]/20 to-[#0e1e22] border border-[#00e699]/40 text-[#00e699] font-black text-xl mb-3 shadow-lg shadow-[#00e699]/10">
            ET
          </div>
          <h2 id="auth-modal-title" className="text-xl font-black text-white tracking-tight">
            {tab === "signin" ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="mt-1 text-xs text-[#8ba3a8]">
            {tab === "signin"
              ? "Sign in to access your ratings, match history, and achievements"
              : "Register your player identity to compete on the global leaderboard"}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="mt-5 flex rounded-xl bg-[#0e1e22] p-1 border border-[#14282c]">
          <button
            type="button"
            onClick={() => {
              setTab("signin");
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
              tab === "signin"
                ? "bg-[#14282c] text-[#00e699] shadow-sm"
                : "text-[#8ba3a8] hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("signup");
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
              tab === "signup"
                ? "bg-[#14282c] text-[#00e699] shadow-sm"
                : "text-[#8ba3a8] hover:text-white"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400 animate-shake">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#00e699]/30 bg-[#00e699]/10 px-3.5 py-2.5 text-xs text-[#00e699] animate-fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#00e699]" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {tab === "signup" && (
            <div>
              <label
                className="block text-xs font-bold uppercase tracking-wider text-[#8ba3a8] mb-1.5"
                htmlFor="account-name"
              >
                Account Name / Handle
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#587277]">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="account-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. AlexRook"
                  maxLength={32}
                  className="w-full rounded-xl border border-[#162e33] bg-[#0e1e22] py-2.5 pl-9 pr-3 text-sm text-white placeholder-[#587277] focus:border-[#00e699] focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label
              className="block text-xs font-bold uppercase tracking-wider text-[#8ba3a8] mb-1.5"
              htmlFor="auth-email"
            >
              Email Address
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#587277]">
                <Mail className="h-4 w-4" />
              </div>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.com"
                className="w-full rounded-xl border border-[#162e33] bg-[#0e1e22] py-2.5 pl-9 pr-3 text-sm text-white placeholder-[#587277] focus:border-[#00e699] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                className="block text-xs font-bold uppercase tracking-wider text-[#8ba3a8]"
                htmlFor="auth-password"
              >
                Password
              </label>
              {tab === "signup" && isPasswordEntered && (
                <span
                  className={`text-[10px] font-mono font-bold ${
                    isLengthValid ? "text-[#00e699]" : "text-amber-400"
                  }`}
                >
                  {isLengthValid ? "✓ Length OK (8+ chars)" : "At least 8 chars required"}
                </span>
              )}
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#587277]">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={tab === "signup" ? 8 : 6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-[#162e33] bg-[#0e1e22] py-2.5 pl-9 pr-10 text-sm text-white placeholder-[#587277] focus:border-[#00e699] focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#587277] hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password (entered twice with real-time match check) */}
          {tab === "signup" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  className="block text-xs font-bold uppercase tracking-wider text-[#8ba3a8]"
                  htmlFor="auth-confirm-password"
                >
                  Confirm Password
                </label>
                {/* Inline match feedback */}
                {isConfirmEntered && (
                  <div className="flex items-center gap-1 text-[11px] font-bold">
                    {isMatch ? (
                      <span className="flex items-center gap-1 text-[#00e699]">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Passwords match</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400">
                        <AlertCircle className="h-3 w-3" />
                        <span>Passwords do not match</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#587277]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="auth-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className={`w-full rounded-xl border bg-[#0e1e22] py-2.5 pl-9 pr-10 text-sm text-white placeholder-[#587277] focus:outline-none transition-colors ${
                    isConfirmEntered
                      ? isMatch
                        ? "border-[#00e699] focus:border-[#00e699]"
                        : "border-red-500 focus:border-red-500"
                      : "border-[#162e33] focus:border-[#00e699]"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#587277] hover:text-white"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || (tab === "signup" && (!isMatch || !isLengthValid))}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00e699] py-3 text-sm font-black text-[#081214] shadow-lg shadow-[#00e699]/15 hover:bg-[#00c885] transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#081214]" />
            ) : (
              <>
                <span>{tab === "signin" ? "Sign In" : "Create Account"}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Security / Terms notice */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-[#587277]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#00e699]" />
          <span>Secured with Better Auth & Glicko-2 validation</span>
        </div>
      </div>
    </dialog>
  );
};

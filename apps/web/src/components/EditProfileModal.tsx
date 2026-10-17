import { AlertCircle, Check, Loader2, User, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { api, useSession } from "../lib/api";
import { useGameStore } from "../store/gameStore";

export const EditProfileModal: React.FC = () => {
  const { activeModal, closeModal } = useGameStore();
  const { data: session, refetch: refetchSession } = useSession();

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeModal === "edit_profile" && session?.user) {
      setName(session.user.name || "");
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [activeModal, session]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeModal === "edit_profile") {
        closeModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeModal, closeModal]);

  if (activeModal !== "edit_profile") return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setErrorMessage("Username must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 30) {
      setErrorMessage("Username must be at most 30 characters.");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      setErrorMessage("Username can only contain letters, numbers, underscores, and hyphens.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.api.users.me.$patch({
        json: { name: trimmed },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const msg =
          "message" in errorData && typeof errorData.message === "string"
            ? errorData.message
            : "Failed to update profile. Please try again.";
        setErrorMessage(msg);
        return;
      }

      setSuccessMessage("Profile updated successfully!");
      if (typeof refetchSession === "function") {
        await refetchSession();
      }
      setTimeout(() => {
        closeModal();
      }, 1200);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Network error while saving profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog
      open
      aria-labelledby="edit-profile-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md border-none w-full h-full max-w-none max-h-none m-0 animate-fade-in"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#162e33] bg-[#0b171a] p-6 sm:p-8 shadow-2xl">
        {/* Subtle decorative glow */}
        <div className="absolute right-0 top-0 h-48 w-48 -translate-y-12 translate-x-12 rounded-full bg-[#00e699]/10 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={closeModal}
          aria-label="Close edit profile modal"
          className="absolute right-4 top-4 rounded-xl p-2 text-[#8ba3a8] hover:bg-[#0e2024] hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00e699]/15 border border-[#00e699]/30 text-[#00e699]">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h2
              id="edit-profile-modal-title"
              className="text-xl font-black text-white tracking-tight"
            >
              Edit Profile
            </h2>
            <p className="text-xs text-[#8ba3a8]">Update your public display username</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username-input"
              className="block text-xs font-bold text-neutral-300 mb-1.5"
            >
              Username
            </label>
            <input
              id="username-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kasparov_Pro"
              maxLength={30}
              className="w-full rounded-xl border border-[#162e33] bg-[#081214] px-4 py-3 text-sm text-white placeholder-[#4a6469] focus:border-[#00e699] focus:outline-none transition-colors"
            />
            <p className="text-[10px] text-[#587277] mt-1">
              Letters, numbers, underscores, and hyphens (2-30 chars).
            </p>
          </div>

          <div>
            <label
              htmlFor="email-input"
              className="block text-xs font-bold text-neutral-300 mb-1.5"
            >
              Verified Email
            </label>
            <input
              id="email-input"
              type="text"
              readOnly
              disabled
              value={session?.user?.email || ""}
              className="w-full rounded-xl border border-[#162e33]/60 bg-[#081214]/60 px-4 py-3 text-xs text-[#8ba3a8] font-mono cursor-not-allowed opacity-80"
            />
            <p className="text-[10px] text-[#587277] mt-1">
              Email is managed and verified by your social OAuth login provider.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 animate-fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-[#00e699]/30 bg-[#00e699]/10 p-3 text-xs text-[#00e699] animate-fade-in">
              <Check className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              disabled={loading}
              className="rounded-xl border border-[#162e33] bg-[#0e1e22] px-4 py-2.5 text-xs font-bold text-neutral-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#00e699] px-5 py-2.5 text-xs font-bold text-neutral-950 shadow-md shadow-[#00e699]/20 hover:bg-[#00c885] transition-all cursor-pointer disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
};

import { Clock, Flame, LogOut, ShieldCheck, Trophy, X, Zap } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { api, signOut, useSession } from "../lib/api";
import { useGameStore } from "../store/gameStore";

interface UserProfileData {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    ratings: {
      bullet: number;
      blitz: number;
      rapid: number;
      classical: number;
    };
  };
}

export const ProfileModal: React.FC = () => {
  const { activeModal, closeModal } = useGameStore();
  const { data: session } = useSession();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeModal === "profile" && session?.user) {
      setLoading(true);
      api.api.users.me
        .$get()
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            return data;
          }
          return null;
        })
        .then((data) => {
          if (data && "user" in data) {
            setProfile(data as unknown as UserProfileData);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [activeModal, session]);

  if (activeModal !== "profile") return null;

  const handleSignOut = async () => {
    await signOut();
    closeModal();
  };

  const ratings = profile?.user?.ratings || {
    bullet: 1500,
    blitz: 1500,
    rapid: 1500,
    classical: 1500,
  };

  const categories = [
    { key: "bullet", label: "Bullet", icon: Flame, color: "text-amber-400" },
    { key: "blitz", label: "Blitz", icon: Zap, color: "text-yellow-400" },
    { key: "rapid", label: "Rapid", icon: Clock, color: "text-emerald-400" },
    { key: "classical", label: "Classical", icon: ShieldCheck, color: "text-blue-400" },
  ];

  return (
    <dialog
      open
      aria-labelledby="profile-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200 border-none w-full h-full max-w-none max-h-none m-0"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl sm:p-8">
        {/* Close Button */}
        <button
          type="button"
          onClick={closeModal}
          aria-label="Close profile"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* User Card */}
        <div className="flex items-center gap-4 border-b border-neutral-800 pb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-neutral-950 font-black text-2xl shadow-lg shadow-emerald-500/20">
            {session?.user.name ? session.user.name.charAt(0).toUpperCase() : "U"}
          </div>
          <div>
            <h2 id="profile-modal-title" className="text-xl font-bold text-white">
              {session?.user.name || "Player"}
            </h2>
            <p className="text-xs text-neutral-400">{session?.user.email}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                <Trophy className="h-3 w-3" />
                Glicko-2 Rated
              </span>
            </div>
          </div>
        </div>

        {/* Rating Grid */}
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
            Ratings & Statistics
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const val = ratings[cat.key as keyof typeof ratings] ?? 1500;
              return (
                <div
                  key={cat.key}
                  className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 text-center"
                >
                  <div className="flex items-center justify-center gap-1 text-xs text-neutral-400 mb-1">
                    <Icon className={`h-3.5 w-3.5 ${cat.color}`} />
                    <span>{cat.label}</span>
                  </div>
                  <div className="text-lg font-bold text-white">{Math.round(val)}</div>
                  <div className="text-[10px] text-emerald-400 font-medium">Active</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-8 flex items-center justify-between border-t border-neutral-800 pt-6">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>

          <button
            type="button"
            onClick={closeModal}
            className="rounded-xl bg-neutral-800 px-5 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
};

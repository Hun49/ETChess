import { AlertCircle, CheckCircle2, SlidersHorizontal } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { adjustRating } from "../api.js";
import type { AdminUser } from "../types.js";

interface RatingsViewProps {
  preselectedUser?: AdminUser | null;
}

export const RatingsView: React.FC<RatingsViewProps> = ({ preselectedUser }) => {
  const [userId, setUserId] = useState(preselectedUser?.id ?? "u-2");
  const [userName, setUserName] = useState(preselectedUser?.name ?? "ChessMaster");
  const [category, setCategory] = useState<"bullet" | "blitz" | "rapid" | "classical">("blitz");
  const [rating, setRating] = useState(1987);
  const [resetRd, setResetRd] = useState(false);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setLoading(true);
    setStatus(null);
    try {
      await adjustRating(userId, category, rating, reason, resetRd);
      setStatus({
        success: true,
        message: `Successfully adjusted ${userName}'s ${category} rating to ${rating}.`,
      });
      setReason("");
    } catch (err) {
      setStatus({
        success: false,
        message: (err as Error).message || "Failed to adjust rating.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6 max-w-[1200px] mx-auto w-full">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Rating Adjustments & Audit
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Audited Glicko-2 manual rating changes. Rate changes are refused if the player has an
          active live game (RATE-11).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Adjustment Form (7 cols) */}
        <div className="md:col-span-7 bg-[#121c26] border border-[#1e2d3d] rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#1a2634] mb-5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Manual Rating Adjustment</h3>
              <p className="text-[11px] text-slate-400">
                Directly adjusts Glicko-2 rating (r) and logs audit entry
              </p>
            </div>
          </div>

          {status && (
            <div
              className={`p-3 rounded-xl mb-4 text-xs flex items-center gap-2.5 ${
                status.success
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
              }`}
            >
              {status.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{status.message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Target User ID or Username
              </label>
              <input
                type="text"
                required
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setUserName(e.target.value);
                }}
                placeholder="User ID or handle (e.g. u-1234)..."
                className="w-full px-3 py-2 bg-[#0d1520] border border-[#1e2d3d] rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/50 shadow-inner"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Rating Category
                </label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as "bullet" | "blitz" | "rapid" | "classical")
                  }
                  className="w-full px-3 py-2 bg-[#0d1520] border border-[#1e2d3d] rounded-xl text-xs text-white outline-none focus:border-emerald-500/50"
                >
                  <option value="bullet">Bullet</option>
                  <option value="blitz">Blitz</option>
                  <option value="rapid">Rapid</option>
                  <option value="classical">Classical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  New Rating (r)
                </label>
                <input
                  type="number"
                  required
                  min={100}
                  max={3500}
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#0d1520] border border-[#1e2d3d] rounded-xl text-xs text-white outline-none focus:border-emerald-500/50 font-mono shadow-inner"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-[#0d1520] border border-[#1e2d3d] rounded-xl">
              <input
                type="checkbox"
                id="resetRd"
                checked={resetRd}
                onChange={(e) => setResetRd(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 bg-[#121c26] border-[#233549] focus:ring-emerald-500/50"
              />
              <label
                htmlFor="resetRd"
                className="text-xs text-slate-300 cursor-pointer select-none"
              >
                Reset RD (Rating Deviation) to provisional baseline (350.0)
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Audit Reason (Mandatory)
              </label>
              <textarea
                required
                rows={3}
                placeholder="Reason for adjustment (e.g., Fair play refund, sandbagging correction)..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full p-3 bg-[#0d1520] border border-[#1e2d3d] rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/50 resize-none shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !reason.trim()}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-md shadow-emerald-950/40"
            >
              {loading ? "Submitting..." : "Apply Rating Adjustment"}
            </button>
          </form>
        </div>

        {/* Info & Policy Guidelines (5 cols) */}
        <div className="md:col-span-5 space-y-5">
          <div className="bg-[#121c26] border border-[#1e2d3d] rounded-2xl p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Rating Modification Rules (RATE-11)
            </h4>
            <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
              <li>
                <strong>Live Match Guard:</strong> The system strictly rejects adjustments if the
                target has an active live game in progress.
              </li>
              <li>
                <strong>Audit Trail:</strong> Every adjustment appends an immutable entry to{" "}
                <code className="text-emerald-400 bg-[#0d1520] px-1 py-0.5 rounded">
                  audit_logs
                </code>{" "}
                with administrator ID, previous rating, and mandatory reason.
              </li>
              <li>
                <strong>Category Isolation:</strong> Adjusting Blitz rating does not alter Bullet,
                Rapid, or Classical ratings.
              </li>
              <li>
                <strong>Provisional Reset:</strong> Setting RD to 350 marks the player as
                provisional until 20+ games are played.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

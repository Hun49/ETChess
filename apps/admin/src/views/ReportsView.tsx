import { CheckCircle, Clock, ShieldAlert, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { getReports, resolveReport } from "../api.js";
import type { ReportItem } from "../types.js";

export const ReportsView: React.FC = () => {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [action, setAction] = useState<"dismiss" | "warn_user" | "ban_user">("dismiss");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getReports().then(setReports);
  }, []);

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport || !resolutionNotes.trim()) return;
    setLoading(true);
    try {
      await resolveReport(selectedReport.id, resolutionNotes, action);
      setReports((prev) =>
        prev.map((r) =>
          r.id === selectedReport.id ? { ...r, status: "resolved", resolutionNotes } : r,
        ),
      );
      setSelectedReport(null);
      setResolutionNotes("");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6 max-w-[1600px] mx-auto w-full">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Player Reports & Fair Play Queue
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Investigate fair play violations, abusive chat, stalling, and resolve player reports with
          audit trail.
        </p>
      </div>

      {/* Reports Table */}
      <div className="bg-[#121c26] border border-[#1e2d3d] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1a2634] text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-[#0d1520]/50">
                <th className="py-3 pl-4">Report ID</th>
                <th className="py-3">Reported Player</th>
                <th className="py-3">Reporter</th>
                <th className="py-3">Violation</th>
                <th className="py-3">Details</th>
                <th className="py-3 text-center">Status</th>
                <th className="py-3 text-right pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a2634]/60">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-[#162230] transition-colors">
                  <td className="py-3 pl-4 font-mono font-semibold text-slate-300">{r.id}</td>
                  <td className="py-3 font-semibold text-rose-400">{r.reportedName}</td>
                  <td className="py-3 text-slate-300">{r.reporterName}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-semibold uppercase">
                      {r.category}
                    </span>
                  </td>
                  <td className="py-3 text-slate-400 max-w-xs truncate">
                    {r.details || "No additional comments"}
                  </td>
                  <td className="py-3 text-center">
                    {r.status === "pending" ? (
                      <span className="flex items-center justify-center gap-1 text-[10px] font-bold text-amber-400">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-400">
                        <CheckCircle className="w-3 h-3" />
                        Resolved
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right pr-4">
                    {r.status === "pending" ? (
                      <button
                        type="button"
                        onClick={() => setSelectedReport(r)}
                        className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
                      >
                        Investigate
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500">Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resolution Modal */}
      {selectedReport && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="w-full max-w-lg bg-[#121c26] border border-[#233549] rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1e2d3d]">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <ShieldAlert className="w-5 h-5 text-emerald-400" />
                <span>Resolve Report {selectedReport.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 p-3 bg-[#0d1520] rounded-xl border border-[#1e2d3d] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Reported User:</span>
                <span className="font-semibold text-rose-400">{selectedReport.reportedName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Reporter:</span>
                <span className="font-semibold text-white">{selectedReport.reporterName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Category:</span>
                <span className="font-semibold text-amber-400 uppercase">
                  {selectedReport.category}
                </span>
              </div>
              <div className="pt-2 border-t border-[#1a2634]">
                <span className="text-slate-400 block mb-1">Details:</span>
                <p className="text-slate-200 italic">{selectedReport.details}</p>
              </div>
            </div>

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Resolution Action
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAction("dismiss")}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      action === "dismiss"
                        ? "bg-slate-500/20 text-slate-200 border-slate-400"
                        : "bg-[#0d1520] text-slate-400 border-[#1e2d3d]"
                    }`}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction("warn_user")}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      action === "warn_user"
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                        : "bg-[#0d1520] text-slate-400 border-[#1e2d3d]"
                    }`}
                  >
                    Warn User
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction("ban_user")}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      action === "ban_user"
                        ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                        : "bg-[#0d1520] text-slate-400 border-[#1e2d3d]"
                    }`}
                  >
                    Ban User
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Resolution Notes (Preserves original details)
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Moderation decision notes..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full p-2.5 bg-[#0d1520] border border-[#1e2d3d] rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 resize-none shadow-inner"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="px-4 py-2 rounded-xl bg-[#1a2634] text-slate-300 text-xs font-semibold hover:bg-[#233549] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !resolutionNotes.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Resolving..." : "Complete Resolution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

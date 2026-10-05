import { RefreshCw, Shield, Terminal } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { getAuditLogs } from "../api.js";
import type { AuditLogItem } from "../types.js";

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getAuditLogs();
      setLogs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="flex-1 p-6 space-y-6 max-w-[1600px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            System & Security Audit Logs
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable, non-repudiable audit logs of all administrative mutations and security
            interventions (SEC-04).
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#121c26] border border-[#1e2d3d] hover:border-emerald-500/30 text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-[#121c26] border border-[#1e2d3d] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1a2634] text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-[#0d1520]/50">
                <th className="py-3 pl-4">Timestamp</th>
                <th className="py-3">Administrator</th>
                <th className="py-3">Action</th>
                <th className="py-3">Target</th>
                <th className="py-3">Details / Audit Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a2634]/60">
              {logs.map((log) => {
                const dateStr = new Date(log.createdAt).toLocaleString();
                const isBan = log.action.includes("BAN");
                const isRating = log.action.includes("RATING");
                const isTerminate = log.action.includes("TERMINATE");

                return (
                  <tr key={log.id} className="hover:bg-[#162230] transition-colors">
                    <td className="py-3 pl-4 font-mono text-slate-400 whitespace-nowrap">
                      {dateStr}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="font-semibold text-white">
                          {log.actorName || log.actorId}
                        </span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                          isBan
                            ? "bg-rose-500/15 border border-rose-500/30 text-rose-400"
                            : isRating
                              ? "bg-teal-500/15 border border-teal-500/30 text-teal-400"
                              : isTerminate
                                ? "bg-amber-500/15 border border-amber-500/30 text-amber-400"
                                : "bg-slate-500/15 border border-slate-500/30 text-slate-300"
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-slate-300">
                      {log.targetType}:{log.targetId}
                    </td>
                    <td className="py-3 font-mono text-[11px] text-slate-400">
                      {log.details ? JSON.stringify(log.details) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

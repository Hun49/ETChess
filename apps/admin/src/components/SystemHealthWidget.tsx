import { Database, HardDrive, Layers, Radio, Server } from "lucide-react";
import type React from "react";
import type { SystemHealthStatus } from "../types.js";

interface SystemHealthWidgetProps {
  health?: SystemHealthStatus;
}

export const SystemHealthWidget: React.FC<SystemHealthWidgetProps> = ({
  health = {
    status: "operational",
    components: [
      { name: "API Worker", status: "Healthy", uptimePct: 99.98 },
      { name: "Durable Objects", status: "Healthy", uptimePct: 99.97 },
      { name: "D1 Database", status: "Healthy", uptimePct: 99.99 },
      { name: "R2 Storage", status: "Healthy", uptimePct: 99.96 },
      { name: "WebSocket", status: "Healthy", uptimePct: 99.94 },
    ],
  },
}) => {
  const getIcon = (name: string) => {
    if (name.includes("API")) return <Server className="w-4 h-4 text-emerald-400" />;
    if (name.includes("Durable")) return <Layers className="w-4 h-4 text-emerald-400" />;
    if (name.includes("D1")) return <Database className="w-4 h-4 text-emerald-400" />;
    if (name.includes("R2")) return <HardDrive className="w-4 h-4 text-emerald-400" />;
    return <Radio className="w-4 h-4 text-emerald-400" />;
  };

  return (
    <div className="bg-[#121c26] border border-[#1e2d3d] rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">System Health</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-emerald-400">
              All systems operational
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {health.components.map((comp) => (
          <div
            key={comp.name}
            className="flex items-center justify-between p-2.5 rounded-xl bg-[#0d1520] border border-[#1a2634] hover:border-emerald-500/30 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                {getIcon(comp.name)}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">{comp.name}</p>
                <p className="text-[10px] text-slate-400">{comp.status}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Mini Green Sparkline */}
              <svg className="w-16 h-6 overflow-visible" viewBox="0 0 60 20" aria-hidden="true">
                <path
                  d="M 0 14 Q 10 18, 20 8 T 40 12 T 60 5"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-xs font-bold text-slate-200">{comp.uptimePct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

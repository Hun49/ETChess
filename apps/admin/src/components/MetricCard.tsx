import { ArrowUpRight } from "lucide-react";
import type React from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  changePct: number;
  subtitle: string;
  icon: React.ReactNode;
  isLive?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  changePct,
  subtitle,
  icon,
  isLive,
}) => {
  const isPositive = changePct >= 0;

  return (
    <div className="bg-[#121c26] border border-[#1e2d3d] hover:border-emerald-500/30 rounded-2xl p-5 transition-all shadow-sm group">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
          {icon}
        </div>
        {isLive && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-semibold text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            Live
          </span>
        )}
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-slate-400">{title}</p>
        <div className="flex items-baseline gap-3 mt-1">
          <h3 className="text-2xl font-bold tracking-tight text-white">
            {typeof value === "number" ? value.toLocaleString() : value}
          </h3>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{isPositive ? `+${changePct}%` : `${changePct}%`}</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-1 font-medium">{subtitle}</p>
      </div>
    </div>
  );
};

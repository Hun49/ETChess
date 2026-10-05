import {
  Database,
  FileText,
  ShieldAlert,
  TrendingUp,
  Trophy,
  UserCheck,
  UserPlus,
} from "lucide-react";
import type React from "react";

interface RecentActivityWidgetProps {
  onViewAll?: () => void;
}

export const RecentActivityWidget: React.FC<RecentActivityWidgetProps> = ({ onViewAll }) => {
  const activities = [
    {
      id: "1",
      title: "New user registered",
      subtitle: "abebe123",
      time: "2m ago",
      icon: <UserPlus className="w-3.5 h-3.5 text-emerald-400" />,
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      id: "2",
      title: "Game completed",
      subtitle: "AlexRook vs Zenith (Blitz)",
      time: "2m ago",
      icon: <Trophy className="w-3.5 h-3.5 text-amber-400" />,
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      id: "3",
      title: "Rating updated",
      subtitle: "You +17 (Blitz)",
      time: "6m ago",
      icon: <TrendingUp className="w-3.5 h-3.5 text-teal-400" />,
      bg: "bg-teal-500/10 border-teal-500/20",
    },
    {
      id: "4",
      title: "Friend challenge accepted",
      subtitle: "Mekonnen accepted your challenge",
      time: "12m ago",
      icon: <UserCheck className="w-3.5 h-3.5 text-indigo-400" />,
      bg: "bg-indigo-500/10 border-indigo-500/20",
    },
    {
      id: "5",
      title: "User banned",
      subtitle: "spammer_007 (7 days)",
      time: "20m ago",
      icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />,
      bg: "bg-rose-500/10 border-rose-500/20",
    },
    {
      id: "6",
      title: "New support ticket",
      subtitle: "#TKT-4821",
      time: "34m ago",
      icon: <FileText className="w-3.5 h-3.5 text-orange-400" />,
      bg: "bg-orange-500/10 border-orange-500/20",
    },
    {
      id: "7",
      title: "System backup completed",
      subtitle: "Database + Storage",
      time: "1h ago",
      icon: <Database className="w-3.5 h-3.5 text-blue-400" />,
      bg: "bg-blue-500/10 border-blue-500/20",
    },
  ];

  return (
    <div className="bg-[#121c26] border border-[#1e2d3d] rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">Recent Activity</h3>
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            View All
          </button>
        )}
      </div>

      <div className="space-y-3.5">
        {activities.map((act) => (
          <div key={act.id} className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${act.bg}`}
              >
                {act.icon}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-200 truncate">{act.title}</p>
                <p className="text-[11px] text-slate-400 truncate">{act.subtitle}</p>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 shrink-0">{act.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

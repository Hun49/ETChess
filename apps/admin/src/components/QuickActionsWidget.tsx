import { ChevronRight, FileText, TrendingUp, Users, Zap } from "lucide-react";
import type React from "react";
import type { AdminView } from "../types.js";

interface QuickActionsWidgetProps {
  onNavigate: (view: AdminView) => void;
}

export const QuickActionsWidget: React.FC<QuickActionsWidgetProps> = ({ onNavigate }) => {
  const actions = [
    {
      title: "View Live Games",
      subtitle: "Monitor ongoing games",
      icon: <Zap className="w-4 h-4 text-emerald-400" />,
      view: "live-games" as AdminView,
    },
    {
      title: "Manage Users",
      subtitle: "Search, edit, ban users",
      icon: <Users className="w-4 h-4 text-emerald-400" />,
      view: "users" as AdminView,
    },
    {
      title: "Adjust Ratings",
      subtitle: "Manual rating changes",
      icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
      view: "rating-adjustments" as AdminView,
    },
    {
      title: "View Logs",
      subtitle: "System & error logs",
      icon: <FileText className="w-4 h-4 text-emerald-400" />,
      view: "logs" as AdminView,
    },
  ];

  return (
    <div className="bg-[#121c26] border border-[#1e2d3d] rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-white tracking-tight mb-3">Quick Actions</h3>

      <div className="space-y-2.5">
        {actions.map((act) => (
          <button
            type="button"
            key={act.title}
            onClick={() => onNavigate(act.view)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-[#0d1520] border border-[#1a2634] hover:border-emerald-500/40 hover:bg-[#162230] transition-all group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                {act.icon}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200 group-hover:text-emerald-400 transition-colors">
                  {act.title}
                </p>
                <p className="text-[10px] text-slate-400">{act.subtitle}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
          </button>
        ))}
      </div>
    </div>
  );
};

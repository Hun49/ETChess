import { Gamepad2, Radio, Users, Zap } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { getAdminMetrics, getLiveGames, getRecentGames, getSystemHealth } from "../api.js";
import { LiveGamesWidget } from "../components/LiveGamesWidget.js";
import { MetricCard } from "../components/MetricCard.js";
import { PlatformUsageDonut } from "../components/PlatformUsageDonut.js";
import { PlayerGrowthChart } from "../components/PlayerGrowthChart.js";
import { QuickActionsWidget } from "../components/QuickActionsWidget.js";
import { RecentActivityWidget } from "../components/RecentActivityWidget.js";
import { RecentGamesTable } from "../components/RecentGamesTable.js";
import { SystemHealthWidget } from "../components/SystemHealthWidget.js";
import { TopPlayersWidget } from "../components/TopPlayersWidget.js";
import type {
  AdminMetrics,
  AdminView,
  LiveGameItem,
  RecentGameItem,
  SystemHealthStatus,
} from "../types.js";

interface DashboardViewProps {
  onNavigate: (view: AdminView) => void;
  onInspectGame: (game: LiveGameItem | RecentGameItem) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onInspectGame }) => {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [health, setHealth] = useState<SystemHealthStatus | null>(null);
  const [liveGames, setLiveGames] = useState<LiveGameItem[]>([]);
  const [recentGames, setRecentGames] = useState<RecentGameItem[]>([]);

  useEffect(() => {
    getAdminMetrics().then(setMetrics);
    getSystemHealth().then(setHealth);
    getLiveGames().then(setLiveGames);
    getRecentGames().then(setRecentGames);

    // Periodic refresh
    const interval = setInterval(() => {
      getLiveGames().then(setLiveGames);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const nowFormatted = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(new Date());

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-w-[1600px] mx-auto w-full">
      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Good morning, Hundaol <span className="animate-wave inline-block">👋</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Here's what's happening with ET-Chess today.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-[#121c26] border border-[#1e2d3d] px-3 py-1.5 rounded-xl self-start sm:self-auto shadow-inner">
          <span>🕒</span>
          <span className="font-mono">{nowFormatted}</span>
        </div>
      </div>

      {/* Main Grid: Content (Left 70%) + Quick Widgets (Right 30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 or 9 cols */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {/* Row 1: 4 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard
              title="Total Users"
              value={metrics?.totalUsers ?? 12482}
              changePct={metrics?.usersChange7d ?? 12}
              subtitle="vs last 7 days"
              icon={<Users className="w-5 h-5 text-emerald-400" />}
            />
            <MetricCard
              title="Active Players"
              value={metrics?.activePlayers ?? 1284}
              changePct={metrics?.activePlayersChange7d ?? 18}
              subtitle="vs last 7 days"
              icon={<Zap className="w-5 h-5 text-emerald-400" />}
            />
            <MetricCard
              title="Games Played"
              value={metrics?.gamesPlayed ?? 48732}
              changePct={metrics?.gamesPlayedChange7d ?? 22}
              subtitle="vs last 7 days"
              icon={<Gamepad2 className="w-5 h-5 text-emerald-400" />}
            />
            <MetricCard
              title="Online Now"
              value={metrics?.onlineNow ?? 312}
              changePct={metrics?.onlineChangeHour ?? 8}
              subtitle="vs last hour"
              icon={<Radio className="w-5 h-5 text-emerald-400 animate-pulse" />}
              isLive
            />
          </div>

          {/* Row 2: Platform Usage Donut + Player Growth Chart */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-5">
              <PlatformUsageDonut modes={metrics?.modes} />
            </div>
            <div className="xl:col-span-7">
              <PlayerGrowthChart growth={metrics?.growth} />
            </div>
          </div>

          {/* Row 3: Recent Games Table */}
          <RecentGamesTable
            games={recentGames}
            onSelectGame={onInspectGame}
            onViewAll={() => onNavigate("game-history")}
          />

          {/* Row 4: System Health + Recent Activity */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SystemHealthWidget health={health ?? undefined} />
            <RecentActivityWidget onViewAll={() => onNavigate("logs")} />
          </div>
        </div>

        {/* Right Sidebar Column (3 or 4 cols) */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
          <QuickActionsWidget onNavigate={onNavigate} />
          <TopPlayersWidget onViewAll={() => onNavigate("ratings-overview")} />
          <LiveGamesWidget
            games={liveGames}
            onSelectGame={onInspectGame}
            onViewAll={() => onNavigate("live-games")}
          />
        </div>
      </div>
    </div>
  );
};

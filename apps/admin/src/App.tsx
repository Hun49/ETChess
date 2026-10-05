import type React from "react";
import { useState } from "react";
import { terminateGame } from "./api.js";
import { ChessBoardModal } from "./components/ChessBoardModal.js";
import { Header } from "./components/Header.js";
import { Sidebar } from "./components/Sidebar.js";
import type { AdminUser, AdminView, LiveGameItem, RecentGameItem } from "./types.js";
import { AuditLogsView } from "./views/AuditLogsView.js";
import { DashboardView } from "./views/DashboardView.js";
import { GameHistoryView } from "./views/GameHistoryView.js";
import { LiveGamesView } from "./views/LiveGamesView.js";
import { RatingsView } from "./views/RatingsView.js";
import { ReportsView } from "./views/ReportsView.js";
import { UsersView } from "./views/UsersView.js";

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AdminView>("dashboard");
  const [inspectedGame, setInspectedGame] = useState<LiveGameItem | RecentGameItem | null>(null);
  const [userForRating, setUserForRating] = useState<AdminUser | null>(null);

  const handleOpenRatingAdjust = (user: AdminUser) => {
    setUserForRating(user);
    setCurrentView("rating-adjustments");
  };

  const handleTerminateLiveGame = async (gameId: string, reason: string) => {
    await terminateGame(gameId, reason);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b1118] text-slate-100 font-sans">
      {/* Sidebar (256px fixed) */}
      <Sidebar currentView={currentView} onSelectView={setCurrentView} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <Header onNavigate={setCurrentView} />

        {/* View Content */}
        <main className="flex-1 overflow-y-auto">
          {currentView === "dashboard" && (
            <DashboardView onNavigate={setCurrentView} onInspectGame={setInspectedGame} />
          )}

          {currentView === "users" && <UsersView onOpenRatingAdjust={handleOpenRatingAdjust} />}

          {currentView === "live-games" && <LiveGamesView onInspectGame={setInspectedGame} />}

          {currentView === "game-history" && <GameHistoryView onInspectGame={setInspectedGame} />}

          {(currentView === "ratings-overview" || currentView === "rating-adjustments") && (
            <RatingsView preselectedUser={userForRating} />
          )}

          {(currentView === "bans" || currentView === "verifications") && <ReportsView />}

          {(currentView === "logs" ||
            currentView === "analytics" ||
            currentView === "settings") && <AuditLogsView />}

          {currentView === "settlements" && (
            <div className="p-10 text-center text-slate-400">
              <h2 className="text-xl font-bold text-white mb-2">Settlements</h2>
              <p className="text-xs">No pending payouts or escrow disputes for this cycle.</p>
            </div>
          )}

          {(currentView === "friend-challenges" || currentView === "pending-invites") && (
            <div className="p-10 text-center text-slate-400">
              <h2 className="text-xl font-bold text-white mb-2">Direct Challenges</h2>
              <p className="text-xs">
                Active challenge pool monitored in realtime via User Channels.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Interactive Chess Board Modal */}
      {inspectedGame && (
        <ChessBoardModal
          game={inspectedGame}
          onClose={() => setInspectedGame(null)}
          onTerminateLiveGame={handleTerminateLiveGame}
        />
      )}
    </div>
  );
};

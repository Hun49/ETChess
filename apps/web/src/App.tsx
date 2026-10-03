import type React from "react";
import { AuthModal } from "./components/AuthModal";
import { GameOverModal } from "./components/GameOverModal";
import { LeaderboardModal } from "./components/LeaderboardModal";
import { MatchmakingModal } from "./components/MatchmakingModal";
import { Navbar } from "./components/Navbar";
import { PlayModal } from "./components/PlayModal";
import { ProfileModal } from "./components/ProfileModal";
import { LandingPage } from "./pages/LandingPage";
import { PlayPage } from "./pages/PlayPage";
import { useGameStore } from "./store/gameStore";

export const App: React.FC = () => {
  const { mode } = useGameStore();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-white">
      {/* Top Navigation */}
      <Navbar />

      {/* Main View Router */}
      <main className="flex-1">{mode === "idle" ? <LandingPage /> : <PlayPage />}</main>

      {/* Global Modals Orchestration */}
      <AuthModal />
      <ProfileModal />
      <PlayModal />
      <MatchmakingModal />
      <GameOverModal />
      <LeaderboardModal />

      {/* Footer */}
      <footer className="border-t border-neutral-800/80 bg-neutral-950 py-8 text-center text-xs text-neutral-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-neutral-300">ET CHESS</span>
            <span>•</span>
            <span>Cloudflare Workers & Durable Objects</span>
            <span>•</span>
            <span>Stockfish WASM Engine</span>
          </div>
          <div className="flex items-center gap-4 text-neutral-400">
            <span>Glicko-2 Rated</span>
            <span>•</span>
            <span>Sub-50ms Edge Sync</span>
            <span>•</span>
            <span>WebSocket Hibernation</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

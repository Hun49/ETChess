import type React from "react";
import { useEffect } from "react";
import { AuthModal } from "./components/AuthModal";
import { LeaderboardModal } from "./components/LeaderboardModal";
import { MobileNav } from "./components/MobileNav";
import { NotificationDrawer } from "./components/NotificationDrawer";
import { Sidebar } from "./components/Sidebar";
import { SkillOnboardingModal } from "./components/SkillOnboardingModal";
import { TopBar } from "./components/TopBar";
import { useSession } from "./lib/api";
import { useGameStore } from "./store/gameStore";
import { AnalysisView } from "./views/AnalysisView";
import { GameHistoryView } from "./views/GameHistoryView";
import { GameOverView } from "./views/GameOverView";
import { HomeView } from "./views/HomeView";
import { InGameView } from "./views/InGameView";
import { MatchFoundView } from "./views/MatchFoundView";
import { PlayComputerView } from "./views/PlayComputerView";
import { PlayFriendView } from "./views/PlayFriendView";
import { PlayOnlineView } from "./views/PlayOnlineView";
import { ProfileView } from "./views/ProfileView";
import { SearchingView } from "./views/SearchingView";
import { SettingsView } from "./views/SettingsView";

export const App: React.FC = () => {
  const { activeView, setIsGuest } = useGameStore();
  const { data: session } = useSession();

  // Synchronize global guest state with authentication session
  useEffect(() => {
    setIsGuest(!session?.user);
  }, [session?.user, setIsGuest]);

  const renderActiveView = () => {
    switch (activeView) {
      case "home":
        return <HomeView />;
      case "play_online":
        return <PlayOnlineView />;
      case "searching":
        return <SearchingView />;
      case "match_found":
        return <MatchFoundView />;
      case "game":
      case "play_local":
        return <InGameView />;
      case "game_over":
        return <GameOverView />;
      case "analysis":
        return <AnalysisView />;
      case "history":
        return <GameHistoryView />;
      case "profile":
        return <ProfileView />;
      case "play_friend":
        return <PlayFriendView />;
      case "play_computer":
        return <PlayComputerView />;
      case "settings":
        return <SettingsView />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#081214] text-neutral-100 font-sans selection:bg-[#00e699]/30 selection:text-white">
      {/* Desktop Fixed Left Navigation Sidebar */}
      <Sidebar />

      {/* Main App Column */}
      <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Bar with Latency, Sound, Bell, Avatar */}
        <TopBar />

        {/* Dynamic Screen View Router */}
        <main className="flex-1 overflow-hidden relative flex flex-col">{renderActiveView()}</main>

        {/* Mobile Bottom Navigation Bar (hidden on desktop lg+) */}
        <MobileNav />
      </div>

      {/* Global Modals & Drawers */}
      <AuthModal />
      <LeaderboardModal />
      <NotificationDrawer />
      <SkillOnboardingModal />
    </div>
  );
};

export default App;

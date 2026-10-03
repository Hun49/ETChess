import { History, Home, Swords, User } from "lucide-react";
import type React from "react";
import { type AppView, useGameStore } from "../store/gameStore";

export const MobileNav: React.FC = () => {
  const { activeView, setActiveView } = useGameStore();

  const isPlayActive =
    activeView === "play_online" ||
    activeView === "play_friend" ||
    activeView === "play_computer" ||
    activeView === "play_local" ||
    activeView === "searching" ||
    activeView === "match_found" ||
    activeView === "game";

  const navItems: { view: AppView; label: string; icon: typeof Home; active: boolean }[] = [
    { view: "home", label: "Home", icon: Home, active: activeView === "home" },
    { view: "play_online", label: "Play", icon: Swords, active: isPlayActive },
    { view: "history", label: "History", icon: History, active: activeView === "history" },
    { view: "profile", label: "Profile", icon: User, active: activeView === "profile" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-[#14282c] bg-[#081214]/95 px-2 backdrop-blur-md">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => setActiveView(item.view)}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 text-[10px] font-semibold transition-colors ${
              item.active ? "text-[#00e699]" : "text-[#8ba3a8] hover:text-white"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

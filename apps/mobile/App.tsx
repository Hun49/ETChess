import { StatusBar } from "expo-status-bar";
import type React from "react";
import { useEffect, useRef } from "react";
import { BackHandler, StyleSheet, ToastAndroid, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { BottomNavBar } from "./src/components/BottomNavBar";
import { MatchmakingModal } from "./src/components/MatchmakingModal";
import { useMobileStore } from "./src/store/mobileStore";
import { COLORS } from "./src/theme/colors";
import { AnalysisView } from "./src/views/AnalysisView";
import { GameHistoryView } from "./src/views/GameHistoryView";
import { HomeView } from "./src/views/HomeView";
import { InGameView } from "./src/views/InGameView";
import { LocalPlayView } from "./src/views/LocalPlayView";
import { PlayComputerView } from "./src/views/PlayComputerView";
import { PlayFriendView } from "./src/views/PlayFriendView";
import { PlayOnlineView } from "./src/views/PlayOnlineView";
import { ProfileView } from "./src/views/ProfileView";
import { SplashScreen } from "./src/views/SplashScreen";

export default function App() {
  const { activeView, goBack, viewHistory } = useMobileStore();
  const lastBackPress = useRef(0);

  // UX-NAV-01 & UX-NAV-02: Hierarchical back navigation, two rapid backs from home exits app
  useEffect(() => {
    const onBackPress = () => {
      if (activeView === "home" || activeView === "splash") {
        const now = Date.now();
        if (now - lastBackPress.current < 2000) {
          BackHandler.exitApp();
          return true;
        }
        lastBackPress.current = now;
        if (ToastAndroid) {
          ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);
        }
        return true;
      }

      goBack();
      return true;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => backHandler.remove();
  }, [activeView, goBack]);

  const renderCurrentView = () => {
    switch (activeView) {
      case "splash":
        return <SplashScreen />;
      case "home":
        return <HomeView />;
      case "play_online":
        return <PlayOnlineView />;
      case "play_computer":
        return <PlayComputerView />;
      case "play_friend":
        return <PlayFriendView />;
      case "play_local":
        return <LocalPlayView />;
      case "in_game":
        return <InGameView />;
      case "history":
        return <GameHistoryView />;
      case "profile":
      case "settings":
        return <ProfileView />;
      case "analysis":
        return <AnalysisView />;
      default:
        return <HomeView />;
    }
  };

  // Show bottom navigation bar on primary tabs
  const showBottomNav =
    activeView === "home" || activeView === "history" || activeView === "profile";

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor={COLORS.background} />

        <View style={styles.content}>{renderCurrentView()}</View>

        {showBottomNav && <BottomNavBar />}

        {/* Global Matchmaking Modal */}
        <MatchmakingModal />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
});

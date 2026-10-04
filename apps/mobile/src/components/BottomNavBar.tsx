import { History, Home, type LucideIcon, Swords, User } from "lucide-react-native";
import type React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMobileStore } from "../store/mobileStore";
import { COLORS } from "../theme/colors";
import type { MobileTab } from "../types";

export const BottomNavBar: React.FC = () => {
  const { activeTab, setActiveTab } = useMobileStore();

  const tabs: Array<{ id: MobileTab; label: string; icon: LucideIcon }> = [
    { id: "home", label: "Home", icon: Home },
    { id: "games", label: "Games", icon: Swords },
    { id: "history", label: "History", icon: History },
    { id: "profile", label: "Profile", icon: User },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tabItem}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.7}
          >
            {isActive && <View style={styles.activeIndicator} />}
            <Icon size={20} color={isActive ? COLORS.primary : COLORS.textSecondary} />
            <Text
              style={[styles.tabLabel, { color: isActive ? COLORS.primary : COLORS.textSecondary }]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 64,
    flexDirection: "row",
    backgroundColor: COLORS.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: "center",
    justifyContent: "space-around",
    paddingBottom: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    position: "relative",
    gap: 3,
  },
  activeIndicator: {
    position: "absolute",
    top: 0,
    width: 28,
    height: 3,
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
});

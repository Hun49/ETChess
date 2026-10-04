import { Bell, Flame, Settings, User } from "lucide-react-native";
import type React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMobileStore } from "../store/mobileStore";
import { COLORS } from "../theme/colors";

export const TopBar: React.FC = () => {
  const { user, navigate } = useMobileStore();

  return (
    <View style={styles.container}>
      {/* Left: Avatar + Username + Rating */}
      <TouchableOpacity
        style={styles.profileSection}
        onPress={() => navigate("profile")}
        activeOpacity={0.8}
      >
        <View style={styles.avatar}>
          <User size={18} color={COLORS.primary} />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {user.name}
          </Text>
          <View style={styles.ratingBadge}>
            <Flame size={11} color={COLORS.primary} />
            <Text style={styles.ratingText}>{user.ratings.blitz}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Right: Actions (Notification, Settings) */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.iconButton} onPress={() => {}} activeOpacity={0.7}>
          <Bell size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigate("settings")}
          activeOpacity={0.7}
        >
          <Settings size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: {
    justifyContent: "center",
  },
  userName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 11,
    fontFamily: "monospace",
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
});

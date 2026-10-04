import {
  Award,
  ChevronRight,
  Flame,
  Globe,
  LogOut,
  Settings,
  Shield,
  TrendingUp,
  User,
  Zap,
} from "lucide-react-native";
import type React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMobileStore } from "../store/mobileStore";
import { COLORS } from "../theme/colors";

export const ProfileView: React.FC = () => {
  const { user, navigate } = useMobileStore();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => navigate("settings")}
          activeOpacity={0.7}
        >
          <Settings size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarWrap}>
            <User size={36} color={COLORS.primary} />
            <View style={styles.onlineBadge} />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.displayName}>{user.name}</Text>
            <Text style={styles.handle}>@{user.name.toLowerCase()}</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{user.isGuest ? "Guest Account" : "Online"}</Text>
            </View>
          </View>
        </View>

        {/* Rating Cards (Bullet, Blitz, Rapid) */}
        <Text style={styles.sectionTitle}>Ratings</Text>
        <View style={styles.ratingsRow}>
          {/* Bullet */}
          <View style={styles.ratingCard}>
            <View style={styles.ratingHeader}>
              <Zap size={14} color={COLORS.primary} />
              <Text style={styles.ratingCategory}>Bullet</Text>
            </View>
            <Text style={styles.ratingNumber}>{user.ratings.bullet}</Text>
            <Text style={styles.ratingGain}>+12</Text>
          </View>

          {/* Blitz */}
          <View style={[styles.ratingCard, styles.ratingCardActive]}>
            <View style={styles.ratingHeader}>
              <Flame size={14} color={COLORS.primary} />
              <Text style={styles.ratingCategory}>Blitz</Text>
            </View>
            <Text style={styles.ratingNumber}>{user.ratings.blitz}</Text>
            <Text style={styles.ratingGain}>+17</Text>
          </View>

          {/* Rapid */}
          <View style={styles.ratingCard}>
            <View style={styles.ratingHeader}>
              <Globe size={14} color={COLORS.primary} />
              <Text style={styles.ratingCategory}>Rapid</Text>
            </View>
            <Text style={styles.ratingNumber}>{user.ratings.rapid}</Text>
            <Text style={[styles.ratingGain, { color: COLORS.danger }]}>-5</Text>
          </View>
        </View>

        {/* Lifetime Stats */}
        <Text style={styles.sectionTitle}>Performance</Text>
        <View style={styles.statsCard}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total Games</Text>
            <Text style={styles.statValue}>842</Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Wins</Text>
            <Text style={[styles.statValue, { color: COLORS.success }]}>
              56% <Text style={styles.statSub}>(471)</Text>
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Draws</Text>
            <Text style={styles.statValue}>
              12% <Text style={styles.statSub}>(101)</Text>
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Losses</Text>
            <Text style={[styles.statValue, { color: COLORS.danger }]}>
              32% <Text style={styles.statSub}>(270)</Text>
            </Text>
          </View>

          <View style={[styles.statRow, styles.statRowHighlight]}>
            <View style={styles.bestRatingLabel}>
              <TrendingUp size={14} color={COLORS.primary} />
              <Text style={styles.statLabel}>Best Rating</Text>
            </View>
            <Text style={[styles.statValue, { color: COLORS.primary }]}>1784</Text>
          </View>
        </View>

        {/* Account Options */}
        <View style={styles.accountMenu}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigate("splash")}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <LogOut size={16} color={COLORS.danger} />
              <Text style={[styles.menuItemText, { color: COLORS.danger }]}>
                {user.isGuest ? "Sign In / Register" : "Sign Out"}
              </Text>
            </View>
            <ChevronRight size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 32,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 20,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.card,
  },
  userDetails: {
    flex: 1,
  },
  displayName: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  handle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.primary,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  ratingsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  ratingCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  ratingCardActive: {
    borderColor: COLORS.primaryBorder,
    backgroundColor: COLORS.surface,
  },
  ratingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingCategory: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: "700",
  },
  ratingNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
    fontFamily: "monospace",
    marginTop: 6,
  },
  ratingGain: {
    fontSize: 10,
    fontFamily: "monospace",
    fontWeight: "700",
    color: COLORS.success,
    marginTop: 2,
  },
  statsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statRowHighlight: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    marginTop: 4,
  },
  bestRatingLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  statValue: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "monospace",
    color: COLORS.text,
  },
  statSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  accountMenu: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: "700",
  },
});

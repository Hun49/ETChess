import {
  ArrowRight,
  Bot,
  Flame,
  Globe,
  Shield,
  Smartphone,
  Sparkles,
  Users,
  Zap,
} from "lucide-react-native";
import type React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { TopBar } from "../components/TopBar";
import { useMobileStore } from "../store/mobileStore";
import { COLORS } from "../theme/colors";

export const HomeView: React.FC = () => {
  const { navigate, setActiveTab, startMatchmaking, history } = useMobileStore();

  const recentGames = history.slice(0, 3);

  return (
    <View style={styles.container}>
      <TopBar />

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroText}>
            <View style={styles.heroTag}>
              <Sparkles size={12} color={COLORS.primary} />
              <Text style={styles.heroTagText}>WELCOME TO ET-CHESS</Text>
            </View>
            <Text style={styles.heroTitle}>Better Moves Every Day</Text>
            <Text style={styles.heroSubtitle}>Play, learn and grow with players and AI.</Text>
          </View>
          <View style={styles.heroBadge}>
            <Shield size={36} color={COLORS.primary} />
          </View>
        </View>

        {/* 4 Mode Cards (2x2 Grid) */}
        <Text style={styles.sectionHeader}>Game Modes</Text>
        <View style={styles.modeGrid}>
          {/* 1. Play Online */}
          <TouchableOpacity
            style={styles.modeCard}
            onPress={() => navigate("play_online")}
            activeOpacity={0.8}
          >
            <View style={[styles.modeIconCircle, { backgroundColor: "rgba(0, 230, 153, 0.15)" }]}>
              <Globe size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.modeTitle}>Play Online</Text>
            <Text style={styles.modeDesc}>Find an opponent</Text>
          </TouchableOpacity>

          {/* 2. Play a Friend */}
          <TouchableOpacity
            style={styles.modeCard}
            onPress={() => navigate("play_friend")}
            activeOpacity={0.8}
          >
            <View style={[styles.modeIconCircle, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
              <Users size={22} color={COLORS.info} />
            </View>
            <Text style={styles.modeTitle}>Play a Friend</Text>
            <Text style={styles.modeDesc}>Challenge your friends</Text>
          </TouchableOpacity>

          {/* 3. Play Computer */}
          <TouchableOpacity
            style={styles.modeCard}
            onPress={() => navigate("play_computer")}
            activeOpacity={0.8}
          >
            <View style={[styles.modeIconCircle, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
              <Bot size={22} color={COLORS.warning} />
            </View>
            <Text style={styles.modeTitle}>Play Computer</Text>
            <Text style={styles.modeDesc}>Practice & improve</Text>
          </TouchableOpacity>

          {/* 4. Local Play */}
          <TouchableOpacity
            style={styles.modeCard}
            onPress={() => navigate("play_local")}
            activeOpacity={0.8}
          >
            <View style={[styles.modeIconCircle, { backgroundColor: "rgba(168, 85, 247, 0.15)" }]}>
              <Smartphone size={22} color="#C084FC" />
            </View>
            <Text style={styles.modeTitle}>Local Play</Text>
            <Text style={styles.modeDesc}>Same device play</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Play Chips */}
        <Text style={styles.sectionHeader}>Quick Play</Text>
        <View style={styles.quickPlayRow}>
          <TouchableOpacity
            style={styles.quickChip}
            onPress={() => startMatchmaking("1+0", true)}
            activeOpacity={0.8}
          >
            <Zap size={14} color={COLORS.primary} />
            <Text style={styles.quickChipDuration}>1 min</Text>
            <Text style={styles.quickChipCategory}>Bullet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickChip, styles.quickChipActive]}
            onPress={() => startMatchmaking("3+0", true)}
            activeOpacity={0.8}
          >
            <Flame size={14} color={COLORS.primary} />
            <Text style={styles.quickChipDuration}>3 min</Text>
            <Text style={styles.quickChipCategory}>Blitz</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickChip}
            onPress={() => startMatchmaking("10+0", true)}
            activeOpacity={0.8}
          >
            <Globe size={14} color={COLORS.primary} />
            <Text style={styles.quickChipDuration}>10 min</Text>
            <Text style={styles.quickChipCategory}>Rapid</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Games */}
        <View style={styles.recentGamesHeader}>
          <Text style={styles.sectionHeader}>Recent Games</Text>
          <TouchableOpacity onPress={() => setActiveTab("history")} activeOpacity={0.7}>
            <Text style={styles.viewAllText}>View all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recentGamesList}>
          {recentGames.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.recentGameItem}
              onPress={() => setActiveTab("history")}
              activeOpacity={0.7}
            >
              <View style={styles.gameItemLeft}>
                <View
                  style={[
                    styles.resultPill,
                    item.result === "win"
                      ? styles.resultWin
                      : item.result === "loss"
                        ? styles.resultLoss
                        : styles.resultDraw,
                  ]}
                >
                  <Text
                    style={[
                      styles.resultText,
                      {
                        color:
                          item.result === "win"
                            ? COLORS.primary
                            : item.result === "loss"
                              ? COLORS.danger
                              : COLORS.textSecondary,
                      },
                    ]}
                  >
                    {item.result.toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={styles.opponentName}>{item.opponent.name}</Text>
                  <Text style={styles.gameMeta}>
                    {item.timeControl} • {item.opening || item.termination}
                  </Text>
                </View>
              </View>

              <View style={styles.gameItemRight}>
                {item.ratingDelta !== 0 && (
                  <Text
                    style={[
                      styles.deltaLabel,
                      { color: item.ratingDelta > 0 ? COLORS.success : COLORS.danger },
                    ]}
                  >
                    {item.ratingDelta > 0 ? `+${item.ratingDelta}` : `${item.ratingDelta}`}
                  </Text>
                )}
                <Text style={styles.dateLabel}>{item.date}</Text>
              </View>
            </TouchableOpacity>
          ))}
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
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 16,
    paddingBottom: 24,
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 20,
  },
  heroText: {
    flex: 1,
  },
  heroTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  heroTagText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  heroBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.primaryBorder,
    marginLeft: 12,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 12,
  },
  modeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  modeCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  modeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },
  modeDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  quickPlayRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  quickChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    gap: 2,
  },
  quickChipActive: {
    borderColor: COLORS.primaryBorder,
    backgroundColor: COLORS.surface,
  },
  quickChipDuration: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 4,
  },
  quickChipCategory: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  recentGamesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  recentGamesList: {
    gap: 10,
    marginTop: 4,
  },
  recentGameItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  gameItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resultPill: {
    width: 40,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  resultWin: {
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  resultLoss: {
    backgroundColor: COLORS.dangerMuted,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  resultDraw: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultText: {
    fontSize: 10,
    fontWeight: "900",
  },
  opponentName: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  gameMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  gameItemRight: {
    alignItems: "flex-end",
  },
  deltaLabel: {
    fontSize: 12,
    fontFamily: "monospace",
    fontWeight: "800",
  },
  dateLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});

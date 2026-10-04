import { Check, Clock, Copy, Search, Sparkles, Swords, Trophy } from "lucide-react-native";
import type React from "react";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useMobileStore } from "../store/mobileStore";
import { COLORS } from "../theme/colors";

type HistoryCategory = "all" | "online" | "friend" | "computer" | "local";

export const GameHistoryView: React.FC = () => {
  const { history, navigate, setActiveTab } = useMobileStore();
  const [category, setCategory] = useState<HistoryCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredGames = useMemo(() => {
    return history.filter((g) => {
      if (category !== "all" && g.category !== category) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          g.opponent.name.toLowerCase().includes(q) ||
          g.timeControl.includes(q) ||
          g.opening?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [history, category, searchQuery]);

  const handleCopyPgn = (gameId: string) => {
    setCopiedId(gameId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAnalyze = () => {
    navigate("analysis");
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Match History</Text>
          <Text style={styles.subtitle}>Review your past games & PGNs</Text>
        </View>

        {/* Win/Loss pill */}
        <View style={styles.statsPill}>
          <Trophy size={14} color={COLORS.primary} />
          <Text style={styles.statsText}>
            <Text style={{ color: COLORS.primary }}>4W</Text> •{" "}
            <Text style={{ color: COLORS.danger }}>2L</Text> •{" "}
            <Text style={{ color: COLORS.textSecondary }}>1D</Text>
          </Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {(
          [
            { id: "all", label: "All" },
            { id: "online", label: "Online" },
            { id: "friend", label: "Friend" },
            { id: "computer", label: "Bot" },
            { id: "local", label: "Local" },
          ] as const
        ).map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.filterChip, category === t.id && styles.filterChipActive]}
            onPress={() => setCategory(t.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, category === t.id && styles.filterChipTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Search size={16} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search opponent or opening..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Game List */}
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listInner}
        showsVerticalScrollIndicator={false}
      >
        {filteredGames.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Swords size={40} color={COLORS.surfaceLight} />
            <Text style={styles.emptyTitle}>No games found</Text>
            <Text style={styles.emptySubtitle}>Try changing filters or play a new game</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setActiveTab("games")}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyButtonText}>Play a Game</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredGames.map((game) => (
            <View key={game.id} style={styles.gameCard}>
              <View style={styles.cardTopRow}>
                {/* Result Pill */}
                <View
                  style={[
                    styles.resultBadge,
                    game.result === "win"
                      ? styles.badgeWin
                      : game.result === "loss"
                        ? styles.badgeLoss
                        : styles.badgeDraw,
                  ]}
                >
                  <Text
                    style={[
                      styles.resultBadgeText,
                      {
                        color:
                          game.result === "win"
                            ? COLORS.primary
                            : game.result === "loss"
                              ? COLORS.danger
                              : COLORS.textSecondary,
                      },
                    ]}
                  >
                    {game.result.toUpperCase()}
                  </Text>
                  {game.ratingDelta !== 0 && (
                    <Text
                      style={[
                        styles.ratingDeltaText,
                        { color: game.ratingDelta > 0 ? COLORS.primary : COLORS.danger },
                      ]}
                    >
                      {game.ratingDelta > 0 ? `+${game.ratingDelta}` : `${game.ratingDelta}`}
                    </Text>
                  )}
                </View>

                {/* Opponent Info */}
                <View style={styles.opponentBlock}>
                  <View style={styles.opponentNameRow}>
                    <Text style={styles.opponentName}>{game.opponent.name}</Text>
                    <Text style={styles.opponentRating}>{game.opponent.rating}</Text>
                  </View>
                  <Text style={styles.openingText}>{game.opening || game.termination}</Text>
                </View>

                {/* Meta */}
                <View style={styles.metaBlock}>
                  <View style={styles.timeControlRow}>
                    <Clock size={11} color={COLORS.textMuted} />
                    <Text style={styles.timeControlText}>{game.timeControl}</Text>
                  </View>
                  <Text style={styles.dateText}>{game.date}</Text>
                </View>
              </View>

              {/* Action row: Copy PGN & Analyze */}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleCopyPgn(game.id)}
                  activeOpacity={0.7}
                >
                  {copiedId === game.id ? (
                    <>
                      <Check size={14} color={COLORS.primary} />
                      <Text style={[styles.actionText, { color: COLORS.primary }]}>Copied!</Text>
                    </>
                  ) : (
                    <>
                      <Copy size={14} color={COLORS.textSecondary} />
                      <Text style={styles.actionText}>PGN</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnAnalyze]}
                  onPress={handleAnalyze}
                  activeOpacity={0.7}
                >
                  <Sparkles size={14} color={COLORS.primary} />
                  <Text style={[styles.actionText, { color: COLORS.primary }]}>Analyze</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
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
  subtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statsText: {
    fontSize: 11,
    fontWeight: "800",
    fontFamily: "monospace",
  },
  filterTabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: COLORS.primary,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text,
  },
  listScroll: {
    flex: 1,
  },
  listInner: {
    padding: 16,
    gap: 10,
    paddingBottom: 24,
  },
  gameCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  resultBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeWin: {
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  badgeLoss: {
    backgroundColor: COLORS.dangerMuted,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  badgeDraw: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultBadgeText: {
    fontSize: 10,
    fontWeight: "900",
  },
  ratingDeltaText: {
    fontSize: 10,
    fontFamily: "monospace",
    fontWeight: "800",
  },
  opponentBlock: {
    flex: 1,
  },
  opponentNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  opponentName: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  opponentRating: {
    fontSize: 11,
    fontFamily: "monospace",
    color: COLORS.textSecondary,
  },
  openingText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  metaBlock: {
    alignItems: "flex-end",
  },
  timeControlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeControlText: {
    fontSize: 11,
    fontFamily: "monospace",
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  dateText: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionBtnAnalyze: {
    borderColor: COLORS.primaryBorder,
    backgroundColor: COLORS.primaryMuted,
  },
  actionText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  emptyButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  emptyButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.textDark,
  },
});

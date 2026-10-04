import { Award, ChevronRight, RotateCcw, Sparkles, Trophy, User } from "lucide-react-native";
import type React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMobileStore } from "../store/mobileStore";
import { COLORS } from "../theme/colors";

export const GameOverModal: React.FC = () => {
  const { game, user, navigate, setActiveTab, startMatchmaking, startBotGame, botDifficulty } =
    useMobileStore();

  if (!game || game.status !== "terminated") return null;

  const isWin = game.winner === game.playerColor;
  const isDraw = game.winner === "draw";
  const title = isWin ? "Victory!" : isDraw ? "Draw" : "Defeat";
  const delta = game.isRated ? (isWin ? +17 : isDraw ? 0 : -17) : 0;

  const opponent = game.playerColor === "white" ? game.blackPlayer : game.whitePlayer;

  const handlePlayAgain = () => {
    if (game.mode === "online") {
      startMatchmaking(game.timeControlId, game.isRated);
    } else if (game.mode === "computer") {
      startBotGame(game.timeControlId, botDifficulty, "random");
    } else {
      navigate("play_online");
    }
  };

  const handleViewAnalysis = () => {
    navigate("analysis");
  };

  const handleGoToHistory = () => {
    setActiveTab("history");
  };

  return (
    <Modal visible={game.status === "terminated"} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Trophy Header */}
          <View
            style={[
              styles.trophyCircle,
              isWin ? styles.trophyWin : isDraw ? styles.trophyDraw : styles.trophyLoss,
            ]}
          >
            {isWin ? (
              <Trophy size={36} color={COLORS.primary} />
            ) : isDraw ? (
              <Award size={36} color={COLORS.warning} />
            ) : (
              <Award size={36} color={COLORS.danger} />
            )}
          </View>

          <Text
            style={[
              styles.resultTitle,
              { color: isWin ? COLORS.primary : isDraw ? COLORS.warning : COLORS.danger },
            ]}
          >
            {title}
          </Text>
          <Text style={styles.terminationText}>{game.terminationReason || "Game finished"}</Text>

          {/* Rating Delta & Matchup Card */}
          <View style={styles.matchupBox}>
            {/* You */}
            <View style={styles.playerStat}>
              <View style={styles.playerAvatar}>
                <User size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.playerName}>You</Text>
              <Text style={styles.playerRatingOld}>{user.ratings.blitz - delta}</Text>
              <View style={styles.deltaPill}>
                <Text
                  style={[
                    styles.deltaText,
                    {
                      color:
                        delta > 0
                          ? COLORS.success
                          : delta < 0
                            ? COLORS.danger
                            : COLORS.textSecondary,
                    },
                  ]}
                >
                  {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "0"}
                </Text>
              </View>
            </View>

            <Text style={styles.vsText}>VS</Text>

            {/* Opponent */}
            <View style={styles.playerStat}>
              <View style={styles.playerAvatar}>
                <User size={18} color={COLORS.textSecondary} />
              </View>
              <Text style={styles.playerName}>{opponent.name}</Text>
              <Text style={styles.playerRatingOld}>{opponent.rating + delta}</Text>
              <View style={styles.deltaPill}>
                <Text
                  style={[
                    styles.deltaText,
                    {
                      color:
                        delta < 0
                          ? COLORS.success
                          : delta > 0
                            ? COLORS.danger
                            : COLORS.textSecondary,
                    },
                  ]}
                >
                  {delta > 0 ? `-${delta}` : delta < 0 ? `+${Math.abs(delta)}` : "0"}
                </Text>
              </View>
            </View>
          </View>

          {/* Match Meta */}
          <Text style={styles.matchMetaText}>
            {game.timeControlId} • {game.moves.length} moves
          </Text>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handlePlayAgain}
              activeOpacity={0.8}
            >
              <RotateCcw size={18} color={COLORS.textDark} />
              <Text style={styles.primaryButtonText}>Play Again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleViewAnalysis}
              activeOpacity={0.8}
            >
              <Sparkles size={16} color={COLORS.primary} />
              <Text style={styles.secondaryButtonText}>View Analysis</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.historyLink}
              onPress={handleGoToHistory}
              activeOpacity={0.7}
            >
              <Text style={styles.historyLinkText}>Game History</Text>
              <ChevronRight size={14} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(8, 18, 20, 0.94)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    padding: 24,
    alignItems: "center",
  },
  trophyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  trophyWin: {
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 2,
    borderColor: COLORS.primaryBorder,
  },
  trophyDraw: {
    backgroundColor: COLORS.warningMuted,
    borderWidth: 2,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  trophyLoss: {
    backgroundColor: COLORS.dangerMuted,
    borderWidth: 2,
    borderColor: COLORS.dangerBorder,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  terminationText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  matchupBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  playerStat: {
    alignItems: "center",
    width: 100,
  },
  playerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  playerName: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
  },
  playerRatingOld: {
    fontSize: 11,
    fontFamily: "monospace",
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  deltaPill: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: COLORS.background,
  },
  deltaText: {
    fontSize: 11,
    fontWeight: "800",
    fontFamily: "monospace",
  },
  vsText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.textMuted,
  },
  matchMetaText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 12,
    marginBottom: 20,
  },
  actionsContainer: {
    width: "100%",
    gap: 10,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 13,
    width: "100%",
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textDark,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: "100%",
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  historyLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
  },
  historyLinkText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
});

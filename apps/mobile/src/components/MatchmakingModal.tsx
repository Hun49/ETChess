import { Shield, Swords, User, X } from "lucide-react-native";
import type React from "react";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useMobileStore } from "../store/mobileStore";
import { COLORS } from "../theme/colors";

export const MatchmakingModal: React.FC = () => {
  const {
    isSearching,
    searchTimeControlId,
    isSearchRated,
    cancelMatchmaking,
    startOnlineGame,
    user,
  } = useMobileStore();

  const [matched, setMatched] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [opponent, setOpponent] = useState({
    name: "AlexRook",
    rating: 1548,
  });

  // Simulated matchmaking discovery for realistic demo & testing
  useEffect(() => {
    let matchTimer: ReturnType<typeof setTimeout>;
    let countInterval: ReturnType<typeof setInterval>;

    if (isSearching) {
      setMatched(false);
      setCountdown(3);

      // Simulate match found after 2.5 seconds
      matchTimer = setTimeout(() => {
        setMatched(true);

        const possibleOpponents = [
          { name: "AlexRook", rating: 1548 },
          { name: "Elena_V", rating: 1580 },
          { name: "ViktorChess", rating: 1620 },
          { name: "FlashTactics", rating: 1490 },
        ];
        const randomOpp = possibleOpponents[Math.floor(Math.random() * possibleOpponents.length)];
        setOpponent(randomOpp);

        let currentCount = 3;
        countInterval = setInterval(() => {
          currentCount -= 1;
          setCountdown(currentCount);

          if (currentCount <= 0) {
            clearInterval(countInterval);
            // Launch game!
            const gameId = `online-${Date.now()}`;
            const isWhite = Math.random() < 0.5;

            startOnlineGame(
              gameId,
              isWhite ? "white" : "black",
              isWhite
                ? { id: user.id, name: user.name, rating: user.ratings.blitz }
                : { id: "opp", name: randomOpp.name, rating: randomOpp.rating },
              !isWhite
                ? { id: user.id, name: user.name, rating: user.ratings.blitz }
                : { id: "opp", name: randomOpp.name, rating: randomOpp.rating },
              searchTimeControlId || "3+2",
              isSearchRated,
            );
          }
        }, 1000);
      }, 2500);
    }

    return () => {
      clearTimeout(matchTimer);
      clearInterval(countInterval);
    };
  }, [isSearching, searchTimeControlId, isSearchRated, startOnlineGame, user]);

  if (!isSearching) return null;

  return (
    <Modal visible={isSearching} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {matched ? (
            // State 2: Match Found!
            <View style={styles.matchedContainer}>
              <Text style={styles.matchedTitle}>Match Found!</Text>

              <View style={styles.matchupRow}>
                {/* You */}
                <View style={styles.playerCard}>
                  <View style={styles.avatarCircle}>
                    <User size={24} color={COLORS.primary} />
                  </View>
                  <Text style={styles.playerName}>{user.name}</Text>
                  <Text style={styles.playerRating}>{user.ratings.blitz}</Text>
                </View>

                {/* VS */}
                <View style={styles.vsBadge}>
                  <Swords size={20} color={COLORS.primary} />
                </View>

                {/* Opponent */}
                <View style={styles.playerCard}>
                  <View style={styles.avatarCircle}>
                    <User size={24} color={COLORS.textSecondary} />
                  </View>
                  <Text style={styles.playerName}>{opponent.name}</Text>
                  <Text style={styles.playerRating}>{opponent.rating}</Text>
                </View>
              </View>

              <View style={styles.countdownContainer}>
                <Text style={styles.countdownText}>{countdown}</Text>
                <Text style={styles.startingText}>Game starting...</Text>
              </View>
            </View>
          ) : (
            // State 1: Searching / Radar pulse
            <View style={styles.searchingContainer}>
              <View style={styles.radarWrapper}>
                <View style={styles.radarOuterRing}>
                  <View style={styles.radarMiddleRing}>
                    <View style={styles.radarCore}>
                      <Shield size={32} color={COLORS.primary} />
                    </View>
                  </View>
                </View>
                <ActivityIndicator
                  size="large"
                  color={COLORS.primary}
                  style={styles.spinnerOverlay}
                />
              </View>

              <Text style={styles.searchingTitle}>Finding an opponent...</Text>
              <Text style={styles.timeControlSubtitle}>
                {searchTimeControlId} {isSearchRated ? "• Rated" : "• Casual"}
              </Text>

              <Text style={styles.ratingInfo}>
                Your rating: <Text style={styles.ratingValue}>{user.ratings.blitz}</Text>
              </Text>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={cancelMatchmaking}
                activeOpacity={0.8}
              >
                <X size={16} color={COLORS.textSecondary} />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(8, 18, 20, 0.92)",
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
  searchingContainer: {
    alignItems: "center",
    width: "100%",
  },
  radarWrapper: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
    position: "relative",
  },
  radarOuterRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: "rgba(0, 230, 153, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 230, 153, 0.03)",
  },
  radarMiddleRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    borderColor: "rgba(0, 230, 153, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 230, 153, 0.08)",
  },
  radarCore: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  spinnerOverlay: {
    position: "absolute",
  },
  searchingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 8,
  },
  timeControlSubtitle: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "600",
    marginTop: 4,
  },
  ratingInfo: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 8,
    marginBottom: 20,
  },
  ratingValue: {
    color: COLORS.text,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  matchedContainer: {
    alignItems: "center",
    width: "100%",
    paddingVertical: 8,
  },
  matchedTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  matchupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 12,
  },
  playerCard: {
    alignItems: "center",
    width: 90,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  playerName: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
  },
  playerRating: {
    fontSize: 11,
    fontFamily: "monospace",
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  vsBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  countdownContainer: {
    marginTop: 24,
    alignItems: "center",
  },
  countdownText: {
    fontSize: 36,
    fontWeight: "900",
    fontFamily: "monospace",
    color: COLORS.primary,
  },
  startingText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});

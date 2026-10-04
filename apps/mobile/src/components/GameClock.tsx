import { Bot, Clock, User } from "lucide-react-native";
import type React from "react";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMobileStore } from "../store/mobileStore";
import { COLORS } from "../theme/colors";
import type { PlayerInfo } from "../types";

interface PlayerClockProps {
  player: PlayerInfo;
  timeMs: number;
  isActive: boolean;
  color: "white" | "black";
}

export const PlayerClock: React.FC<PlayerClockProps> = ({ player, timeMs, isActive, color }) => {
  const [remainingMs, setRemainingMs] = useState(timeMs);
  const { game, endGame } = useMobileStore();

  useEffect(() => {
    setRemainingMs(timeMs);
  }, [timeMs]);

  useEffect(() => {
    if (!isActive || !game || game.status !== "active") return;

    const interval = setInterval(() => {
      setRemainingMs((prev) => {
        if (prev <= 1000) {
          clearInterval(interval);
          // Flag fall / Timeout termination
          const winner = color === "white" ? "black" : "white";
          endGame(winner, "by Timeout");
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, game, color, endGame]);

  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const isLowTime = totalSec < 30;

  return (
    <View style={[styles.container, isActive && styles.activeContainer]}>
      {/* Player info (Avatar, Name, Rating, Color Indicator) */}
      <View style={styles.playerInfo}>
        <View style={styles.avatarContainer}>
          {player.isAi ? (
            <Bot size={18} color={COLORS.primary} />
          ) : (
            <User size={18} color={COLORS.textSecondary} />
          )}
          <View
            style={[
              styles.colorPill,
              { backgroundColor: color === "white" ? "#FFFFFF" : "#1A1A1A" },
            ]}
          />
        </View>

        <View style={styles.nameBlock}>
          <Text style={styles.playerName} numberOfLines={1}>
            {player.name}
          </Text>
          <Text style={styles.playerRating}>{player.rating}</Text>
        </View>
      </View>

      {/* Clock Display */}
      <View
        style={[
          styles.clockBox,
          isActive && styles.clockBoxActive,
          isLowTime && styles.clockBoxLowTime,
        ]}
      >
        <Clock
          size={14}
          color={isLowTime ? COLORS.danger : isActive ? COLORS.primary : COLORS.textMuted}
        />
        <Text
          style={[
            styles.clockText,
            isActive && styles.clockTextActive,
            isLowTime && styles.clockTextLowTime,
          ]}
        >
          {formattedTime}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 12,
  },
  activeContainer: {
    borderColor: COLORS.primaryBorder,
    backgroundColor: COLORS.surface,
  },
  playerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  colorPill: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.card,
  },
  nameBlock: {
    flex: 1,
  },
  playerName: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  playerRating: {
    fontSize: 11,
    fontFamily: "monospace",
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  clockBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clockBoxActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  clockBoxLowTime: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerMuted,
  },
  clockText: {
    fontSize: 14,
    fontFamily: "monospace",
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  clockTextActive: {
    color: COLORS.primary,
  },
  clockTextLowTime: {
    color: COLORS.danger,
  },
});

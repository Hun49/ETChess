import type { TimeControlId } from "@etchess/types";
import { ArrowLeft, Bot, Sparkles } from "lucide-react-native";
import type React from "react";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMobileStore } from "../store/mobileStore";
import { COLORS } from "../theme/colors";

export const PlayComputerView: React.FC = () => {
  const { goBack, startBotGame } = useMobileStore();
  const [difficulty, setDifficulty] = useState(4);
  const [timeControl, setTimeControl] = useState<TimeControlId>("5+0");
  const [color, setColor] = useState<"white" | "black" | "random">("white");

  const difficulties = [
    { level: 1, name: "Beginner", rating: 800 },
    { level: 2, name: "Novice", rating: 1000 },
    { level: 3, name: "Casual", rating: 1200 },
    { level: 4, name: "Intermediate", rating: 1400 },
    { level: 5, name: "Advanced", rating: 1600 },
    { level: 6, name: "Master", rating: 1850 },
    { level: 7, name: "Grandmaster", rating: 2100 },
    { level: 8, name: "Super GM", rating: 2400 },
  ];

  const handleStartGame = () => {
    startBotGame(timeControl, difficulty, color);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.title}>Play Computer</Text>
          <Text style={styles.subtitle}>100% offline bot practice</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Difficulty Selection */}
        <Text style={styles.sectionTitle}>Difficulty Level</Text>
        <View style={styles.diffGrid}>
          {difficulties.map((diff) => {
            const isSelected = difficulty === diff.level;
            return (
              <TouchableOpacity
                key={diff.level}
                style={[styles.diffCard, isSelected && styles.diffCardSelected]}
                onPress={() => setDifficulty(diff.level)}
                activeOpacity={0.8}
              >
                <View style={styles.diffHeader}>
                  <Bot size={16} color={isSelected ? COLORS.primary : COLORS.textSecondary} />
                  <Text style={[styles.diffName, isSelected && styles.diffNameSelected]}>
                    {diff.name}
                  </Text>
                </View>
                <Text style={styles.diffRating}>{diff.rating} ELO</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Time Control */}
        <Text style={styles.sectionTitle}>Time Control</Text>
        <View style={styles.tcRow}>
          {(["1+0", "3+0", "5+0", "10+0"] as const).map((tc) => {
            const isSelected = timeControl === tc;
            return (
              <TouchableOpacity
                key={tc}
                style={[styles.tcChip, isSelected && styles.tcChipSelected]}
                onPress={() => setTimeControl(tc)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tcText, isSelected && styles.tcTextSelected]}>{tc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Color Choice */}
        <Text style={styles.sectionTitle}>Play As</Text>
        <View style={styles.colorRow}>
          {(["white", "random", "black"] as const).map((c) => {
            const isSelected = color === c;
            return (
              <TouchableOpacity
                key={c}
                style={[styles.colorChoice, isSelected && styles.colorChoiceSelected]}
                onPress={() => setColor(c)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.colorCircle,
                    {
                      backgroundColor:
                        c === "white" ? "#FFFFFF" : c === "black" ? "#1A1A1A" : COLORS.surfaceLight,
                    },
                  ]}
                />
                <Text style={[styles.colorText, isSelected && styles.colorTextSelected]}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Start Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.startButton} onPress={handleStartGame} activeOpacity={0.8}>
          <Sparkles size={18} color={COLORS.textDark} />
          <Text style={styles.startText}>Play vs Computer</Text>
        </TouchableOpacity>
      </View>
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
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  diffGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
  },
  diffCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  diffCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  diffHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  diffName: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  diffNameSelected: {
    color: COLORS.primary,
  },
  diffRating: {
    fontSize: 11,
    fontFamily: "monospace",
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  tcRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  tcChip: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    alignItems: "center",
  },
  tcChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  tcText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  tcTextSelected: {
    color: COLORS.primary,
  },
  colorRow: {
    flexDirection: "row",
    gap: 10,
  },
  colorChoice: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
  },
  colorChoiceSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  colorCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  colorText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  colorTextSelected: {
    color: COLORS.primary,
  },
  bottomBar: {
    padding: 16,
    backgroundColor: COLORS.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 14,
  },
  startText: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.textDark,
  },
});

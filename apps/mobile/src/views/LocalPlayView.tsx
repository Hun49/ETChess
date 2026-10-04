import type { TimeControlId } from "@etchess/types";
import { ArrowLeft, Smartphone, Users } from "lucide-react-native";
import type React from "react";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useMobileStore } from "../store/mobileStore";
import { COLORS } from "../theme/colors";

export const LocalPlayView: React.FC = () => {
  const { goBack, startLocalGame } = useMobileStore();
  const [timeControl, setTimeControl] = useState<TimeControlId>("10+0");
  const [player1Name, setPlayer1Name] = useState("Player 1");
  const [player2Name, setPlayer2Name] = useState("Player 2");

  const handleStartGame = () => {
    startLocalGame(timeControl);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.title}>Local Game</Text>
          <Text style={styles.subtitle}>Pass & Play on the same device</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Smartphone size={24} color="#C084FC" />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>Two Players, One Phone</Text>
            <Text style={styles.infoDesc}>
              Pass the device between moves. 100% offline, no internet required.
            </Text>
          </View>
        </View>

        {/* Players setup */}
        <Text style={styles.sectionTitle}>Players</Text>
        <View style={styles.playersCard}>
          <View style={styles.playerInputRow}>
            <View style={[styles.colorSquare, { backgroundColor: "#FFFFFF" }]} />
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>White Player</Text>
              <TextInput
                style={styles.textInput}
                value={player1Name}
                onChangeText={setPlayer1Name}
                placeholder="Player 1"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>

          <View style={[styles.playerInputRow, styles.playerInputBorder]}>
            <View style={[styles.colorSquare, { backgroundColor: "#1A1A1A" }]} />
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Black Player</Text>
              <TextInput
                style={styles.textInput}
                value={player2Name}
                onChangeText={setPlayer2Name}
                placeholder="Player 2"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>
        </View>

        {/* Time Control */}
        <Text style={styles.sectionTitle}>Time Control</Text>
        <View style={styles.tcGrid}>
          {(["5+0", "10+0", "15+10", "30+0"] as const).map((tc) => {
            const isSelected = timeControl === tc;
            return (
              <TouchableOpacity
                key={tc}
                style={[styles.tcCard, isSelected && styles.tcCardSelected]}
                onPress={() => setTimeControl(tc)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tcTitle, isSelected && styles.tcTitleSelected]}>{tc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Start Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.startButton} onPress={handleStartGame} activeOpacity={0.8}>
          <Users size={18} color={COLORS.textDark} />
          <Text style={styles.startText}>Start Game</Text>
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
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },
  infoDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  playersCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 24,
  },
  playerInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  playerInputBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
    marginTop: 14,
  },
  colorSquare: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  textInput: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    paddingVertical: 2,
  },
  tcGrid: {
    flexDirection: "row",
    gap: 10,
  },
  tcCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: "center",
  },
  tcCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  tcTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textSecondary,
  },
  tcTitleSelected: {
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

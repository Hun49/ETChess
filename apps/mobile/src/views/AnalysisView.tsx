import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCw,
  Sparkles,
  TrendingUp,
} from "lucide-react-native";
import type React from "react";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ChessBoard } from "../components/ChessBoard";
import { useMobileStore } from "../store/mobileStore";
import { COLORS } from "../theme/colors";

export const AnalysisView: React.FC = () => {
  const { goBack, game } = useMobileStore();
  const [currentPly, setCurrentPly] = useState(game?.moves.length || 0);

  const evaluationScore = "+1.8";
  const evaluationText = "White has a solid advantage (+1.8)";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.title}>Game Analysis</Text>
          <Text style={styles.subtitle}>Stockfish engine review & best moves</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Evaluation Banner */}
        <View style={styles.evalCard}>
          <View style={styles.evalScoreBadge}>
            <TrendingUp size={16} color={COLORS.primary} />
            <Text style={styles.evalScoreText}>{evaluationScore}</Text>
          </View>
          <Text style={styles.evalDescription}>{evaluationText}</Text>
        </View>

        {/* Board */}
        <View style={styles.boardWrap}>
          <ChessBoard />
        </View>

        {/* Move Step Controls */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setCurrentPly(0)}
            activeOpacity={0.7}
          >
            <ChevronsLeft size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setCurrentPly((prev) => Math.max(0, prev - 1))}
            activeOpacity={0.7}
          >
            <ChevronLeft size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.plyIndicator}>
            Ply {currentPly} / {game?.moves.length || 0}
          </Text>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setCurrentPly((prev) => Math.min(game?.moves.length || 0, prev + 1))}
            activeOpacity={0.7}
          >
            <ChevronRight size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setCurrentPly(game?.moves.length || 0)}
            activeOpacity={0.7}
          >
            <ChevronsRight size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Best Move Suggestion */}
        <View style={styles.suggestionCard}>
          <View style={styles.suggestionHeader}>
            <Sparkles size={16} color={COLORS.primary} />
            <Text style={styles.suggestionTitle}>Engine Line</Text>
          </View>
          <Text style={styles.suggestionText}>
            Best Move: <Text style={styles.moveHighlight}>Nf3</Text> (Controls the center and
            prepares kingside castling)
          </Text>
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
  evalCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 16,
  },
  evalScoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  evalScoreText: {
    fontSize: 14,
    fontWeight: "900",
    fontFamily: "monospace",
    color: COLORS.primary,
  },
  evalDescription: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text,
    flex: 1,
  },
  boardWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  plyIndicator: {
    fontSize: 12,
    fontFamily: "monospace",
    fontWeight: "700",
    color: COLORS.text,
    minWidth: 80,
    textAlign: "center",
  },
  suggestionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    padding: 14,
  },
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  suggestionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
  },
  suggestionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  moveHighlight: {
    color: COLORS.text,
    fontWeight: "800",
    fontFamily: "monospace",
  },
});

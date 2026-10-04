import type { TimeControlId } from "@etchess/types";
import { ArrowLeft, Flame, Globe, Zap } from "lucide-react-native";
import type React from "react";
import { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useMobileStore } from "../store/mobileStore";
import { COLORS } from "../theme/colors";

type CategoryTab = "bullet" | "blitz" | "rapid";

export const PlayOnlineView: React.FC = () => {
  const { goBack, startMatchmaking } = useMobileStore();
  const [category, setCategory] = useState<CategoryTab>("blitz");
  const [selectedTc, setSelectedTc] = useState<TimeControlId>("3+2");
  const [isRated, setIsRated] = useState(true);
  const [preferredColor, setPreferredColor] = useState<"random" | "white" | "black">("random");

  const categoryPresets: Record<
    CategoryTab,
    Array<{ id: TimeControlId; title: string; subtitle: string }>
  > = {
    bullet: [
      { id: "1+0", title: "1+0", subtitle: "1 min • Fast & chaotic" },
      { id: "2+0", title: "2+0", subtitle: "2 min • Sharp play" },
    ],
    blitz: [
      { id: "3+0", title: "3+0", subtitle: "3 min • Fast paced" },
      { id: "3+2", title: "3+2", subtitle: "3 min + 2s • Most popular" },
      { id: "5+0", title: "5+0", subtitle: "5 min • Balanced blitz" },
      { id: "5+3", title: "5+3", subtitle: "5 min + 3s • With increment" },
    ],
    rapid: [
      { id: "10+0", title: "10+0", subtitle: "10 min • Thoughtful play" },
      { id: "15+10", title: "15+10", subtitle: "15 min + 10s • Classical rapid" },
    ],
  };

  const handleStartMatchmaking = () => {
    startMatchmaking(selectedTc, isRated);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.title}>Play Online</Text>
          <Text style={styles.subtitle}>Choose your time control</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Category Tabs (Bullet, Blitz, Rapid) */}
        <View style={styles.categoryTabs}>
          <TouchableOpacity
            style={[styles.categoryTab, category === "bullet" && styles.categoryTabActive]}
            onPress={() => {
              setCategory("bullet");
              setSelectedTc("1+0");
            }}
            activeOpacity={0.8}
          >
            <Zap size={16} color={category === "bullet" ? COLORS.primary : COLORS.textSecondary} />
            <Text
              style={[
                styles.categoryTabText,
                category === "bullet" && styles.categoryTabTextActive,
              ]}
            >
              Bullet
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.categoryTab, category === "blitz" && styles.categoryTabActive]}
            onPress={() => {
              setCategory("blitz");
              setSelectedTc("3+2");
            }}
            activeOpacity={0.8}
          >
            <Flame size={16} color={category === "blitz" ? COLORS.primary : COLORS.textSecondary} />
            <Text
              style={[styles.categoryTabText, category === "blitz" && styles.categoryTabTextActive]}
            >
              Blitz
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.categoryTab, category === "rapid" && styles.categoryTabActive]}
            onPress={() => {
              setCategory("rapid");
              setSelectedTc("10+0");
            }}
            activeOpacity={0.8}
          >
            <Globe size={16} color={category === "rapid" ? COLORS.primary : COLORS.textSecondary} />
            <Text
              style={[styles.categoryTabText, category === "rapid" && styles.categoryTabTextActive]}
            >
              Rapid
            </Text>
          </TouchableOpacity>
        </View>

        {/* Time Control Cards Grid */}
        <Text style={styles.sectionTitle}>Presets</Text>
        <View style={styles.presetsGrid}>
          {categoryPresets[category].map((preset) => {
            const isSelected = selectedTc === preset.id;
            return (
              <TouchableOpacity
                key={preset.id}
                style={[styles.presetCard, isSelected && styles.presetCardSelected]}
                onPress={() => setSelectedTc(preset.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.presetTitle, isSelected && styles.presetTitleSelected]}>
                  {preset.title}
                </Text>
                <Text style={styles.presetSubtitle}>{preset.subtitle}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Options */}
        <Text style={styles.sectionTitle}>Options</Text>
        <View style={styles.optionsCard}>
          {/* Rated Toggle */}
          <View style={styles.optionRow}>
            <View>
              <Text style={styles.optionLabel}>Rated Game</Text>
              <Text style={styles.optionDesc}>Affects your Glicko-2 rating</Text>
            </View>
            <Switch
              value={isRated}
              onValueChange={setIsRated}
              trackColor={{ false: COLORS.surface, true: COLORS.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Color Preference */}
          <View style={[styles.optionRow, styles.optionRowBorder]}>
            <View>
              <Text style={styles.optionLabel}>Preferred Color</Text>
              <Text style={styles.optionDesc}>Fair pairing assigns random</Text>
            </View>
            <View style={styles.colorPills}>
              {(["white", "random", "black"] as const).map((col) => (
                <TouchableOpacity
                  key={col}
                  style={[styles.colorPill, preferredColor === col && styles.colorPillActive]}
                  onPress={() => setPreferredColor(col)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.colorPillText,
                      preferredColor === col && styles.colorPillTextActive,
                    ]}
                  >
                    {col.charAt(0).toUpperCase() + col.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Action */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.findMatchButton}
          onPress={handleStartMatchmaking}
          activeOpacity={0.8}
        >
          <Text style={styles.findMatchText}>Find Match</Text>
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
  categoryTabs: {
    flexDirection: "row",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 4,
    gap: 4,
    marginBottom: 20,
  },
  categoryTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  categoryTabActive: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  categoryTabTextActive: {
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
  presetsGrid: {
    gap: 10,
    marginBottom: 24,
  },
  presetCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  presetCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  presetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  presetTitleSelected: {
    color: COLORS.primary,
  },
  presetSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  optionsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionRowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
    marginTop: 16,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  optionDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  colorPills: {
    flexDirection: "row",
    gap: 6,
  },
  colorPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  colorPillActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  colorPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  colorPillTextActive: {
    color: COLORS.primary,
  },
  bottomBar: {
    padding: 16,
    backgroundColor: COLORS.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  findMatchButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  findMatchText: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.textDark,
  },
});

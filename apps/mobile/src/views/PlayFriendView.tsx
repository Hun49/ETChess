import type { TimeControlId } from "@etchess/types";
import { ArrowLeft, Check, Copy, Link, Search, Share2, User } from "lucide-react-native";
import type React from "react";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useMobileStore } from "../store/mobileStore";
import { COLORS } from "../theme/colors";

export const PlayFriendView: React.FC = () => {
  const { goBack, startOnlineGame, user } = useMobileStore();
  const [tab, setTab] = useState<"search" | "link">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFriend, setSelectedFriend] = useState<string | null>("f1");
  const [timeControl, setTimeControl] = useState<TimeControlId>("3+2");
  const [isRated, setIsRated] = useState(false);
  const [canTakeback, setCanTakeback] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  const friends = [
    { id: "f1", name: "ShadowKnight", rating: 1420, online: true },
    { id: "f2", name: "QueenBishop", rating: 1180, online: true },
    { id: "f3", name: "KnightRider", rating: 980, online: false },
    { id: "f4", name: "ChessMaster", rating: 1600, online: false },
  ];

  const filteredFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleCreateChallenge = () => {
    const friend = friends.find((f) => f.id === selectedFriend) || friends[0];
    const gameId = `friend-${Date.now()}`;

    startOnlineGame(
      gameId,
      "white",
      { id: user.id, name: user.name, rating: user.ratings.blitz },
      { id: friend.id, name: friend.name, rating: friend.rating },
      timeControl,
      isRated,
    );
  };

  const handleCopyLink = () => {
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.title}>Play a Friend</Text>
          <Text style={styles.subtitle}>Direct challenge or shareable link</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Tab switch */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tabButton, tab === "search" && styles.tabButtonActive]}
            onPress={() => setTab("search")}
            activeOpacity={0.8}
          >
            <User size={16} color={tab === "search" ? COLORS.primary : COLORS.textSecondary} />
            <Text style={[styles.tabButtonText, tab === "search" && styles.tabButtonTextActive]}>
              Friends List
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, tab === "link" && styles.tabButtonActive]}
            onPress={() => setTab("link")}
            activeOpacity={0.8}
          >
            <Link size={16} color={tab === "link" ? COLORS.primary : COLORS.textSecondary} />
            <Text style={[styles.tabButtonText, tab === "link" && styles.tabButtonTextActive]}>
              Share Link
            </Text>
          </TouchableOpacity>
        </View>

        {tab === "search" ? (
          <>
            {/* Search Box */}
            <View style={styles.searchBar}>
              <Search size={16} color={COLORS.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by username..."
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Friend List */}
            <Text style={styles.sectionTitle}>Select Friend</Text>
            <View style={styles.friendsList}>
              {filteredFriends.map((f) => {
                const isSelected = selectedFriend === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.friendCard, isSelected && styles.friendCardSelected]}
                    onPress={() => setSelectedFriend(f.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.friendLeft}>
                      <View style={styles.avatarWrap}>
                        <User size={18} color={COLORS.primary} />
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: f.online ? COLORS.success : COLORS.textMuted },
                          ]}
                        />
                      </View>
                      <View>
                        <Text style={styles.friendName}>{f.name}</Text>
                        <Text style={styles.friendStatus}>{f.online ? "Online" : "Offline"}</Text>
                      </View>
                    </View>

                    <Text style={styles.friendRating}>{f.rating}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.linkCard}>
            <View style={styles.linkHeader}>
              <Share2 size={24} color={COLORS.primary} />
              <Text style={styles.linkTitle}>Open Shareable Challenge</Text>
              <Text style={styles.linkDesc}>
                Anyone with this link can join and accept your challenge. Valid for 10 minutes.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.copyLinkButton}
              onPress={handleCopyLink}
              activeOpacity={0.8}
            >
              {copiedLink ? (
                <>
                  <Check size={18} color={COLORS.primary} />
                  <Text style={styles.copyLinkText}>Link Copied to Clipboard!</Text>
                </>
              ) : (
                <>
                  <Copy size={18} color={COLORS.primary} />
                  <Text style={styles.copyLinkText}>https://etchess.com/ch/9f2a7b1</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Time Control & Rules */}
        <Text style={styles.sectionTitle}>Time Control</Text>
        <View style={styles.tcRow}>
          {(["3+0", "3+2", "5+0", "10+0"] as const).map((tc) => {
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

        {/* Options */}
        <Text style={styles.sectionTitle}>Rules</Text>
        <View style={styles.optionsCard}>
          <View style={styles.optionRow}>
            <View>
              <Text style={styles.optionLabel}>Rated Match</Text>
              <Text style={styles.optionDesc}>Max 5 rated games per 24h (RULE-05)</Text>
            </View>
            <Switch
              value={isRated}
              onValueChange={setIsRated}
              trackColor={{ false: COLORS.surface, true: COLORS.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.optionRow, styles.optionRowBorder]}>
            <View>
              <Text style={styles.optionLabel}>Allow Takebacks</Text>
              <Text style={styles.optionDesc}>
                {isRated
                  ? "Takebacks disabled in rated games (RULE-10)"
                  : "Both players must agree (RULE-10)"}
              </Text>
            </View>
            <Switch
              disabled={isRated}
              value={isRated ? false : canTakeback}
              onValueChange={setCanTakeback}
              trackColor={{ false: COLORS.surface, true: COLORS.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleCreateChallenge}
          activeOpacity={0.8}
        >
          <Text style={styles.submitText}>
            {tab === "search" ? "Challenge Friend" : "Share Challenge"}
          </Text>
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
  tabs: {
    flexDirection: "row",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 4,
    gap: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  tabButtonTextActive: {
    color: COLORS.primary,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    height: 44,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  friendsList: {
    gap: 8,
    marginBottom: 20,
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  friendCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  friendLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  statusDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.card,
  },
  friendName: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  friendStatus: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  friendRating: {
    fontSize: 12,
    fontFamily: "monospace",
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  linkCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  linkHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 8,
  },
  linkDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 16,
  },
  copyLinkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: "100%",
    justifyContent: "center",
  },
  copyLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  tcRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  tcChip: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    alignItems: "center",
  },
  tcChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  tcText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  tcTextSelected: {
    color: COLORS.primary,
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
    paddingTop: 14,
    marginTop: 14,
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
  bottomBar: {
    padding: 16,
    backgroundColor: COLORS.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.textDark,
  },
});

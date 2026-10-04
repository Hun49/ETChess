import { Bot, ChevronRight, Globe, Shield, Swords, Users } from "lucide-react-native";
import type React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMobileStore } from "../store/mobileStore";
import { COLORS } from "../theme/colors";

export const SplashScreen: React.FC = () => {
  const { navigate, setUser } = useMobileStore();

  const handleGetStarted = () => {
    navigate("home");
  };

  const handleGuestEntry = () => {
    setUser({ isGuest: true, name: "Guest" });
    navigate("home");
  };

  return (
    <View style={styles.container}>
      {/* Brand Hero */}
      <View style={styles.heroSection}>
        <View style={styles.logoBadge}>
          <Shield size={48} color={COLORS.primary} />
        </View>
        <Text style={styles.brandTitle}>ET-Chess</Text>
        <Text style={styles.brandSubtitle}>Play. Learn. Improve.</Text>
        <Text style={styles.brandDescription}>
          A modern chess experience for everyone — online, offline, with friends, or against the
          computer.
        </Text>
      </View>

      {/* Feature Highlights */}
      <View style={styles.featuresList}>
        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Globe size={18} color={COLORS.primary} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Online Matchmaking</Text>
            <Text style={styles.featureDesc}>Play against players worldwide</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Users size={18} color={COLORS.primary} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Play a Friend</Text>
            <Text style={styles.featureDesc}>Challenge your friends via link or username</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Bot size={18} color={COLORS.primary} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Play Computer</Text>
            <Text style={styles.featureDesc}>100% offline bot play with adjustable difficulty</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Swords size={18} color={COLORS.primary} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Local Play</Text>
            <Text style={styles.featureDesc}>Pass & Play on the same screen</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleGetStarted}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
          <ChevronRight size={18} color={COLORS.textDark} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.guestButton} onPress={handleGuestEntry} activeOpacity={0.7}>
          <Text style={styles.guestButtonText}>Continue as Guest</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    justifyContent: "space-between",
    paddingTop: 60,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: "center",
    marginTop: 20,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "700",
    marginTop: 4,
    letterSpacing: 0.5,
  },
  brandDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  featuresList: {
    gap: 14,
    marginVertical: 20,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: COLORS.card,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  featureDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  actionSection: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 14,
    width: "100%",
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.textDark,
  },
  guestButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  guestButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
});

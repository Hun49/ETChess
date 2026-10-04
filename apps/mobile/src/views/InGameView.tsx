import { Flag, Handshake, ListOrdered, RotateCw, Undo2, X } from "lucide-react-native";
import type React from "react";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ChessBoard } from "../components/ChessBoard";
import { PlayerClock } from "../components/GameClock";
import { GameOverModal } from "../components/GameOverModal";
import { useMobileStore } from "../store/mobileStore";
import { COLORS } from "../theme/colors";

export const InGameView: React.FC = () => {
  const { game, resign, offerDraw, requestTakeback, goBack } = useMobileStore();
  const [boardFlipped, setBoardFlipped] = useState(false);
  const [showMoveList, setShowMoveList] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);

  if (!game) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No active game found</Text>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.backButtonText}>Return to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isWhiteTurn = game.turn === "white";
  const isPlayerWhite = game.playerColor === "white";

  // Top player is opponent, bottom player is you (unless flipped)
  const topPlayer = boardFlipped
    ? isPlayerWhite
      ? game.whitePlayer
      : game.blackPlayer
    : isPlayerWhite
      ? game.blackPlayer
      : game.whitePlayer;
  const topPlayerColor: "white" | "black" = boardFlipped
    ? isPlayerWhite
      ? "white"
      : "black"
    : isPlayerWhite
      ? "black"
      : "white";
  const topTimeMs = topPlayerColor === "white" ? game.whiteTimeMs : game.blackTimeMs;
  const isTopActive =
    (topPlayerColor === "white" && isWhiteTurn) || (topPlayerColor === "black" && !isWhiteTurn);

  const bottomPlayer = boardFlipped
    ? isPlayerWhite
      ? game.blackPlayer
      : game.whitePlayer
    : isPlayerWhite
      ? game.whitePlayer
      : game.blackPlayer;
  const bottomPlayerColor: "white" | "black" = boardFlipped
    ? isPlayerWhite
      ? "black"
      : "white"
    : isPlayerWhite
      ? "white"
      : "black";
  const bottomTimeMs = bottomPlayerColor === "white" ? game.whiteTimeMs : game.blackTimeMs;
  const isBottomActive =
    (bottomPlayerColor === "white" && isWhiteTurn) ||
    (bottomPlayerColor === "black" && !isWhiteTurn);

  const handleConfirmResign = () => {
    setShowResignConfirm(false);
    resign();
  };

  return (
    <View style={styles.container}>
      {/* Top Player Clock & Info */}
      <View style={styles.topClockSection}>
        <PlayerClock
          player={topPlayer}
          timeMs={topTimeMs}
          isActive={isTopActive}
          color={topPlayerColor}
        />
      </View>

      {/* Board */}
      <View style={styles.boardSection}>
        <ChessBoard flipped={boardFlipped} />
      </View>

      {/* Bottom Player Clock & Info */}
      <View style={styles.bottomClockSection}>
        <PlayerClock
          player={bottomPlayer}
          timeMs={bottomTimeMs}
          isActive={isBottomActive}
          color={bottomPlayerColor}
        />
      </View>

      {/* Move notation strip */}
      <TouchableOpacity
        style={styles.moveStrip}
        onPress={() => setShowMoveList(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.moveStripText} numberOfLines={1}>
          {game.moves.length === 0
            ? "Waiting for first move..."
            : game.moves
                .slice(-4)
                .map((m, idx) => `${game.moves.length - 4 + idx + 1}. ${m}`)
                .join("  ")}
        </Text>
      </TouchableOpacity>

      {/* Game Action Controls */}
      <View style={styles.controlsBar}>
        {/* Resign */}
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => setShowResignConfirm(true)}
          activeOpacity={0.7}
        >
          <Flag size={18} color={COLORS.danger} />
          <Text style={[styles.controlText, { color: COLORS.danger }]}>Resign</Text>
        </TouchableOpacity>

        {/* Draw */}
        <TouchableOpacity style={styles.controlBtn} onPress={offerDraw} activeOpacity={0.7}>
          <Handshake size={18} color={COLORS.textSecondary} />
          <Text style={styles.controlText}>Draw</Text>
        </TouchableOpacity>

        {/* Takeback (Enabled only when canTakeback is true per RULE-10) */}
        <TouchableOpacity
          style={[styles.controlBtn, !game.canTakeback && styles.controlBtnDisabled]}
          disabled={!game.canTakeback}
          onPress={requestTakeback}
          activeOpacity={0.7}
        >
          <Undo2 size={18} color={game.canTakeback ? COLORS.primary : COLORS.textMuted} />
          <Text
            style={[
              styles.controlText,
              { color: game.canTakeback ? COLORS.primary : COLORS.textMuted },
            ]}
          >
            Takeback
          </Text>
        </TouchableOpacity>

        {/* Flip Board */}
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => setBoardFlipped((prev) => !prev)}
          activeOpacity={0.7}
        >
          <RotateCw size={18} color={COLORS.textSecondary} />
          <Text style={styles.controlText}>Flip</Text>
        </TouchableOpacity>

        {/* Moves list */}
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => setShowMoveList(true)}
          activeOpacity={0.7}
        >
          <ListOrdered size={18} color={COLORS.textSecondary} />
          <Text style={styles.controlText}>Moves</Text>
        </TouchableOpacity>
      </View>

      {/* Consequential Confirmation Modal for Resign (UX-CONF-01) */}
      <Modal visible={showResignConfirm} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Resign Game?</Text>
            <Text style={styles.confirmDesc}>
              This will forfeit the match and count as a loss for ratings.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setShowResignConfirm(false)}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmResignBtn} onPress={handleConfirmResign}>
                <Text style={styles.confirmResignText}>Resign</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Move History Sheet */}
      <Modal visible={showMoveList} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.moveListSheet}>
            <View style={styles.moveListHeader}>
              <Text style={styles.moveListTitle}>Move History</Text>
              <TouchableOpacity onPress={() => setShowMoveList(false)}>
                <X size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.movesScroll}>
              {game.moves.map((m, idx) => (
                <View key={`ply-${idx + 1}-${m}`} style={styles.moveRow}>
                  <Text style={styles.moveNumber}>{idx + 1}.</Text>
                  <Text style={styles.moveSan}>{m}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Game Over Modal */}
      <GameOverModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  topClockSection: {
    paddingVertical: 4,
  },
  boardSection: {
    alignItems: "center",
    justifyContent: "center",
  },
  bottomClockSection: {
    paddingVertical: 4,
  },
  moveStrip: {
    marginHorizontal: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  moveStripText: {
    fontSize: 12,
    fontFamily: "monospace",
    color: COLORS.textSecondary,
  },
  controlsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  controlBtn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  controlBtnDisabled: {
    opacity: 0.4,
  },
  controlText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBox: {
    width: 300,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    alignItems: "center",
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  confirmDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 16,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    width: "100%",
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  confirmCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  confirmResignBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.danger,
    alignItems: "center",
  },
  confirmResignText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  moveListSheet: {
    width: "100%",
    maxHeight: 400,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    position: "absolute",
    bottom: 0,
  },
  moveListHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  moveListTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
  },
  movesScroll: {
    maxHeight: 300,
  },
  moveRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  moveNumber: {
    width: 32,
    fontSize: 12,
    fontFamily: "monospace",
    color: COLORS.textMuted,
  },
  moveSan: {
    fontSize: 13,
    fontFamily: "monospace",
    fontWeight: "700",
    color: COLORS.text,
  },
});

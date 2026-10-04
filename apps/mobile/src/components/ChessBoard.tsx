import type { Square } from "chess.js";
import type React from "react";
import { useMemo, useState } from "react";
import { Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMobileStore } from "../store/mobileStore";
import { COLORS } from "../theme/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOARD_SIZE = Math.min(SCREEN_WIDTH - 24, 380);
const SQUARE_SIZE = BOARD_SIZE / 8;

// Standard Unicode chess piece glyphs with crisp styling
const PIECE_SYMBOLS: Record<string, string> = {
  p: "♟",
  r: "♜",
  n: "♞",
  b: "♝",
  q: "♛",
  k: "♚",
  P: "♙",
  R: "♖",
  N: "♘",
  B: "♗",
  Q: "♕",
  K: "♔",
};

interface ChessBoardProps {
  flipped?: boolean;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({ flipped = false }) => {
  const { chess, game, makeMove } = useMobileStore();
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  // Files and Ranks order depending on orientation
  const files = useMemo(
    () =>
      flipped ? ["h", "g", "f", "e", "d", "c", "b", "a"] : ["a", "b", "c", "d", "e", "f", "g", "h"],
    [flipped],
  );
  const ranks = useMemo(
    () => (flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1]),
    [flipped],
  );

  // Calculate valid moves for selected square
  const legalDestinations = useMemo(() => {
    if (!selectedSquare) return new Set<string>();
    const moves = chess.moves({ square: selectedSquare, verbose: true });
    return new Set(moves.map((m) => m.to));
  }, [chess, selectedSquare]);

  const handleSquarePress = (square: Square) => {
    if (!game || game.status !== "active") return;

    const piece = chess.get(square);

    // If already selected and clicked another square
    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      if (legalDestinations.has(square)) {
        // Check for pawn promotion (pawn moving to 8th rank or 1st rank)
        const movingPiece = chess.get(selectedSquare);
        const isPawn = movingPiece?.type === "p";
        const isPromotionRank = square.endsWith("8") || square.endsWith("1");

        if (isPawn && isPromotionRank) {
          setPendingPromotion({ from: selectedSquare, to: square });
          return;
        }

        makeMove(selectedSquare, square);
        setSelectedSquare(null);
        return;
      }
    }

    // Select piece if it belongs to current player's turn
    if (piece) {
      const isWhitePiece = piece.color === "w";
      const isWhiteTurn = chess.turn() === "w";

      // In local mode, either side can move on their turn
      // In online / bot mode, player can only move their assigned color
      if (game.mode === "local") {
        if ((isWhitePiece && isWhiteTurn) || (!isWhitePiece && !isWhiteTurn)) {
          setSelectedSquare(square);
        }
      } else {
        const isPlayerTurn =
          (game.playerColor === "white" && isWhiteTurn && isWhitePiece) ||
          (game.playerColor === "black" && !isWhiteTurn && !isWhitePiece);

        if (isPlayerTurn) {
          setSelectedSquare(square);
        }
      }
    } else {
      setSelectedSquare(null);
    }
  };

  const handlePromotionSelection = (piece: "q" | "r" | "b" | "n") => {
    if (pendingPromotion) {
      makeMove(pendingPromotion.from, pendingPromotion.to, piece);
      setPendingPromotion(null);
      setSelectedSquare(null);
    }
  };

  return (
    <View style={styles.boardContainer}>
      <View style={styles.board}>
        {ranks.map((rank, rankIdx) => (
          <View key={`rank-${rank}`} style={styles.row}>
            {files.map((file, fileIdx) => {
              const square = `${file}${rank}` as Square;
              const piece = chess.get(square);
              const isDarkSquare = (rankIdx + fileIdx) % 2 === 1;
              const isSelected = selectedSquare === square;
              const isDestination = legalDestinations.has(square);
              const isLastMove = game?.lastMove?.from === square || game?.lastMove?.to === square;
              const isCheckKing =
                game?.isCheck && piece?.type === "k" && piece.color === chess.turn();

              return (
                <TouchableOpacity
                  key={square}
                  style={[
                    styles.square,
                    {
                      backgroundColor: isDarkSquare ? "#4A7057" : "#E2E8F0",
                    },
                    isLastMove && styles.lastMoveSquare,
                    isSelected && styles.selectedSquare,
                    isCheckKing && styles.checkSquare,
                  ]}
                  onPress={() => handleSquarePress(square)}
                  activeOpacity={0.9}
                >
                  {/* File / Rank coordinates */}
                  {fileIdx === 0 && (
                    <Text
                      style={[
                        styles.rankCoordinate,
                        { color: isDarkSquare ? "#E2E8F0" : "#4A7057" },
                      ]}
                    >
                      {rank}
                    </Text>
                  )}
                  {rankIdx === 7 && (
                    <Text
                      style={[
                        styles.fileCoordinate,
                        { color: isDarkSquare ? "#E2E8F0" : "#4A7057" },
                      ]}
                    >
                      {file}
                    </Text>
                  )}

                  {/* Piece */}
                  {piece && (
                    <Text
                      style={[
                        styles.pieceText,
                        { color: piece.color === "w" ? "#FFFFFF" : "#1A1A1A" },
                        piece.color === "w" && styles.whitePieceShadow,
                      ]}
                    >
                      {piece.color === "w"
                        ? PIECE_SYMBOLS[piece.type.toUpperCase()]
                        : PIECE_SYMBOLS[piece.type.toLowerCase()]}
                    </Text>
                  )}

                  {/* Destination Dot / Ring indicator */}
                  {isDestination && (
                    <View style={piece ? styles.captureRing : styles.destinationDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Pawn Promotion Modal */}
      <Modal visible={!!pendingPromotion} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.promotionCard}>
            <Text style={styles.promotionTitle}>Promote Pawn</Text>
            <View style={styles.promotionButtons}>
              {(["q", "r", "b", "n"] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={styles.promotionOption}
                  onPress={() => handlePromotionSelection(p)}
                >
                  <Text style={styles.promotionPieceText}>
                    {chess.turn() === "w"
                      ? PIECE_SYMBOLS[p.toUpperCase()]
                      : PIECE_SYMBOLS[p.toLowerCase()]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  boardContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  board: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  row: {
    flexDirection: "row",
    height: SQUARE_SIZE,
  },
  square: {
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  selectedSquare: {
    backgroundColor: "rgba(246, 246, 105, 0.75)",
  },
  lastMoveSquare: {
    backgroundColor: "rgba(0, 230, 153, 0.35)",
  },
  checkSquare: {
    backgroundColor: "rgba(239, 68, 68, 0.7)",
  },
  pieceText: {
    fontSize: SQUARE_SIZE * 0.76,
    lineHeight: SQUARE_SIZE,
    textAlign: "center",
  },
  whitePieceShadow: {
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  destinationDot: {
    position: "absolute",
    width: SQUARE_SIZE * 0.3,
    height: SQUARE_SIZE * 0.3,
    borderRadius: (SQUARE_SIZE * 0.3) / 2,
    backgroundColor: "rgba(0, 230, 153, 0.7)",
  },
  captureRing: {
    position: "absolute",
    width: SQUARE_SIZE * 0.85,
    height: SQUARE_SIZE * 0.85,
    borderRadius: (SQUARE_SIZE * 0.85) / 2,
    borderWidth: 3,
    borderColor: "rgba(0, 230, 153, 0.85)",
  },
  rankCoordinate: {
    position: "absolute",
    top: 2,
    left: 3,
    fontSize: 9,
    fontWeight: "700",
  },
  fileCoordinate: {
    position: "absolute",
    bottom: 2,
    right: 3,
    fontSize: 9,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  promotionCard: {
    width: 280,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    alignItems: "center",
  },
  promotionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 16,
  },
  promotionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  promotionOption: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  promotionPieceText: {
    fontSize: 32,
    color: COLORS.text,
  },
});

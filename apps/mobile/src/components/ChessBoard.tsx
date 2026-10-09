import {
  BOARD_THEMES,
  type BoardThemeKey,
  CLASSIC_PIECE_SVGS,
  type PieceSymbol,
} from "@etchess/assets";
import type { Square } from "@etchess/chess-core";
import type React from "react";
import { useMemo, useState } from "react";
import { Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { useMobileStore } from "../store/mobileStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOARD_SIZE = Math.min(SCREEN_WIDTH - 24, 380);
const SQUARE_SIZE = BOARD_SIZE / 8;

interface ChessBoardProps {
  flipped?: boolean;
  theme?: BoardThemeKey;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({ flipped = false, theme = "classic" }) => {
  const { chess, game, makeMove } = useMobileStore();
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const boardTheme = BOARD_THEMES[theme] || BOARD_THEMES.classic;

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

  const handlePromotionSelection = (promoType: "q" | "r" | "b" | "n") => {
    if (pendingPromotion) {
      makeMove(pendingPromotion.from, pendingPromotion.to, promoType);
      setPendingPromotion(null);
      setSelectedSquare(null);
    }
  };

  return (
    <View style={styles.boardContainer}>
      <View
        style={[
          styles.board,
          {
            borderColor: boardTheme.borderColor,
          },
        ]}
      >
        {ranks.map((rank, rankIdx) => (
          <View key={`rank-${rank}`} style={styles.row}>
            {files.map((file, fileIdx) => {
              const square = `${file}${rank}` as Square;
              const piece = chess.get(square);
              const isDarkSquare = (rankIdx + fileIdx) % 2 === 1;
              const isSelected = selectedSquare === square;
              const isDestination = legalDestinations.has(square);
              const isLastMoveFrom = game?.lastMove?.from === square;
              const isLastMoveTo = game?.lastMove?.to === square;
              const isCheckKing =
                game?.isCheck && piece?.type === "k" && piece.color === chess.turn();

              const squareBaseColor = isDarkSquare ? boardTheme.dark : boardTheme.light;
              const coordColor = isDarkSquare ? boardTheme.light : boardTheme.dark;

              // Compose piece symbol if piece exists
              const pieceSymbol = piece
                ? (`${piece.color}${piece.type.toUpperCase()}` as PieceSymbol)
                : null;
              const pieceSvg = pieceSymbol ? CLASSIC_PIECE_SVGS[pieceSymbol] : null;

              return (
                <TouchableOpacity
                  key={square}
                  style={[
                    styles.square,
                    { backgroundColor: squareBaseColor },
                    isLastMoveFrom && { backgroundColor: boardTheme.lastMoveFrom },
                    isLastMoveTo && { backgroundColor: boardTheme.lastMoveTo },
                    isSelected && { backgroundColor: boardTheme.selected },
                    isCheckKing && { backgroundColor: boardTheme.check },
                  ]}
                  onPress={() => handleSquarePress(square)}
                  activeOpacity={0.9}
                >
                  {/* File / Rank coordinates */}
                  {fileIdx === 0 && (
                    <Text style={[styles.rankCoordinate, { color: coordColor }]}>{rank}</Text>
                  )}
                  {rankIdx === 7 && (
                    <Text style={[styles.fileCoordinate, { color: coordColor }]}>{file}</Text>
                  )}

                  {/* Piece Rendering with Canonical SVG */}
                  {pieceSvg && (
                    <View style={styles.pieceContainer} pointerEvents="none">
                      <SvgXml
                        xml={pieceSvg}
                        width={SQUARE_SIZE * 0.88}
                        height={SQUARE_SIZE * 0.88}
                      />
                    </View>
                  )}

                  {/* Legal Move Destination Indicator */}
                  {isDestination && (
                    <View
                      style={
                        piece
                          ? [styles.captureRing, { borderColor: boardTheme.validCaptureRing }]
                          : [styles.destinationDot, { backgroundColor: boardTheme.validDot }]
                      }
                      pointerEvents="none"
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Pawn Promotion Modal with Vector Piece SVGs */}
      <Modal visible={!!pendingPromotion} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.promotionCard}>
            <Text style={styles.promotionTitle}>Promote Pawn</Text>
            <View style={styles.promotionButtons}>
              {(["q", "r", "b", "n"] as const).map((p) => {
                const turnColor = chess.turn() || "w";
                const promoSymbol = `${turnColor}${p.toUpperCase()}` as PieceSymbol;
                const promoSvg = CLASSIC_PIECE_SVGS[promoSymbol];

                return (
                  <TouchableOpacity
                    key={p}
                    style={styles.promotionOption}
                    onPress={() => handlePromotionSelection(p)}
                    activeOpacity={0.7}
                  >
                    {promoSvg ? <SvgXml xml={promoSvg} width={38} height={38} /> : null}
                  </TouchableOpacity>
                );
              })}
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
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    backgroundColor: "#0a0a0a",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
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
  pieceContainer: {
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  destinationDot: {
    position: "absolute",
    width: SQUARE_SIZE * 0.32,
    height: SQUARE_SIZE * 0.32,
    borderRadius: (SQUARE_SIZE * 0.32) / 2,
  },
  captureRing: {
    position: "absolute",
    width: SQUARE_SIZE * 0.88,
    height: SQUARE_SIZE * 0.88,
    borderRadius: (SQUARE_SIZE * 0.88) / 2,
    borderWidth: 3.5,
  },
  rankCoordinate: {
    position: "absolute",
    top: 2,
    left: 3,
    fontSize: 10,
    fontWeight: "700",
    opacity: 0.9,
  },
  fileCoordinate: {
    position: "absolute",
    bottom: 2,
    right: 3,
    fontSize: 10,
    fontWeight: "700",
    opacity: 0.9,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  promotionCard: {
    width: 290,
    backgroundColor: "#171717",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "#262626",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  promotionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#e5e5e5",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  promotionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  promotionOption: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: "#262626",
    borderWidth: 1.5,
    borderColor: "#404040",
    alignItems: "center",
    justifyContent: "center",
  },
});

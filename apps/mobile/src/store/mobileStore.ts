import { Chess } from "@etchess/chess-core";
import { TIME_CONTROLS, type TimeControlId } from "@etchess/types";
import { create } from "zustand";
import { api } from "../services/apiClient";
import { haptics } from "../services/haptics";
import { realtime } from "../services/realtimeClient";
import type {
  GameMode,
  MatchHistoryItem,
  MobileGameState,
  MobileTab,
  MobileView,
  PlayerInfo,
} from "../types";

export interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  ratings: {
    bullet: number;
    blitz: number;
    rapid: number;
    classical: number;
  };
  isGuest: boolean;
}

interface MobileStoreState {
  // Navigation & User
  activeTab: MobileTab;
  activeView: MobileView;
  viewHistory: MobileView[];
  user: UserProfile;
  onlineStatus: "connected" | "connecting" | "disconnected";
  hapticsEnabled: boolean;

  // Matchmaking
  isSearching: boolean;
  searchTimeControlId: TimeControlId | null;
  isSearchRated: boolean;

  // Active Game
  chess: Chess;
  game: MobileGameState | null;
  botDifficulty: number; // 1 to 8

  // History
  history: MatchHistoryItem[];

  // Actions
  setActiveTab: (tab: MobileTab) => void;
  navigate: (view: MobileView) => void;
  goBack: () => void;
  setUser: (user: Partial<UserProfile>) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  syncUserSession: () => Promise<void>;
  startMatchmaking: (timeControlId: TimeControlId, rated: boolean) => void;
  cancelMatchmaking: () => void;
  startBotGame: (
    timeControlId: TimeControlId,
    difficulty: number,
    color: "white" | "black" | "random",
  ) => void;
  startLocalGame: (timeControlId: TimeControlId) => void;
  startOnlineGame: (
    gameId: string,
    playerColor: "white" | "black",
    white: PlayerInfo,
    black: PlayerInfo,
    timeControlId: TimeControlId,
    rated: boolean,
  ) => void;
  makeMove: (from: string, to: string, promotion?: string) => boolean;
  resign: () => void;
  offerDraw: () => void;
  requestTakeback: () => void;
  endGame: (winner: "white" | "black" | "draw", reason: string) => void;
}

const DEFAULT_USER: UserProfile = {
  id: "guest-user",
  name: "ChessPlayer",
  ratings: {
    bullet: 1420,
    blitz: 1567,
    rapid: 1321,
    classical: 1500,
  },
  isGuest: false,
};

const INITIAL_HISTORY: MatchHistoryItem[] = [
  {
    id: "g1",
    category: "online",
    timeControl: "3+2",
    opponent: { name: "AlexRook", rating: 1548 },
    playerColor: "white",
    result: "win",
    ratingDelta: +17,
    termination: "by Checkmate",
    opening: "Ruy Lopez: Morphy Defense",
    movesCount: 23,
    date: "10m ago",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0",
  },
  {
    id: "g2",
    category: "online",
    timeControl: "10+0",
    opponent: { name: "Elena_V", rating: 1580 },
    playerColor: "black",
    result: "win",
    ratingDelta: +14,
    termination: "by Resignation",
    opening: "Sicilian Defense: Najdorf",
    movesCount: 36,
    date: "2h ago",
    pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 0-1",
  },
  {
    id: "g3",
    category: "friend",
    timeControl: "5+0",
    opponent: { name: "DarkKnight99", rating: 1555 },
    playerColor: "white",
    result: "loss",
    ratingDelta: -11,
    termination: "by Timeout",
    opening: "Queen's Gambit Declined",
    movesCount: 42,
    date: "Yesterday",
    pgn: "1. d4 d5 2. c4 e6 0-1",
  },
  {
    id: "g4",
    category: "computer",
    timeControl: "3+0",
    opponent: { name: "Stockfish Medium", rating: 1400 },
    playerColor: "black",
    result: "win",
    ratingDelta: 0,
    termination: "by Checkmate",
    opening: "King's Indian Attack",
    movesCount: 31,
    date: "3d ago",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 0-1",
  },
];

export const useMobileStore = create<MobileStoreState>((set, get) => {
  const initialChess = new Chess();

  return {
    activeTab: "home",
    activeView: "home",
    viewHistory: ["home"],
    user: DEFAULT_USER,
    onlineStatus: "disconnected",
    hapticsEnabled: true,

    isSearching: false,
    searchTimeControlId: null,
    isSearchRated: true,

    chess: initialChess,
    game: null,
    botDifficulty: 4,

    history: INITIAL_HISTORY,

    setHapticsEnabled: (enabled: boolean) => {
      haptics.setEnabled(enabled);
      set({ hapticsEnabled: enabled });
    },

    syncUserSession: async () => {
      try {
        set({ onlineStatus: "connecting" });
        const res = await api.getMe();
        if (res?.user) {
          set({
            user: {
              id: res.user.id,
              name: res.user.name,
              avatar: res.user.image || undefined,
              ratings: res.user.ratings,
              isGuest: !!res.user.isGuest,
            },
            onlineStatus: "connected",
          });
        }
      } catch {
        // If not authenticated, attempt guest session
        try {
          const guestRes = await api.createGuestSession();
          if (guestRes?.user) {
            set({
              user: {
                id: guestRes.user.id,
                name: guestRes.user.name,
                avatar: guestRes.user.image || undefined,
                ratings: guestRes.user.ratings,
                isGuest: true,
              },
              onlineStatus: "connected",
            });
          }
        } catch {
          set({ onlineStatus: "disconnected" });
        }
      }
    },

    setActiveTab: (tab: MobileTab) => {
      let targetView: MobileView = "home";
      if (tab === "home") targetView = "home";
      else if (tab === "games") targetView = "play_online";
      else if (tab === "history") targetView = "history";
      else if (tab === "profile") targetView = "profile";

      set({ activeTab: tab, activeView: targetView, viewHistory: [targetView] });
    },

    navigate: (view: MobileView) => {
      const { viewHistory } = get();
      set({
        activeView: view,
        viewHistory: [...viewHistory, view],
      });
    },

    goBack: () => {
      const { viewHistory } = get();
      if (viewHistory.length <= 1) {
        set({ activeView: "home", viewHistory: ["home"], activeTab: "home" });
        return;
      }
      const updated = [...viewHistory];
      updated.pop();
      const prev = updated[updated.length - 1];
      set({
        activeView: prev,
        viewHistory: updated,
      });
    },

    setUser: (partialUser) => {
      set((state) => ({ user: { ...state.user, ...partialUser } }));
    },

    startMatchmaking: (timeControlId: TimeControlId, rated: boolean) => {
      set({
        isSearching: true,
        searchTimeControlId: timeControlId,
        isSearchRated: rated,
      });
    },

    cancelMatchmaking: () => {
      set({
        isSearching: false,
        searchTimeControlId: null,
      });
    },

    startBotGame: (timeControlId, difficulty, color) => {
      const newChess = new Chess();
      const chosenColor = color === "random" ? (Math.random() < 0.5 ? "white" : "black") : color;
      const tc = TIME_CONTROLS[timeControlId];
      const initialMs = tc ? tc.initialSeconds * 1000 : 180000;

      const botNames = [
        "Beginner Bot",
        "Novice Bot",
        "Casual Bot",
        "Intermediate Bot",
        "Advanced Bot",
        "Master Bot",
        "Grandmaster Bot",
        "Super GM Bot",
      ];
      const botRatings = [800, 1000, 1200, 1400, 1600, 1850, 2100, 2400];
      const botName = botNames[difficulty - 1] || "Computer Bot";
      const botRating = botRatings[difficulty - 1] || 1500;

      const user = get().user;

      const whitePlayer: PlayerInfo =
        chosenColor === "white"
          ? { id: user.id, name: user.name, rating: user.ratings.blitz }
          : { id: "bot", name: botName, rating: botRating, isAi: true };

      const blackPlayer: PlayerInfo =
        chosenColor === "black"
          ? { id: user.id, name: user.name, rating: user.ratings.blitz }
          : { id: "bot", name: botName, rating: botRating, isAi: true };

      const game: MobileGameState = {
        gameId: `bot-${Date.now()}`,
        mode: "computer",
        fen: newChess.fen(),
        moves: [],
        turn: "white",
        playerColor: chosenColor,
        whitePlayer,
        blackPlayer,
        whiteTimeMs: initialMs,
        blackTimeMs: initialMs,
        timeControlId,
        isRated: false,
        status: "active",
        canTakeback: true,
        isCheck: false,
      };

      set({
        chess: newChess,
        game,
        botDifficulty: difficulty,
        activeView: "in_game",
      });

      // If user plays black, trigger initial bot move as white
      if (chosenColor === "black") {
        setTimeout(() => {
          const moves = newChess.moves({ verbose: true });
          if (moves.length > 0) {
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            get().makeMove(randomMove.from, randomMove.to, randomMove.promotion);
          }
        }, 600);
      }
    },

    startLocalGame: (timeControlId) => {
      const newChess = new Chess();
      const tc = TIME_CONTROLS[timeControlId];
      const initialMs = tc ? tc.initialSeconds * 1000 : 600000;

      const game: MobileGameState = {
        gameId: `local-${Date.now()}`,
        mode: "local",
        fen: newChess.fen(),
        moves: [],
        turn: "white",
        playerColor: "white",
        whitePlayer: { id: "p1", name: "Player 1 (White)", rating: 1500 },
        blackPlayer: { id: "p2", name: "Player 2 (Black)", rating: 1500 },
        whiteTimeMs: initialMs,
        blackTimeMs: initialMs,
        timeControlId,
        isRated: false,
        status: "active",
        canTakeback: true,
        isCheck: false,
      };

      set({
        chess: newChess,
        game,
        activeView: "in_game",
      });
    },

    startOnlineGame: (gameId, playerColor, white, black, timeControlId, rated) => {
      const newChess = new Chess();
      const tc = TIME_CONTROLS[timeControlId];
      const initialMs = tc ? tc.initialSeconds * 1000 : 180000;

      const game: MobileGameState = {
        gameId,
        mode: "online",
        fen: newChess.fen(),
        moves: [],
        turn: "white",
        playerColor,
        whitePlayer: white,
        blackPlayer: black,
        whiteTimeMs: initialMs,
        blackTimeMs: initialMs,
        timeControlId,
        isRated: rated,
        status: "active",
        canTakeback: false, // Rule-10: No takebacks in rated or online matchmaking
        isCheck: false,
      };

      set({
        chess: newChess,
        game,
        isSearching: false,
        searchTimeControlId: null,
        activeView: "in_game",
      });
    },

    makeMove: (from, to, promotion = "q") => {
      const { chess, game } = get();
      if (!game || game.status !== "active") return false;

      try {
        const move = chess.move({
          from,
          to,
          promotion,
        });

        if (!move) return false;

        const nextTurn = chess.turn() === "w" ? "white" : "black";
        const isCheck = chess.inCheck();
        const isGameOver = chess.isGameOver();

        let winner: "white" | "black" | "draw" | undefined = undefined;
        let terminationReason = "";

        if (isGameOver) {
          if (chess.isCheckmate()) {
            winner = nextTurn === "white" ? "black" : "white";
            terminationReason = "Checkmate";
          } else if (chess.isDraw()) {
            winner = "draw";
            terminationReason = chess.isStalemate()
              ? "Stalemate"
              : chess.isThreefoldRepetition()
                ? "Repetition"
                : "Draw";
          }
        }

        const updatedMoves = [...game.moves, move.san];

        // Tactile feedback
        if (move.captured) {
          haptics.capture();
        } else if (isCheck) {
          haptics.check();
        } else {
          haptics.move();
        }

        // If online mode, dispatch move to server
        if (game.mode === "online") {
          realtime.sendGameMessage({
            v: 1,
            type: "MOVE_INTENT",
            payload: {
              from,
              to,
              promotion: (promotion as "q" | "r" | "b" | "n") || undefined,
              expectedPly: game.moves.length,
            },
          });
        }

        set({
          game: {
            ...game,
            fen: chess.fen(),
            moves: updatedMoves,
            turn: nextTurn,
            isCheck,
            lastMove: { from, to },
            status: isGameOver ? "terminated" : "active",
            winner,
            terminationReason,
          },
        });

        // If playing computer and game is still active and it's bot's turn:
        if (!isGameOver && game.mode === "computer" && nextTurn !== game.playerColor) {
          setTimeout(() => {
            const currentChess = get().chess;
            const legalMoves = currentChess.moves({ verbose: true });
            if (legalMoves.length > 0) {
              // Bot move selection with capture/check bias for higher difficulties
              const captures = legalMoves.filter((m) => m.captured);
              const checks = legalMoves.filter((m) => {
                currentChess.move(m);
                const check = currentChess.inCheck();
                currentChess.undo();
                return check;
              });

              let chosen = legalMoves[Math.floor(Math.random() * legalMoves.length)];
              if (get().botDifficulty >= 4 && captures.length > 0 && Math.random() < 0.6) {
                chosen = captures[Math.floor(Math.random() * captures.length)];
              } else if (get().botDifficulty >= 5 && checks.length > 0 && Math.random() < 0.5) {
                chosen = checks[Math.floor(Math.random() * checks.length)];
              }

              get().makeMove(chosen.from, chosen.to, chosen.promotion);
            }
          }, 450);
        }

        return true;
      } catch {
        return false;
      }
    },

    resign: () => {
      const { game } = get();
      if (!game || game.status !== "active") return;
      const winner = game.playerColor === "white" ? "black" : "white";
      get().endGame(winner, "by Resignation");
    },

    offerDraw: () => {
      // In local or bot play, draw agreement:
      const { game } = get();
      if (!game || game.status !== "active") return;
      get().endGame("draw", "by Agreement");
    },

    requestTakeback: () => {
      const { chess, game } = get();
      if (!game || !game.canTakeback || game.moves.length === 0) return;

      if (game.mode === "computer" && game.moves.length >= 2) {
        // Takeback 2 plies (bot's move and player's move)
        chess.undo();
        chess.undo();
        const updatedMoves = [...game.moves].slice(0, -2);
        set({
          game: {
            ...game,
            fen: chess.fen(),
            moves: updatedMoves,
            turn: game.playerColor,
            isCheck: chess.inCheck(),
            lastMove: undefined,
          },
        });
      } else {
        // Takeback 1 ply
        chess.undo();
        const updatedMoves = [...game.moves].slice(0, -1);
        set({
          game: {
            ...game,
            fen: chess.fen(),
            moves: updatedMoves,
            turn: chess.turn() === "w" ? "white" : "black",
            isCheck: chess.inCheck(),
            lastMove: undefined,
          },
        });
      }
    },

    endGame: (winner, reason) => {
      const { game, history, user } = get();
      if (!game) return;

      const isWin = winner === game.playerColor;
      const isLoss = winner !== "draw" && winner !== game.playerColor;
      const resultStr = isWin ? "win" : isLoss ? "loss" : "draw";
      const ratingDelta = game.isRated ? (isWin ? +16 : isLoss ? -14 : 0) : 0;

      // Haptic feedback on game outcome
      haptics.gameOver(isWin);

      const newHistoryItem: MatchHistoryItem = {
        id: game.gameId,
        category: game.mode,
        timeControl: game.timeControlId,
        opponent: {
          name: game.playerColor === "white" ? game.blackPlayer.name : game.whitePlayer.name,
          rating: game.playerColor === "white" ? game.blackPlayer.rating : game.whitePlayer.rating,
        },
        playerColor: game.playerColor,
        result: resultStr,
        ratingDelta,
        termination: reason,
        movesCount: game.moves.length,
        date: "Just now",
        pgn: game.moves.join(" "),
      };

      set({
        game: {
          ...game,
          status: "terminated",
          winner,
          terminationReason: reason,
        },
        history: [newHistoryItem, ...history],
        user: {
          ...user,
          ratings: {
            ...user.ratings,
            blitz: user.ratings.blitz + ratingDelta,
          },
        },
      });
    },
  };
});

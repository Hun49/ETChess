import { type BotHandle, createBot } from "@etchess/bot-engine";
import {
  STARTING_FEN,
  calculateClockAfterMove,
  getCurrentClockDisplay,
  isInCheck,
  validateAndApplyMove,
} from "@etchess/chess-core";
import {
  type ClientGameFrame,
  type ClientMatchmakerFrame,
  parseServerGameFrame,
  parseServerMatchmakerFrame,
} from "@etchess/realtime-protocol";
import type { BotTier, TimeControlKey } from "@etchess/types";
import { create } from "zustand";
import { LocalUciEngineTransport } from "../lib/localUciEngine";
import { sound } from "../lib/sound";

export type GameMode = "idle" | "matchmaking" | "online" | "bot" | "pass_and_play";
export type BoardTheme = "classic" | "wood" | "blue" | "dark" | "slate" | "emerald" | "ocean";
export type AppView =
  | "home"
  | "play_online"
  | "play_friend"
  | "play_computer"
  | "play_local"
  | "searching"
  | "match_found"
  | "game"
  | "game_over"
  | "analysis"
  | "history"
  | "profile"
  | "settings";

export interface PlayerInfo {
  id?: string;
  name: string;
  rating: number;
  avatar?: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  senderRole: "white" | "black" | "spectator";
  text: string;
  timestamp: number;
}

export interface GameSettings {
  boardTheme: "classic" | "wood" | "blue" | "dark";
  pieceStyle: "classic" | "modern" | "minimal";
  coordinates: boolean;
  boardSize: number;
  animations: boolean;
  moveSound: boolean;
  captureSound: boolean;
  checkSound: boolean;
  gameEndSound: boolean;
  clockWarning: boolean;
}

export interface GameState {
  // Navigation & Screen View
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  mode: GameMode;
  gameId: string | null;
  timeControl: TimeControlKey;
  rated: boolean;
  botTier: BotTier;

  // Board & Move State
  fen: string;
  turn: "w" | "b";
  playerColor: "white" | "black";
  boardOrientation: "white" | "black";
  boardTheme: BoardTheme;
  moves: string[]; // SAN moves
  lastMove: { from: string; to: string } | null;
  isCheck: boolean;

  // Players
  whitePlayer: PlayerInfo;
  blackPlayer: PlayerInfo;

  // Clocks
  whiteMs: number;
  blackMs: number;
  incrementMs: number;
  lastMoveTimestamp: number;
  isClockRunning: boolean;

  // Status & Outcomes
  status: "idle" | "waiting" | "active" | "ended" | "aborted";
  result: "1-0" | "0-1" | "1/2-1/2" | "aborted" | null;
  termination: string | null;
  whiteRatingDiff?: number;
  blackRatingDiff?: number;

  // Realtime & Connectivity
  latencyMs: number;
  whiteConnected: boolean;
  blackConnected: boolean;
  disconnectGraceMs: number | null;
  drawOfferedBy: "white" | "black" | null;
  rematchOfferedBy: "white" | "black" | null;
  rematchAccepted: boolean;
  chatMessages: ChatMessage[];

  // Matchmaking & Friend Challenge
  matchFoundCountdown: number;
  friendChallenge: {
    id: string;
    timeControl: TimeControlKey;
    color: "white" | "black" | "random";
    rated: boolean;
    takeback: boolean;
    timeGift: boolean;
  } | null;

  // App Settings
  settings: GameSettings;
  updateSettings: (partial: Partial<GameSettings>) => void;

  // Sound & Modals
  isSoundMuted: boolean;
  activeModal: "auth" | "profile" | "play" | "leaderboard" | "game_over" | null;

  // Actions
  openModal: (modal: "auth" | "profile" | "play" | "leaderboard" | "game_over") => void;
  closeModal: () => void;
  toggleSound: () => void;
  setBoardTheme: (theme: BoardTheme) => void;
  flipBoard: () => void;

  // Game Flow Actions
  startPassAndPlay: (tc?: TimeControlKey) => void;
  startBotGame: (
    tier: BotTier,
    playerColor: "white" | "black" | "random",
    tc?: TimeControlKey,
  ) => void;
  joinMatchmaking: (tc: TimeControlKey, rated: boolean) => void;
  leaveMatchmaking: () => void;
  createFriendChallenge: (config: {
    timeControl: TimeControlKey;
    color: "white" | "black" | "random";
    rated: boolean;
    takeback: boolean;
    timeGift: boolean;
  }) => string;
  cancelFriendChallenge: () => void;
  makeMove: (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => boolean;
  resign: () => void;
  offerDraw: () => void;
  respondDraw: (accept: boolean) => void;
  requestRematch: () => void;
  respondRematch: (accept: boolean) => void;
  sendChatMessage: (text: string) => void;
  resetToIdle: () => void;
  tickClock: () => void;
}

// Active singletons for connections and engine
let activeGameWs: WebSocket | null = null;
let activeMatchmakerWs: WebSocket | null = null;
let activeBot: BotHandle | null = null;
let pingIntervalId: number | null = null;
let clockIntervalId: number | null = null;

const TC_CONFIG: Record<TimeControlKey, { initialMs: number; incMs: number }> = {
  "1+0": { initialMs: 60 * 1000, incMs: 0 },
  "2+0": { initialMs: 120 * 1000, incMs: 0 },
  "3+0": { initialMs: 3 * 60 * 1000, incMs: 0 },
  "3+2": { initialMs: 3 * 60 * 1000, incMs: 2000 },
  "5+0": { initialMs: 5 * 60 * 1000, incMs: 0 },
  "5+3": { initialMs: 5 * 60 * 1000, incMs: 3000 },
  "10+0": { initialMs: 10 * 60 * 1000, incMs: 0 },
  "10+5": { initialMs: 10 * 60 * 1000, incMs: 5000 },
  "15+10": { initialMs: 15 * 60 * 1000, incMs: 10000 },
  "30+0": { initialMs: 30 * 60 * 1000, incMs: 0 },
};

export const useGameStore = create<GameState>((set, get) => ({
  activeView: "home",
  setActiveView: (view) => set({ activeView: view }),
  mode: "idle",
  gameId: null,
  timeControl: "3+2",
  rated: true,
  botTier: "intermediate",

  fen: STARTING_FEN,
  turn: "w",
  playerColor: "white",
  boardOrientation: "white",
  boardTheme: "classic",
  moves: [],
  lastMove: null,
  isCheck: false,

  whitePlayer: { name: "White", rating: 1500 },
  blackPlayer: { name: "Black", rating: 1500 },

  whiteMs: 180000,
  blackMs: 180000,
  incrementMs: 2000,
  lastMoveTimestamp: Date.now(),
  isClockRunning: false,

  status: "idle",
  result: null,
  termination: null,

  latencyMs: 0,
  whiteConnected: true,
  blackConnected: true,
  disconnectGraceMs: null,
  drawOfferedBy: null,
  rematchOfferedBy: null,
  rematchAccepted: false,
  chatMessages: [],

  matchFoundCountdown: 3,
  friendChallenge: null,

  settings: {
    boardTheme: "classic",
    pieceStyle: "classic",
    coordinates: true,
    boardSize: 100,
    animations: true,
    moveSound: true,
    captureSound: true,
    checkSound: true,
    gameEndSound: true,
    clockWarning: true,
  },

  updateSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
      boardTheme: partial.boardTheme ?? state.boardTheme,
    })),

  isSoundMuted: sound.isSoundMuted(),
  activeModal: null,

  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),

  toggleSound: () => {
    const nextMuted = !get().isSoundMuted;
    sound.setMuted(nextMuted);
    set({ isSoundMuted: nextMuted });
  },

  setBoardTheme: (theme) => set({ boardTheme: theme }),
  flipBoard: () =>
    set((state) => ({
      boardOrientation: state.boardOrientation === "white" ? "black" : "white",
    })),

  createFriendChallenge: (config) => {
    const id = Math.random().toString(36).substring(2, 8);
    set({
      friendChallenge: { ...config, id },
      timeControl: config.timeControl,
      rated: config.rated,
    });
    return id;
  },

  cancelFriendChallenge: () => set({ friendChallenge: null }),

  // Reset to Lobby / Landing
  resetToIdle: () => {
    if (activeGameWs) {
      activeGameWs.close();
      activeGameWs = null;
    }
    if (activeMatchmakerWs) {
      activeMatchmakerWs.close();
      activeMatchmakerWs = null;
    }
    if (activeBot) {
      activeBot.terminate();
      activeBot = null;
    }
    if (pingIntervalId) {
      clearInterval(pingIntervalId);
      pingIntervalId = null;
    }
    if (clockIntervalId) {
      clearInterval(clockIntervalId);
      clockIntervalId = null;
    }

    set({
      activeView: "home",
      mode: "idle",
      gameId: null,
      status: "idle",
      result: null,
      termination: null,
      fen: STARTING_FEN,
      turn: "w",
      moves: [],
      lastMove: null,
      isCheck: false,
      isClockRunning: false,
      activeModal: null,
      chatMessages: [],
    });
  },

  // 1. Pass and Play (Local 2 Players)
  startPassAndPlay: (tc = "10+0") => {
    get().resetToIdle();
    const config = TC_CONFIG[tc];

    set({
      activeView: "game",
      mode: "pass_and_play",
      timeControl: tc,
      whitePlayer: { name: "Player 1 (White)", rating: 1500 },
      blackPlayer: { name: "Player 2 (Black)", rating: 1500 },
      fen: STARTING_FEN,
      turn: "w",
      playerColor: "white",
      boardOrientation: "white",
      whiteMs: config.initialMs,
      blackMs: config.initialMs,
      incrementMs: config.incMs,
      lastMoveTimestamp: Date.now(),
      isClockRunning: true,
      status: "active",
      moves: [],
      lastMove: null,
      isCheck: false,
      activeModal: null,
    });

    startClockTicker(set, get);
  },

  // 2. Play Against Local Bot (Stockfish / UCI Engine)
  startBotGame: (tier = "intermediate", selectedColor = "white", tc = "5+0") => {
    get().resetToIdle();
    const config = TC_CONFIG[tc];

    const actualColor: "white" | "black" =
      selectedColor === "random" ? (Math.random() < 0.5 ? "white" : "black") : selectedColor;

    const botTransport = new LocalUciEngineTransport();
    const bot = createBot(tier, botTransport);
    activeBot = bot;

    const botName = `ET Bot (${tier.charAt(0).toUpperCase() + tier.slice(1)})`;
    const botRating = tier === "beginner" ? 600 : tier === "intermediate" ? 1400 : 2000;

    set({
      activeView: "game",
      mode: "bot",
      botTier: tier,
      timeControl: tc,
      playerColor: actualColor,
      boardOrientation: actualColor,
      whitePlayer:
        actualColor === "white"
          ? { name: "You", rating: 1500 }
          : { name: botName, rating: botRating },
      blackPlayer:
        actualColor === "black"
          ? { name: "You", rating: 1500 }
          : { name: botName, rating: botRating },
      fen: STARTING_FEN,
      turn: "w",
      whiteMs: config.initialMs,
      blackMs: config.initialMs,
      incrementMs: config.incMs,
      lastMoveTimestamp: Date.now(),
      isClockRunning: true,
      status: "active",
      moves: [],
      lastMove: null,
      isCheck: false,
      activeModal: null,
    });

    bot.init().then(() => {
      // If bot is playing White, trigger first move
      if (actualColor === "black") {
        setTimeout(() => {
          bot.requestMove(STARTING_FEN, (uciMove) => {
            handleBotMoveReceived(uciMove, set, get);
          });
        }, 400);
      }
    });

    startClockTicker(set, get);
  },

  // 3. Online Matchmaking via MatchmakerDO WebSocket
  joinMatchmaking: (tc: TimeControlKey, rated: boolean) => {
    get().resetToIdle();

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const matchmakerUrl = `${wsProtocol}//${window.location.host}/ws/user`;
    const ws = new WebSocket(matchmakerUrl);
    activeMatchmakerWs = ws;

    set({
      activeView: "searching",
      mode: "matchmaking",
      timeControl: tc,
      rated,
      activeModal: null,
    });

    ws.onopen = () => {
      const joinMsg: ClientMatchmakerFrame = {
        type: "QUEUE_JOIN",
        payload: { timeControlId: tc, rated },
      };
      ws.send(JSON.stringify(joinMsg));
    };

    ws.onmessage = (event) => {
      const parsed = parseServerMatchmakerFrame(event.data);
      if (!parsed.success) return;

      const frame = parsed.data;
      if (frame.type === "MATCH_FOUND") {
        sound.playMatchFound();
        ws.close();
        activeMatchmakerWs = null;

        const myColor = frame.payload.color;
        const opponent = frame.payload.opponent;

        set({
          activeView: "match_found",
          matchFoundCountdown: 3,
          whitePlayer:
            myColor === "white"
              ? { name: "You", rating: 1567 }
              : { name: opponent.name, rating: opponent.rating },
          blackPlayer:
            myColor === "black"
              ? { name: "You", rating: 1567 }
              : { name: opponent.name, rating: opponent.rating },
        });

        // Countdown: 3, 2, 1, then connect to game room
        let count = 3;
        const timer = setInterval(() => {
          count--;
          if (count > 0) {
            set({ matchFoundCountdown: count });
          } else {
            clearInterval(timer);
            connectToOnlineGame(
              frame.payload.gameId,
              frame.payload.color ?? frame.payload.assignedColor ?? "white",
              frame.payload.opponent,
              set,
              get,
            );
          }
        }, 1000);
      }
    };

    ws.onerror = () => {
      set({ activeView: "play_online", mode: "idle" });
    };
  },

  leaveMatchmaking: () => {
    if (activeMatchmakerWs) {
      const leaveMsg: ClientMatchmakerFrame = { type: "LEAVE_QUEUE" };
      try {
        activeMatchmakerWs.send(JSON.stringify(leaveMsg));
      } catch {}
      activeMatchmakerWs.close();
      activeMatchmakerWs = null;
    }
    set({ activeView: "play_online", mode: "idle" });
  },

  // Make move on board
  makeMove: (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => {
    const { fen, mode, playerColor, turn, status } = get();
    if (status !== "active") return false;

    // In online and bot modes, ensure player is moving on their own turn
    if (
      (mode === "online" || mode === "bot") &&
      ((turn === "w" && playerColor !== "white") || (turn === "b" && playerColor !== "black"))
    ) {
      return false;
    }

    const validation = validateAndApplyMove(fen, { from, to, promotion });
    if (!validation.valid) {
      return false;
    }

    // Play move or capture sound
    const isCapture = validation.san.includes("x");
    if (isCapture) {
      sound.playCapture();
    } else {
      sound.playMove();
    }

    if (validation.snapshot.isCheck) {
      sound.playCheck();
    }

    // Update clocks
    const now = Date.now();
    const clockResult = calculateClockAfterMove(
      {
        whiteMs: get().whiteMs,
        blackMs: get().blackMs,
        activeTurn: turn,
        lastMoveTimestamp: get().lastMoveTimestamp,
      },
      { incrementMs: get().incrementMs },
      now,
    );

    const nextMoves = [...get().moves, validation.san];
    const isOver = validation.snapshot.isGameOver;

    let result: "1-0" | "0-1" | "1/2-1/2" | null = null;
    let termination: string | null = null;

    if (validation.snapshot.isCheckmate) {
      result = turn === "w" ? "1-0" : "0-1";
      termination = `Checkmate - ${turn === "w" ? "White" : "Black"} wins`;
      sound.playGameOver();
    } else if (validation.snapshot.isDraw) {
      result = "1/2-1/2";
      termination = validation.snapshot.isStalemate
        ? "Draw by stalemate"
        : validation.snapshot.isThreefoldRepetition
          ? "Draw by threefold repetition"
          : "Draw by insufficient material";
      sound.playGameOver();
    }

    set({
      fen: validation.snapshot.fen,
      turn: validation.snapshot.turn,
      moves: nextMoves,
      lastMove: { from, to },
      isCheck: validation.snapshot.isCheck,
      whiteMs: clockResult.whiteMs,
      blackMs: clockResult.blackMs,
      lastMoveTimestamp: now,
      status: isOver ? "ended" : "active",
      result,
      termination,
      activeModal: isOver ? "game_over" : get().activeModal,
    });

    // If online, dispatch MOVE_INTENT to GameSessionDO
    if (mode === "online" && activeGameWs) {
      const moveFrame: ClientGameFrame = {
        v: 1,
        type: "MOVE_INTENT",
        payload: {
          from,
          to,
          promotion,
          expectedPly: nextMoves.length - 1,
        },
      };
      activeGameWs.send(JSON.stringify(moveFrame));
    }

    // If bot mode and game is still active, request bot reply
    if (mode === "bot" && !isOver && activeBot) {
      setTimeout(() => {
        activeBot?.requestMove(validation.snapshot.fen, (botBestMove) => {
          handleBotMoveReceived(botBestMove, set, get);
        });
      }, 300);
    }

    return true;
  },

  resign: () => {
    const { mode, playerColor } = get();
    if (mode === "online" && activeGameWs) {
      const resignFrame: ClientGameFrame = { type: "RESIGN" };
      activeGameWs.send(JSON.stringify(resignFrame));
    } else {
      const winner = playerColor === "white" ? "black" : "white";
      const result = playerColor === "white" ? "0-1" : "1-0";
      sound.playGameOver();
      set({
        status: "ended",
        result,
        termination: `${playerColor === "white" ? "White" : "Black"} resigned`,
        activeModal: "game_over",
      });
    }
  },

  offerDraw: () => {
    const { mode, playerColor } = get();
    if (mode === "online" && activeGameWs) {
      const frame: ClientGameFrame = { type: "OFFER_DRAW" };
      activeGameWs.send(JSON.stringify(frame));
      set({ drawOfferedBy: playerColor });
    }
  },

  respondDraw: (accept: boolean) => {
    const { mode } = get();
    if (mode === "online" && activeGameWs) {
      const frame: ClientGameFrame = { type: "RESPOND_DRAW", accept };
      activeGameWs.send(JSON.stringify(frame));
      set({ drawOfferedBy: null });
    }
  },

  requestRematch: () => {
    const { mode } = get();
    if (mode === "online" && activeGameWs) {
      const frame: ClientGameFrame = { type: "REQUEST_REMATCH" };
      activeGameWs.send(JSON.stringify(frame));
      set({ rematchOfferedBy: get().playerColor });
    } else if (mode === "bot") {
      get().startBotGame(get().botTier, get().playerColor, get().timeControl);
    } else if (mode === "pass_and_play") {
      get().startPassAndPlay(get().timeControl);
    }
  },

  respondRematch: (accept: boolean) => {
    const { mode } = get();
    if (mode === "online" && activeGameWs) {
      const frame: ClientGameFrame = { type: "RESPOND_REMATCH", accept };
      activeGameWs.send(JSON.stringify(frame));
      set({ rematchOfferedBy: null });
    }
  },

  sendChatMessage: (text: string) => {
    if (get().mode === "online" && activeGameWs && text.trim().length > 0) {
      const frame: ClientGameFrame = {
        type: "CHAT_SEND",
        text: text.trim().slice(0, 300),
      };
      activeGameWs.send(JSON.stringify(frame));
    }
  },

  tickClock: () => {
    const { status, isClockRunning, whiteMs, blackMs, turn, lastMoveTimestamp } = get();
    if (status !== "active" || !isClockRunning) return;

    const display = getCurrentClockDisplay(
      {
        whiteMs,
        blackMs,
        activeTurn: turn,
        lastMoveTimestamp,
      },
      Date.now(),
    );

    if (display.flagged) {
      sound.playGameOver();
      const winner = turn === "w" ? "Black" : "White";
      set({
        status: "ended",
        result: turn === "w" ? "0-1" : "1-0",
        termination: `Time out - ${winner} wins on time`,
        whiteMs: display.whiteMs,
        blackMs: display.blackMs,
        activeModal: "game_over",
      });
      return;
    }

    set({
      whiteMs: display.whiteMs,
      blackMs: display.blackMs,
    });
  },
}));

/**
 * Handles bot move response from UCI bestmove output
 */
function handleBotMoveReceived(
  uciMove: string,
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
): void {
  if (!uciMove || uciMove === "(none)" || uciMove.length < 4) return;

  const from = uciMove.slice(0, 2);
  const to = uciMove.slice(2, 4);
  const promotion = (uciMove.length > 4 ? uciMove[4] : undefined) as
    | "q"
    | "r"
    | "b"
    | "n"
    | undefined;

  const currentFen = get().fen;
  const validation = validateAndApplyMove(currentFen, { from, to, promotion });
  if (!validation.valid) return;

  const isCapture = validation.san.includes("x");
  if (isCapture) {
    sound.playCapture();
  } else {
    sound.playMove();
  }

  if (validation.snapshot.isCheck) {
    sound.playCheck();
  }

  const now = Date.now();
  const clockResult = calculateClockAfterMove(
    {
      whiteMs: get().whiteMs,
      blackMs: get().blackMs,
      activeTurn: get().turn,
      lastMoveTimestamp: get().lastMoveTimestamp,
    },
    { incrementMs: get().incrementMs },
    now,
  );

  const nextMoves = [...get().moves, validation.san];
  const isOver = validation.snapshot.isGameOver;

  let result: "1-0" | "0-1" | "1/2-1/2" | null = null;
  let termination: string | null = null;

  if (validation.snapshot.isCheckmate) {
    result = get().turn === "w" ? "1-0" : "0-1";
    termination = `Checkmate - ${get().turn === "w" ? "White" : "Black"} wins`;
    sound.playGameOver();
  } else if (validation.snapshot.isDraw) {
    result = "1/2-1/2";
    termination = "Draw";
    sound.playGameOver();
  }

  set({
    fen: validation.snapshot.fen,
    turn: validation.snapshot.turn,
    moves: nextMoves,
    lastMove: { from, to },
    isCheck: validation.snapshot.isCheck,
    whiteMs: clockResult.whiteMs,
    blackMs: clockResult.blackMs,
    lastMoveTimestamp: now,
    status: isOver ? "ended" : "active",
    result,
    termination,
    activeModal: isOver ? "game_over" : get().activeModal,
  });
}

/**
 * Connects to live GameRoomDO WebSocket
 */
function connectToOnlineGame(
  gameId: string,
  playerColor: "white" | "black",
  opponent: { id: string; name: string; rating: number },
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
): void {
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const gameWsUrl = `${wsProtocol}//${window.location.host}/ws/game/${gameId}`;
  const ws = new WebSocket(gameWsUrl);
  activeGameWs = ws;

  set({
    activeView: "game",
    mode: "online",
    gameId,
    playerColor,
    boardOrientation: playerColor,
    whitePlayer:
      playerColor === "white"
        ? { name: "You", rating: 1567 }
        : { name: opponent.name, rating: opponent.rating, id: opponent.id },
    blackPlayer:
      playerColor === "black"
        ? { name: "You", rating: 1567 }
        : { name: opponent.name, rating: opponent.rating, id: opponent.id },
    status: "active",
    fen: STARTING_FEN,
    turn: "w",
    moves: [],
    lastMove: null,
    isCheck: false,
    activeModal: null,
  });

  // Start ping interval to compute round-trip latency
  if (pingIntervalId) clearInterval(pingIntervalId);
  pingIntervalId = window.setInterval(() => {
    if (activeGameWs && activeGameWs.readyState === WebSocket.OPEN) {
      const pingFrame: ClientGameFrame = {
        type: "PING",
        timestamp: Date.now(),
      };
      activeGameWs.send(JSON.stringify(pingFrame));
    }
  }, 5000);

  ws.onmessage = (event) => {
    const parsed = parseServerGameFrame(event.data);
    if (!parsed.success) return;

    const frame = parsed.data;

    if (frame.type === "GAME_SYNC") {
      const payload = frame.payload;
      set({
        fen: payload.fen,
        turn: payload.turn,
        moves: payload.moves,
        whiteMs: payload.whiteMs,
        blackMs: payload.blackMs,
        lastMoveTimestamp: payload.lastMoveTimestamp ?? 0,
        whiteConnected: payload.whiteConnected,
        blackConnected: payload.blackConnected,
        status: payload.status,
        result: payload.result ?? null,
        termination: payload.termination ?? null,
        isCheck: isInCheck(payload.fen),
        isClockRunning: payload.status === "active",
      });
    } else if (frame.type === "MOVE_MADE") {
      const payload = frame.payload;
      const isCapture = payload.san.includes("x");
      if (isCapture) {
        sound.playCapture();
      } else {
        sound.playMove();
      }

      const check = isInCheck(payload.fen);
      if (check) sound.playCheck();

      set({
        fen: payload.fen,
        turn: payload.turn,
        moves: [...get().moves, payload.san],
        lastMove: { from: payload.from, to: payload.to },
        whiteMs: payload.whiteMs,
        blackMs: payload.blackMs,
        lastMoveTimestamp: payload.lastMoveTimestamp,
        isCheck: check,
      });
    } else if (frame.type === "GAME_ENDED") {
      sound.playGameOver();
      set({
        activeView: "game_over",
        status: "ended",
        result: frame.payload.result,
        termination: frame.payload.termination,
        whiteRatingDiff: frame.payload.whiteRatingDiff,
        blackRatingDiff: frame.payload.blackRatingDiff,
        activeModal: "game_over",
      });
    } else if (frame.type === "DRAW_OFFERED") {
      set({ drawOfferedBy: frame.from });
    } else if (frame.type === "DRAW_DECLINED") {
      set({ drawOfferedBy: null });
    } else if (frame.type === "REMATCH_OFFERED") {
      set({ rematchOfferedBy: frame.from });
    } else if (frame.type === "PLAYER_DISCONNECTED") {
      if (frame.role === "white")
        set({ whiteConnected: false, disconnectGraceMs: frame.gracePeriodMs });
      if (frame.role === "black")
        set({ blackConnected: false, disconnectGraceMs: frame.gracePeriodMs });
    } else if (frame.type === "PLAYER_RECONNECTED") {
      if (frame.role === "white") set({ whiteConnected: true, disconnectGraceMs: null });
      if (frame.role === "black") set({ blackConnected: true, disconnectGraceMs: null });
    } else if (frame.type === "PONG") {
      const latency = Math.max(0, Date.now() - frame.timestamp);
      set({ latencyMs: latency });
    } else if (frame.type === "CHAT_MESSAGE") {
      set({
        chatMessages: [...get().chatMessages, frame],
      });
    }
  };

  ws.onclose = () => {
    if (get().status === "active") {
      set({ whiteConnected: false, blackConnected: false });
    }
  };

  startClockTicker(set, get);
}

/**
 * High-frequency clock countdown interval ticker (every 100ms)
 */
function startClockTicker(set: (partial: Partial<GameState>) => void, get: () => GameState): void {
  if (clockIntervalId) clearInterval(clockIntervalId);
  clockIntervalId = window.setInterval(() => {
    get().tickClock();
  }, 100);
}

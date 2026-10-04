import type { TimeControlId } from "@etchess/types";

export type MobileTab = "home" | "games" | "history" | "profile";

export type MobileView =
  | "splash"
  | "home"
  | "play_online"
  | "play_computer"
  | "play_friend"
  | "play_local"
  | "in_game"
  | "analysis"
  | "history"
  | "profile"
  | "settings";

export type GameMode = "online" | "computer" | "friend" | "local";

export interface PlayerInfo {
  id: string;
  name: string;
  rating: number;
  avatar?: string;
  isAi?: boolean;
}

export interface MobileGameState {
  gameId: string;
  mode: GameMode;
  fen: string;
  moves: string[];
  turn: "white" | "black";
  playerColor: "white" | "black";
  whitePlayer: PlayerInfo;
  blackPlayer: PlayerInfo;
  whiteTimeMs: number;
  blackTimeMs: number;
  timeControlId: TimeControlId;
  isRated: boolean;
  status: "idle" | "active" | "terminated";
  winner?: "white" | "black" | "draw";
  terminationReason?: string;
  canTakeback: boolean;
  isCheck: boolean;
  lastMove?: { from: string; to: string };
}

export interface MatchHistoryItem {
  id: string;
  category: "online" | "friend" | "computer" | "local";
  timeControl: string;
  opponent: {
    name: string;
    rating: number;
    avatar?: string;
  };
  playerColor: "white" | "black";
  result: "win" | "loss" | "draw";
  ratingDelta: number;
  termination: string;
  opening?: string;
  movesCount: number;
  date: string;
  pgn: string;
}

export type PlayMode = "online" | "friend" | "computer" | "local";

export type PlayerColor = "white" | "black";

export type GameResult = "1-0" | "0-1" | "1/2-1/2" | "aborted";

export type GameTermination =
  | "checkmate"
  | "timeout"
  | "resignation"
  | "draw_agreement"
  | "stalemate"
  | "repetition"
  | "insufficient_material"
  | "forfeit_disconnect"
  | "abandoned";

export const DISCONNECT_FORFEIT_TIMEOUT_MS = 60_000;

export interface MoveInput {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
}

export interface ClockState {
  whiteMs: number;
  blackMs: number;
  lastMoveTimestamp: number;
  activeTurn: "w" | "b";
}

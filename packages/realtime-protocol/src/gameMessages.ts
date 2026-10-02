import { z } from "zod";

// Square regex pattern: e2, e4, a1, h8, etc.
const SquareSchema = z.string().regex(/^[a-h][1-8]$/);
const PromotionSchema = z.enum(["q", "r", "b", "n"]).optional();

// ==========================================
// 1. Client -> Server Schemas
// ==========================================

export const ClientMoveSchema = z.object({
  type: z.literal("MOVE"),
  payload: z.object({
    from: SquareSchema,
    to: SquareSchema,
    promotion: PromotionSchema,
  }),
});

export const ClientResignSchema = z.object({
  type: z.literal("RESIGN"),
});

export const ClientOfferDrawSchema = z.object({
  type: z.literal("OFFER_DRAW"),
});

export const ClientRespondDrawSchema = z.object({
  type: z.literal("RESPOND_DRAW"),
  accept: z.boolean(),
});

export const ClientRequestRematchSchema = z.object({
  type: z.literal("REQUEST_REMATCH"),
});

export const ClientRespondRematchSchema = z.object({
  type: z.literal("RESPOND_REMATCH"),
  accept: z.boolean(),
});

export const ClientPingSchema = z.object({
  type: z.literal("PING"),
  timestamp: z.number(),
});

export const ClientChatSendSchema = z.object({
  type: z.literal("CHAT_SEND"),
  text: z.string().min(1).max(300),
});

export const ClientGameFrameSchema = z.discriminatedUnion("type", [
  ClientMoveSchema,
  ClientResignSchema,
  ClientOfferDrawSchema,
  ClientRespondDrawSchema,
  ClientRequestRematchSchema,
  ClientRespondRematchSchema,
  ClientPingSchema,
  ClientChatSendSchema,
]);

export type ClientGameFrame = z.infer<typeof ClientGameFrameSchema>;

// ==========================================
// 2. Server -> Client Schemas
// ==========================================

export const ServerGameSyncSchema = z.object({
  type: z.literal("GAME_SYNC"),
  payload: z.object({
    gameId: z.string(),
    fen: z.string(),
    turn: z.enum(["w", "b"]),
    status: z.enum(["waiting", "active", "ended", "aborted"]),
    whiteUserId: z.string().nullable(),
    blackUserId: z.string().nullable(),
    whiteMs: z.number(),
    blackMs: z.number(),
    lastMoveTimestamp: z.number(),
    whiteConnected: z.boolean(),
    blackConnected: z.boolean(),
    spectatorCount: z.number(),
    result: z.enum(["1-0", "0-1", "1/2-1/2", "aborted"]).optional(),
    termination: z.string().optional(),
    moves: z.array(z.string()), // SAN moves
  }),
});

export const ServerMoveMadeSchema = z.object({
  type: z.literal("MOVE_MADE"),
  payload: z.object({
    from: SquareSchema,
    to: SquareSchema,
    promotion: PromotionSchema,
    san: z.string(),
    fen: z.string(),
    whiteMs: z.number(),
    blackMs: z.number(),
    lastMoveTimestamp: z.number(),
    turn: z.enum(["w", "b"]),
  }),
});

export const ServerGameEndedSchema = z.object({
  type: z.literal("GAME_ENDED"),
  payload: z.object({
    result: z.enum(["1-0", "0-1", "1/2-1/2", "aborted"]),
    termination: z.string(),
    winner: z.enum(["white", "black"]).optional(),
    whiteRatingDiff: z.number().optional(),
    blackRatingDiff: z.number().optional(),
  }),
});

export const ServerDrawOfferedSchema = z.object({
  type: z.literal("DRAW_OFFERED"),
  from: z.enum(["white", "black"]),
});

export const ServerDrawDeclinedSchema = z.object({
  type: z.literal("DRAW_DECLINED"),
});

export const ServerRematchOfferedSchema = z.object({
  type: z.literal("REMATCH_OFFERED"),
  from: z.enum(["white", "black"]),
});

export const ServerRematchDeclinedSchema = z.object({
  type: z.literal("REMATCH_DECLINED"),
});

export const ServerPlayerDisconnectedSchema = z.object({
  type: z.literal("PLAYER_DISCONNECTED"),
  role: z.enum(["white", "black"]),
  gracePeriodMs: z.number(),
});

export const ServerPlayerReconnectedSchema = z.object({
  type: z.literal("PLAYER_RECONNECTED"),
  role: z.enum(["white", "black"]),
});

export const ServerPongSchema = z.object({
  type: z.literal("PONG"),
  timestamp: z.number(),
});

export const ServerChatMessageSchema = z.object({
  type: z.literal("CHAT_MESSAGE"),
  id: z.string(),
  sender: z.string(),
  senderRole: z.enum(["white", "black", "spectator"]),
  text: z.string(),
  timestamp: z.number(),
});

export const ServerErrorSchema = z.object({
  type: z.literal("ERROR"),
  code: z.string(),
  message: z.string(),
});

export const ServerGameFrameSchema = z.discriminatedUnion("type", [
  ServerGameSyncSchema,
  ServerMoveMadeSchema,
  ServerGameEndedSchema,
  ServerDrawOfferedSchema,
  ServerDrawDeclinedSchema,
  ServerRematchOfferedSchema,
  ServerRematchDeclinedSchema,
  ServerPlayerDisconnectedSchema,
  ServerPlayerReconnectedSchema,
  ServerPongSchema,
  ServerChatMessageSchema,
  ServerErrorSchema,
]);

export type ServerGameFrame = z.infer<typeof ServerGameFrameSchema>;

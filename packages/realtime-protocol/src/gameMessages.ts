import { z } from "zod";

export const PROTOCOL_VERSION = 1;

// Regex matching standard chess squares (a1-h8)
export const SquareSchema = z.string().regex(/^[a-h][1-8]$/);
export const PromotionPieceSchema = z.enum(["q", "r", "b", "n"]);

export const PlayerRoleSchema = z.enum(["white", "black", "spectator"]);
export const GameResultSchema = z.enum(["1-0", "0-1", "1/2-1/2", "aborted"]);
export const GameStatusSchema = z.enum(["waiting", "active", "ended", "aborted"]);

export const PlayerInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  rating: z.number(),
  image: z.string().nullable().optional(),
  isProvisional: z.boolean().optional(),
  connected: z.boolean(),
});

// ============================================================================
// 1. Client -> Server Frames (/ws/game/:gameId)
// ============================================================================

export const ClientAuthPayloadSchema = z.object({
  ticket: z.string().min(1),
});

export const ClientMoveIntentPayloadSchema = z.object({
  from: SquareSchema,
  to: SquareSchema,
  promotion: PromotionPieceSchema.optional(),
  expectedPly: z.number().int().nonnegative(),
});

export const ClientDrawOfferPayloadSchema = z.object({});

export const ClientDrawResponsePayloadSchema = z.object({
  accept: z.boolean(),
});

export const ClientResignPayloadSchema = z.object({});

export const ClientTakebackRequestPayloadSchema = z.object({
  plies: z.union([z.literal(1), z.literal(2)]).optional(),
});

export const ClientTakebackResponsePayloadSchema = z.object({
  accept: z.boolean(),
});

export const ClientHeartbeatPingPayloadSchema = z.object({
  clientSeq: z.number().optional(),
});

// Discriminated union of client game messages
export const ClientGameFrameSchema = z.discriminatedUnion("type", [
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("AUTH"),
    requestId: z.string().optional(),
    payload: ClientAuthPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("MOVE_INTENT"),
    requestId: z.string().optional(),
    payload: ClientMoveIntentPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("MOVE"),
    requestId: z.string().optional(),
    payload: z.object({
      from: SquareSchema,
      to: SquareSchema,
      promotion: PromotionPieceSchema.optional(),
      expectedPly: z.number().int().nonnegative().optional().default(0),
    }),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("DRAW_OFFER"),
    requestId: z.string().optional(),
    payload: ClientDrawOfferPayloadSchema.default({}),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("DRAW_RESPONSE"),
    requestId: z.string().optional(),
    payload: ClientDrawResponsePayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("OFFER_DRAW"),
    payload: z.any().optional().default({}),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("RESPOND_DRAW"),
    accept: z.boolean().optional(),
    payload: z.any().optional().default({}),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("RESIGN"),
    requestId: z.string().optional(),
    payload: ClientResignPayloadSchema.optional().default({}),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("TAKEBACK_REQUEST"),
    requestId: z.string().optional(),
    payload: ClientTakebackRequestPayloadSchema.default({}),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("TAKEBACK_RESPONSE"),
    requestId: z.string().optional(),
    payload: ClientTakebackResponsePayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("HEARTBEAT_PING"),
    requestId: z.string().optional(),
    payload: ClientHeartbeatPingPayloadSchema.default({}),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("PING"),
    timestamp: z.number(),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("REQUEST_REMATCH"),
    payload: z.any().optional(),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("RESPOND_REMATCH"),
    accept: z.boolean(),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("CHAT_SEND"),
    text: z.string(),
  }),
]);

export type ClientGameFrame = z.input<typeof ClientGameFrameSchema>;
export type ClientGameFrameOutput = z.output<typeof ClientGameFrameSchema>;

// ============================================================================
// 2. Server -> Client Frames (/ws/game/:gameId)
// ============================================================================

export const ServerGameSnapshotPayloadSchema = z.object({
  gameId: z.string(),
  fen: z.string(),
  pgn: z.string().optional().default(""),
  moves: z.array(z.string()), // SAN moves
  turn: z.enum(["w", "b"]),
  ply: z.number().int().nonnegative().optional().default(0),
  status: GameStatusSchema,
  white: PlayerInfoSchema.nullable().optional(),
  black: PlayerInfoSchema.nullable().optional(),
  whiteUserId: z.string().nullable().optional(),
  blackUserId: z.string().nullable().optional(),
  whiteMs: z.number().int().nonnegative(),
  blackMs: z.number().int().nonnegative(),
  initialMs: z.number().int().positive().optional().default(180000),
  incrementMs: z.number().int().nonnegative().optional().default(2000),
  rated: z.boolean().optional().default(true),
  isFriendGame: z.boolean().optional().default(false),
  canTakeback: z.boolean().optional().default(false),
  drawOfferedBy: z.enum(["white", "black"]).nullable().optional(),
  takebackOfferedBy: z.enum(["white", "black"]).nullable().optional(),
  lastMoveTimestamp: z.number().nullable().optional(),
  turnStartedAt: z.number().nullable().optional(),
  disconnectGraceRemainingMs: z.number().int().nonnegative().optional(),
  whiteConnected: z.boolean().optional().default(true),
  blackConnected: z.boolean().optional().default(true),
  spectatorCount: z.number().optional().default(0),
  result: z.enum(["1-0", "0-1", "1/2-1/2", "aborted"]).optional(),
  termination: z.string().optional(),
  winner: z.enum(["white", "black"]).optional(),
});

export const ServerMoveAcceptedPayloadSchema = z.object({
  san: z.string(),
  uci: z.string().optional().default(""),
  from: SquareSchema,
  to: SquareSchema,
  promotion: PromotionPieceSchema.optional(),
  fen: z.string(),
  ply: z.number().int().nonnegative().optional().default(1),
  whiteMs: z.number().int().nonnegative(),
  blackMs: z.number().int().nonnegative(),
  turn: z.enum(["w", "b"]),
  lastMoveTimestamp: z.number().optional(),
  lagCreditMs: z.number().nonnegative().optional(),
});

export const ServerMoveRejectedPayloadSchema = z.object({
  reason: z.string(),
  expectedPly: z.number().int().nonnegative(),
  currentFen: z.string(),
});

export const ServerDrawOfferedPayloadSchema = z.object({
  fromRole: z.enum(["white", "black"]).optional(),
  from: z.enum(["white", "black"]).optional(),
});

export const ServerDrawDeclinedPayloadSchema = z.object({
  byRole: z.enum(["white", "black"]).optional(),
});

export const ServerTakebackOfferedPayloadSchema = z.object({
  fromRole: z.enum(["white", "black"]),
});

export const ServerTakebackResolvedPayloadSchema = z.object({
  accepted: z.boolean(),
  fen: z.string().optional(),
  ply: z.number().int().nonnegative().optional(),
  whiteMs: z.number().int().nonnegative().optional(),
  blackMs: z.number().int().nonnegative().optional(),
});

export const ServerOpponentPresencePayloadSchema = z.object({
  role: z.enum(["white", "black"]),
  status: z.enum(["connected", "disconnected"]),
  gracePeriodRemainingMs: z.number().int().nonnegative().optional(),
});

export const ServerGameTerminatedPayloadSchema = z.object({
  result: GameResultSchema,
  termination: z.string(),
  winnerRole: z.enum(["white", "black"]).optional(),
  winner: z.enum(["white", "black"]).optional(),
  whiteRatingBefore: z.number().optional(),
  whiteRatingAfter: z.number().optional(),
  whiteRatingDiff: z.number().optional(),
  blackRatingBefore: z.number().optional(),
  blackRatingAfter: z.number().optional(),
  blackRatingDiff: z.number().optional(),
});

export const ServerHeartbeatPongPayloadSchema = z.object({
  clientSeq: z.number().optional(),
});

export const ServerErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
});

// Discriminated union of server game messages
export const ServerGameFrameSchema = z.discriminatedUnion("type", [
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("GAME_SNAPSHOT"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerGameSnapshotPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("GAME_SYNC"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerGameSnapshotPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("MOVE_ACCEPTED"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerMoveAcceptedPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("MOVE_MADE"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerMoveAcceptedPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("MOVE_REJECTED"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerMoveRejectedPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("DRAW_OFFERED"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    from: z.enum(["white", "black"]).optional(),
    payload: ServerDrawOfferedPayloadSchema.optional(),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("DRAW_DECLINED"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerDrawDeclinedPayloadSchema.optional(),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("TAKEBACK_OFFERED"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerTakebackOfferedPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("TAKEBACK_RESOLVED"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerTakebackResolvedPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("OPPONENT_PRESENCE"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerOpponentPresencePayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("PLAYER_DISCONNECTED"),
    role: z.enum(["white", "black"]),
    gracePeriodMs: z.number(),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("PLAYER_RECONNECTED"),
    role: z.enum(["white", "black"]),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("GAME_TERMINATED"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerGameTerminatedPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("GAME_ENDED"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerGameTerminatedPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("HEARTBEAT_PONG"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerHeartbeatPongPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("PONG"),
    timestamp: z.number(),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("REMATCH_OFFERED"),
    from: z.enum(["white", "black"]),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("REMATCH_DECLINED"),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("CHAT_MESSAGE"),
    id: z.string(),
    sender: z.string(),
    senderRole: z.enum(["white", "black", "spectator"]),
    text: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("ERROR"),
    requestId: z.string().optional(),
    code: z.string().optional(),
    message: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerErrorPayloadSchema.optional(),
  }),
]);

export type ServerGameFrame = z.input<typeof ServerGameFrameSchema>;
export type ServerGameFrameOutput = z.output<typeof ServerGameFrameSchema>;

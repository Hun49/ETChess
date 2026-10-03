import { z } from "zod";
import { PROTOCOL_VERSION } from "./gameMessages";

// ============================================================================
// 1. Client -> Server Frames (/ws/user)
// ============================================================================

export const ClientUserAuthPayloadSchema = z.object({
  ticket: z.string().min(1),
});

export const ClientQueueJoinPayloadSchema = z.object({
  timeControlId: z.string().min(1),
  rated: z.boolean(),
});

export const ClientQueueLeavePayloadSchema = z.object({});

export const ClientUserPingPayloadSchema = z.object({
  clientSeq: z.number().optional(),
});

export const ClientUserFrameSchema = z.discriminatedUnion("type", [
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("AUTH"),
    requestId: z.string().optional(),
    payload: ClientUserAuthPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("QUEUE_JOIN"),
    requestId: z.string().optional(),
    payload: ClientQueueJoinPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("JOIN_QUEUE"),
    requestId: z.string().optional(),
    payload: z.object({
      timeControl: z.string().optional(),
      timeControlId: z.string().optional(),
      rated: z.boolean(),
    }),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("QUEUE_LEAVE"),
    requestId: z.string().optional(),
    payload: ClientQueueLeavePayloadSchema.default({}),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("LEAVE_QUEUE"),
    requestId: z.string().optional(),
    payload: z.any().optional().default({}),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("HEARTBEAT_PING"),
    requestId: z.string().optional(),
    payload: ClientUserPingPayloadSchema.default({}),
  }),
]);

export type ClientUserFrame = z.input<typeof ClientUserFrameSchema>;
export type ClientUserFrameOutput = z.output<typeof ClientUserFrameSchema>;

// ============================================================================
// 2. Server -> Client Frames (/ws/user)
// ============================================================================

export const ServerQueueStatusPayloadSchema = z.object({
  status: z.enum(["queued", "idle"]),
  timeControlId: z.string().optional(),
  rated: z.boolean().optional(),
  queueTimeMs: z.number().int().nonnegative().optional(),
  searchRange: z
    .object({
      min: z.number(),
      max: z.number(),
    })
    .optional(),
});

export const ServerMatchFoundPayloadSchema = z.object({
  gameId: z.string(),
  timeControlId: z.string().optional(),
  timeControl: z.string().optional(),
  rated: z.boolean().optional(),
  assignedColor: z.enum(["white", "black"]).optional(),
  color: z.enum(["white", "black"]).optional(),
  opponent: z.object({
    id: z.string(),
    name: z.string(),
    rating: z.number(),
    image: z.string().nullable().optional(),
  }),
});

export const ServerChallengeReceivedPayloadSchema = z.object({
  challengeId: z.string(),
  challenger: z.object({
    id: z.string(),
    name: z.string(),
    rating: z.number(),
    image: z.string().nullable().optional(),
  }),
  timeControlId: z.string(),
  rated: z.boolean(),
  preferredColor: z.enum(["white", "black", "random"]),
  expiresAt: z.number(),
});

export const ServerChallengeDeclinedPayloadSchema = z.object({
  challengeId: z.string(),
  reason: z.string().optional(),
});

export const ServerChallengeAcceptedPayloadSchema = z.object({
  challengeId: z.string(),
  gameId: z.string(),
});

export const ServerChallengeExpiredPayloadSchema = z.object({
  challengeId: z.string(),
});

export const ServerUserHeartbeatPongPayloadSchema = z.object({
  clientSeq: z.number().optional(),
});

export const ServerUserErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const ServerUserFrameSchema = z.discriminatedUnion("type", [
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("QUEUE_STATUS"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerQueueStatusPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("QUEUE_JOINED"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: z
      .object({
        timeControl: z.string().optional(),
        timeControlId: z.string().optional(),
        rated: z.boolean().optional(),
      })
      .optional()
      .default({}),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("QUEUE_LEFT"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: z.any().optional().default({}),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("QUEUE_ERROR"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    message: z.string().optional(),
    payload: z.any().optional(),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("MATCH_FOUND"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerMatchFoundPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("CHALLENGE_RECEIVED"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerChallengeReceivedPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("CHALLENGE_DECLINED"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerChallengeDeclinedPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("CHALLENGE_ACCEPTED"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerChallengeAcceptedPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("CHALLENGE_EXPIRED"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerChallengeExpiredPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("HEARTBEAT_PONG"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerUserHeartbeatPongPayloadSchema,
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
    type: z.literal("ERROR"),
    requestId: z.string().optional(),
    serverTime: z
      .number()
      .optional()
      .default(() => Date.now()),
    payload: ServerUserErrorPayloadSchema,
  }),
]);

export type ServerUserFrame = z.input<typeof ServerUserFrameSchema>;
export type ServerUserFrameOutput = z.output<typeof ServerUserFrameSchema>;

import { z } from "zod";

const TimeControlEnum = z.enum([
  "1+0",
  "2+0",
  "3+0",
  "3+2",
  "5+0",
  "5+3",
  "10+0",
  "10+5",
  "15+10",
  "30+0",
]);

// ==========================================
// Matchmaker Client -> Server
// ==========================================

export const ClientJoinQueueSchema = z.object({
  type: z.literal("JOIN_QUEUE"),
  payload: z.object({
    timeControl: TimeControlEnum,
    rated: z.boolean(),
  }),
});

export const ClientLeaveQueueSchema = z.object({
  type: z.literal("LEAVE_QUEUE"),
});

export const ClientMatchmakerFrameSchema = z.discriminatedUnion("type", [
  ClientJoinQueueSchema,
  ClientLeaveQueueSchema,
]);

export type ClientMatchmakerFrame = z.infer<typeof ClientMatchmakerFrameSchema>;

// ==========================================
// Matchmaker Server -> Client
// ==========================================

export const ServerQueueJoinedSchema = z.object({
  type: z.literal("QUEUE_JOINED"),
  payload: z.object({
    timeControl: TimeControlEnum,
    rated: z.boolean(),
  }),
});

export const ServerMatchFoundSchema = z.object({
  type: z.literal("MATCH_FOUND"),
  payload: z.object({
    gameId: z.string().uuid(),
    color: z.enum(["white", "black"]),
    opponent: z.object({
      id: z.string(),
      name: z.string(),
      rating: z.number(),
    }),
  }),
});

export const ServerQueueLeftSchema = z.object({
  type: z.literal("QUEUE_LEFT"),
});

export const ServerQueueErrorSchema = z.object({
  type: z.literal("QUEUE_ERROR"),
  message: z.string(),
});

export const ServerMatchmakerFrameSchema = z.discriminatedUnion("type", [
  ServerQueueJoinedSchema,
  ServerMatchFoundSchema,
  ServerQueueLeftSchema,
  ServerQueueErrorSchema,
]);

export type ServerMatchmakerFrame = z.infer<typeof ServerMatchmakerFrameSchema>;

import {
  type ClientGameFrame,
  type ClientGameFrameOutput,
  ClientGameFrameSchema,
  type ServerGameFrame,
  type ServerGameFrameOutput,
  ServerGameFrameSchema,
} from "./gameMessages";
import {
  type ClientUserFrame,
  type ClientUserFrameOutput,
  ClientUserFrameSchema,
  type ServerUserFrame,
  type ServerUserFrameOutput,
  ServerUserFrameSchema,
} from "./userMessages";

export * from "./gameMessages";
export * from "./userMessages";

/**
 * Backward-compatibility aliases for user channel frames during migration
 */
export type ClientMatchmakerFrame = ClientUserFrame;
export type ServerMatchmakerFrame = ServerUserFrame;
export const parseClientMatchmakerFrame = parseClientUserFrame;
export const parseServerMatchmakerFrame = parseServerUserFrame;

/**
 * Safely parses a raw string or JSON into a valid ClientGameFrame.
 */
export function parseClientGameFrame(
  data: unknown,
): { success: true; data: ClientGameFrameOutput } | { success: false; error: string } {
  try {
    const raw = typeof data === "string" ? JSON.parse(data) : data;
    const parsed = ClientGameFrameSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }
    return { success: true, data: parsed.data };
  } catch {
    return { success: false, error: "Invalid JSON format" };
  }
}

/**
 * Safely parses a raw string or JSON into a valid ServerGameFrame.
 */
export function parseServerGameFrame(
  data: unknown,
): { success: true; data: ServerGameFrameOutput } | { success: false; error: string } {
  try {
    const raw = typeof data === "string" ? JSON.parse(data) : data;
    const parsed = ServerGameFrameSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }
    return { success: true, data: parsed.data };
  } catch {
    return { success: false, error: "Invalid JSON format" };
  }
}

/**
 * Safely parses a raw string or JSON into a valid ClientUserFrame.
 */
export function parseClientUserFrame(
  data: unknown,
): { success: true; data: ClientUserFrameOutput } | { success: false; error: string } {
  try {
    const raw = typeof data === "string" ? JSON.parse(data) : data;
    const parsed = ClientUserFrameSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }
    return { success: true, data: parsed.data };
  } catch {
    return { success: false, error: "Invalid JSON format" };
  }
}

/**
 * Safely parses a raw string or JSON into a valid ServerUserFrame.
 */
export function parseServerUserFrame(
  data: unknown,
): { success: true; data: ServerUserFrameOutput } | { success: false; error: string } {
  try {
    const raw = typeof data === "string" ? JSON.parse(data) : data;
    const parsed = ServerUserFrameSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }
    return { success: true, data: parsed.data };
  } catch {
    return { success: false, error: "Invalid JSON format" };
  }
}

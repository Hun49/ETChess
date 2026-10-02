import {
  type ClientGameFrame,
  ClientGameFrameSchema,
  type ServerGameFrame,
  ServerGameFrameSchema,
} from "./gameMessages";
import {
  type ClientMatchmakerFrame,
  ClientMatchmakerFrameSchema,
  type ServerMatchmakerFrame,
  ServerMatchmakerFrameSchema,
} from "./matchmakerMessages";

export * from "./gameMessages";
export * from "./matchmakerMessages";

/**
 * Safely parses a raw string or JSON into a valid ClientGameFrame.
 */
export function parseClientGameFrame(
  data: unknown,
): { success: true; data: ClientGameFrame } | { success: false; error: string } {
  try {
    const raw = typeof data === "string" ? JSON.parse(data) : data;
    const parsed = ClientGameFrameSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }
    return { success: true, data: parsed.data };
  } catch (err) {
    return { success: false, error: "Invalid JSON format" };
  }
}

/**
 * Safely parses a raw string or JSON into a valid ServerGameFrame.
 */
export function parseServerGameFrame(
  data: unknown,
): { success: true; data: ServerGameFrame } | { success: false; error: string } {
  try {
    const raw = typeof data === "string" ? JSON.parse(data) : data;
    const parsed = ServerGameFrameSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }
    return { success: true, data: parsed.data };
  } catch (err) {
    return { success: false, error: "Invalid JSON format" };
  }
}

/**
 * Safely parses a raw string or JSON into a valid ClientMatchmakerFrame.
 */
export function parseClientMatchmakerFrame(
  data: unknown,
): { success: true; data: ClientMatchmakerFrame } | { success: false; error: string } {
  try {
    const raw = typeof data === "string" ? JSON.parse(data) : data;
    const parsed = ClientMatchmakerFrameSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }
    return { success: true, data: parsed.data };
  } catch (err) {
    return { success: false, error: "Invalid JSON format" };
  }
}

/**
 * Safely parses a raw string or JSON into a valid ServerMatchmakerFrame.
 */
export function parseServerMatchmakerFrame(
  data: unknown,
): { success: true; data: ServerMatchmakerFrame } | { success: false; error: string } {
  try {
    const raw = typeof data === "string" ? JSON.parse(data) : data;
    const parsed = ServerMatchmakerFrameSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }
    return { success: true, data: parsed.data };
  } catch (err) {
    return { success: false, error: "Invalid JSON format" };
  }
}

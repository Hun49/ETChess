import type { ServerUserFrame } from "@etchess/realtime-protocol";
import type { Env } from "../types";

/**
 * Delivers a real-time ServerUserFrame to a user's active WebSocket connection
 * via the MatchmakerDO user channel.
 */
export async function notifyUserChannel(
  env: Env,
  userId: string,
  frame: ServerUserFrame,
): Promise<void> {
  try {
    const id = env.MATCHMAKER_DO.idFromName("global");
    const stub = env.MATCHMAKER_DO.get(id);
    await stub.fetch("http://internal/notify-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, frame }),
    });
  } catch (err) {
    console.error("Failed to notify user channel:", err);
  }
}

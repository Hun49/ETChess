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
  // 1. Deliver to UserPresenceDO if available (B4-PRES-04)
  if (env.USER_PRESENCE_DO) {
    try {
      const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(userId));
      await upStub.fetch("http://internal/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frame }),
      });
    } catch (err) {
      console.error("Failed to notify UserPresenceDO:", err);
    }
  }

  // 2. Deliver to global MatchmakerDO for backward compatibility with active sockets
  if (env.MATCHMAKER_DO) {
    try {
      const id = env.MATCHMAKER_DO.idFromName("global");
      const stub = env.MATCHMAKER_DO.get(id);
      await stub.fetch("http://internal/notify-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, frame }),
      });
    } catch (err) {
      console.error("Failed to notify MatchmakerDO:", err);
    }
  }
}

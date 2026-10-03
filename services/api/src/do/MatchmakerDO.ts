import { DurableObject } from "cloudflare:workers";
import {
  type ClientMatchmakerFrame,
  type ServerMatchmakerFrame,
  parseClientMatchmakerFrame,
} from "@etchess/realtime-protocol";
import type { TimeControlKey } from "@etchess/types";
import type { Env } from "../types";

interface QueuedPlayer {
  userId: string;
  userName: string;
  rating: number;
  timeControl: TimeControlKey;
  rated: boolean;
  joinedAt: number;
  ws: WebSocket;
}

interface MatchmakerAttachment {
  userId: string;
  userName: string;
  rating: number;
}

export class MatchmakerDO extends DurableObject<Env> {
  private queue: QueuedPlayer[] = [];

  private send(ws: WebSocket, frame: ServerMatchmakerFrame): void {
    try {
      ws.send(JSON.stringify(frame));
    } catch {
      // Socket dead
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      const userId = url.searchParams.get("userId") || crypto.randomUUID();
      const userName = url.searchParams.get("userName") || "Guest";
      const rating = Number.parseInt(url.searchParams.get("rating") || "1500", 10);

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      const attachment: MatchmakerAttachment = { userId, userName, rating };
      this.ctx.acceptWebSocket(server, [userId]);
      server.serializeAttachment(attachment);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    if (url.pathname.endsWith("/queue-status")) {
      return Response.json({
        totalInQueue: this.queue.length,
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = ws.deserializeAttachment() as MatchmakerAttachment | null;
    if (!attachment) return;

    const parsed = parseClientMatchmakerFrame(message);
    if (!parsed.success) {
      this.send(ws, {
        type: "QUEUE_ERROR",
        message: parsed.error,
      });
      return;
    }

    const frame: ClientMatchmakerFrame = parsed.data;

    switch (frame.type) {
      case "JOIN_QUEUE": {
        const { timeControl, rated } = frame.payload;

        // Remove any existing queue entries for this user
        this.queue = this.queue.filter((p) => p.userId !== attachment.userId && p.ws !== ws);

        const now = Date.now();
        const candidateIndex = this.queue.findIndex((p) => {
          if (
            p.timeControl !== timeControl ||
            p.rated !== rated ||
            p.userId === attachment.userId
          ) {
            return false;
          }
          // Rating window starts at 150 and expands by 50 every 10 seconds
          const secondsWaiting = (now - p.joinedAt) / 1000;
          const allowedDiff = 150 + Math.floor(secondsWaiting / 10) * 50;
          return Math.abs(p.rating - attachment.rating) <= allowedDiff;
        });

        if (candidateIndex !== -1) {
          const opponent = this.queue.splice(candidateIndex, 1)[0];
          const gameId = crypto.randomUUID();
          const isUserWhite = Math.random() < 0.5;

          const whitePlayer = isUserWhite ? attachment : opponent;
          const blackPlayer = isUserWhite ? opponent : attachment;

          // Pre-initialize GameRoomDO
          try {
            const roomDO = this.env.GAME_ROOM_DO.get(this.env.GAME_ROOM_DO.idFromName(gameId));
            await roomDO.fetch("http://internal/init", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                gameId,
                whiteUserId: whitePlayer.userId,
                whiteUserName: whitePlayer.userName,
                blackUserId: blackPlayer.userId,
                blackUserName: blackPlayer.userName,
                timeControl,
                rated,
              }),
            });
          } catch (err) {
            console.error("Failed to pre-initialize GameRoomDO:", err);
          }

          // Send MATCH_FOUND to current player
          this.send(ws, {
            type: "MATCH_FOUND",
            payload: {
              gameId,
              color: isUserWhite ? "white" : "black",
              opponent: {
                id: opponent.userId,
                name: opponent.userName,
                rating: opponent.rating,
              },
            },
          });

          // Send MATCH_FOUND to opponent
          this.send(opponent.ws, {
            type: "MATCH_FOUND",
            payload: {
              gameId,
              color: isUserWhite ? "black" : "white",
              opponent: {
                id: attachment.userId,
                name: attachment.userName,
                rating: attachment.rating,
              },
            },
          });
        } else {
          // Add to queue
          this.queue.push({
            userId: attachment.userId,
            userName: attachment.userName,
            rating: attachment.rating,
            timeControl: (timeControl || "3+2") as TimeControlKey,
            rated,
            joinedAt: now,
            ws,
          });

          this.send(ws, {
            type: "QUEUE_JOINED",
            payload: {
              timeControl,
              rated,
            },
          });
        }
        break;
      }

      case "LEAVE_QUEUE": {
        this.queue = this.queue.filter((p) => p.userId !== attachment.userId && p.ws !== ws);
        this.send(ws, { type: "QUEUE_LEFT" });
        break;
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.queue = this.queue.filter((p) => p.ws !== ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.queue = this.queue.filter((p) => p.ws !== ws);
  }
}

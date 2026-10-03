import { DurableObject } from "cloudflare:workers";
import { shouldRefuseRatedPair } from "@etchess/rating";
import {
  type ClientUserFrame,
  PROTOCOL_VERSION,
  type ServerUserFrame,
  parseClientUserFrame,
} from "@etchess/realtime-protocol";
import {
  PRODUCT_RULES,
  type RatingCategory,
  TIME_CONTROLS,
  type TimeControlKey,
  WS_CLOSE_CODES,
  getRatingCategory,
} from "@etchess/types";
import { and, eq, gt, isNotNull, or } from "drizzle-orm";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { MetricsCollector } from "../lib/observability";
import { TicketReplayGuard, verifyWsTicket } from "../lib/wsTicket";
import type { Env } from "../types";

export interface QueuedPlayer {
  userId: string;
  userName: string;
  rating: number;
  timeControlId: TimeControlKey;
  category: RatingCategory;
  rated: boolean;
  joinedAt: number;
  lastStatusSentAt: number;
}

interface UserSocketAttachment {
  userId?: string;
  userName?: string;
  rating?: number;
  authenticated: boolean;
}

export class MatchmakerDO extends DurableObject<Env> {
  private queue: QueuedPlayer[] | null = null;
  private replayGuard = new TicketReplayGuard();

  private async loadQueue(): Promise<QueuedPlayer[]> {
    if (!this.queue) {
      this.queue = (await this.ctx.storage.get<QueuedPlayer[]>("queue")) ?? [];
    }
    return this.queue;
  }

  /**
   * "Durable before visible": persists queue state before notifying clients.
   */
  private async persistQueue(): Promise<void> {
    if (!this.queue) return;
    await this.ctx.storage.put("queue", this.queue);
    await this.syncAlarm();
  }

  private async syncAlarm(): Promise<void> {
    if (!this.queue || this.queue.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const currentAlarm = await this.ctx.storage.getAlarm();
    if (!currentAlarm) {
      // Schedule sweep every 1000ms when queue active
      await this.ctx.storage.setAlarm(Date.now() + 1000);
    }
  }

  private send(ws: WebSocket, frame: ServerUserFrame): void {
    try {
      ws.send(JSON.stringify(frame));
    } catch {
      // Socket closing/closed
    }
  }

  private getSocketsForUser(userId: string): WebSocket[] {
    const sockets = this.ctx.getWebSockets();
    return sockets.filter((ws) => {
      const att = ws.deserializeAttachment() as UserSocketAttachment | null;
      return att?.authenticated && att.userId === userId;
    });
  }

  private sendToUser(userId: string, frame: ServerUserFrame): void {
    const userSockets = this.getSocketsForUser(userId);
    for (const ws of userSockets) {
      this.send(ws, frame);
    }
  }

  /**
   * Calculates dynamic search range (RULE-06):
   * Start: ±100 Elo, expanding +50 every 5s, capped at ±600 Elo.
   */
  private getSearchRange(
    player: QueuedPlayer,
    now: number,
  ): { range: number; min: number; max: number } {
    const elapsedMs = Math.max(0, now - player.joinedAt);
    const intervals = Math.floor(elapsedMs / PRODUCT_RULES.MATCHMAKING_WIDEN_INTERVAL_MS);
    const range = Math.min(
      PRODUCT_RULES.MATCHMAKING_START_RANGE + intervals * PRODUCT_RULES.MATCHMAKING_WIDEN_STEP,
      PRODUCT_RULES.MATCHMAKING_CAP_RANGE,
    );
    return {
      range,
      min: Math.max(0, player.rating - range),
      max: player.rating + range,
    };
  }

  /**
   * Counts rated games between a pair of players in a rolling 24-hour window (RULE-05).
   */
  private async getRecentRatedGamesCount(
    db: DrizzleD1Database<typeof schema>,
    userA: string,
    userB: string,
    sinceMs: number,
  ): Promise<number> {
    try {
      const since = new Date(sinceMs);
      const rows = await db
        .select({ id: schema.games.id })
        .from(schema.games)
        .where(
          and(
            gt(schema.games.startedAt, since),
            isNotNull(schema.games.whiteRatingChange),
            or(
              and(eq(schema.games.whitePlayerId, userA), eq(schema.games.blackPlayerId, userB)),
              and(eq(schema.games.whitePlayerId, userB), eq(schema.games.blackPlayerId, userA)),
            ),
          ),
        );
      return rows.length;
    } catch {
      return 0;
    }
  }

  /**
   * Sweeps queue and pairs compatible players.
   */
  private async sweepAndMatch(now: number): Promise<boolean> {
    const queue = await this.loadQueue();
    if (queue.length < 2) return false;

    const db = drizzle(this.env.DB, { schema });

    for (let i = 0; i < queue.length; i++) {
      const p1 = queue[i];
      const r1 = this.getSearchRange(p1, now);

      for (let j = i + 1; j < queue.length; j++) {
        const p2 = queue[j];

        // Criteria 1: Different users
        if (p1.userId === p2.userId) continue;

        // Criteria 2: Matching time control and rated flag
        if (p1.timeControlId !== p2.timeControlId || p1.rated !== p2.rated) {
          continue;
        }

        // Criteria 3: Mutual Elo window overlap
        const r2 = this.getSearchRange(p2, now);
        const ratingDiff = Math.abs(p1.rating - p2.rating);
        if (ratingDiff > r1.range || ratingDiff > r2.range) {
          continue;
        }

        // Criteria 4: RULE-05 Rated pair cap check (5 games in rolling 24h)
        if (p1.rated) {
          const recentCount = await this.getRecentRatedGamesCount(
            db,
            p1.userId,
            p2.userId,
            now - 86_400_000,
          );
          const refusal = shouldRefuseRatedPair({
            recentRatedGamesBetweenPairIn24h: recentCount,
          });
          if (refusal.refuse) {
            continue; // Skip pairing this pair
          }
        }

        // Compatible pair found! Remove both from queue
        queue.splice(j, 1);
        queue.splice(i, 1);
        await this.persistQueue();

        await this.executeMatchFound(p1, p2);
        return true; // Match formed, queue modified
      }
    }

    return false;
  }

  /**
   * Pre-initializes GameSessionDO and dispatches MATCH_FOUND to both players.
   */
  private async executeMatchFound(p1: QueuedPlayer, p2: QueuedPlayer): Promise<void> {
    const gameId = crypto.randomUUID();
    const isP1White = Math.random() < 0.5;

    const white = isP1White ? p1 : p2;
    const black = isP1White ? p2 : p1;

    // 1. Pre-initialize GameSessionDO
    try {
      const ns = this.env.GAME_SESSION_DO || this.env.GAME_ROOM_DO;
      const sessionStub = ns.get(ns.idFromName(gameId));
      await sessionStub.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          whiteUserId: white.userId,
          whiteUserName: white.userName,
          whiteRating: white.rating,
          blackUserId: black.userId,
          blackUserName: black.userName,
          blackRating: black.rating,
          timeControl: white.timeControlId,
          rated: white.rated,
        }),
      });
    } catch (err) {
      console.error("Failed to pre-initialize GameSessionDO:", err);
    }

    const now = Date.now();

    // 2. Dispatch MATCH_FOUND to p1
    this.sendToUser(p1.userId, {
      v: PROTOCOL_VERSION,
      type: "MATCH_FOUND",
      serverTime: now,
      payload: {
        gameId,
        timeControlId: p1.timeControlId,
        timeControl: p1.timeControlId,
        rated: p1.rated,
        assignedColor: isP1White ? "white" : "black",
        color: isP1White ? "white" : "black",
        opponent: {
          id: p2.userId,
          name: p2.userName,
          rating: p2.rating,
        },
      },
    });

    // 3. Dispatch MATCH_FOUND to p2
    this.sendToUser(p2.userId, {
      v: PROTOCOL_VERSION,
      type: "MATCH_FOUND",
      serverTime: now,
      payload: {
        gameId,
        timeControlId: p2.timeControlId,
        timeControl: p2.timeControlId,
        rated: p2.rated,
        assignedColor: isP1White ? "black" : "white",
        color: isP1White ? "black" : "white",
        opponent: {
          id: p1.userId,
          name: p1.userName,
          rating: p1.rating,
        },
      },
    });

    // 4. Record wait time metrics
    MetricsCollector.matchmakerWaitMs(now - p1.joinedAt, { timeControl: p1.timeControlId });
    MetricsCollector.matchmakerWaitMs(now - p2.joinedAt, { timeControl: p2.timeControlId });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 1. WebSocket Upgrade (/ws/user or /ws/matchmaker)
    if (request.headers.get("Upgrade") === "websocket") {
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      const ticketQuery = url.searchParams.get("ticket");

      const attachment: UserSocketAttachment = {
        authenticated: false,
      };

      this.ctx.acceptWebSocket(server);
      server.serializeAttachment(attachment);

      // If ticket provided in query, verify immediately
      if (ticketQuery) {
        await this.authenticateSocket(server, ticketQuery);
      }

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // 2. Queue Status HTTP Endpoint
    if (url.pathname.endsWith("/queue-status") || url.pathname.endsWith("/status")) {
      const queue = await this.loadQueue();
      return Response.json({
        totalInQueue: queue.length,
        players: queue.map((p) => ({
          userId: p.userId,
          rating: p.rating,
          timeControl: p.timeControlId,
          category: p.category,
          waitingSeconds: Math.floor((Date.now() - p.joinedAt) / 1000),
        })),
      });
    }

    // 3. Clear Queue Endpoint (For integration testing)
    if (url.pathname.endsWith("/clear") && request.method === "POST") {
      this.queue = [];
      await this.persistQueue();
      return Response.json({ cleared: true });
    }

    return new Response("Not Found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = ws.deserializeAttachment() as UserSocketAttachment | null;
    if (!attachment) return;

    const parsed = parseClientUserFrame(message);
    if (!parsed.success) {
      this.send(ws, {
        v: PROTOCOL_VERSION,
        type: "ERROR",
        serverTime: Date.now(),
        payload: {
          code: "VALIDATION_FAILED",
          message: parsed.error,
        },
      });
      return;
    }

    const frame: ClientUserFrame = parsed.data;

    // 1. Handle AUTH frame
    if (frame.type === "AUTH") {
      await this.authenticateSocket(ws, frame.payload.ticket);
      return;
    }

    // All subsequent frames require authentication
    if (!attachment.authenticated || !attachment.userId) {
      ws.close(WS_CLOSE_CODES.UNAUTHORIZED, "Unauthenticated");
      return;
    }

    // 2. Handle User Channel Frames
    switch (frame.type) {
      case "QUEUE_JOIN":
      case "JOIN_QUEUE": {
        const payload = frame.payload;
        const timeControlId = (
          "timeControlId" in payload
            ? payload.timeControlId
            : "timeControl" in payload
              ? payload.timeControl
              : "3+2"
        ) as TimeControlKey;

        const rated = !!payload.rated;
        const category = getRatingCategory(timeControlId);

        const queue = await this.loadQueue();

        // Evict any existing queue entries for this user
        this.queue = queue.filter((p) => p.userId !== attachment.userId);

        const now = Date.now();
        const queuedPlayer: QueuedPlayer = {
          userId: attachment.userId,
          userName: attachment.userName || "Player",
          rating: attachment.rating ?? 1500,
          timeControlId,
          category,
          rated,
          joinedAt: now,
          lastStatusSentAt: now,
        };

        this.queue.push(queuedPlayer);
        await this.persistQueue();

        const searchRange = this.getSearchRange(queuedPlayer, now);

        // Acknowledge QUEUE_JOINED and send initial QUEUE_STATUS
        this.send(ws, {
          v: PROTOCOL_VERSION,
          type: "QUEUE_JOINED",
          serverTime: now,
          payload: {
            timeControlId,
            timeControl: timeControlId,
            rated,
          },
        });

        this.send(ws, {
          v: PROTOCOL_VERSION,
          type: "QUEUE_STATUS",
          serverTime: now,
          payload: {
            status: "queued",
            timeControlId,
            rated,
            queueTimeMs: 0,
            searchRange: {
              min: searchRange.min,
              max: searchRange.max,
            },
          },
        });

        // Trigger immediate matching attempt
        await this.sweepAndMatch(now);
        break;
      }

      case "QUEUE_LEAVE":
      case "LEAVE_QUEUE": {
        const queue = await this.loadQueue();
        this.queue = queue.filter((p) => p.userId !== attachment.userId);
        await this.persistQueue();

        this.send(ws, {
          v: PROTOCOL_VERSION,
          type: "QUEUE_LEFT",
          serverTime: Date.now(),
        });

        this.send(ws, {
          v: PROTOCOL_VERSION,
          type: "QUEUE_STATUS",
          serverTime: Date.now(),
          payload: {
            status: "idle",
          },
        });
        break;
      }

      case "HEARTBEAT_PING": {
        const seq =
          "payload" in frame &&
          frame.payload &&
          typeof frame.payload === "object" &&
          "clientSeq" in frame.payload
            ? (frame.payload as { clientSeq?: number }).clientSeq
            : undefined;

        this.send(ws, {
          v: PROTOCOL_VERSION,
          type: "HEARTBEAT_PONG",
          serverTime: Date.now(),
          payload: { clientSeq: seq },
        });
        break;
      }
    }
  }

  private async authenticateSocket(ws: WebSocket, ticket: string): Promise<void> {
    const secret =
      this.env.BETTER_AUTH_SECRET || "development_better_auth_secret_key_minimum_32_characters";
    const verification = await verifyWsTicket(ticket, secret);

    if (!verification.valid) {
      ws.close(WS_CLOSE_CODES.UNAUTHORIZED, verification.reason || "Invalid ticket");
      return;
    }

    if (!this.replayGuard.consume(verification.payload.jti, verification.payload.exp)) {
      ws.close(WS_CLOSE_CODES.UNAUTHORIZED, "Ticket already used");
      return;
    }

    const payload = verification.payload;
    const attachment: UserSocketAttachment = {
      userId: payload.userId,
      userName: payload.userName,
      rating: payload.rating,
      authenticated: true,
    };

    ws.serializeAttachment(attachment);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as UserSocketAttachment | null;
    if (attachment?.userId) {
      const queue = await this.loadQueue();
      const initialLength = queue.length;
      this.queue = queue.filter((p) => p.userId !== attachment.userId);
      if (this.queue.length !== initialLength) {
        await this.persistQueue();
      }
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  /**
   * Alarms revalidate (Change 3):
   * Periodic queue sweep, range expansion, and 120s timeout eviction.
   */
  async alarm(): Promise<void> {
    const queue = await this.loadQueue();
    if (queue.length === 0) return;

    const now = Date.now();

    // 1. Evict players who exceeded 120-second queue timeout (RULE-06)
    const timedOut = queue.filter((p) => now - p.joinedAt >= PRODUCT_RULES.MATCHMAKING_TIMEOUT_MS);

    for (const player of timedOut) {
      this.sendToUser(player.userId, {
        v: PROTOCOL_VERSION,
        type: "QUEUE_STATUS",
        serverTime: now,
        payload: {
          status: "idle",
        },
      });

      this.sendToUser(player.userId, {
        v: PROTOCOL_VERSION,
        type: "ERROR",
        serverTime: now,
        payload: {
          code: "TIMEOUT",
          message: "Matchmaking search timed out after 120 seconds",
        },
      });
    }

    this.queue = queue.filter((p) => now - p.joinedAt < PRODUCT_RULES.MATCHMAKING_TIMEOUT_MS);

    // 2. Perform matchmaking sweep across expanding windows
    let matched = true;
    while (matched) {
      matched = await this.sweepAndMatch(now);
    }

    // 3. Send periodic QUEUE_STATUS updates with current range to waiting players
    for (const player of this.queue) {
      if (now - player.lastStatusSentAt >= PRODUCT_RULES.MATCHMAKING_WIDEN_INTERVAL_MS) {
        player.lastStatusSentAt = now;
        const searchRange = this.getSearchRange(player, now);

        this.sendToUser(player.userId, {
          v: PROTOCOL_VERSION,
          type: "QUEUE_STATUS",
          serverTime: now,
          payload: {
            status: "queued",
            timeControlId: player.timeControlId,
            rated: player.rated,
            queueTimeMs: now - player.joinedAt,
            searchRange: {
              min: searchRange.min,
              max: searchRange.max,
            },
          },
        });
      }
    }

    await this.persistQueue();
  }
}

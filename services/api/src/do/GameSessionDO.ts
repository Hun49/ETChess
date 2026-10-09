import { DurableObject } from "cloudflare:workers";
import {
  STARTING_FEN,
  applyTakeback,
  buildPgn,
  calculateClockAfterMove,
  canOfferTakeback,
  isClockRunningForPly,
  resolveTimeout,
  validateAndApplyMove,
} from "@etchess/chess-core";
import { applyGameResult } from "@etchess/rating";
import {
  type ClientGameFrame,
  PROTOCOL_VERSION,
  type ServerGameFrame,
  parseClientGameFrame,
} from "@etchess/realtime-protocol";
import {
  PRODUCT_RULES,
  type RatingCategory,
  TIME_CONTROLS,
  type TimeControlKey,
  getRatingCategory,
} from "@etchess/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { MetricsCollector } from "../lib/observability";
import {
  buildRatingUpdateSet,
  fetchUserCategoryRating,
  settleGameRatings,
} from "../lib/ratingStorage";
import { getWsTicketSecret } from "../lib/secrets";
import { TicketReplayGuard, verifyWsTicket } from "../lib/wsTicket";
import type { Env } from "../types";

export interface StoredTimer {
  kind:
    | "FIRST_MOVE_DEADLINE"
    | "CLOCK_FLAG"
    | "DISCONNECT_GRACE"
    | "AUTO_CLOSE"
    | "FINALIZE_RETRY"
    | "HEARTBEAT_WATCHDOG";
  dueAt: number;
  ply: number;
  version: number;
  role?: "white" | "black";
}

export interface PlayerSessionState {
  userId: string;
  userName: string;
  rating: number;
  rd?: number;
  vol?: number;
  connected: boolean;
  disconnectedAt?: number | null;
  rttMs?: number;
  lastHeartbeatAt?: number;
}

export interface StoredGameSessionState {
  version: number;
  ply: number;
  gameId: string;
  fen: string;
  initialFen?: string;
  pgn: string;
  turn: "w" | "b";
  status: "waiting" | "active" | "ended" | "aborted";
  whitePlayer: PlayerSessionState;
  blackPlayer: PlayerSessionState;
  timeControl: TimeControlKey;
  initialMs: number;
  incrementMs: number;
  category: RatingCategory;
  rated: boolean;
  isFriendGame: boolean;
  canTakeback: boolean;
  whiteMs: number;
  blackMs: number;
  lastMoveServerTime: number;
  isClockRunning: boolean;
  moves: string[]; // SAN moves
  drawOfferFrom?: "white" | "black" | null;
  drawOfferPly?: number | null;
  lastDrawOfferPlyWhite?: number | null;
  lastDrawOfferPlyBlack?: number | null;
  moveClockHistory?: Array<{ whiteMs: number; blackMs: number }>;
  takebackOfferFrom?: "white" | "black" | null;
  takebackOfferPly?: number | null;
  takebackOfferPlies?: 1 | 2;
  result?: "1-0" | "0-1" | "1/2-1/2" | "aborted";
  termination?: string;
  winnerRole?: "white" | "black";
  whiteRatingBefore?: number;
  whiteRatingAfter?: number;
  whiteRatingDiff?: number;
  whiteRdBefore?: number;
  whiteRdAfter?: number;
  whiteVolBefore?: number;
  whiteVolAfter?: number;
  blackRatingBefore?: number;
  blackRatingAfter?: number;
  blackRatingDiff?: number;
  blackRdBefore?: number;
  blackRdAfter?: number;
  blackVolBefore?: number;
  blackVolAfter?: number;
  startedAt: number;
  endedAt?: number;
  finalized: boolean;
  persistedToD1?: boolean;
  positionCounts?: Record<string, number>;
  terminalBroadcasted?: boolean;
}

interface SocketAttachment {
  userId: string;
  userName: string;
  role: "white" | "black" | "spectator";
  userRole?: string;
  authenticated: boolean;
  authTimeoutTimer?: number;
  lastHeartbeatAt?: number;
  measuredRttMs?: number;
  windowStartMs?: number;
  messageCountInWindow?: number;
  pendingPings?: Record<string, number>;
  // B5-CHAT-03: per-socket chat rate limiter (max 3 chat messages per 5 seconds)
  chatCountInWindow?: number;
  chatWindowStartMs?: number;
  chatMuted?: boolean;
}

export class GameSessionDO extends DurableObject<Env> {
  private state: StoredGameSessionState | null = null;
  private timers: StoredTimer[] = [];
  private replayGuard: TicketReplayGuard;
  private finalizationPromise: Promise<void> | null = null;
  private userMessageWindows: Map<string, { windowStartMs: number; count: number }> = new Map();
  private userChatWindows: Map<string, { windowStartMs: number; count: number }> = new Map();
  private blockedUsers: Set<string> = new Set();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.replayGuard = new TicketReplayGuard(ctx.storage);
  }

  private async loadState(): Promise<StoredGameSessionState | null> {
    if (!this.state) {
      this.state = (await this.ctx.storage.get<StoredGameSessionState>("gameState")) ?? null;
      this.timers = (await this.ctx.storage.get<StoredTimer[]>("timers")) ?? [];
    }
    return this.state;
  }

  /**
   * "Durable before visible" (Change 4):
   * Always persists state and timers to durable storage in a single atomic transaction before any broadcast.
   */
  private async persistState(): Promise<void> {
    if (!this.state) return;
    await this.ctx.storage.put({
      gameState: this.state,
      timers: this.timers,
    });
    await this.syncAlarm();
  }

  /**
   * Synchronizes the single Durable Object alarm to min(dueAt) of active timers (Change 3).
   */
  private async syncAlarm(): Promise<void> {
    if (this.timers.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const earliest = Math.min(...this.timers.map((t) => t.dueAt));
    await this.ctx.storage.setAlarm(earliest);
  }

  private addTimer(timer: StoredTimer): void {
    // Drop existing timer of the same kind and role to avoid duplicates
    this.timers = this.timers.filter((t) => !(t.kind === timer.kind && t.role === timer.role));
    this.timers.push(timer);
  }

  private removeTimer(predicate: (t: StoredTimer) => boolean): void {
    this.timers = this.timers.filter((t) => !predicate(t));
  }

  private send(ws: WebSocket, frame: ServerGameFrame): void {
    try {
      ws.send(JSON.stringify(frame));
    } catch {
      // Socket dead
    }
  }

  public sendServerPing(ws: WebSocket): string {
    const pingId = crypto.randomUUID();
    const att = ws.deserializeAttachment() as SocketAttachment | null;
    if (att) {
      att.pendingPings = att.pendingPings || {};
      att.pendingPings[pingId] = Date.now();
      ws.serializeAttachment(att);
    }
    this.send(ws, {
      v: PROTOCOL_VERSION,
      type: "PING",
      pingId,
      serverTime: Date.now(),
      payload: { pingId },
    });
    return pingId;
  }

  private broadcast(frame: ServerGameFrame): void {
    const json = JSON.stringify(frame);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const att = ws.deserializeAttachment() as SocketAttachment | null;
        if (!att || !att.authenticated) {
          continue; // Critical C3: Never broadcast game traffic to unauthenticated sockets!
        }
        ws.send(json);
      } catch {
        // Socket dead
      }
    }
  }

  private broadcastChat(frame: ServerGameFrame, senderUserId?: string): void {
    const json = JSON.stringify(frame);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const att = ws.deserializeAttachment() as SocketAttachment | null;
        if (!att || !att.authenticated) {
          continue;
        }
        if (att.chatMuted) {
          continue;
        }
        if (
          senderUserId &&
          att.userId &&
          (this.blockedUsers.has(`${att.userId}:${senderUserId}`) ||
            this.blockedUsers.has(`${senderUserId}:${att.userId}`))
        ) {
          continue;
        }
        ws.send(json);
      } catch {
        // Socket dead
      }
    }
  }

  private createSnapshotFrame(state: StoredGameSessionState): ServerGameFrame {
    return {
      v: PROTOCOL_VERSION,
      type: "GAME_SNAPSHOT",
      serverTime: Date.now(),
      payload: {
        gameId: state.gameId,
        fen: state.fen,
        pgn: state.pgn,
        moves: state.moves,
        turn: state.turn,
        ply: state.ply,
        status: state.status,
        white: {
          id: state.whitePlayer.userId,
          name: state.whitePlayer.userName,
          rating: state.whitePlayer.rating,
          connected: state.whitePlayer.connected,
        },
        black: {
          id: state.blackPlayer.userId,
          name: state.blackPlayer.userName,
          rating: state.blackPlayer.rating,
          connected: state.blackPlayer.connected,
        },
        whiteMs: state.whiteMs,
        blackMs: state.blackMs,
        initialMs: state.initialMs,
        incrementMs: state.incrementMs,
        rated: state.rated,
        isFriendGame: state.isFriendGame,
        canTakeback: state.canTakeback,
        result: state.result,
        termination: state.termination,
        winner: state.winnerRole,
      },
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 1. Internal HTTP Initialization Endpoint
    if (url.pathname.endsWith("/init") && request.method === "POST") {
      const body = (await request.json()) as {
        gameId: string;
        whiteUserId: string;
        whiteUserName: string;
        whiteRating?: number;
        whiteRd?: number;
        whiteVol?: number;
        blackUserId: string;
        blackUserName: string;
        blackRating?: number;
        blackRd?: number;
        blackVol?: number;
        timeControl: TimeControlKey;
        rated: boolean;
        isFriendGame?: boolean;
        initialFen?: string;
        initialPly?: number;
      };

      const existing = await this.loadState();
      if (existing) {
        return Response.json({ success: true, alreadyInitialized: true });
      }

      if (!body.timeControl || !(body.timeControl in TIME_CONTROLS)) {
        return Response.json(
          {
            error: {
              code: "INVALID_TIME_CONTROL",
              message: `Invalid or unsupported time control preset: ${body.timeControl}`,
            },
          },
          { status: 400 },
        );
      }

      const tc = TIME_CONTROLS[body.timeControl as TimeControlKey];
      const now = Date.now();
      const initialMs = tc.initialSeconds * 1000;
      const incrementMs = tc.incrementSeconds * 1000;
      const isFriend = !!body.isFriendGame;
      const initialFen = body.initialFen || STARTING_FEN;
      const initialTurn = initialFen.split(" ")[1] === "b" ? "b" : "w";
      const initialPly = body.initialPly ?? 0;

      const newState: StoredGameSessionState = {
        version: 1,
        ply: initialPly,
        gameId: body.gameId,
        fen: initialFen,
        initialFen: initialFen,
        pgn: "",
        turn: initialTurn,
        status: "active",
        whitePlayer: {
          userId: body.whiteUserId,
          userName: body.whiteUserName,
          rating: body.whiteRating ?? 1500,
          rd: body.whiteRd ?? PRODUCT_RULES.GLICKO2_DEFAULT_RD,
          vol: body.whiteVol ?? PRODUCT_RULES.GLICKO2_DEFAULT_VOLATILITY,
          connected: false,
        },
        blackPlayer: {
          userId: body.blackUserId,
          userName: body.blackUserName,
          rating: body.blackRating ?? 1500,
          rd: body.blackRd ?? PRODUCT_RULES.GLICKO2_DEFAULT_RD,
          vol: body.blackVol ?? PRODUCT_RULES.GLICKO2_DEFAULT_VOLATILITY,
          connected: false,
        },
        timeControl: body.timeControl,
        initialMs,
        incrementMs,
        category: tc.category,
        rated: body.rated,
        isFriendGame: isFriend,
        canTakeback: isFriend && !body.rated,
        whiteMs: initialMs,
        blackMs: initialMs,
        lastMoveServerTime: now,
        isClockRunning: initialPly >= 2,
        moves: [],
        positionCounts: { [initialFen.split(" ").slice(0, 4).join(" ")]: 1 },
        startedAt: now,
        finalized: false,
      };

      this.state = newState;
      this.timers = [];

      if (initialPly === 0) {
        // RULE-01: Schedule first-move deadline (30s for White)
        this.addTimer({
          kind: "FIRST_MOVE_DEADLINE",
          dueAt: now + PRODUCT_RULES.FIRST_MOVE_DEADLINE_MS,
          ply: 0,
          version: newState.version,
          role: "white",
        });
      } else if (initialPly === 1) {
        this.addTimer({
          kind: "FIRST_MOVE_DEADLINE",
          dueAt: now + PRODUCT_RULES.FIRST_MOVE_DEADLINE_MS,
          ply: 1,
          version: newState.version,
          role: "black",
        });
      } else {
        const activeMs = initialTurn === "w" ? initialMs : initialMs;
        this.addTimer({
          kind: "CLOCK_FLAG",
          dueAt: now + activeMs,
          ply: initialPly,
          version: newState.version,
          role: initialTurn === "w" ? "white" : "black",
        });
      }

      await this.persistState();
      MetricsCollector.gamesStarted({
        timeControl: body.timeControl,
        rated: body.rated,
      });

      return Response.json({ success: true, gameId: body.gameId });
    }

    // 2. HTTP State Query
    if (url.pathname.endsWith("/state")) {
      const state = await this.loadState();
      if (!state) return new Response("Game Not Found", { status: 404 });
      return Response.json(state);
    }

    // 3. HTTP Finalize Retry / Re-execution (for idempotency and retry test)
    if (url.pathname.endsWith("/retry-finalize") && request.method === "POST") {
      const state = await this.loadState();
      if (!state) return new Response("Game Not Found", { status: 404 });
      state.finalized = false;
      state.persistedToD1 = false;
      await this.finalizeGame();
      await this.persistState();
      return Response.json({ success: true, persistedToD1: state.persistedToD1 });
    }

    // 4. HTTP Game State Query (for admin live games inspector)
    if (url.pathname.endsWith("/state") && request.method === "GET") {
      const state = await this.loadState();
      if (!state) return new Response("Game Not Found", { status: 404 });
      return Response.json(state);
    }

    // 5. HTTP Admin Terminate Endpoint
    if (url.pathname.endsWith("/terminate") && request.method === "POST") {
      const state = await this.loadState();
      if (!state) return new Response("Game Not Found", { status: 404 });
      const body = (await request.json().catch(() => ({}))) as { reason?: string };

      if (state.status === "active") {
        state.status = "ended";
        state.result = "aborted";
        state.termination = "admin_intervention";
        state.winnerRole = undefined;
        await this.finalizeGame();
        await this.persistState();

        const termFrame: ServerGameFrame = {
          v: PROTOCOL_VERSION,
          type: "GAME_TERMINATED",
          payload: {
            result: "aborted",
            termination: "admin_intervention",
          },
        };
        this.broadcast(termFrame);
        for (const s of this.ctx.getWebSockets()) {
          try {
            s.close(1000, "Terminated by administrator");
          } catch {
            // ignore
          }
        }
      }
      return Response.json({ success: true, status: state.status });
    }

    // 6. Test Helper: Fast-forward / Expire Timers (for testing alarms deterministically)
    if (url.pathname.endsWith("/expire-timers") && request.method === "POST") {
      const now = Date.now();
      for (const t of this.timers) {
        t.dueAt = now - 1;
      }
      await this.ctx.storage.put("timers", this.timers);
      return Response.json({ success: true, expiredCount: this.timers.length });
    }

    // 6b. Test Helper: Send Server Ping (for server-authoritative RTT testing)
    if (url.pathname.endsWith("/send-ping") && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { role?: "white" | "black" };
      const role = body.role || "white";
      let pingId: string | null = null;
      for (const ws of this.ctx.getWebSockets()) {
        const att = ws.deserializeAttachment() as SocketAttachment | null;
        if (att?.authenticated && att.role === role) {
          pingId = this.sendServerPing(ws);
          break;
        }
      }
      return Response.json({ success: true, pingId });
    }

    // 6c. Test Helper: Reconstruct DO from storage (simulates DO eviction / reload)
    if (url.pathname.endsWith("/reconstruct") && request.method === "POST") {
      this.state = null;
      this.timers = [];
      const state = await this.loadState();
      return Response.json({ success: true, status: state?.status });
    }

    // 6d. Test Helper: Set FEN directly in DO state (for terminal testing)
    if (url.pathname.endsWith("/test-set-fen") && request.method === "POST") {
      const body = (await request.json()) as { fen: string; turn?: "w" | "b" };
      const state = await this.loadState();
      if (!state) return new Response("Not found", { status: 404 });
      state.fen = body.fen;
      if (body.turn) state.turn = body.turn;
      await this.persistState();
      return Response.json({ success: true, fen: state.fen });
    }

    // 6e. Test Helper: Set clock values directly in DO state (for timeout testing)
    if (url.pathname.endsWith("/test-set-clock") && request.method === "POST") {
      const body = (await request.json()) as { whiteMs?: number; blackMs?: number };
      const state = await this.loadState();
      if (!state) return new Response("Not found", { status: 404 });
      if (body.whiteMs != null) state.whiteMs = body.whiteMs;
      if (body.blackMs != null) state.blackMs = body.blackMs;
      if (
        (body.whiteMs === 0 && state.turn === "w") ||
        (body.blackMs === 0 && state.turn === "b")
      ) {
        const now = Date.now();
        for (const t of this.timers) {
          if (t.kind === "CLOCK_FLAG" || t.kind === "FIRST_MOVE_DEADLINE") {
            t.dueAt = now - 1;
          }
        }
      }
      await this.persistState();
      return Response.json({ success: true, whiteMs: state.whiteMs, blackMs: state.blackMs });
    }

    // 6f. Test Helper: Set status/finalized directly in DO state (for reconciliation testing)
    if (url.pathname.endsWith("/test-force-state") && request.method === "POST") {
      const body = (await request.json()) as {
        status?: "active" | "ended" | "aborted" | string;
        finalized?: boolean;
      };
      const state = await this.loadState();
      if (!state) return new Response("Not found", { status: 404 });
      if (body.status) state.status = body.status as "active" | "ended" | "aborted";
      if (body.finalized != null) state.finalized = body.finalized;
      await this.persistState();
      return Response.json({ success: true, status: state.status, finalized: state.finalized });
    }

    // 6g. Block User in Game Session (B6-CHAT-01)
    if (url.pathname.endsWith("/block-user") && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        userId?: string;
        blockedUserId?: string;
      };
      if (!body.userId || !body.blockedUserId) {
        return Response.json(
          { error: { code: "VALIDATION_FAILED", message: "userId and blockedUserId required" } },
          { status: 400 },
        );
      }
      this.blockedUsers.add(`${body.userId}:${body.blockedUserId}`);
      this.blockedUsers.add(`${body.blockedUserId}:${body.userId}`);
      return Response.json({ success: true });
    }

    // 7. WebSocket Connection Upgrade
    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const state = await this.loadState();
      if (!state) {
        return new Response("Game session not initialized", { status: 404 });
      }

      const url = new URL(request.url);
      if (url.searchParams.has("ticket")) {
        return new Response(
          JSON.stringify({
            error: {
              code: "INVALID_AUTH_TRANSPORT",
              message:
                "WebSocket tickets must not be passed in query strings. Authenticate using first-frame AUTH frame.",
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      const attachment: SocketAttachment = {
        userId: "",
        userName: "",
        role: "spectator",
        authenticated: false,
        lastHeartbeatAt: Date.now(),
      };

      this.ctx.acceptWebSocket(server);
      server.serializeAttachment(attachment);

      // Enforce 5-second authentication deadline on unauthenticated sockets (C3)
      setTimeout(() => {
        try {
          const currentAtt = server.deserializeAttachment() as SocketAttachment | null;
          if (currentAtt && !currentAtt.authenticated) {
            server.close(4001, "Authentication timeout (5s)");
          }
        } catch {
          // Already closed
        }
      }, 5000);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    if (!attachment) return;

    // 1. Frame size cap: max 16KB per WebSocket frame (H7)
    const msgLen = typeof message === "string" ? message.length : message.byteLength;
    if (msgLen > 16384) {
      ws.close(1009, "Frame size exceeds 16KB limit");
      return;
    }

    // 2. Per-connection message rate limiter: max 25 messages/second (H7, N3)
    const now = Date.now();
    const windowStart = attachment.windowStartMs ?? now;
    if (now - windowStart < 1000) {
      attachment.messageCountInWindow = (attachment.messageCountInWindow ?? 0) + 1;
      if (attachment.messageCountInWindow > 25) {
        this.send(ws, {
          v: PROTOCOL_VERSION,
          type: "ERROR",
          code: "RATE_LIMITED",
          message: "WebSocket message rate limit exceeded (max 25/sec)",
          serverTime: now,
        });
        ws.close(1008, "Rate limit exceeded (max 25/sec)");
        return;
      }
    } else {
      attachment.windowStartMs = now;
      attachment.messageCountInWindow = 1;
    }

    // 2b. User-level message rate limiter: max 25 messages/second across all connections (B6-WS-01 & B7-03)
    if (attachment.userId) {
      // 1) Local check for immediate burst protection
      const userWin = this.userMessageWindows.get(attachment.userId);
      if (userWin && now - userWin.windowStartMs < 1000) {
        userWin.count++;
        if (userWin.count > 25) {
          this.send(ws, {
            v: PROTOCOL_VERSION,
            type: "ERROR",
            code: "RATE_LIMITED",
            message: "WebSocket user rate limit exceeded (max 25/sec)",
            serverTime: now,
          });
          ws.close(1008, "User rate limit exceeded (max 25/sec)");
          return;
        }
      } else {
        this.userMessageWindows.set(attachment.userId, { windowStartMs: now, count: 1 });
      }

      // 2) Global cross-DO coordination via UserPresenceDO (B7-03)
      if (this.env.USER_PRESENCE_DO) {
        try {
          const upStub = this.env.USER_PRESENCE_DO.get(
            this.env.USER_PRESENCE_DO.idFromName(attachment.userId),
          );
          const rlRes = await upStub.fetch("http://internal/rate-limit-tick", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ maxPerSec: 25 }),
          });
          if (rlRes.status === 429) {
            this.send(ws, {
              v: PROTOCOL_VERSION,
              type: "ERROR",
              code: "RATE_LIMITED",
              message: "WebSocket user rate limit exceeded (max 25/sec across connections)",
              serverTime: now,
            });
            ws.close(1008, "User rate limit exceeded (max 25/sec across connections)");
            return;
          }
        } catch {
          // If UserPresenceDO is transiently unreachable, local limiter maintains safety
        }
      }
    }

    // CRITICAL (CLK-21): Do NOT update lastHeartbeatAt on arbitrary message frames!
    // Only genuine heartbeat protocol frames count for heartbeat activity.
    // Persist updated rate limiter counters back to socket attachment:
    ws.serializeAttachment(attachment);

    const parsed = parseClientGameFrame(message);
    if (!parsed.success) {
      this.send(ws, {
        v: PROTOCOL_VERSION,
        type: "ERROR",
        code: "INVALID_FRAME",
        message: parsed.error,
        serverTime: Date.now(),
      });
      return;
    }

    const frame: ClientGameFrame = parsed.data;
    const state = await this.loadState();
    if (!state) return;

    // First frame must be AUTH unless already authenticated
    if (frame.type === "AUTH") {
      await this.handleAuthFrame(ws, attachment, frame.payload.ticket);
      return;
    }

    if (!attachment.authenticated) {
      ws.close(4001, "Authentication required");
      return;
    }

    switch (frame.type) {
      case "MOVE_INTENT": {
        await this.handleMove(ws, attachment, frame.payload);
        break;
      }

      case "DRAW_OFFER": {
        await this.handleDrawOffer(ws, attachment);
        break;
      }

      case "DRAW_RESPONSE": {
        await this.handleDrawResponse(ws, attachment, frame.payload.accept);
        break;
      }

      case "CHAT_MUTE": {
        const isMuted = "muted" in frame ? Boolean(frame.muted) : true;
        attachment.chatMuted = isMuted;
        ws.serializeAttachment(attachment);
        this.send(ws, {
          v: PROTOCOL_VERSION,
          type: "CHAT_MUTE_ACK",
          serverTime: now,
          muted: isMuted,
        });
        break;
      }

      case "RESIGN": {
        await this.handleResign(ws, attachment);
        break;
      }

      case "TAKEBACK_REQUEST": {
        const plies =
          "payload" in frame &&
          frame.payload &&
          typeof frame.payload === "object" &&
          "plies" in frame.payload
            ? (frame.payload.plies as 1 | 2)
            : undefined;
        await this.handleTakebackRequest(ws, attachment, plies);
        break;
      }

      case "TAKEBACK_RESPONSE": {
        const accept =
          "payload" in frame
            ? !!frame.payload.accept
            : "accept" in frame
              ? !!(frame as { accept?: boolean }).accept
              : false;
        await this.handleTakebackResponse(ws, attachment, accept);
        break;
      }

      case "HEARTBEAT_PONG":
      case "PONG": {
        const rawPingId =
          ("pingId" in frame && typeof frame.pingId === "string" ? frame.pingId : undefined) ||
          ("payload" in frame &&
          frame.payload &&
          typeof frame.payload === "object" &&
          "pingId" in frame.payload &&
          typeof (frame.payload as { pingId?: unknown }).pingId === "string"
            ? (frame.payload as { pingId?: string }).pingId
            : undefined);

        // CLK-02 & CLK-03: Server-authoritative RTT via server-issued pingId.
        // Client cannot manufacture elapsed time or provide client timestamps.
        if (rawPingId && typeof rawPingId === "string" && rawPingId.trim() !== "") {
          const pingId = rawPingId.trim();
          if (attachment.pendingPings?.[pingId]) {
            const sendTime = attachment.pendingPings[pingId];
            delete attachment.pendingPings[pingId]; // Single-use consumption prevents replays
            const rawRtt = Math.max(0, now - sendTime);
            const clampedRtt = Math.min(rawRtt, PRODUCT_RULES.LAG_CREDIT_CAP_MS * 2);
            if (attachment.role === "white" || attachment.role === "black") {
              const player = attachment.role === "white" ? state.whitePlayer : state.blackPlayer;
              player.rttMs = clampedRtt;
              player.lastHeartbeatAt = now;
            }
            attachment.measuredRttMs = clampedRtt;
            attachment.lastHeartbeatAt = now;
          }
        }
        ws.serializeAttachment(attachment);
        break;
      }

      case "HEARTBEAT_PING":
      case "PING": {
        attachment.lastHeartbeatAt = now;

        const seq =
          "payload" in frame &&
          frame.payload &&
          typeof frame.payload === "object" &&
          "clientSeq" in frame.payload
            ? (frame.payload as { clientSeq?: number }).clientSeq
            : "seq" in frame
              ? (frame as { seq?: number }).seq
              : undefined;

        if (attachment.role === "white" || attachment.role === "black") {
          const player = attachment.role === "white" ? state.whitePlayer : state.blackPlayer;
          player.lastHeartbeatAt = now;
          if (seq && seq > now - 10000 && seq <= now + 1000) {
            const rawRtt = Math.max(0, now - seq);
            const clampedRtt = Math.min(rawRtt, PRODUCT_RULES.LAG_CREDIT_CAP_MS * 2);
            player.rttMs = clampedRtt;
            attachment.measuredRttMs = clampedRtt;
          }
        }
        ws.serializeAttachment(attachment);

        this.send(ws, {
          v: PROTOCOL_VERSION,
          type: "HEARTBEAT_PONG",
          serverTime: now,
          payload: { clientSeq: seq },
        });
        break;
      }

      case "CHAT_SEND": {
        // B6-CHAT-01: spectators cannot send chat messages
        if (attachment.role === "spectator") {
          this.send(ws, {
            v: PROTOCOL_VERSION,
            type: "ERROR",
            code: "FORBIDDEN",
            message: "Spectators cannot send chat messages in this game",
            serverTime: now,
          });
          break;
        }

        // B5-CHAT-01: game must be active to send chat
        if (state.status !== "active") {
          this.send(ws, {
            v: PROTOCOL_VERSION,
            type: "ERROR",
            code: "GAME_NOT_ACTIVE",
            message: "Chat is only available in active games",
            serverTime: now,
          });
          break;
        }

        // B5-CHAT-03: chat rate limit (max 3 messages per 5 seconds per socket)
        const chatWindowMs = 5000;
        const chatWindowStart = attachment.chatWindowStartMs ?? now;
        if (now - chatWindowStart < chatWindowMs) {
          attachment.chatCountInWindow = (attachment.chatCountInWindow ?? 0) + 1;
          if (attachment.chatCountInWindow > 3) {
            this.send(ws, {
              v: PROTOCOL_VERSION,
              type: "ERROR",
              code: "RATE_LIMITED",
              message: "Chat rate limit exceeded (max 3 messages per 5 seconds)",
              serverTime: now,
            });
            ws.serializeAttachment(attachment);
            break;
          }
        } else {
          attachment.chatWindowStartMs = now;
          attachment.chatCountInWindow = 1;
        }
        ws.serializeAttachment(attachment);

        // B6-WS-01: per-user chat rate limit across all sockets (max 3 messages per 5 seconds)
        if (attachment.userId) {
          const userChatWin = this.userChatWindows.get(attachment.userId);
          if (userChatWin && now - userChatWin.windowStartMs < chatWindowMs) {
            userChatWin.count++;
            if (userChatWin.count > 3) {
              this.send(ws, {
                v: PROTOCOL_VERSION,
                type: "ERROR",
                code: "RATE_LIMITED",
                message:
                  "User chat rate limit exceeded (max 3 messages per 5 seconds across connections)",
                serverTime: now,
              });
              break;
            }
          } else {
            this.userChatWindows.set(attachment.userId, { windowStartMs: now, count: 1 });
          }

          // Global cross-DO chat rate limit coordination via UserPresenceDO (B7-03)
          if (this.env.USER_PRESENCE_DO) {
            try {
              const upStub = this.env.USER_PRESENCE_DO.get(
                this.env.USER_PRESENCE_DO.idFromName(attachment.userId),
              );
              const chatRlRes = await upStub.fetch("http://internal/chat-rate-limit-tick", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ maxPerWindow: 3, windowMs: chatWindowMs }),
              });
              if (chatRlRes.status === 429) {
                this.send(ws, {
                  v: PROTOCOL_VERSION,
                  type: "ERROR",
                  code: "RATE_LIMITED",
                  message:
                    "User chat rate limit exceeded (max 3 messages per 5 seconds across connections)",
                  serverTime: now,
                });
                break;
              }
            } catch {
              // Local fallback maintains safety
            }
          }
        }

        // B6-CHAT-01: check blocked users between sender and opponent
        const opponentUserId =
          attachment.role === "white"
            ? state.blackPlayer.userId
            : attachment.role === "black"
              ? state.whitePlayer.userId
              : null;
        if (
          opponentUserId &&
          attachment.userId &&
          (this.blockedUsers.has(`${attachment.userId}:${opponentUserId}`) ||
            this.blockedUsers.has(`${opponentUserId}:${attachment.userId}`))
        ) {
          this.send(ws, {
            v: PROTOCOL_VERSION,
            type: "ERROR",
            code: "FORBIDDEN",
            message: "Cannot send chat message to a blocked player",
            serverTime: now,
          });
          break;
        }

        // B5-CHAT-02: server-authoritative sender identity — never trust client-supplied sender field
        const rawText = "text" in frame ? (frame as { text?: unknown }).text : undefined;
        const text = typeof rawText === "string" ? rawText.trim() : "";

        if (text.length === 0) {
          this.send(ws, {
            v: PROTOCOL_VERSION,
            type: "ERROR",
            code: "INVALID_FRAME",
            message: "Chat message text must not be empty",
            serverTime: now,
          });
          break;
        }

        // B6-PROTO-01 & SRS SEC-12: max 280 characters
        if (text.length > 280) {
          this.send(ws, {
            v: PROTOCOL_VERSION,
            type: "ERROR",
            code: "INVALID_FRAME",
            message: "Chat message text exceeds maximum length (280 characters)",
            serverTime: now,
          });
          break;
        }

        // Sender identity is authoritative from socket attachment, never the frame payload
        const senderName = attachment.userName;
        const senderRole = attachment.role;

        this.broadcastChat(
          {
            v: PROTOCOL_VERSION,
            type: "CHAT_MESSAGE",
            id: crypto.randomUUID(),
            sender: senderName,
            senderRole,
            text,
            timestamp: now,
          },
          attachment.userId,
        );
        break;
      }

      case "REQUEST_REMATCH": {
        // Rematch is post-game only — not supported during active play
        if (state.status === "active" || state.status === "waiting") {
          this.send(ws, {
            v: PROTOCOL_VERSION,
            type: "ERROR",
            code: "INVALID_STATE",
            message: "Rematch can only be requested after the game ends",
            serverTime: now,
          });
        } else {
          this.broadcast({
            v: PROTOCOL_VERSION,
            type: "REMATCH_OFFERED",
            from: attachment.role as "white" | "black",
          });
        }
        break;
      }

      case "RESPOND_REMATCH": {
        // Acknowledge but decline — rematch creation goes through matchmaking API
        this.broadcast({
          v: PROTOCOL_VERSION,
          type: "REMATCH_DECLINED",
        });
        break;
      }
    }
  }

  private async handleAuthFrame(
    ws: WebSocket,
    attachment: SocketAttachment,
    ticket: string,
  ): Promise<void> {
    const state = await this.loadState();
    if (!state) return;

    const secret = getWsTicketSecret(this.env);
    const verification = await verifyWsTicket(ticket, secret);

    if (!verification.valid) {
      this.send(ws, {
        v: PROTOCOL_VERSION,
        type: "ERROR",
        code: "UNAUTHORIZED",
        message: verification.reason,
        serverTime: Date.now(),
      });
      ws.close(4001, verification.reason);
      return;
    }

    const { userId, userName, jti, exp, gameId, scope } = verification.payload;

    // Strictly enforce game scope and game ID match (C3 & H6)
    if (scope !== "game" || !gameId || gameId !== state.gameId) {
      this.send(ws, {
        v: PROTOCOL_VERSION,
        type: "ERROR",
        code: "UNAUTHORIZED",
        message: "Ticket scope must be 'game' with matching gameId",
        serverTime: Date.now(),
      });
      ws.close(4001, "Ticket gameId does not match current game session");
      return;
    }

    // Replay protection: single-use ticket check (survives DO eviction via storage)
    if (!(await this.replayGuard.consume(jti, exp))) {
      ws.close(4001, "Ticket has already been consumed");
      return;
    }

    // Determine player role
    let role: "white" | "black" | "spectator" = "spectator";
    if (userId === state.whitePlayer.userId) {
      role = "white";
    } else if (userId === state.blackPlayer.userId) {
      role = "black";
    }

    // Defense-in-depth: Guests cannot spectate (SRS AUTH-05, B6-AUTH-01)
    if (verification.payload.userRole === "guest" && role === "spectator") {
      this.send(ws, {
        v: PROTOCOL_VERSION,
        type: "ERROR",
        code: "FORBIDDEN",
        message: "Guest accounts cannot spectate games",
        serverTime: Date.now(),
      });
      ws.close(4001, "Guest accounts cannot spectate games");
      return;
    }

    // RULE: One socket per player (close old socket with code 4004) (H5)
    if (role === "white" || role === "black") {
      for (const existingWs of this.ctx.getWebSockets()) {
        if (existingWs !== ws) {
          try {
            const existingAtt = existingWs.deserializeAttachment() as SocketAttachment | null;
            if (existingAtt?.authenticated && existingAtt.role === role) {
              existingWs.close(4004, "Superseded by new session");
            }
          } catch {
            // Already closed
          }
        }
      }
    }

    const now = Date.now();
    attachment.userId = userId;
    attachment.userName = userName;
    attachment.role = role;
    attachment.userRole = verification.payload.userRole;
    attachment.authenticated = true;
    attachment.lastHeartbeatAt = now;
    ws.serializeAttachment(attachment);

    // If active player connected, update presence and cancel disconnect grace timer
    if (role === "white" || role === "black") {
      const player = role === "white" ? state.whitePlayer : state.blackPlayer;
      const wasDisconnected = !player.connected;
      player.connected = true;
      player.disconnectedAt = null;
      player.lastHeartbeatAt = now;

      this.removeTimer((t) => t.kind === "DISCONNECT_GRACE" && t.role === role);

      if (wasDisconnected) {
        MetricsCollector.reconnectsTotal(role);
        this.broadcast({
          v: PROTOCOL_VERSION,
          type: "OPPONENT_PRESENCE",
          serverTime: Date.now(),
          payload: {
            role,
            status: "connected",
          },
        });
      }
    }

    if (state.status === "active") {
      this.addTimer({
        kind: "HEARTBEAT_WATCHDOG",
        dueAt: now + 15000,
        ply: state.ply,
        version: state.version,
      });
    }

    await this.persistState();

    // Send complete initial snapshot to joining client
    this.send(ws, this.createSnapshotFrame(state));
  }

  private async handleMove(
    ws: WebSocket,
    attachment: SocketAttachment,
    payload: {
      from: string;
      to: string;
      promotion?: string;
      expectedPly?: number;
    },
  ): Promise<void> {
    const state = await this.loadState();
    if (!state || state.status !== "active") {
      this.send(ws, {
        v: PROTOCOL_VERSION,
        type: "MOVE_REJECTED",
        serverTime: Date.now(),
        payload: {
          reason: "GAME_NOT_ACTIVE",
          expectedPly: state?.ply ?? 0,
          currentFen: state?.fen ?? STARTING_FEN,
        },
      });
      return;
    }

    // 1. Authorization: Only the player to move can play
    const expectedRole = state.turn === "w" ? "white" : "black";
    if (attachment.role !== expectedRole) {
      this.send(ws, {
        v: PROTOCOL_VERSION,
        type: "MOVE_REJECTED",
        serverTime: Date.now(),
        payload: {
          reason: "OUT_OF_TURN",
          expectedPly: state.ply,
          currentFen: state.fen,
        },
      });
      return;
    }

    // 2. Ply sequence check (mandatory expectedPly prevents duplicate/replayed frames) (M5)
    if (payload.expectedPly === undefined || payload.expectedPly !== state.ply) {
      this.send(ws, {
        v: PROTOCOL_VERSION,
        type: "MOVE_REJECTED",
        serverTime: Date.now(),
        payload: {
          reason: "OUT_OF_SYNC",
          expectedPly: state.ply,
          currentFen: state.fen,
        },
      });
      return;
    }

    // 3. Move validation with pure chess engine
    const moveValidation = validateAndApplyMove(
      state.fen,
      {
        from: payload.from,
        to: payload.to,
        promotion: payload.promotion as "q" | "r" | "b" | "n" | undefined,
      },
      {
        moves: state.moves,
        initialFen: state.initialFen,
        positionCounts: state.positionCounts,
      },
    );

    if (!moveValidation.valid) {
      this.send(ws, {
        v: PROTOCOL_VERSION,
        type: "MOVE_REJECTED",
        serverTime: Date.now(),
        payload: {
          reason: moveValidation.reason || "ILLEGAL_MOVE",
          expectedPly: state.ply,
          currentFen: state.fen,
        },
      });
      return;
    }

    const now = Date.now();
    const { san, snapshot } = moveValidation;

    const player = attachment.role === "white" ? state.whitePlayer : state.blackPlayer;
    const rtt = player.rttMs ?? attachment.measuredRttMs;

    // 4. Clock calculation with lag credit (RULE-04) and first-move hold (RULE-01)
    const clockResult = calculateClockAfterMove(
      {
        whiteMs: state.whiteMs,
        blackMs: state.blackMs,
        activeTurn: state.turn,
        lastMoveTimestamp: state.lastMoveServerTime,
      },
      {
        incrementMs: state.incrementMs,
        ply: state.ply,
        lagCreditCapMs: PRODUCT_RULES.LAG_CREDIT_CAP_MS,
        serverMeasuredRttMs: rtt,
      },
      now,
    );

    if (clockResult.flagged) {
      await this.handleTimeout(state.turn === "w" ? "white" : "black");
      return;
    }

    // 5. Update state
    state.moveClockHistory = state.moveClockHistory || [];
    state.moveClockHistory.push({ whiteMs: state.whiteMs, blackMs: state.blackMs });

    // Clear any open draw offer when a move is played (M1)
    state.drawOfferFrom = null;
    state.drawOfferPly = null;

    state.whiteMs = clockResult.whiteMs;
    state.blackMs = clockResult.blackMs;
    state.lastMoveServerTime = now;
    state.turn = snapshot.turn;
    state.fen = snapshot.fen;
    if (snapshot.positionCounts) {
      state.positionCounts = snapshot.positionCounts;
    }
    state.ply++;
    state.version++;
    state.moves.push(san);
    state.isClockRunning = isClockRunningForPly(state.ply);

    // Cancel previous first-move and clock timers
    this.removeTimer((t) => t.kind === "FIRST_MOVE_DEADLINE" || t.kind === "CLOCK_FLAG");

    // 6. Check game over conditions
    let gameOver = false;
    if (snapshot.isCheckmate) {
      gameOver = true;
      state.status = "ended";
      state.result = state.turn === "b" ? "1-0" : "0-1";
      state.winnerRole = state.turn === "b" ? "white" : "black";
      state.termination = "checkmate";
    } else if (snapshot.isStalemate) {
      gameOver = true;
      state.status = "ended";
      state.result = "1/2-1/2";
      state.termination = "stalemate";
    } else if (snapshot.isThreefoldRepetition) {
      gameOver = true;
      state.status = "ended";
      state.result = "1/2-1/2";
      state.termination = "threefold_repetition";
    } else if (snapshot.isInsufficientMaterial) {
      gameOver = true;
      state.status = "ended";
      state.result = "1/2-1/2";
      state.termination = "insufficient_material";
    } else if (snapshot.isDrawByFiftyMoves) {
      gameOver = true;
      state.status = "ended";
      state.result = "1/2-1/2";
      state.termination = "fifty_moves";
    } else if (snapshot.isDraw) {
      gameOver = true;
      state.status = "ended";
      state.result = "1/2-1/2";
      state.termination = "draw";
    }

    // 7. Schedule next timer if game active
    if (!gameOver) {
      this.addTimer({
        kind: "HEARTBEAT_WATCHDOG",
        dueAt: now + 15000,
        ply: state.ply,
        version: state.version,
      });

      if (state.ply === 1) {
        // Black's first move deadline (30s)
        this.addTimer({
          kind: "FIRST_MOVE_DEADLINE",
          dueAt: now + PRODUCT_RULES.FIRST_MOVE_DEADLINE_MS,
          ply: 1,
          version: state.version,
          role: "black",
        });
      } else {
        // Clocks running: schedule active player clock flag
        const activeMs = state.turn === "w" ? state.whiteMs : state.blackMs;
        this.addTimer({
          kind: "CLOCK_FLAG",
          dueAt: now + activeMs,
          ply: state.ply,
          version: state.version,
          role: state.turn === "w" ? "white" : "black",
        });
      }
    }

    // 8. "Durable before visible": write and await storage BEFORE broadcast
    await this.persistState();
    MetricsCollector.movesTotal(state.ply, { gameId: state.gameId });

    // 9. Broadcast move acceptance
    this.broadcast({
      v: PROTOCOL_VERSION,
      type: "MOVE_ACCEPTED",
      serverTime: now,
      payload: {
        san,
        uci: `${payload.from}${payload.to}${payload.promotion || ""}`,
        from: payload.from,
        to: payload.to,
        fen: state.fen,
        ply: state.ply,
        whiteMs: state.whiteMs,
        blackMs: state.blackMs,
        turn: state.turn,
        lagCreditMs: clockResult.lagCreditMs,
      },
    });

    if (gameOver) {
      await this.finalizeGame();
    }
  }

  private async handleDrawOffer(ws: WebSocket, attachment: SocketAttachment): Promise<void> {
    const state = await this.loadState();
    if (!state || state.status !== "active") return;
    if (attachment.role !== "white" && attachment.role !== "black") return;

    // RULE-09: Minimum ply 4 (2 moves per side)
    const minPly = PRODUCT_RULES.DRAW_MIN_PLY_PER_SIDE * 2;
    if (state.ply < minPly) {
      this.send(ws, {
        v: PROTOCOL_VERSION,
        type: "ERROR",
        code: "DRAW_RULE_VIOLATION",
        message: "Draw offers allowed only after 2 moves per player",
        serverTime: Date.now(),
      });
      return;
    }

    // RULE-09: Cooldown between offers by same player (M1)
    const lastOfferPly =
      attachment.role === "white" ? state.lastDrawOfferPlyWhite : state.lastDrawOfferPlyBlack;
    if (
      lastOfferPly !== null &&
      lastOfferPly !== undefined &&
      state.ply - lastOfferPly < PRODUCT_RULES.DRAW_COOLDOWN_PLIES
    ) {
      this.send(ws, {
        v: PROTOCOL_VERSION,
        type: "ERROR",
        code: "DRAW_COOLDOWN",
        message: `You must wait ${PRODUCT_RULES.DRAW_COOLDOWN_PLIES} plies before offering another draw`,
        serverTime: Date.now(),
      });
      return;
    }

    state.drawOfferFrom = attachment.role;
    state.drawOfferPly = state.ply;
    if (attachment.role === "white") {
      state.lastDrawOfferPlyWhite = state.ply;
    } else {
      state.lastDrawOfferPlyBlack = state.ply;
    }
    await this.persistState();

    this.broadcast({
      v: PROTOCOL_VERSION,
      type: "DRAW_OFFERED",
      serverTime: Date.now(),
      payload: { fromRole: attachment.role },
    });
  }

  private async handleDrawResponse(
    ws: WebSocket,
    attachment: SocketAttachment,
    accept: boolean,
  ): Promise<void> {
    const state = await this.loadState();
    if (!state || state.status !== "active" || !state.drawOfferFrom) return;
    if (attachment.role === state.drawOfferFrom) return; // Cannot accept own offer

    if (accept) {
      state.status = "ended";
      state.result = "1/2-1/2";
      state.termination = "agreement";
      state.drawOfferFrom = null;
      state.drawOfferPly = null;
      await this.persistState();
      await this.finalizeGame();
    } else {
      state.drawOfferFrom = null;
      state.drawOfferPly = null;
      await this.persistState();
      this.broadcast({
        v: PROTOCOL_VERSION,
        type: "DRAW_DECLINED",
        serverTime: Date.now(),
      });
    }
  }

  private async handleResign(ws: WebSocket, attachment: SocketAttachment): Promise<void> {
    const state = await this.loadState();
    if (!state || state.status !== "active") return;
    if (attachment.role !== "white" && attachment.role !== "black") return;

    if (state.ply < 2) {
      // GAME-14 / GAME-40: Resignation before both players have made a move aborts the game without rating change
      state.status = "aborted";
      state.result = "aborted";
      state.termination = "abandoned";
      state.winnerRole = undefined;
    } else {
      state.status = "ended";
      state.winnerRole = attachment.role === "white" ? "black" : "white";
      state.result = attachment.role === "white" ? "0-1" : "1-0";
      state.termination = "resignation";
    }

    await this.persistState();
    await this.finalizeGame();
  }

  private async handleTakebackRequest(
    ws: WebSocket,
    attachment: SocketAttachment,
    plies?: 1 | 2,
  ): Promise<void> {
    const state = await this.loadState();
    if (!state || state.status !== "active") return;
    if (attachment.role !== "white" && attachment.role !== "black") return;

    // RULE-10: Only unrated friend games
    const check = canOfferTakeback({
      isFriendGame: state.isFriendGame,
      rated: state.rated,
      ply: state.ply,
      hasPendingRequest: !!state.takebackOfferFrom,
    });

    if (!check.allowed) {
      this.send(ws, {
        v: PROTOCOL_VERSION,
        type: "ERROR",
        code: "TAKEBACK_NOT_ALLOWED",
        message: check.reason || "Takebacks not allowed",
        serverTime: Date.now(),
      });
      return;
    }

    state.takebackOfferFrom = attachment.role;
    state.takebackOfferPly = state.ply;
    state.takebackOfferPlies = plies;
    await this.persistState();

    this.broadcast({
      v: PROTOCOL_VERSION,
      type: "TAKEBACK_OFFERED",
      serverTime: Date.now(),
      payload: { fromRole: attachment.role },
    });
  }

  private async handleTakebackResponse(
    ws: WebSocket,
    attachment: SocketAttachment,
    accept: boolean,
  ): Promise<void> {
    const state = await this.loadState();
    if (!state || state.status !== "active" || !state.takebackOfferFrom) return;
    const requestedPlies = state.takebackOfferPlies;
    state.takebackOfferFrom = null;
    state.takebackOfferPly = null;
    state.takebackOfferPlies = undefined;

    if (!accept) {
      await this.persistState();
      this.broadcast({
        v: PROTOCOL_VERSION,
        type: "TAKEBACK_RESOLVED",
        serverTime: Date.now(),
        payload: {
          accepted: false,
          fen: state.fen,
          ply: state.ply,
          whiteMs: state.whiteMs,
          blackMs: state.blackMs,
        },
      });
      return;
    }

    // Rewind dynamically:
    // If client specified 1 or 2 plies, use it; otherwise default to 2 (or 1 if ply < 2)
    let pliesToRewind: 1 | 2 = 2;
    if (requestedPlies === 1 || requestedPlies === 2) {
      pliesToRewind = requestedPlies;
    } else {
      pliesToRewind = state.ply >= 2 ? 2 : 1;
    }

    const rewound = applyTakeback(state.moves, pliesToRewind);
    state.fen = rewound.fen;
    state.ply = rewound.ply;
    state.turn = rewound.turn;
    state.moves = rewound.moves;
    state.version++;

    // Restore clocks from moveClockHistory (M2)
    if (state.moveClockHistory && state.moveClockHistory.length > 0) {
      state.moveClockHistory = state.moveClockHistory.slice(
        0,
        Math.max(0, state.moveClockHistory.length - pliesToRewind),
      );
      const lastSnapshot = state.moveClockHistory[state.moveClockHistory.length - 1];
      if (lastSnapshot) {
        state.whiteMs = lastSnapshot.whiteMs;
        state.blackMs = lastSnapshot.blackMs;
      } else {
        state.whiteMs = state.initialMs;
        state.blackMs = state.initialMs;
      }
    }

    // Reset lastMoveServerTime to now so players are not charged negotiation time (M2)
    const now = Date.now();
    state.lastMoveServerTime = now;
    state.isClockRunning = isClockRunningForPly(state.ply);

    // Re-arm clock flag timer for turn to move
    this.removeTimer((t) => t.kind === "CLOCK_FLAG" || t.kind === "FIRST_MOVE_DEADLINE");
    if (state.ply >= 2 && state.isClockRunning) {
      const activeMs = state.turn === "w" ? state.whiteMs : state.blackMs;
      this.addTimer({
        kind: "CLOCK_FLAG",
        dueAt: now + activeMs,
        ply: state.ply,
        version: state.version,
        role: state.turn === "w" ? "white" : "black",
      });
    }

    await this.persistState();

    this.broadcast({
      v: PROTOCOL_VERSION,
      type: "TAKEBACK_RESOLVED",
      serverTime: Date.now(),
      payload: {
        accepted: true,
        fen: state.fen,
        ply: state.ply,
        whiteMs: state.whiteMs,
        blackMs: state.blackMs,
      },
    });
  }

  /**
   * Resolves timeout with FIDE Dead-Position Rule (Change 1).
   */
  private async handleTimeout(flaggedColor: "white" | "black"): Promise<void> {
    const state = await this.loadState();
    if (!state || state.status !== "active") return;

    if (state.ply < 2) {
      // GAME-14: Timeout before both players have made a move aborts the game without rating change
      state.status = "aborted";
      state.result = "aborted";
      state.termination = "abandoned";
      state.winnerRole = undefined;
    } else {
      const resolution = resolveTimeout(state.fen, flaggedColor);
      state.status = "ended";
      state.result = resolution.result;
      state.winnerRole = resolution.winnerRole;
      state.termination = resolution.termination;
    }

    if (flaggedColor === "white") {
      state.whiteMs = 0;
    } else {
      state.blackMs = 0;
    }

    await this.persistState();
    await this.finalizeGame();
  }

  /**
   * Finalizes an ended/aborted game session.
   * D1 is written in a single idempotent batch off the move path (Change 4).
   */
  private async finalizeGame(): Promise<void> {
    if (this.finalizationPromise) {
      await this.finalizationPromise;
      return;
    }

    this.finalizationPromise = (async () => {
      const state = await this.loadState();
      if (!state || state.finalized) return;

      state.endedAt = Date.now();
      this.timers = []; // Clear active match timers

      // 1. Build official PGN with headers
      state.pgn = buildPgn({
        event: state.rated ? "ET Chess Rated Match" : "ET Chess Casual Match",
        white: state.whitePlayer.userName,
        black: state.blackPlayer.userName,
        whiteElo: state.whitePlayer.rating,
        blackElo: state.blackPlayer.rating,
        timeControl: state.timeControl,
        result:
          (state.result === "aborted" ? "*" : (state.result as "1-0" | "0-1" | "1/2-1/2" | "*")) ||
          "*",
        termination: state.termination,
        moves: state.moves,
      });

      // 2. Transactional Exactly-Once Settlement in D1 (FINAL-01, RATING-01, RATING-02, RATING-03)
      if (!state.persistedToD1) {
        try {
          const settlement = await settleGameRatings(
            this.env.DB,
            {
              gameId: state.gameId,
              whiteUserId: state.whitePlayer.userId,
              blackUserId: state.blackPlayer.userId,
              timeControl: state.timeControl,
              category: state.category,
              moves: state.moves,
              result: state.result || "*",
              termination: state.termination || "unknown",
              rated: state.rated,
              gameType: state.isFriendGame ? "challenge" : "matchmaking",
              startedAt: state.startedAt,
              endedAt: state.endedAt,
            },
            this.env,
          );

          if (settlement.settled) {
            state.persistedToD1 = true;
            state.finalized = true;
            if (settlement.whiteRatingBefore != null) {
              state.whiteRatingBefore = settlement.whiteRatingBefore;
            }
            if (settlement.whiteRatingAfter != null) {
              state.whiteRatingAfter = settlement.whiteRatingAfter;
            }
            if (settlement.whiteRatingDiff != null) {
              state.whiteRatingDiff = settlement.whiteRatingDiff;
            }
            if (settlement.blackRatingBefore != null) {
              state.blackRatingBefore = settlement.blackRatingBefore;
            }
            if (settlement.blackRatingAfter != null) {
              state.blackRatingAfter = settlement.blackRatingAfter;
            }
            if (settlement.blackRatingDiff != null) {
              state.blackRatingDiff = settlement.blackRatingDiff;
            }
          }
        } catch (err) {
          console.error("Failed to write game batch to D1, scheduling retry:", err);
          state.persistedToD1 = false;
          // Schedule retry timer for D1 persistence
          this.addTimer({
            kind: "FINALIZE_RETRY",
            dueAt: Date.now() + 2000,
            ply: state.ply,
            version: state.version,
          });
        }
      }

      // 3. Persist finalized state to DO storage
      await this.persistState();

      // 4. Broadcast GAME_TERMINATED frame exactly once (FINAL-01)
      if (state.persistedToD1 && !state.terminalBroadcasted) {
        state.terminalBroadcasted = true;
        this.broadcast({
          v: PROTOCOL_VERSION,
          type: "GAME_TERMINATED",
          serverTime: Date.now(),
          payload: {
            result: state.result || "aborted",
            termination: state.termination || "unknown",
            winnerRole: state.winnerRole,
            whiteRatingBefore: state.whiteRatingBefore,
            whiteRatingAfter: state.whiteRatingAfter,
            whiteRatingDiff: state.whiteRatingDiff,
            blackRatingBefore: state.blackRatingBefore,
            blackRatingAfter: state.blackRatingAfter,
            blackRatingDiff: state.blackRatingDiff,
          },
        });

        // TEST-04: Structured observability log without secrets
        console.log(
          JSON.stringify({
            event: "GAME_FINALIZED",
            gameId: state.gameId,
            terminalReason: state.termination,
            finalPly: state.ply,
            result: state.result,
            winnerRole: state.winnerRole,
            settlementState: "settled",
            idempotencyKey: state.gameId,
            startedAt: state.startedAt,
            endedAt: state.endedAt,
          }),
        );

        MetricsCollector.gamesEnded(state.termination || "unknown", {
          rated: state.rated,
          result: state.result,
        });

        // Release live game lock in MatchmakerDO
        if (this.env.MATCHMAKER_DO) {
          try {
            const mmStub = this.env.MATCHMAKER_DO.get(this.env.MATCHMAKER_DO.idFromName("global"));
            await mmStub.fetch("http://internal/clear-active-game", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ gameId: state.gameId }),
            });
          } catch {
            // Best-effort MatchmakerDO lock cleanup
          }
        }

        // Release live game lock in UserPresenceDO for both players (B4-PRES-03)
        if (this.env.USER_PRESENCE_DO) {
          const playersToRelease = [state.whitePlayer?.userId, state.blackPlayer?.userId].filter(
            (id): id is string => Boolean(id),
          );

          for (const uid of playersToRelease) {
            try {
              const upStub = this.env.USER_PRESENCE_DO.get(
                this.env.USER_PRESENCE_DO.idFromName(uid),
              );
              await upStub.fetch("http://internal/release-live-game", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ gameId: state.gameId }),
              });
            } catch {
              // Best-effort UserPresenceDO lock cleanup
            }
          }
        }

        // Schedule auto-close alarm in 5 minutes
        this.addTimer({
          kind: "AUTO_CLOSE",
          dueAt: Date.now() + 300_000,
          ply: state.ply,
          version: state.version,
        });
        await this.syncAlarm();
        await this.persistState();
      }
    })();

    try {
      await this.finalizationPromise;
    } finally {
      this.finalizationPromise = null;
    }
  }

  /**
   * Multiplexed Alarms Handler (Change 3).
   * Validates each due timer against current state, dropping stale timers silently.
   */
  async alarm(): Promise<void> {
    const state = await this.loadState();
    if (!state) return;

    const now = Date.now();
    // CLK-07, CLK-10, CLK-13: Exact boundary precision — only execute timers that are actually due (dueAt <= now).
    const dueTimers = this.timers.filter((t) => t.dueAt <= now);

    // Silent network drop detection via heartbeat timeout (15 seconds) (H5, N4, CLK-20)
    if (state.status === "active") {
      for (const role of ["white", "black"] as const) {
        const player = role === "white" ? state.whitePlayer : state.blackPlayer;
        if (
          player.connected &&
          player.lastHeartbeatAt &&
          now - player.lastHeartbeatAt >= PRODUCT_RULES.DISCONNECT_TIMEOUT_MS
        ) {
          player.connected = false;
          player.disconnectedAt = now;
          this.addTimer({
            kind: "DISCONNECT_GRACE",
            dueAt: now + PRODUCT_RULES.DISCONNECT_GRACE_MS,
            ply: state.ply,
            version: state.version,
            role,
          });
          this.broadcast({
            v: PROTOCOL_VERSION,
            type: "OPPONENT_PRESENCE",
            serverTime: now,
            payload: {
              role,
              status: "disconnected",
              gracePeriodRemainingMs: PRODUCT_RULES.DISCONNECT_GRACE_MS,
            },
          });
        }
      }
    }

    for (const timer of dueTimers) {
      MetricsCollector.alarmsFired(timer.kind);

      switch (timer.kind) {
        case "HEARTBEAT_WATCHDOG": {
          if (state.status !== "active") break;
          // CLK-20: Dynamic rescheduling to ensure silent connections are detected within 15 seconds
          const connectedPlayers = [state.whitePlayer, state.blackPlayer].filter(
            (p) => p.connected && p.lastHeartbeatAt,
          );
          let nextCheckDueAt = now + PRODUCT_RULES.DISCONNECT_TIMEOUT_MS;
          if (connectedPlayers.length > 0) {
            const earliestExpiry = Math.min(
              ...connectedPlayers.map(
                (p) => (p.lastHeartbeatAt ?? now) + PRODUCT_RULES.DISCONNECT_TIMEOUT_MS,
              ),
            );
            nextCheckDueAt = Math.max(now + 1000, earliestExpiry);
          }
          this.addTimer({
            kind: "HEARTBEAT_WATCHDOG",
            dueAt: nextCheckDueAt,
            ply: state.ply,
            version: state.version,
          });
          await this.persistState();
          break;
        }

        case "FIRST_MOVE_DEADLINE": {
          // Verify condition: game active, ply < 2, version matches
          if (state.status !== "active" || state.ply >= 2 || state.version !== timer.version) {
            MetricsCollector.alarmsStaleDropped(timer.kind, "already_moved");
            continue;
          }
          // Abort game: no rating changes (RULE-01)
          state.status = "aborted";
          state.result = "aborted";
          state.termination = "abandoned";
          await this.persistState();
          await this.finalizeGame();
          break;
        }

        case "CLOCK_FLAG": {
          // Verify condition: game active, ply and turn match
          const activeRole = state.turn === "w" ? "white" : "black";
          if (state.status !== "active" || state.ply !== timer.ply || timer.role !== activeRole) {
            MetricsCollector.alarmsStaleDropped(timer.kind, "ply_mismatch");
            continue;
          }
          await this.handleTimeout(timer.role);
          break;
        }

        case "DISCONNECT_GRACE": {
          // Verify condition: game active, player still disconnected
          const player = timer.role === "white" ? state.whitePlayer : state.blackPlayer;
          if (state.status !== "active" || player.connected) {
            MetricsCollector.alarmsStaleDropped(timer.kind, "reconnected");
            continue;
          }
          if (state.ply < 2) {
            // GAME-14 / GAME-35: Disconnect before both players have moved aborts the game without rating change
            state.status = "aborted";
            state.result = "aborted";
            state.termination = "abandoned";
            state.winnerRole = undefined;
          } else {
            // Disconnected player forfeits (RULE-02)
            state.status = "ended";
            state.winnerRole = timer.role === "white" ? "black" : "white";
            state.result = timer.role === "white" ? "0-1" : "1-0";
            state.termination = "abandoned";
          }
          await this.persistState();
          await this.finalizeGame();
          break;
        }

        case "FINALIZE_RETRY": {
          if (!state.finalized || !state.persistedToD1) {
            await this.finalizeGame();
          }
          break;
        }

        case "AUTO_CLOSE": {
          // Clean up completed session state and sockets (M3)
          for (const s of this.ctx.getWebSockets()) {
            try {
              s.close(1000, "Game session completed");
            } catch {
              // ignore
            }
          }
          await this.ctx.storage.deleteAll();
          break;
        }
      }
    }

    // Purge executed timers and re-arm alarm
    this.timers = this.timers.filter((t) => t.dueAt > now);
    await this.ctx.storage.put("timers", this.timers);
    await this.syncAlarm();
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    if (!attachment || !attachment.authenticated) return;

    const state = await this.loadState();
    if (!state || state.status !== "active") return;

    if (attachment.role === "white" || attachment.role === "black") {
      // RULE: One socket per player. Verify no other active connection exists for this role before marking disconnected (H5)
      const hasOtherActiveSocket = this.ctx.getWebSockets().some((s) => {
        if (s === ws) return false;
        try {
          const att = s.deserializeAttachment() as SocketAttachment | null;
          return att?.authenticated && att?.role === attachment.role;
        } catch {
          return false;
        }
      });

      if (hasOtherActiveSocket) {
        return; // Player is still actively connected via another socket!
      }

      const player = attachment.role === "white" ? state.whitePlayer : state.blackPlayer;
      player.connected = false;
      player.disconnectedAt = Date.now();

      // RULE-02: 60s disconnect grace period before forfeit
      this.addTimer({
        kind: "DISCONNECT_GRACE",
        dueAt: Date.now() + PRODUCT_RULES.DISCONNECT_GRACE_MS,
        ply: state.ply,
        version: state.version,
        role: attachment.role,
      });

      await this.persistState();
      MetricsCollector.disconnectsTotal(attachment.role);

      this.broadcast({
        v: PROTOCOL_VERSION,
        type: "OPPONENT_PRESENCE",
        serverTime: Date.now(),
        payload: {
          role: attachment.role,
          status: "disconnected",
          gracePeriodRemainingMs: PRODUCT_RULES.DISCONNECT_GRACE_MS,
        },
      });
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }
}

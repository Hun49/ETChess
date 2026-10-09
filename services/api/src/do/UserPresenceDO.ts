import { DurableObject } from "cloudflare:workers";
import {
  type ClientUserFrame,
  PROTOCOL_VERSION,
  type ServerUserFrame,
  parseClientUserFrame,
} from "@etchess/realtime-protocol";
import { WS_CLOSE_CODES } from "@etchess/types";
import { getWsTicketSecret } from "../lib/secrets";
import { TicketReplayGuard, verifyWsTicket } from "../lib/wsTicket";
import type { Env } from "../types";

export interface UserPresenceState {
  activeGameId: string | null;
  activeQueuePool: string | null;
  settlementLock: { lockId: string; expiresAt: number } | null;
}

interface SocketAttachment {
  userId?: string;
  userName?: string;
  rating?: number;
  userRole?: string;
  authenticated: boolean;
  lastHeartbeatAt?: number;
}

export class UserPresenceDO extends DurableObject<Env> {
  private activeGameId: string | null = null;
  private activeGameClaimedAt: number | null = null;
  private activeQueuePool: string | null = null;
  private settlementLock: { lockId: string; expiresAt: number } | null = null;
  private replayGuard: TicketReplayGuard;
  private stateLoaded = false;
  private messageWindowStartMs = 0;
  private messageCountInWindow = 0;
  private chatWindowStartMs = 0;
  private chatCountInWindow = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.replayGuard = new TicketReplayGuard(ctx.storage);
  }

  private async loadState(): Promise<void> {
    if (this.stateLoaded) return;
    const [gameId, claimedAt, queuePool, lock] = await Promise.all([
      this.ctx.storage.get<string>("activeGameId"),
      this.ctx.storage.get<number>("activeGameClaimedAt"),
      this.ctx.storage.get<string>("activeQueuePool"),
      this.ctx.storage.get<{ lockId: string; expiresAt: number }>("settlementLock"),
    ]);
    this.activeGameId = gameId ?? null;
    this.activeGameClaimedAt = claimedAt ?? null;
    this.activeQueuePool = queuePool ?? null;
    this.settlementLock = lock ?? null;
    this.stateLoaded = true;
  }

  /**
   * Reconciles stale active game:
   * If UserPresenceDO still records an active game, query GameSessionDO to verify whether
   * it has finalized or terminated. If so, clean up the lock automatically (B4-PRES-04).
   */
  private async reconcileStaleGame(): Promise<void> {
    if (!this.activeGameId) return;
    if (!this.env.GAME_SESSION_DO) return;

    try {
      const sessionStub = this.env.GAME_SESSION_DO.get(
        this.env.GAME_SESSION_DO.idFromName(this.activeGameId),
      );
      const res = await sessionStub.fetch("http://internal/state");
      if (res.ok) {
        const sessionState = (await res.json()) as {
          status: string;
          finalized?: boolean;
          ply?: number;
          whitePlayer?: { connected: boolean };
          blackPlayer?: { connected: boolean };
        };
        if (
          sessionState.status === "ended" ||
          sessionState.status === "finished" ||
          sessionState.status === "finalized" ||
          sessionState.finalized ||
          sessionState.status === "aborted"
        ) {
          this.activeGameId = null;
          this.activeGameClaimedAt = null;
          await Promise.all([
            this.ctx.storage.delete("activeGameId"),
            this.ctx.storage.delete("activeGameClaimedAt"),
          ]);
        }
      }
    } catch {
      // GameSessionDO unreachable; do not clear prematurely on transient network errors
    }
  }

  private send(ws: WebSocket, frame: ServerUserFrame): void {
    try {
      ws.send(JSON.stringify(frame));
    } catch {
      // Socket closing/closed
    }
  }

  private broadcast(frame: ServerUserFrame): void {
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      this.send(ws, frame);
    }
  }

  async fetch(request: Request): Promise<Response> {
    await this.loadState();
    const url = new URL(request.url);

    // 1. WebSocket Upgrade handling (/ws/user)
    if (request.headers.get("Upgrade") === "websocket") {
      if (url.searchParams.has("ticket")) {
        return new Response(
          JSON.stringify({
            error: {
              code: "INVALID_AUTH_TRANSPORT",
              message: "WebSocket tickets must not be passed in query strings.",
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      const attachment: SocketAttachment = {
        authenticated: false,
        lastHeartbeatAt: Date.now(),
      };

      this.ctx.acceptWebSocket(server);
      server.serializeAttachment(attachment);

      setTimeout(() => {
        try {
          const cur = server.deserializeAttachment() as SocketAttachment | null;
          if (cur && !cur.authenticated) {
            server.close(WS_CLOSE_CODES.UNAUTHORIZED, "Authentication timeout (5s)");
          }
        } catch {}
      }, 5000);

      return new Response(null, { status: 101, webSocket: client });
    }

    // 2. Claim Live Game (B4-PRES-02, INV-01)
    if (url.pathname.endsWith("/claim-live-game") && request.method === "POST") {
      const body = (await request.json()) as { gameId: string };
      await this.reconcileStaleGame();

      if (this.activeGameId && this.activeGameId !== body.gameId) {
        return Response.json(
          {
            error: {
              code: "ALREADY_IN_GAME",
              message: "User is already in an active live game.",
              activeGameId: this.activeGameId,
            },
          },
          { status: 409 },
        );
      }

      this.activeGameId = body.gameId;
      this.activeGameClaimedAt = Date.now();
      this.activeQueuePool = null; // Auto-leave queue on game start
      await Promise.all([
        this.ctx.storage.put("activeGameId", this.activeGameId),
        this.ctx.storage.put("activeGameClaimedAt", this.activeGameClaimedAt),
        this.ctx.storage.delete("activeQueuePool"),
      ]);

      return Response.json({ success: true, gameId: this.activeGameId });
    }

    // 3. Release Live Game (B4-PRES-03)
    if (url.pathname.endsWith("/release-live-game") && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { gameId?: string };
      if (!body.gameId || this.activeGameId === body.gameId) {
        this.activeGameId = null;
        this.activeGameClaimedAt = null;
        await Promise.all([
          this.ctx.storage.delete("activeGameId"),
          this.ctx.storage.delete("activeGameClaimedAt"),
        ]);
      }
      return Response.json({ success: true });
    }

    // 3b. Test Reset Endpoint (for test cleanup)
    if (url.pathname.endsWith("/test-reset") && request.method === "POST") {
      this.activeGameId = null;
      this.activeGameClaimedAt = null;
      this.activeQueuePool = null;
      this.settlementLock = null;
      await this.ctx.storage.deleteAll();
      return Response.json({ success: true });
    }

    // 4. Query Active Game Status (B4-PRES-04)
    if (url.pathname.endsWith("/active-game") && request.method === "GET") {
      await this.reconcileStaleGame();
      return Response.json({
        active: Boolean(this.activeGameId),
        gameId: this.activeGameId,
      });
    }

    // 5. Claim Queue Pool (INV-02)
    if (url.pathname.endsWith("/claim-queue") && request.method === "POST") {
      const body = (await request.json()) as { poolKey: string };
      await this.reconcileStaleGame();

      if (this.activeGameId) {
        return Response.json(
          {
            error: {
              code: "ALREADY_IN_GAME",
              message: "Cannot join matchmaking queue while in a live game.",
              activeGameId: this.activeGameId,
            },
          },
          { status: 409 },
        );
      }

      const previousPool = this.activeQueuePool;
      this.activeQueuePool = body.poolKey;
      await this.ctx.storage.put("activeQueuePool", this.activeQueuePool);

      return Response.json({
        success: true,
        poolKey: this.activeQueuePool,
        switchedPool: previousPool && previousPool !== body.poolKey ? previousPool : null,
      });
    }

    // 6. Release Queue Pool
    if (url.pathname.endsWith("/release-queue") && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { poolKey?: string };
      if (!body.poolKey || this.activeQueuePool === body.poolKey) {
        this.activeQueuePool = null;
        await this.ctx.storage.delete("activeQueuePool");
      }
      return Response.json({ success: true });
    }

    // 7. Query Queue Status
    if (url.pathname.endsWith("/queue-status") && request.method === "GET") {
      return Response.json({
        queued: Boolean(this.activeQueuePool),
        poolKey: this.activeQueuePool,
      });
    }

    // 8. Acquire Settlement Lock (B4-RATE-01, B4-RATE-02, INV-08)
    if (url.pathname.endsWith("/acquire-settlement-lock") && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { leaseMs?: number };
      const now = Date.now();
      const leaseMs = body.leaseMs ?? 5000;

      if (this.settlementLock && this.settlementLock.expiresAt > now) {
        return Response.json(
          {
            error: {
              code: "LOCK_BUSY",
              message: "User rating settlement lock is currently held.",
              retryAfterMs: this.settlementLock.expiresAt - now,
            },
          },
          { status: 409 },
        );
      }

      const lockId = crypto.randomUUID();
      this.settlementLock = { lockId, expiresAt: now + leaseMs };
      await this.ctx.storage.put("settlementLock", this.settlementLock);

      return Response.json({ success: true, lockId });
    }

    // 9. Release Settlement Lock (B6-01)
    if (url.pathname.endsWith("/release-settlement-lock") && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { lockId?: string };
      if (!body.lockId || typeof body.lockId !== "string" || body.lockId.trim() === "") {
        return Response.json(
          {
            error: {
              code: "MISSING_LOCK_ID",
              message: "lockId is mandatory to release settlement lock",
            },
          },
          { status: 400 },
        );
      }
      const now = Date.now();
      if (!this.settlementLock || this.settlementLock.lockId !== body.lockId) {
        return Response.json(
          {
            error: { code: "LOCK_NOT_OWNED", message: "Lock is not held by the specified lockId" },
          },
          { status: 409 },
        );
      }
      if (this.settlementLock.expiresAt <= now) {
        this.settlementLock = null;
        await this.ctx.storage.delete("settlementLock");
        return Response.json(
          { error: { code: "LOCK_EXPIRED", message: "Settlement lock lease has expired" } },
          { status: 409 },
        );
      }
      this.settlementLock = null;
      await this.ctx.storage.delete("settlementLock");
      return Response.json({ success: true });
    }

    // 9b. Verify Settlement Lock (B6-01)
    if (url.pathname.endsWith("/verify-settlement-lock") && request.method === "GET") {
      const lockId = url.searchParams.get("lockId");
      if (!lockId || lockId.trim() === "") {
        return Response.json(
          { error: { code: "MISSING_LOCK_ID", message: "lockId parameter is mandatory" } },
          { status: 400 },
        );
      }
      const now = Date.now();
      if (!this.settlementLock || this.settlementLock.lockId !== lockId) {
        return Response.json(
          {
            valid: false,
            code: "LOCK_NOT_OWNED",
            message: "Lock is not held by the specified lockId",
          },
          { status: 409 },
        );
      }
      if (this.settlementLock.expiresAt <= now) {
        this.settlementLock = null;
        await this.ctx.storage.delete("settlementLock");
        return Response.json(
          { valid: false, code: "LOCK_EXPIRED", message: "Settlement lock lease has expired" },
          { status: 409 },
        );
      }
      return Response.json({ valid: true, expiresAt: this.settlementLock.expiresAt });
    }

    // 10. Push Frame to User Sockets (B4-PRES-04 / NOTIFY)
    if (url.pathname.endsWith("/notify") && request.method === "POST") {
      const body = (await request.json()) as { frame: ServerUserFrame };
      this.broadcast(body.frame);
      return Response.json({ success: true, deliveredCount: this.ctx.getWebSockets().length });
    }

    // 11. Presence Summary
    if (url.pathname.endsWith("/presence") && request.method === "GET") {
      await this.reconcileStaleGame();
      const sockets = this.ctx.getWebSockets();
      return Response.json({
        online: sockets.length > 0,
        socketCount: sockets.length,
        activeGameId: this.activeGameId,
        activeQueuePool: this.activeQueuePool,
      });
    }

    // 12. Cross-DO User Message Rate Limiter (B7-03)
    if (url.pathname.endsWith("/rate-limit-tick") && request.method === "POST") {
      const now = Date.now();
      const body = (await request.json().catch(() => ({}))) as { maxPerSec?: number };
      const limit = body.maxPerSec ?? 25;
      if (now - this.messageWindowStartMs < 1000) {
        this.messageCountInWindow++;
        if (this.messageCountInWindow > limit) {
          return Response.json(
            {
              allowed: false,
              count: this.messageCountInWindow,
              error: {
                code: "RATE_LIMITED",
                message: `User message rate limit exceeded (max ${limit}/sec across connections)`,
              },
            },
            { status: 429 },
          );
        }
      } else {
        this.messageWindowStartMs = now;
        this.messageCountInWindow = 1;
      }
      return Response.json({ allowed: true, count: this.messageCountInWindow });
    }

    // 13. Cross-DO User Chat Rate Limiter (B7-03)
    if (url.pathname.endsWith("/chat-rate-limit-tick") && request.method === "POST") {
      const now = Date.now();
      const body = (await request.json().catch(() => ({}))) as {
        maxPerWindow?: number;
        windowMs?: number;
      };
      const limit = body.maxPerWindow ?? 3;
      const windowMs = body.windowMs ?? 5000;
      if (now - this.chatWindowStartMs < windowMs) {
        this.chatCountInWindow++;
        if (this.chatCountInWindow > limit) {
          return Response.json(
            {
              allowed: false,
              count: this.chatCountInWindow,
              error: {
                code: "RATE_LIMITED",
                message: `User chat rate limit exceeded (max ${limit} per 5 seconds across connections)`,
              },
            },
            { status: 429 },
          );
        }
      } else {
        this.chatWindowStartMs = now;
        this.chatCountInWindow = 1;
      }
      return Response.json({ allowed: true, count: this.chatCountInWindow });
    }

    return new Response("Not Found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
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

    // 1. Authenticate with Ticket
    if (frame.type === "AUTH") {
      const secret = getWsTicketSecret(this.env);
      const verification = await verifyWsTicket(frame.payload.ticket, secret);

      if (!verification.valid) {
        ws.close(WS_CLOSE_CODES.UNAUTHORIZED, verification.reason || "Invalid ticket");
        return;
      }

      if (verification.payload.scope !== "user") {
        ws.close(WS_CLOSE_CODES.UNAUTHORIZED, "Invalid ticket scope: expected 'user'");
        return;
      }

      if (!(await this.replayGuard.consume(verification.payload.jti, verification.payload.exp))) {
        ws.close(WS_CLOSE_CODES.UNAUTHORIZED, "Ticket already used");
        return;
      }

      const p = verification.payload;
      attachment.userId = p.userId;
      attachment.userName = p.userName;
      attachment.rating = p.rating;
      attachment.userRole = p.userRole;
      attachment.authenticated = true;
      attachment.lastHeartbeatAt = Date.now();
      ws.serializeAttachment(attachment);
      return;
    }

    if (!attachment.authenticated) {
      ws.close(WS_CLOSE_CODES.UNAUTHORIZED, "Unauthenticated");
      return;
    }

    // 2. Heartbeat Ping
    if (frame.type === "HEARTBEAT_PING") {
      const seq =
        "payload" in frame &&
        frame.payload &&
        typeof frame.payload === "object" &&
        "clientSeq" in frame.payload
          ? (frame.payload as { clientSeq?: number }).clientSeq
          : undefined;

      attachment.lastHeartbeatAt = Date.now();
      ws.serializeAttachment(attachment);

      this.send(ws, {
        v: PROTOCOL_VERSION,
        type: "HEARTBEAT_PONG",
        serverTime: Date.now(),
        payload: { clientSeq: seq },
      });
    }
  }

  async webSocketClose(_ws: WebSocket): Promise<void> {
    // Sockets are cleaned up automatically by Cloudflare Workers runtime
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }
}

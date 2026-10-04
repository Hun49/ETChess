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
import { buildRatingUpdateSet, fetchUserCategoryRating } from "../lib/ratingStorage";
import { getWsTicketSecret } from "../lib/secrets";
import { TicketReplayGuard, verifyWsTicket } from "../lib/wsTicket";
import type { Env } from "../types";

export interface StoredTimer {
  kind: "FIRST_MOVE_DEADLINE" | "CLOCK_FLAG" | "DISCONNECT_GRACE" | "AUTO_CLOSE" | "FINALIZE_RETRY";
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
}

export interface StoredGameSessionState {
  version: number;
  ply: number;
  gameId: string;
  fen: string;
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
  takebackOfferFrom?: "white" | "black" | null;
  takebackOfferPly?: number | null;
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
}

interface SocketAttachment {
  userId: string;
  userName: string;
  role: "white" | "black" | "spectator";
  authenticated: boolean;
  authTimeoutTimer?: number;
}

export class GameSessionDO extends DurableObject<Env> {
  private state: StoredGameSessionState | null = null;
  private timers: StoredTimer[] = [];
  private replayGuard = new TicketReplayGuard();

  private async loadState(): Promise<StoredGameSessionState | null> {
    if (!this.state) {
      this.state = (await this.ctx.storage.get<StoredGameSessionState>("gameState")) ?? null;
      this.timers = (await this.ctx.storage.get<StoredTimer[]>("timers")) ?? [];
    }
    return this.state;
  }

  /**
   * "Durable before visible" (Change 4):
   * Always persists state and timers to durable storage before any broadcast.
   */
  private async persistState(): Promise<void> {
    if (!this.state) return;
    await this.ctx.storage.put("gameState", this.state);
    await this.ctx.storage.put("timers", this.timers);
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

      const tc = TIME_CONTROLS[body.timeControl] || TIME_CONTROLS["3+2"];
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

    // 3. WebSocket Connection Upgrade
    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const state = await this.loadState();
      if (!state) {
        return new Response("Game session not initialized", { status: 404 });
      }

      const url = new URL(request.url);
      const queryTicket = url.searchParams.get("ticket");

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      const attachment: SocketAttachment = {
        userId: "",
        userName: "",
        role: "spectator",
        authenticated: false,
      };

      this.ctx.acceptWebSocket(server);
      server.serializeAttachment(attachment);

      if (queryTicket) {
        // Authenticate immediately if ticket is passed in query
        await this.handleAuthFrame(server, attachment, queryTicket);
      } else {
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
      }

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
      case "MOVE_INTENT":
      case "MOVE": {
        const payload = "payload" in frame ? frame.payload : frame;
        await this.handleMove(ws, attachment, payload);
        break;
      }

      case "DRAW_OFFER":
      case "OFFER_DRAW": {
        await this.handleDrawOffer(ws, attachment);
        break;
      }

      case "DRAW_RESPONSE":
      case "RESPOND_DRAW": {
        const accept =
          "accept" in frame ? !!frame.accept : "payload" in frame ? !!frame.payload.accept : false;
        await this.handleDrawResponse(ws, attachment, accept);
        break;
      }

      case "RESIGN": {
        await this.handleResign(ws, attachment);
        break;
      }

      case "TAKEBACK_REQUEST": {
        await this.handleTakebackRequest(ws, attachment);
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

      case "HEARTBEAT_PING":
      case "PING": {
        const seq =
          "payload" in frame &&
          frame.payload &&
          typeof frame.payload === "object" &&
          "clientSeq" in frame.payload
            ? (frame.payload as { clientSeq?: number }).clientSeq
            : "seq" in frame
              ? (frame as { seq?: number }).seq
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

    // Replay protection: single-use ticket check
    if (!this.replayGuard.consume(jti, exp)) {
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

    attachment.userId = userId;
    attachment.userName = userName;
    attachment.role = role;
    attachment.authenticated = true;
    ws.serializeAttachment(attachment);

    // If active player connected, update presence and cancel disconnect grace timer
    if (role === "white" || role === "black") {
      const player = role === "white" ? state.whitePlayer : state.blackPlayer;
      const wasDisconnected = !player.connected;
      player.connected = true;
      player.disconnectedAt = null;

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

    // 2. Ply sequence check
    if (payload.expectedPly !== undefined && payload.expectedPly !== state.ply) {
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
    const moveValidation = validateAndApplyMove(state.fen, {
      from: payload.from,
      to: payload.to,
      promotion: payload.promotion as "q" | "r" | "b" | "n" | undefined,
    });

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
      },
      now,
    );

    if (clockResult.flagged) {
      await this.handleTimeout(state.turn === "w" ? "white" : "black");
      return;
    }

    // 5. Update state
    state.whiteMs = clockResult.whiteMs;
    state.blackMs = clockResult.blackMs;
    state.lastMoveServerTime = now;
    state.turn = snapshot.turn;
    state.fen = snapshot.fen;
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

    // RULE-09: Cooldown between offers by same player
    if (
      state.drawOfferFrom === attachment.role &&
      state.drawOfferPly !== null &&
      state.drawOfferPly !== undefined &&
      state.ply - state.drawOfferPly < PRODUCT_RULES.DRAW_COOLDOWN_PLIES
    ) {
      this.send(ws, {
        v: PROTOCOL_VERSION,
        type: "ERROR",
        code: "DRAW_COOLDOWN",
        message: "You must wait 5 plies before offering another draw",
        serverTime: Date.now(),
      });
      return;
    }

    state.drawOfferFrom = attachment.role;
    state.drawOfferPly = state.ply;
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
      await this.persistState();
      await this.finalizeGame();
    } else {
      state.drawOfferFrom = null;
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

    state.status = "ended";
    state.winnerRole = attachment.role === "white" ? "black" : "white";
    state.result = attachment.role === "white" ? "0-1" : "1-0";
    state.termination = "resignation";

    await this.persistState();
    await this.finalizeGame();
  }

  private async handleTakebackRequest(ws: WebSocket, attachment: SocketAttachment): Promise<void> {
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
    if (attachment.role === state.takebackOfferFrom) return;

    state.takebackOfferFrom = null;

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

    // Rewind 2 plies if taking back full turn, or 1 ply if opponent made last move
    const rewound = applyTakeback(state.moves, 2);
    state.fen = rewound.fen;
    state.ply = rewound.ply;
    state.turn = rewound.turn;
    state.moves = rewound.moves;
    state.version++;

    // Re-arm clock flag timer for turn to move
    this.removeTimer((t) => t.kind === "CLOCK_FLAG" || t.kind === "FIRST_MOVE_DEADLINE");
    if (state.ply >= 2) {
      const activeMs = state.turn === "w" ? state.whiteMs : state.blackMs;
      this.addTimer({
        kind: "CLOCK_FLAG",
        dueAt: Date.now() + activeMs,
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

    const resolution = resolveTimeout(state.fen, flaggedColor);
    state.status = "ended";
    state.result = resolution.result;
    state.winnerRole = resolution.winnerRole;
    state.termination = resolution.termination;

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
    const state = await this.loadState();
    if (!state || state.finalized) return;

    state.endedAt = Date.now();
    this.timers = []; // Clear active match timers

    // 1. Calculate Glicko-2 ratings if rated and not aborted
    if (state.rated && state.status === "ended" && state.result && state.result !== "aborted") {
      const score = state.result === "1-0" ? 1 : state.result === "0-1" ? 0 : 0.5;

      const whiteRd = state.whitePlayer.rd ?? PRODUCT_RULES.GLICKO2_DEFAULT_RD;
      const whiteVol = state.whitePlayer.vol ?? PRODUCT_RULES.GLICKO2_DEFAULT_VOLATILITY;
      const blackRd = state.blackPlayer.rd ?? PRODUCT_RULES.GLICKO2_DEFAULT_RD;
      const blackVol = state.blackPlayer.vol ?? PRODUCT_RULES.GLICKO2_DEFAULT_VOLATILITY;

      const ratingCalc = applyGameResult({
        whiteRating: {
          rating: state.whitePlayer.rating,
          deviation: whiteRd,
          volatility: whiteVol,
        },
        blackRating: {
          rating: state.blackPlayer.rating,
          deviation: blackRd,
          volatility: blackVol,
        },
        score,
      });

      state.whiteRatingBefore = ratingCalc.white.ratingBefore;
      state.whiteRatingAfter = ratingCalc.white.ratingAfter;
      state.whiteRatingDiff = ratingCalc.white.diff;
      state.whiteRdBefore = ratingCalc.white.rdBefore;
      state.whiteRdAfter = ratingCalc.white.rdAfter;
      state.whiteVolBefore = ratingCalc.white.volatilityBefore;
      state.whiteVolAfter = ratingCalc.white.volatilityAfter;

      state.blackRatingBefore = ratingCalc.black.ratingBefore;
      state.blackRatingAfter = ratingCalc.black.ratingAfter;
      state.blackRatingDiff = ratingCalc.black.diff;
      state.blackRdBefore = ratingCalc.black.rdBefore;
      state.blackRdAfter = ratingCalc.black.rdAfter;
      state.blackVolBefore = ratingCalc.black.volatilityBefore;
      state.blackVolAfter = ratingCalc.black.volatilityAfter;
    }

    // 2. Build official PGN with headers
    state.pgn = buildPgn({
      event: state.rated ? "ET Chess Rated Match" : "ET Chess Casual Match",
      white: state.whitePlayer.userName,
      black: state.blackPlayer.userName,
      whiteElo: state.whitePlayer.rating,
      blackElo: state.blackPlayer.rating,
      timeControl: state.timeControl,
      result: (state.result as "1-0" | "0-1" | "1/2-1/2" | "*") || "*",
      termination: state.termination,
      moves: state.moves,
    });

    // 3. Batch write to D1 Database with idempotence and retry resilience (H1 & H2)
    if (!state.persistedToD1) {
      try {
        const db = drizzle(this.env.DB, { schema });

        let whiteUpdateSet: Record<string, unknown> | null = null;
        let blackUpdateSet: Record<string, unknown> | null = null;

        if (state.rated && state.whiteRatingAfter != null && state.blackRatingAfter != null) {
          const whiteCurrent = await fetchUserCategoryRating(
            db,
            state.whitePlayer.userId,
            state.category,
          );
          const blackCurrent = await fetchUserCategoryRating(
            db,
            state.blackPlayer.userId,
            state.category,
          );

          const whiteOutcome: "win" | "loss" | "draw" =
            state.result === "1-0" ? "win" : state.result === "0-1" ? "loss" : "draw";
          const blackOutcome: "win" | "loss" | "draw" =
            state.result === "0-1" ? "win" : state.result === "1-0" ? "loss" : "draw";

          whiteUpdateSet = buildRatingUpdateSet(
            state.category,
            {
              rating: state.whiteRatingAfter,
              rd: state.whiteRdAfter ?? whiteCurrent.rd,
              vol: state.whiteVolAfter ?? whiteCurrent.vol,
            },
            whiteCurrent,
            whiteOutcome,
          );

          blackUpdateSet = buildRatingUpdateSet(
            state.category,
            {
              rating: state.blackRatingAfter,
              rd: state.blackRdAfter ?? blackCurrent.rd,
              vol: state.blackVolAfter ?? blackCurrent.vol,
            },
            blackCurrent,
            blackOutcome,
          );
        }

        await db.batch([
          db
            .insert(schema.games)
            .values({
              id: state.gameId,
              whitePlayerId: state.whitePlayer.userId,
              blackPlayerId: state.blackPlayer.userId,
              timeControl: state.timeControl,
              category: state.category,
              moves: JSON.stringify(state.moves),
              result: state.result || "*",
              termination: state.termination || "unknown",
              whiteRatingBefore: state.whiteRatingBefore,
              whiteRatingChange: state.whiteRatingDiff,
              blackRatingBefore: state.blackRatingBefore,
              blackRatingChange: state.blackRatingDiff,
              startedAt: new Date(state.startedAt),
              endedAt: new Date(state.endedAt),
            })
            .onConflictDoNothing({ target: schema.games.id }),
          ...(whiteUpdateSet
            ? [
                db
                  .update(schema.ratings)
                  .set(whiteUpdateSet)
                  .where(eq(schema.ratings.userId, state.whitePlayer.userId)),
              ]
            : []),
          ...(blackUpdateSet
            ? [
                db
                  .update(schema.ratings)
                  .set(blackUpdateSet)
                  .where(eq(schema.ratings.userId, state.blackPlayer.userId)),
              ]
            : []),
        ]);

        state.persistedToD1 = true;
        state.finalized = true;
      } catch (err) {
        console.error("Failed to write game batch to D1, scheduling retry:", err);
        state.persistedToD1 = false;
        // Schedule retry timer for D1 persistence (H2)
        this.addTimer({
          kind: "FINALIZE_RETRY",
          dueAt: Date.now() + 2000,
          ply: state.ply,
          version: state.version,
        });
      }
    }

    // 4. Persist finalized state to DO storage
    await this.persistState();

    // 5. Broadcast GAME_TERMINATED frame
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

    MetricsCollector.gamesEnded(state.termination || "unknown", {
      rated: state.rated,
      result: state.result,
    });

    // 6. Schedule auto-close alarm in 5 minutes
    this.addTimer({
      kind: "AUTO_CLOSE",
      dueAt: Date.now() + 300_000,
      ply: state.ply,
      version: state.version,
    });
    await this.syncAlarm();
  }

  /**
   * Multiplexed Alarms Handler (Change 3).
   * Validates each due timer against current state, dropping stale timers silently.
   */
  async alarm(): Promise<void> {
    const state = await this.loadState();
    if (!state) return;

    const now = Date.now();
    const minDueAt = this.timers.length > 0 ? Math.min(...this.timers.map((t) => t.dueAt)) : 0;
    const threshold = Math.max(now, minDueAt);
    const dueTimers = this.timers.filter((t) => t.dueAt <= threshold);

    for (const timer of dueTimers) {
      MetricsCollector.alarmsFired(timer.kind);

      switch (timer.kind) {
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
          // Disconnected player forfeits (RULE-02)
          state.status = "ended";
          state.winnerRole = timer.role === "white" ? "black" : "white";
          state.result = timer.role === "white" ? "0-1" : "1-0";
          state.termination = "abandoned";
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
          // Clean up completed session
          break;
        }
      }
    }

    // Purge executed timers and re-arm alarm
    this.timers = this.timers.filter((t) => t.dueAt > threshold);
    await this.ctx.storage.put("timers", this.timers);
    await this.syncAlarm();
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    if (!attachment || !attachment.authenticated) return;

    const state = await this.loadState();
    if (!state || state.status !== "active") return;

    if (attachment.role === "white" || attachment.role === "black") {
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

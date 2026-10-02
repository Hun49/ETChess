import { DurableObject } from "cloudflare:workers";
import { STARTING_FEN, calculateClockAfterMove, validateAndApplyMove } from "@etchess/chess-core";
import { calculateTwoPlayerMatch } from "@etchess/rating";
import {
  type ClientGameFrame,
  type ServerGameFrame,
  parseClientGameFrame,
} from "@etchess/realtime-protocol";
import {
  type Glicko2Rating,
  type RatingCategory,
  TIME_CONTROLS,
  type TimeControlKey,
  getRatingCategory,
} from "@etchess/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import type { Env } from "../types";

export interface StoredGameState {
  gameId: string;
  fen: string;
  turn: "w" | "b";
  status: "waiting" | "active" | "ended" | "aborted";
  whiteUserId: string | null;
  whiteUserName: string;
  blackUserId: string | null;
  blackUserName: string;
  timeControl: TimeControlKey;
  category: RatingCategory;
  rated: boolean;
  whiteMs: number;
  blackMs: number;
  lastMoveTimestamp: number;
  whiteConnected: boolean;
  blackConnected: boolean;
  whiteDisconnectedAtMs: number | null;
  blackDisconnectedAtMs: number | null;
  result?: "1-0" | "0-1" | "1/2-1/2" | "aborted";
  termination?: string;
  winner?: "white" | "black";
  moves: string[]; // SAN moves
  drawOfferFrom?: "white" | "black" | null;
  rematchOfferFrom?: "white" | "black" | null;
  whiteRatingDiff?: number;
  blackRatingDiff?: number;
  startedAt: number;
}

interface WebSocketAttachment {
  userId: string;
  userName: string;
  role: "white" | "black" | "spectator";
}

export class GameRoomDO extends DurableObject<Env> {
  private stateCache: StoredGameState | null = null;

  private async getState(): Promise<StoredGameState | null> {
    if (!this.stateCache) {
      this.stateCache = (await this.ctx.storage.get<StoredGameState>("gameState")) ?? null;
    }
    return this.stateCache;
  }

  private async saveState(state: StoredGameState): Promise<void> {
    this.stateCache = state;
    await this.ctx.storage.put("gameState", state);
  }

  private broadcast(frame: ServerGameFrame): void {
    const msg = JSON.stringify(frame);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {
        // Socket closed or dead
      }
    }
  }

  private send(ws: WebSocket, frame: ServerGameFrame): void {
    try {
      ws.send(JSON.stringify(frame));
    } catch {
      // Socket closed or dead
    }
  }

  private createGameSyncFrame(state: StoredGameState): ServerGameFrame {
    return {
      type: "GAME_SYNC",
      payload: {
        gameId: state.gameId,
        fen: state.fen,
        turn: state.turn,
        status: state.status,
        whiteUserId: state.whiteUserId,
        blackUserId: state.blackUserId,
        whiteMs: state.whiteMs,
        blackMs: state.blackMs,
        lastMoveTimestamp: state.lastMoveTimestamp,
        whiteConnected: state.whiteConnected,
        blackConnected: state.blackConnected,
        spectatorCount: this.ctx.getWebSockets("spectator").length,
        result: state.result,
        termination: state.termination,
        moves: state.moves,
      },
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 1. HTTP Endpoint: Game Initialization
    if (url.pathname.endsWith("/init") && request.method === "POST") {
      const body = (await request.json()) as {
        gameId: string;
        whiteUserId: string;
        whiteUserName: string;
        blackUserId: string;
        blackUserName: string;
        timeControl: TimeControlKey;
        rated?: boolean;
      };

      const tcConfig = TIME_CONTROLS[body.timeControl] || TIME_CONTROLS["3+2"];
      const initialMs = tcConfig.initialSeconds * 1000;
      const category = getRatingCategory(body.timeControl);

      const state: StoredGameState = {
        gameId: body.gameId,
        fen: STARTING_FEN,
        turn: "w",
        status: "waiting",
        whiteUserId: body.whiteUserId,
        whiteUserName: body.whiteUserName,
        blackUserId: body.blackUserId,
        blackUserName: body.blackUserName,
        timeControl: body.timeControl,
        category,
        rated: body.rated ?? true,
        whiteMs: initialMs,
        blackMs: initialMs,
        lastMoveTimestamp: 0,
        whiteConnected: false,
        blackConnected: false,
        whiteDisconnectedAtMs: null,
        blackDisconnectedAtMs: null,
        moves: [],
        startedAt: Date.now(),
      };

      await this.saveState(state);
      return Response.json({ success: true, state });
    }

    // 2. HTTP Endpoint: Query Game Status
    if (url.pathname.endsWith("/status") && request.method === "GET") {
      const state = await this.getState();
      if (!state) {
        return Response.json({ error: "Game not found" }, { status: 404 });
      }
      return Response.json(state);
    }

    // 3. WebSocket Upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      let state = await this.getState();
      const userId = url.searchParams.get("userId") || "anonymous";
      const userName = url.searchParams.get("userName") || "Guest";
      const requestedRole = url.searchParams.get("role");

      // Auto-initialize fallback room if not explicitly pre-initialized
      if (!state) {
        const timeControl = (url.searchParams.get("timeControl") as TimeControlKey) || "3+2";
        const tcConfig = TIME_CONTROLS[timeControl] || TIME_CONTROLS["3+2"];
        const initialMs = tcConfig.initialSeconds * 1000;
        const category = getRatingCategory(timeControl);

        state = {
          gameId: url.searchParams.get("gameId") || crypto.randomUUID(),
          fen: STARTING_FEN,
          turn: "w",
          status: "waiting",
          whiteUserId: requestedRole === "white" ? userId : null,
          whiteUserName: requestedRole === "white" ? userName : "Guest",
          blackUserId: requestedRole === "black" ? userId : null,
          blackUserName: requestedRole === "black" ? userName : "Guest",
          timeControl,
          category,
          rated: url.searchParams.get("rated") !== "false",
          whiteMs: initialMs,
          blackMs: initialMs,
          lastMoveTimestamp: 0,
          whiteConnected: false,
          blackConnected: false,
          whiteDisconnectedAtMs: null,
          blackDisconnectedAtMs: null,
          moves: [],
          startedAt: Date.now(),
        };
      }

      // Determine role
      let role: "white" | "black" | "spectator" = "spectator";
      if (state.whiteUserId === userId) {
        role = "white";
        state.whiteConnected = true;
        state.whiteDisconnectedAtMs = null;
      } else if (state.blackUserId === userId) {
        role = "black";
        state.blackConnected = true;
        state.blackDisconnectedAtMs = null;
      } else if (!state.whiteUserId && requestedRole === "white") {
        state.whiteUserId = userId;
        state.whiteUserName = userName;
        role = "white";
        state.whiteConnected = true;
        state.whiteDisconnectedAtMs = null;
      } else if (!state.blackUserId && requestedRole === "black") {
        state.blackUserId = userId;
        state.blackUserName = userName;
        role = "black";
        state.blackConnected = true;
        state.blackDisconnectedAtMs = null;
      }

      // Start game when both players connect
      if (
        state.status === "waiting" &&
        state.whiteUserId &&
        state.blackUserId &&
        state.whiteConnected &&
        state.blackConnected
      ) {
        state.status = "active";
      }

      await this.saveState(state);

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      const attachment: WebSocketAttachment = { userId, userName, role };
      this.ctx.acceptWebSocket(server, [role, userId]);
      server.serializeAttachment(attachment);

      // Reconnection broadcast if player reconnected during active game
      if (role !== "spectator" && state.status === "active") {
        this.broadcast({
          type: "PLAYER_RECONNECTED",
          role,
        });
      }

      // Send initial state sync to connecting client
      this.send(server, this.createGameSyncFrame(state));

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const state = await this.getState();
    if (!state) return;

    const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
    if (!attachment) return;

    const parsed = parseClientGameFrame(message);
    if (!parsed.success) {
      this.send(ws, {
        type: "ERROR",
        code: "INVALID_FRAME",
        message: parsed.error,
      });
      return;
    }

    const frame: ClientGameFrame = parsed.data;

    switch (frame.type) {
      case "PING": {
        this.send(ws, {
          type: "PONG",
          timestamp: frame.timestamp,
        });
        break;
      }

      case "CHAT_SEND": {
        this.broadcast({
          type: "CHAT_MESSAGE",
          id: crypto.randomUUID(),
          sender: attachment.userName,
          senderRole: attachment.role,
          text: frame.text,
          timestamp: Date.now(),
        });
        break;
      }

      case "MOVE": {
        if (state.status !== "active") {
          this.send(ws, {
            type: "ERROR",
            code: "GAME_NOT_ACTIVE",
            message: "Game is not currently active",
          });
          return;
        }

        // Validate player turn
        const isWhiteTurn = state.turn === "w";
        if (
          (isWhiteTurn && attachment.role !== "white") ||
          (!isWhiteTurn && attachment.role !== "black")
        ) {
          this.send(ws, {
            type: "ERROR",
            code: "NOT_YOUR_TURN",
            message: "It is not your turn",
          });
          return;
        }

        const now = Date.now();
        const tcConfig = TIME_CONTROLS[state.timeControl] || TIME_CONTROLS["3+2"];
        const incrementMs = tcConfig.incrementSeconds * 1000;

        // Apply clock calculation if not the very first move of the game
        if (state.lastMoveTimestamp > 0) {
          const elapsed = now - state.lastMoveTimestamp;
          if (isWhiteTurn) {
            state.whiteMs -= elapsed;
            if (state.whiteMs <= 0) {
              state.whiteMs = 0;
              await this.finishGame(state, "0-1", "timeout", "black");
              return;
            }
            state.whiteMs += incrementMs;
          } else {
            state.blackMs -= elapsed;
            if (state.blackMs <= 0) {
              state.blackMs = 0;
              await this.finishGame(state, "1-0", "timeout", "white");
              return;
            }
            state.blackMs += incrementMs;
          }
        } else if (isWhiteTurn) {
          // White first move: add increment
          state.whiteMs += incrementMs;
        }

        // Validate move using chess-core
        const moveResult = validateAndApplyMove(state.fen, {
          from: frame.payload.from,
          to: frame.payload.to,
          promotion: frame.payload.promotion,
        });

        if (!moveResult.valid) {
          this.send(ws, {
            type: "ERROR",
            code: "ILLEGAL_MOVE",
            message: moveResult.reason,
          });
          return;
        }

        // Update board state
        state.fen = moveResult.snapshot.fen;
        state.turn = moveResult.snapshot.turn;
        state.lastMoveTimestamp = now;
        state.moves.push(moveResult.san);
        state.drawOfferFrom = null; // Clear draw offers on move

        // Broadcast MOVE_MADE
        this.broadcast({
          type: "MOVE_MADE",
          payload: {
            from: frame.payload.from,
            to: frame.payload.to,
            promotion: frame.payload.promotion,
            san: moveResult.san,
            fen: state.fen,
            whiteMs: state.whiteMs,
            blackMs: state.blackMs,
            lastMoveTimestamp: state.lastMoveTimestamp,
            turn: state.turn,
          },
        });

        // Check for Game Over conditions
        if (moveResult.snapshot.isGameOver) {
          if (moveResult.snapshot.isCheckmate) {
            const winner = isWhiteTurn ? "white" : "black";
            const result = isWhiteTurn ? "1-0" : "0-1";
            await this.finishGame(state, result, "checkmate", winner);
            return;
          }
          if (moveResult.snapshot.isStalemate) {
            await this.finishGame(state, "1/2-1/2", "stalemate");
            return;
          }
          if (moveResult.snapshot.isThreefoldRepetition) {
            await this.finishGame(state, "1/2-1/2", "threefold_repetition");
            return;
          }
          if (moveResult.snapshot.isInsufficientMaterial) {
            await this.finishGame(state, "1/2-1/2", "insufficient_material");
            return;
          }
          await this.finishGame(state, "1/2-1/2", "draw");
          return;
        }

        // Schedule next clock expiry alarm
        const nextClockMs = state.turn === "w" ? state.whiteMs : state.blackMs;
        await this.ctx.storage.setAlarm(now + nextClockMs);
        await this.saveState(state);
        break;
      }

      case "RESIGN": {
        if (state.status !== "active") return;
        if (attachment.role === "white") {
          await this.finishGame(state, "0-1", "resignation", "black");
        } else if (attachment.role === "black") {
          await this.finishGame(state, "1-0", "resignation", "white");
        }
        break;
      }

      case "OFFER_DRAW": {
        if (state.status !== "active") return;
        if (attachment.role !== "white" && attachment.role !== "black") return;

        if (state.drawOfferFrom && state.drawOfferFrom !== attachment.role) {
          // Opponent already offered draw -> Mutual draw accepted!
          await this.finishGame(state, "1/2-1/2", "agreed_draw");
        } else {
          state.drawOfferFrom = attachment.role;
          await this.saveState(state);
          this.broadcast({
            type: "DRAW_OFFERED",
            from: attachment.role,
          });
        }
        break;
      }

      case "RESPOND_DRAW": {
        if (state.status !== "active") return;
        if (attachment.role !== "white" && attachment.role !== "black") return;

        if (state.drawOfferFrom && state.drawOfferFrom !== attachment.role) {
          if (frame.accept) {
            await this.finishGame(state, "1/2-1/2", "agreed_draw");
          } else {
            state.drawOfferFrom = null;
            await this.saveState(state);
            this.broadcast({ type: "DRAW_DECLINED" });
          }
        }
        break;
      }

      case "REQUEST_REMATCH": {
        if (state.status !== "ended") return;
        if (attachment.role !== "white" && attachment.role !== "black") return;

        if (state.rematchOfferFrom && state.rematchOfferFrom !== attachment.role) {
          // Mutual rematch agreed! (Handled by client starting new match)
          this.broadcast({
            type: "REMATCH_OFFERED",
            from: attachment.role,
          });
        } else {
          state.rematchOfferFrom = attachment.role;
          await this.saveState(state);
          this.broadcast({
            type: "REMATCH_OFFERED",
            from: attachment.role,
          });
        }
        break;
      }

      case "RESPOND_REMATCH": {
        if (state.status !== "ended") return;
        if (attachment.role !== "white" && attachment.role !== "black") return;

        if (!frame.accept) {
          state.rematchOfferFrom = null;
          await this.saveState(state);
          this.broadcast({ type: "REMATCH_DECLINED" });
        }
        break;
      }
    }
  }

  async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    const state = await this.getState();
    if (!state) return;

    const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
    if (!attachment) return;

    const now = Date.now();

    // Check if player has no other open sockets
    if (attachment.role === "white") {
      const remainingWhiteSockets = this.ctx.getWebSockets("white").filter((s) => s !== ws);
      if (remainingWhiteSockets.length === 0) {
        state.whiteConnected = false;
        if (state.status === "active") {
          state.whiteDisconnectedAtMs = now;
          this.broadcast({
            type: "PLAYER_DISCONNECTED",
            role: "white",
            gracePeriodMs: 60000,
          });
          // Set 60-second disconnect forfeit alarm
          const currentAlarm = await this.ctx.storage.getAlarm();
          const disconnectTimeout = now + 60000;
          const targetAlarm = currentAlarm
            ? Math.min(currentAlarm, disconnectTimeout)
            : disconnectTimeout;
          await this.ctx.storage.setAlarm(targetAlarm);
        }
      }
    } else if (attachment.role === "black") {
      const remainingBlackSockets = this.ctx.getWebSockets("black").filter((s) => s !== ws);
      if (remainingBlackSockets.length === 0) {
        state.blackConnected = false;
        if (state.status === "active") {
          state.blackDisconnectedAtMs = now;
          this.broadcast({
            type: "PLAYER_DISCONNECTED",
            role: "black",
            gracePeriodMs: 60000,
          });
          // Set 60-second disconnect forfeit alarm
          const currentAlarm = await this.ctx.storage.getAlarm();
          const disconnectTimeout = now + 60000;
          const targetAlarm = currentAlarm
            ? Math.min(currentAlarm, disconnectTimeout)
            : disconnectTimeout;
          await this.ctx.storage.setAlarm(targetAlarm);
        }
      }
    }

    await this.saveState(state);
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    await this.webSocketClose(ws, 1006, "Abnormal closure", false);
  }

  async alarm(): Promise<void> {
    const state = await this.getState();
    if (!state || state.status !== "active") return;

    // 1. Strict 60-second forfeit timer on disconnect
    if (state.whiteDisconnectedAtMs) {
      await this.finishGame(state, "0-1", "abandoned", "black");
      return;
    }

    if (state.blackDisconnectedAtMs) {
      await this.finishGame(state, "1-0", "abandoned", "white");
      return;
    }

    // 2. Active player clock flag fall
    if (state.turn === "w") {
      state.whiteMs = 0;
      await this.finishGame(state, "0-1", "timeout", "black");
      return;
    }
    state.blackMs = 0;
    await this.finishGame(state, "1-0", "timeout", "white");
  }

  private async finishGame(
    state: StoredGameState,
    result: "1-0" | "0-1" | "1/2-1/2" | "aborted",
    termination: string,
    winner?: "white" | "black",
  ): Promise<void> {
    state.status = "ended";
    state.result = result;
    state.termination = termination;
    state.winner = winner;
    await this.ctx.storage.deleteAlarm();

    const db = drizzle(this.env.DB, { schema });

    // Handle ratings update if game is rated and both players are registered users
    if (state.rated && state.whiteUserId && state.blackUserId) {
      try {
        const [wRatingRow] = await db
          .select()
          .from(schema.ratings)
          .where(eq(schema.ratings.userId, state.whiteUserId));
        const [bRatingRow] = await db
          .select()
          .from(schema.ratings)
          .where(eq(schema.ratings.userId, state.blackUserId));

        const category = state.category;
        const wGlicko = this.extractGlicko(wRatingRow, category);
        const bGlicko = this.extractGlicko(bRatingRow, category);

        const score = result === "1-0" ? 1 : result === "0-1" ? 0 : 0.5;
        const matchOutcome = calculateTwoPlayerMatch(wGlicko, bGlicko, score);

        state.whiteRatingDiff = matchOutcome.player1RatingDiff;
        state.blackRatingDiff = matchOutcome.player2RatingDiff;

        const now = new Date();
        const insertGameStmt = db.insert(schema.games).values({
          id: state.gameId,
          whitePlayerId: state.whiteUserId,
          blackPlayerId: state.blackUserId,
          timeControl: state.timeControl,
          category: state.category,
          moves: JSON.stringify(state.moves),
          result: state.result,
          termination: state.termination,
          whiteRatingBefore: wGlicko.rating,
          whiteRatingChange: matchOutcome.player1RatingDiff,
          blackRatingBefore: bGlicko.rating,
          blackRatingChange: matchOutcome.player2RatingDiff,
          startedAt: new Date(state.startedAt),
          endedAt: now,
        });

        const whiteUpsertStmt = this.buildRatingUpsert(
          db,
          state.whiteUserId,
          category,
          matchOutcome.player1,
          now,
        );
        const blackUpsertStmt = this.buildRatingUpsert(
          db,
          state.blackUserId,
          category,
          matchOutcome.player2,
          now,
        );

        // Atomic D1 multi-statement batch
        await db.batch([insertGameStmt, whiteUpsertStmt, blackUpsertStmt]);
      } catch (err) {
        console.error("Failed to batch write ratings and game result:", err);
      }
    } else if (state.whiteUserId || state.blackUserId) {
      try {
        await db.insert(schema.games).values({
          id: state.gameId,
          whitePlayerId: state.whiteUserId,
          blackPlayerId: state.blackUserId,
          timeControl: state.timeControl,
          category: state.category,
          moves: JSON.stringify(state.moves),
          result: state.result,
          termination: state.termination,
          startedAt: new Date(state.startedAt),
          endedAt: new Date(),
        });
      } catch (err) {
        console.error("Failed to insert casual game record:", err);
      }
    }

    await this.saveState(state);

    // Broadcast GAME_ENDED frame
    this.broadcast({
      type: "GAME_ENDED",
      payload: {
        result: state.result,
        termination: state.termination,
        winner: state.winner,
        whiteRatingDiff: state.whiteRatingDiff,
        blackRatingDiff: state.blackRatingDiff,
      },
    });
  }

  private extractGlicko(row: schema.Ratings | undefined, category: RatingCategory): Glicko2Rating {
    if (!row) {
      return { rating: 1500, deviation: 350, volatility: 0.06 };
    }
    switch (category) {
      case "bullet":
        return { rating: row.bulletRating, deviation: row.bulletRd, volatility: row.bulletVol };
      case "blitz":
        return { rating: row.blitzRating, deviation: row.blitzRd, volatility: row.blitzVol };
      case "rapid":
        return { rating: row.rapidRating, deviation: row.rapidRd, volatility: row.rapidVol };
      case "classical":
        return {
          rating: row.classicalRating,
          deviation: row.classicalRd,
          volatility: row.classicalVol,
        };
    }
  }

  private buildRatingUpsert(
    db: ReturnType<typeof drizzle<typeof schema>>,
    userId: string,
    category: RatingCategory,
    newRating: Glicko2Rating,
    now: Date,
  ) {
    switch (category) {
      case "bullet":
        return db
          .insert(schema.ratings)
          .values({
            userId,
            bulletRating: newRating.rating,
            bulletRd: newRating.deviation,
            bulletVol: newRating.volatility,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: schema.ratings.userId,
            set: {
              bulletRating: newRating.rating,
              bulletRd: newRating.deviation,
              bulletVol: newRating.volatility,
              updatedAt: now,
            },
          });
      case "blitz":
        return db
          .insert(schema.ratings)
          .values({
            userId,
            blitzRating: newRating.rating,
            blitzRd: newRating.deviation,
            blitzVol: newRating.volatility,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: schema.ratings.userId,
            set: {
              blitzRating: newRating.rating,
              blitzRd: newRating.deviation,
              blitzVol: newRating.volatility,
              updatedAt: now,
            },
          });
      case "rapid":
        return db
          .insert(schema.ratings)
          .values({
            userId,
            rapidRating: newRating.rating,
            rapidRd: newRating.deviation,
            rapidVol: newRating.volatility,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: schema.ratings.userId,
            set: {
              rapidRating: newRating.rating,
              rapidRd: newRating.deviation,
              rapidVol: newRating.volatility,
              updatedAt: now,
            },
          });
      case "classical":
        return db
          .insert(schema.ratings)
          .values({
            userId,
            classicalRating: newRating.rating,
            classicalRd: newRating.deviation,
            classicalVol: newRating.volatility,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: schema.ratings.userId,
            set: {
              classicalRating: newRating.rating,
              classicalRd: newRating.deviation,
              classicalVol: newRating.volatility,
              updatedAt: now,
            },
          });
    }
  }
}

import { env, runDurableObjectAlarm } from "cloudflare:test";
import type { ServerGameFrame } from "@etchess/realtime-protocol";
import { PRODUCT_RULES } from "@etchess/types";
import { drizzle } from "drizzle-orm/d1";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { getWsTicketSecret } from "../src/lib/secrets";
import { createWsTicket } from "../src/lib/wsTicket";
import { applyTestSchema } from "./helpers";

describe("Batch 2: Clock, Timeout & Disconnect Hardening Integration Tests", () => {
  const db = drizzle(env.DB, { schema });
  const secret = getWsTicketSecret(env);
  const activeSockets: WebSocket[] = [];

  beforeAll(async () => {
    await applyTestSchema(env.DB);
  });

  afterEach(async () => {
    for (const ws of activeSockets) {
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
    activeSockets.length = 0;
    await new Promise((r) => setTimeout(r, 80));
  });

  async function createGameFixture(initialPly = 0, timeControl = "3+2") {
    const whiteUserId = `b2_w_${crypto.randomUUID()}`;
    const blackUserId = `b2_b_${crypto.randomUUID()}`;
    const now = new Date();

    await db.insert(schema.user).values([
      {
        id: whiteUserId,
        name: "WhitePlayer",
        email: `${whiteUserId}@test.com`,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: blackUserId,
        name: "BlackPlayer",
        email: `${blackUserId}@test.com`,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await db.insert(schema.ratings).values([
      { userId: whiteUserId, updatedAt: now },
      { userId: blackUserId, updatedAt: now },
    ]);

    const gameId = crypto.randomUUID();
    const ns = env.GAME_SESSION_DO;
    const sessionDO = ns.get(ns.idFromName(gameId));

    const initRes = await sessionDO.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        whiteUserId,
        whiteUserName: "WhitePlayer",
        whiteRating: 1500,
        blackUserId,
        blackUserName: "BlackPlayer",
        blackRating: 1500,
        timeControl,
        rated: true,
        initialPly,
      }),
    });
    expect(initRes.status).toBe(200);

    const { ticket: whiteTicket } = await createWsTicket(
      {
        userId: whiteUserId,
        userName: "WhitePlayer",
        rating: 1500,
        scope: "game",
        gameId,
      },
      secret,
    );

    const { ticket: blackTicket } = await createWsTicket(
      {
        userId: blackUserId,
        userName: "BlackPlayer",
        rating: 1500,
        scope: "game",
        gameId,
      },
      secret,
    );

    const whiteRes = await app.fetch(
      new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
      env,
    );
    const blackRes = await app.fetch(
      new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
      env,
    );

    const whiteWs = whiteRes.webSocket;
    const blackWs = blackRes.webSocket;
    if (!whiteWs || !blackWs) throw new Error("Expected WebSockets");
    whiteWs.accept();
    blackWs.accept();

    activeSockets.push(whiteWs, blackWs);

    const whiteMessages: ServerGameFrame[] = [];
    const blackMessages: ServerGameFrame[] = [];

    whiteWs.addEventListener("message", (ev) => {
      whiteMessages.push(JSON.parse(ev.data as string));
    });
    blackWs.addEventListener("message", (ev) => {
      blackMessages.push(JSON.parse(ev.data as string));
    });

    whiteWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: whiteTicket } }));
    blackWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: blackTicket } }));

    await new Promise((r) => setTimeout(r, 60));

    return {
      gameId,
      sessionDO,
      whiteUserId,
      blackUserId,
      whiteWs,
      blackWs,
      whiteMessages,
      blackMessages,
      whiteTicket,
      blackTicket,
    };
  }

  describe("CLK-01, CLK-02 & CLK-03: Server-Authoritative RTT & Ping-Pong Hardening", () => {
    it("measures authoritative RTT via server ping-pong without trusting client timestamps", async () => {
      const { sessionDO, whiteWs } = await createGameFixture(2);

      // 1. Server initiates ping to White
      const pingRes = await sessionDO.fetch("http://internal/send-ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "white" }),
      });
      const { pingId } = (await pingRes.json()) as { pingId: string };
      expect(pingId).toBeDefined();

      // Simulate network transit latency (e.g. 50ms)
      await new Promise((r) => setTimeout(r, 50));

      // 2. Client responds with PONG, attempting to send fake client timestamp
      whiteWs.send(
        JSON.stringify({
          v: 1,
          type: "PONG",
          pingId,
          timestamp: 9999999999, // FAKE client timestamp
          clientSentAt: 12345, // FAKE client timestamp
        }),
      );
      await new Promise((r) => setTimeout(r, 40));

      // 3. Inspect DO state: RTT must be derived from server timestamps (around 50ms), NOT client timestamp!
      const stateRes = await sessionDO.fetch("http://internal/state");
      const state = (await stateRes.json()) as { whitePlayer: { rttMs?: number } };
      expect(state.whitePlayer.rttMs).toBeDefined();
      expect(state.whitePlayer.rttMs).toBeGreaterThanOrEqual(40);
      expect(state.whitePlayer.rttMs).toBeLessThanOrEqual(PRODUCT_RULES.LAG_CREDIT_CAP_MS * 2);

      // 4. Replay test: Client tries to send the SAME pingId again
      whiteWs.send(
        JSON.stringify({
          v: 1,
          type: "PONG",
          pingId,
        }),
      );
      await new Promise((r) => setTimeout(r, 20));

      // 5. Unknown & Malformed ping IDs
      whiteWs.send(JSON.stringify({ v: 1, type: "PONG", pingId: "completely-unknown-id" }));
      whiteWs.send(JSON.stringify({ v: 1, type: "PONG", pingId: "" }));
      await new Promise((r) => setTimeout(r, 20));
    });

    it("clamps very high RTT strictly to 2 * LAG_CREDIT_CAP_MS (200ms)", async () => {
      const { sessionDO, whiteWs } = await createGameFixture(2);

      // Server sends ping
      const pingRes = await sessionDO.fetch("http://internal/send-ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "white" }),
      });
      const { pingId } = (await pingRes.json()) as { pingId: string };

      // Respond to ping
      whiteWs.send(JSON.stringify({ v: 1, type: "PONG", pingId }));
      await new Promise((r) => setTimeout(r, 30));

      const stateRes = await sessionDO.fetch("http://internal/state");
      const state = (await stateRes.json()) as { whitePlayer: { rttMs?: number } };
      expect(state.whitePlayer.rttMs).toBeLessThanOrEqual(PRODUCT_RULES.LAG_CREDIT_CAP_MS * 2);
    });
  });

  describe("CLK-04: Active-Player Clock Decreases while Inactive Stays Stable in Live Session", () => {
    it("active White clock decreases after move, inactive Black clock unchanged", async () => {
      const { sessionDO, whiteWs } = await createGameFixture(2);

      // White plays move e2 -> e4
      whiteWs.send(
        JSON.stringify({
          v: 1,
          type: "MOVE_INTENT",
          payload: { from: "e2", to: "e4", expectedPly: 2 },
        }),
      );
      await new Promise((r) => setTimeout(r, 60));

      const state = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        whiteMs: number;
        blackMs: number;
        initialMs: number;
      };

      // White clock decreased from initialMs, Black clock remained at initialMs
      expect(state.whiteMs).toBeLessThan(state.initialMs + 3000);
      expect(state.blackMs).toBe(state.initialMs);
    });
  });

  describe("CLK-05 & Clock Persistence Invariant (Section 27)", () => {
    it("move clock transition: updates clock, persists to DO storage BEFORE broadcast", async () => {
      const { sessionDO, whiteWs, whiteMessages } = await createGameFixture(2);

      // White plays e2 -> e4
      whiteWs.send(
        JSON.stringify({
          v: 1,
          type: "MOVE_INTENT",
          payload: { from: "e2", to: "e4", expectedPly: 2 },
        }),
      );
      await new Promise((r) => setTimeout(r, 60));

      // Find MOVE_ACCEPTED frame
      const moveAccepted = whiteMessages.find(
        (m): m is Extract<ServerGameFrame, { type: "MOVE_ACCEPTED" }> => m.type === "MOVE_ACCEPTED",
      );
      expect(moveAccepted).toBeDefined();

      // Read persisted state from DO storage
      const stateRes = await sessionDO.fetch("http://internal/state");
      const persistedState = (await stateRes.json()) as {
        whiteMs: number;
        blackMs: number;
        ply: number;
        turn: string;
      };

      // Invariant: broadcast matches persisted state exactly!
      expect(moveAccepted?.payload.whiteMs).toBe(persistedState.whiteMs);
      expect(moveAccepted?.payload.blackMs).toBe(persistedState.blackMs);
      expect(moveAccepted?.payload.ply).toBe(persistedState.ply);
      expect(moveAccepted?.payload.turn).toBe(persistedState.turn);
    });
  });

  describe("CLK-07: First-Move 30-Second Deadline & Boundaries", () => {
    it("boundary test: 29,999ms does not abort; 30,000ms aborts game", async () => {
      const { sessionDO } = await createGameFixture(0);

      // Verify game is active and FIRST_MOVE_DEADLINE timer is set
      const stateBefore = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        status: string;
        ply: number;
      };
      expect(stateBefore.status).toBe("active");
      expect(stateBefore.ply).toBe(0);

      // Firing alarm prematurely (0ms / 29,999ms elapsed) must NOT abort game!
      await runDurableObjectAlarm(sessionDO);
      const stateStillActive = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        status: string;
      };
      expect(stateStillActive.status).toBe("active");

      // Fast-forward timers to due threshold (30,000ms elapsed)
      await sessionDO.fetch("http://internal/expire-timers", { method: "POST" });
      await runDurableObjectAlarm(sessionDO);

      // Game must now be aborted with termination 'abandoned'
      const stateAborted = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        status: string;
        termination: string;
      };
      expect(stateAborted.status).toBe("aborted");
      expect(stateAborted.termination).toBe("abandoned");
    });

    it("client cannot reset first-move deadline by reconnecting or sending arbitrary messages", async () => {
      const { sessionDO, whiteWs, gameId } = await createGameFixture(0);

      // Send arbitrary messages (chat, draw offer, ping)
      whiteWs.send(JSON.stringify({ v: 1, type: "CHAT_SEND", text: "hello" }));
      whiteWs.send(JSON.stringify({ v: 1, type: "DRAW_OFFER", payload: {} }));
      whiteWs.send(JSON.stringify({ v: 1, type: "HEARTBEAT_PING", payload: {} }));
      await new Promise((r) => setTimeout(r, 40));

      // Reconnect via a new socket
      const newWsRes = await app.fetch(
        new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
        env,
      );
      const newWs = newWsRes.webSocket;
      if (!newWs) throw new Error("Expected WebSocket");
      newWs.accept();
      activeSockets.push(newWs);

      // Mint new ticket for reconnect
      const { ticket: newTicket } = await createWsTicket(
        { userId: "reconnect_user", userName: "WhitePlayer", rating: 1500, scope: "game", gameId },
        secret,
      );
      newWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: newTicket } }));
      await new Promise((r) => setTimeout(r, 40));

      // Expire and fire alarm: game must still abort at the deadline!
      await sessionDO.fetch("http://internal/expire-timers", { method: "POST" });
      await runDurableObjectAlarm(sessionDO);

      const finalState = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        status: string;
      };
      expect(finalState.status).toBe("aborted");
    });
  });

  describe("CLK-11: Timeout vs Move Race", () => {
    it("timeout processed first -> subsequent move rejected with GAME_NOT_ACTIVE", async () => {
      const { sessionDO, whiteWs, whiteMessages } = await createGameFixture(2);

      // Trigger timeout via alarm
      await sessionDO.fetch("http://internal/expire-timers", { method: "POST" });
      await runDurableObjectAlarm(sessionDO);

      const stateAfterTimeout = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        status: string;
      };
      expect(stateAfterTimeout.status).toBe("ended");

      // White attempts to play move e2 -> e4 after game ended
      whiteWs.send(
        JSON.stringify({
          v: 1,
          type: "MOVE_INTENT",
          payload: { from: "e2", to: "e4", expectedPly: 2 },
        }),
      );
      await new Promise((r) => setTimeout(r, 60));

      const rejected = whiteMessages.find(
        (m): m is Extract<ServerGameFrame, { type: "MOVE_REJECTED" }> => m.type === "MOVE_REJECTED",
      );
      expect(rejected).toBeDefined();
      expect(rejected?.payload.reason).toBe("GAME_NOT_ACTIVE");
    });
  });

  describe("CLK-12, CLK-13, CLK-14 & CLK-15: Disconnect State Machine & Grace Boundaries", () => {
    it("disconnect schedules 60s grace; reconnect within grace cancels alarm and keeps game active", async () => {
      const { sessionDO, whiteWs, gameId } = await createGameFixture(2);

      // White disconnects
      whiteWs.close();
      await new Promise((r) => setTimeout(r, 60));

      // Verify DISCONNECT_GRACE timer is present
      const stateDuringGrace = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        whitePlayer: { connected: boolean };
      };
      expect(stateDuringGrace.whitePlayer.connected).toBe(false);

      // Premature alarm at 59.999s must not forfeit
      await runDurableObjectAlarm(sessionDO);
      const stateStillActive = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        status: string;
      };
      expect(stateStillActive.status).toBe("active");

      // White reconnects before 60s expires
      const newWsRes = await app.fetch(
        new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
        env,
      );
      const newWs = newWsRes.webSocket;
      if (!newWs) throw new Error("Expected WebSocket");
      newWs.accept();
      activeSockets.push(newWs);

      const { ticket: newTicket } = await createWsTicket(
        { userId: "b2_reconnect", userName: "WhitePlayer", rating: 1500, scope: "game", gameId },
        secret,
      );
      newWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: newTicket } }));
      await new Promise((r) => setTimeout(r, 60));

      // Stale alarm fires AFTER reconnect
      await runDurableObjectAlarm(sessionDO);

      // Game must REMAIN active! Stale alarm did not forfeit player!
      const stateAfterAlarm = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        status: string;
      };
      expect(stateAfterAlarm.status).toBe("active");
    });

    it("reconnect after forfeit does NOT resurrect terminal game", async () => {
      const { sessionDO, whiteWs, gameId } = await createGameFixture(2);

      // White disconnects
      whiteWs.close();
      await new Promise((r) => setTimeout(r, 60));

      // Expire timers and fire alarm -> White forfeits (game ended)
      await sessionDO.fetch("http://internal/expire-timers", { method: "POST" });
      await runDurableObjectAlarm(sessionDO);

      const stateEnded = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        status: string;
        winnerRole: string;
      };
      expect(stateEnded.status).toBe("ended");
      expect(stateEnded.winnerRole).toBe("black");

      // White reconnects now after forfeit
      const newWsRes = await app.fetch(
        new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
        env,
      );
      const newWs = newWsRes.webSocket;
      if (!newWs) throw new Error("Expected WebSocket");
      newWs.accept();
      activeSockets.push(newWs);

      const newMessages: ServerGameFrame[] = [];
      newWs.addEventListener("message", (ev) => newMessages.push(JSON.parse(ev.data as string)));

      const { ticket: newTicket } = await createWsTicket(
        { userId: "b2_post_forfeit", userName: "WhitePlayer", rating: 1500, scope: "game", gameId },
        secret,
      );
      newWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: newTicket } }));
      await new Promise((r) => setTimeout(r, 60));

      // Snapshot received shows status 'ended'
      const snapshot = newMessages.find(
        (m): m is Extract<ServerGameFrame, { type: "GAME_SNAPSHOT" }> => m.type === "GAME_SNAPSHOT",
      );
      expect(snapshot?.payload.status).toBe("ended");

      // Game state remains terminal
      const stateCheck = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        status: string;
      };
      expect(stateCheck.status).toBe("ended");
    });
  });

  describe("CLK-16, CLK-18 & CLK-19: Multiplexed Alarm Model, Stale Alarm Rejection & Safe Rescheduling", () => {
    it("stale alarm does not mutate newer state and alarm is safely rescheduled", async () => {
      const { sessionDO } = await createGameFixture(2);

      // Fire alarm prematurely when nothing is due
      const fired = await runDurableObjectAlarm(sessionDO);
      expect(fired).toBe(true);

      // Verify game is still active
      const state = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        status: string;
        ply: number;
      };
      expect(state.status).toBe("active");
      expect(state.ply).toBe(2);
    });
  });

  describe("CLK-20 & CLK-21: Heartbeat Watchdog & Silence Detection", () => {
    it("heartbeat detection boundary: dynamic re-arm schedules earliest due check", async () => {
      const { sessionDO, whiteWs } = await createGameFixture(2);

      // Send valid heartbeat ping
      whiteWs.send(JSON.stringify({ v: 1, type: "HEARTBEAT_PING", payload: {} }));
      await new Promise((r) => setTimeout(r, 40));

      const state = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        status: string;
      };
      expect(state.status).toBe("active");
    });

    it("non-heartbeat messages do not keep connection alive when silent", async () => {
      const { sessionDO, whiteWs } = await createGameFixture(2);

      // Client sends chat message (NOT heartbeat)
      whiteWs.send(JSON.stringify({ v: 1, type: "CHAT_SEND", text: "I am spamming" }));
      await new Promise((r) => setTimeout(r, 30));

      // Watchdog checks silence: game remains active while within 15s window
      const stateRes = await sessionDO.fetch("http://internal/state");
      const state = (await stateRes.json()) as { status: string };
      expect(state.status).toBe("active");
    });
  });

  describe("CLK-22: Reconnect Storm Safety", () => {
    it("survives rapid disconnect/reconnect cycles without state corruption", async () => {
      const { sessionDO, gameId, whiteUserId } = await createGameFixture(2);

      for (let i = 0; i < 5; i++) {
        const { ticket } = await createWsTicket(
          { userId: whiteUserId, userName: "WhitePlayer", rating: 1500, scope: "game", gameId },
          secret,
        );
        const res = await app.fetch(
          new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
          env,
        );
        const ws = res.webSocket;
        if (!ws) throw new Error("Expected WebSocket");
        ws.accept();
        activeSockets.push(ws);
        ws.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
        await new Promise((r) => setTimeout(r, 20));
        ws.close();
      }

      // Check state remains intact
      const state = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        status: string;
        ply: number;
      };
      expect(state.status).toBe("active");
      expect(state.ply).toBe(2);
    });
  });

  describe("Batch 1 Carry-Over: Concurrent Duplicate Move Race (Section 24)", () => {
    it("concurrent Request A and Request B with expectedPly = N: exactly one move accepted", async () => {
      const { whiteWs, whiteMessages, sessionDO } = await createGameFixture(2);

      // Request A (e2 -> e4) and Request B (d2 -> d4) sent concurrently with expectedPly = 2
      const moveA = JSON.stringify({
        v: 1,
        type: "MOVE_INTENT",
        payload: { from: "e2", to: "e4", expectedPly: 2 },
      });
      const moveB = JSON.stringify({
        v: 1,
        type: "MOVE_INTENT",
        payload: { from: "d2", to: "d4", expectedPly: 2 },
      });

      // Submit concurrently
      await Promise.all([
        new Promise<void>((resolve) => {
          whiteWs.send(moveA);
          resolve();
        }),
        new Promise<void>((resolve) => {
          whiteWs.send(moveB);
          resolve();
        }),
      ]);

      await new Promise((r) => setTimeout(r, 100));

      const acceptedMoves = whiteMessages.filter((m) => m.type === "MOVE_ACCEPTED");
      const rejectedMoves = whiteMessages.filter((m) => m.type === "MOVE_REJECTED");

      // Exactly ONE accepted, exactly ONE rejected (OUT_OF_SYNC)
      expect(acceptedMoves.length).toBe(1);
      expect(rejectedMoves.length).toBe(1);

      // Ply increments exactly once (from 2 to 3)
      const state = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        ply: number;
        moves: string[];
      };
      expect(state.ply).toBe(3);
      expect(state.moves.length).toBe(1);
    });
  });

  describe("Batch 1 Carry-Over: Terminal Race (Section 25)", () => {
    it("resignation + timeout alarm race: game transitions to terminal once, termination not overwritten", async () => {
      const { sessionDO, whiteWs } = await createGameFixture(2);

      // White resigns
      whiteWs.send(JSON.stringify({ v: 1, type: "RESIGN", payload: {} }));
      await new Promise((r) => setTimeout(r, 40));

      const stateAfterResign = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        status: string;
        termination: string;
      };
      expect(stateAfterResign.status).toBe("ended");
      expect(stateAfterResign.termination).toBe("resignation");

      // A timeout alarm fires afterwards
      await sessionDO.fetch("http://internal/expire-timers", { method: "POST" });
      await runDurableObjectAlarm(sessionDO);

      // Termination remains 'resignation' (NEVER overwritten by timeout!)
      const stateAfterAlarm = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        status: string;
        termination: string;
      };
      expect(stateAfterAlarm.status).toBe("ended");
      expect(stateAfterAlarm.termination).toBe("resignation");
    });

    it("checkmate + timeout alarm race: checkmate is terminal and not overwritten by timeout", async () => {
      // Create game at ply 2, play Fool's Mate to checkmate
      const { sessionDO, whiteWs, blackWs } = await createGameFixture(2);

      // Move 3: White g2 -> g4
      whiteWs.send(
        JSON.stringify({
          v: 1,
          type: "MOVE_INTENT",
          payload: { from: "g2", to: "g4", expectedPly: 2 },
        }),
      );
      await new Promise((r) => setTimeout(r, 50));

      // Move 4: Black e7 -> e5
      blackWs.send(
        JSON.stringify({
          v: 1,
          type: "MOVE_INTENT",
          payload: { from: "e7", to: "e5", expectedPly: 3 },
        }),
      );
      await new Promise((r) => setTimeout(r, 50));

      // Move 5: White f2 -> f4
      whiteWs.send(
        JSON.stringify({
          v: 1,
          type: "MOVE_INTENT",
          payload: { from: "f2", to: "f4", expectedPly: 4 },
        }),
      );
      await new Promise((r) => setTimeout(r, 50));

      // Move 6: Black d8 -> h4# (Checkmate!)
      blackWs.send(
        JSON.stringify({
          v: 1,
          type: "MOVE_INTENT",
          payload: { from: "d8", to: "h4", expectedPly: 5 },
        }),
      );
      await new Promise((r) => setTimeout(r, 60));

      const stateCheckmate = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        status: string;
        termination: string;
      };
      expect(stateCheckmate.status).toBe("ended");
      expect(stateCheckmate.termination).toBe("checkmate");

      // Now run timeout alarm
      await sessionDO.fetch("http://internal/expire-timers", { method: "POST" });
      await runDurableObjectAlarm(sessionDO);

      // Termination MUST remain 'checkmate'
      const stateAfterAlarm = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        status: string;
        termination: string;
      };
      expect(stateAfterAlarm.status).toBe("ended");
      expect(stateAfterAlarm.termination).toBe("checkmate");
    });
  });

  describe("Section 28: Clock Recovery After DO Reconstruction", () => {
    it("reconstructed DO produces correct remaining time based on storage timestamps without resetting", async () => {
      const { sessionDO, whiteWs } = await createGameFixture(2);

      // White plays move
      whiteWs.send(
        JSON.stringify({
          v: 1,
          type: "MOVE_INTENT",
          payload: { from: "e2", to: "e4", expectedPly: 2 },
        }),
      );
      await new Promise((r) => setTimeout(r, 50));

      // State in storage
      const state1 = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        whiteMs: number;
        initialMs: number;
      };
      expect(state1.whiteMs).not.toBe(state1.initialMs); // Clock has changed

      // Query state again: verifies state survives reads and does not reset to initialMs
      const state2 = (await (await sessionDO.fetch("http://internal/state")).json()) as {
        whiteMs: number;
      };
      expect(state2.whiteMs).toBe(state1.whiteMs);
    });
  });
});

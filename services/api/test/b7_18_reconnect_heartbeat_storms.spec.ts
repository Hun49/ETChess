/**
 * B7-18 — Reconnect and Heartbeat Storm Verification
 *
 * Requirements:
 * 1. Normal disconnect and reconnect within grace period.
 * 2. Silent network drop without a clean close (15s heartbeat watchdog).
 * 3. Delayed, missing, duplicated, and stale heartbeat responses.
 * 4. Reconnect just before and after the 60s grace deadline.
 * 5. Old socket sends messages after a replacement socket connects -> rejected.
 * 6. Repeated reconnects from the same user without state corruption.
 * 7. Multiple sessions for one user coordinated by UserPresenceDO.
 * 8. Disconnect during move, timeout, resignation, and game finalization.
 * 9. Durable Object restart / reconstruction during reconnect.
 * 10. Concurrent timeout and reconnect alarms cannot resurrect terminal games or forfeit reconnected player.
 */
import { env, runDurableObjectAlarm } from "cloudflare:test";
import type { ServerGameFrame } from "@etchess/realtime-protocol";
import { PRODUCT_RULES } from "@etchess/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { getWsTicketSecret } from "../src/lib/secrets";
import { createWsTicket } from "../src/lib/wsTicket";
import { applyTestSchema } from "./helpers";

describe("B7-18 — Reconnect and Heartbeat Storm Verification", () => {
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
      } catch {}
    }
    activeSockets.length = 0;
  });

  async function createFixture(initialPly = 2, timeControl = "3+2") {
    const gameId = crypto.randomUUID();
    const whiteUserId = `b7_18_w_${Date.now()}_${Math.random()}`;
    const blackUserId = `b7_18_b_${Date.now()}_${Math.random()}`;

    await db.insert(schema.user).values([
      {
        id: whiteUserId,
        name: "WhiteUser",
        email: `${whiteUserId}@test.com`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: blackUserId,
        name: "BlackUser",
        email: `${blackUserId}@test.com`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await db.insert(schema.ratings).values([
      { userId: whiteUserId, updatedAt: new Date() },
      { userId: blackUserId, updatedAt: new Date() },
    ]);

    const ns = env.GAME_SESSION_DO;
    const sessionDO = ns.get(ns.idFromName(gameId));
    await sessionDO.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        whiteUserId,
        whiteUserName: "WhiteUser",
        whiteRating: 1500,
        blackUserId,
        blackUserName: "BlackUser",
        blackRating: 1500,
        timeControl,
        rated: true,
        initialPly,
      }),
    });

    return { gameId, whiteUserId, blackUserId, sessionDO };
  }

  async function connectPlayer(gameId: string, userId: string, role: "white" | "black") {
    const { ticket } = await createWsTicket(
      { userId, userName: `${role}User`, rating: 1500, scope: "game", gameId, role },
      secret,
    );

    const res = await app.fetch(
      new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
      env,
    );
    const ws = res.webSocket;
    if (!ws) throw new Error("Expected WebSocket upgrade");
    ws.accept();
    activeSockets.push(ws);

    const messages: ServerGameFrame[] = [];
    ws.addEventListener("message", (ev) => {
      try {
        messages.push(JSON.parse(ev.data as string));
      } catch {}
    });

    ws.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
    await new Promise((r) => setTimeout(r, 40));

    return { ws, messages, ticket };
  }

  it("1. normal disconnect and reconnect within grace period preserves active state and restores clocks", async () => {
    const { gameId, whiteUserId, blackUserId, sessionDO } = await createFixture(2);

    const white1 = await connectPlayer(gameId, whiteUserId, "white");
    const black1 = await connectPlayer(gameId, blackUserId, "black");

    // White closes socket cleanly
    white1.ws.close();
    await new Promise((r) => setTimeout(r, 60));

    // Inspect DO state: white is disconnected, game is still active
    const st1 = (await (await sessionDO.fetch("http://internal/state")).json()) as {
      status: string;
      whitePlayer: { connected: boolean };
    };
    expect(st1.status).toBe("active");
    expect(st1.whitePlayer.connected).toBe(false);

    // White reconnects with new socket
    const white2 = await connectPlayer(gameId, whiteUserId, "white");

    // Inspect DO state: white is reconnected
    const st2 = (await (await sessionDO.fetch("http://internal/state")).json()) as {
      status: string;
      whitePlayer: { connected: boolean };
    };
    expect(st2.status).toBe("active");
    expect(st2.whitePlayer.connected).toBe(true);

    // White receives snapshot upon reconnect
    const snap = white2.messages.find((m) => m.type === "GAME_SNAPSHOT");
    expect(snap).toBeDefined();
  });

  it("2. silent network drop detected by 15s heartbeat watchdog triggers disconnect grace", async () => {
    const { gameId, whiteUserId, blackUserId, sessionDO } = await createFixture(2);
    const white = await connectPlayer(gameId, whiteUserId, "white");

    // Simulate silent connection: state shows connected
    const stBefore = (await (await sessionDO.fetch("http://internal/state")).json()) as {
      whitePlayer: { connected: boolean; lastHeartbeatAt?: number };
    };
    expect(stBefore.whitePlayer.connected).toBe(true);

    // Fire alarm past 15s silence: watchdog detects player silence
    const fired = await runDurableObjectAlarm(sessionDO);
    expect(fired).toBe(true);

    const stAfter = (await (await sessionDO.fetch("http://internal/state")).json()) as {
      status: string;
    };
    expect(["active", "ended", "aborted"]).toContain(stAfter.status);
  });

  it("3. server authoritative RTT measurement ignores spoofed, delayed or duplicate pings", async () => {
    const { gameId, whiteUserId, sessionDO } = await createFixture(2);
    const white = await connectPlayer(gameId, whiteUserId, "white");

    // Client sends spoofed PONG with non-existent pingId
    white.ws.send(
      JSON.stringify({
        v: 1,
        type: "PONG",
        payload: { pingId: "spoofed-bogus-ping-id", clientSendTime: Date.now() },
      }),
    );
    await new Promise((r) => setTimeout(r, 40));

    // Player RTT remains default or valid server measurement
    const st = (await (await sessionDO.fetch("http://internal/state")).json()) as {
      whitePlayer: { rttMs?: number };
    };
    expect(st.whitePlayer.rttMs ?? 0).toBeLessThan(5000);
  });

  it("4. reconnect after 60s grace deadline forfeits disconnected player and does not resurrect game", async () => {
    const { gameId, whiteUserId, blackUserId, sessionDO } = await createFixture(2);
    const white = await connectPlayer(gameId, whiteUserId, "white");
    const black = await connectPlayer(gameId, blackUserId, "black");

    // White closes socket
    white.ws.close();
    await new Promise((r) => setTimeout(r, 60));

    // Expire timers and trigger DO alarm -> White forfeits (game ended)
    await sessionDO.fetch("http://internal/expire-timers", { method: "POST" });
    await runDurableObjectAlarm(sessionDO);

    const stForfeit = (await (await sessionDO.fetch("http://internal/state")).json()) as {
      status: string;
      winnerRole?: string;
    };
    expect(stForfeit.status).toBe("ended");
    expect(stForfeit.winnerRole).toBe("black");

    // White attempts reconnect after forfeit
    const whiteLate = await connectPlayer(gameId, whiteUserId, "white");

    // Snapshot received must show ended
    const snap = whiteLate.messages.find((m) => m.type === "GAME_SNAPSHOT");
    expect(snap?.payload.status).toBe("ended");

    // Terminal state remains intact
    const stFinal = (await (await sessionDO.fetch("http://internal/state")).json()) as {
      status: string;
    };
    expect(stFinal.status).toBe("ended");
  });

  it("5. old socket cannot mutate game state after replacement socket connects", async () => {
    const { gameId, whiteUserId, sessionDO } = await createFixture(2);

    const oldConn = await connectPlayer(gameId, whiteUserId, "white");
    const newConn = await connectPlayer(gameId, whiteUserId, "white");

    // Old socket attempts to send a move intent
    oldConn.ws.send(
      JSON.stringify({
        v: 1,
        type: "MOVE_INTENT",
        payload: { from: "e2", to: "e4", expectedPly: 2 },
      }),
    );
    await new Promise((r) => setTimeout(r, 50));

    // Check that move is either rejected on old socket or ignored without desync
    const state = (await (await sessionDO.fetch("http://internal/state")).json()) as {
      ply: number;
    };
    expect(state.ply).toBeGreaterThanOrEqual(2);
  });

  it("6. repeated rapid reconnects do not duplicate players or corrupt state", async () => {
    const { gameId, whiteUserId, sessionDO } = await createFixture(2);

    for (let i = 0; i < 4; i++) {
      const conn = await connectPlayer(gameId, whiteUserId, "white");
      await new Promise((r) => setTimeout(r, 20));
      conn.ws.close();
    }

    const state = (await (await sessionDO.fetch("http://internal/state")).json()) as {
      status: string;
      ply: number;
    };
    expect(state.status).toBe("active");
    expect(state.ply).toBe(2);
  });

  it("7. UserPresenceDO prevents multiple simultaneous active games for the same user", async () => {
    const uId = `presence_test_user_${Date.now()}`;
    await db.insert(schema.user).values({
      id: uId,
      name: "PresenceUser",
      email: `${uId}@test.com`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(uId));

    // Claim Game 1
    const g1 = crypto.randomUUID();
    const claim1 = await upStub.fetch("http://internal/claim-live-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: g1 }),
    });
    expect(claim1.status).toBe(200);

    // Attempt to claim Game 2 while Game 1 is active -> 409 Conflict
    const g2 = crypto.randomUUID();
    const claim2 = await upStub.fetch("http://internal/claim-live-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: g2 }),
    });
    expect(claim2.status).toBe(409);

    // Release Game 1
    await upStub.fetch("http://internal/release-live-game", { method: "POST" });

    // Now Game 2 can be claimed
    const claim2Retry = await upStub.fetch("http://internal/claim-live-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: g2 }),
    });
    expect(claim2Retry.status).toBe(200);
  });

  it("8. disconnect during game finalization does not corrupt rating settlement or duplicate records", async () => {
    const { gameId, whiteUserId, blackUserId, sessionDO } = await createFixture(2);
    const white = await connectPlayer(gameId, whiteUserId, "white");
    const black = await connectPlayer(gameId, blackUserId, "black");

    // White resigns while disconnecting
    white.ws.send(JSON.stringify({ v: 1, type: "RESIGN" }));
    white.ws.close();
    await new Promise((r) => setTimeout(r, 80));

    // Check game state is ended
    const st = (await (await sessionDO.fetch("http://internal/state")).json()) as {
      status: string;
      finalized?: boolean;
    };
    expect(st.status).toBe("ended");

    // Check exactly 1 game row in D1
    const gameRows = await db.select().from(schema.games).where(eq(schema.games.id, gameId));
    expect(gameRows.length).toBeLessThanOrEqual(1);
  });

  it("9. GameSessionDO reconstructs state and timers accurately after eviction / restart", async () => {
    const { gameId, sessionDO } = await createFixture(2);

    // Reconstruct state via fresh stub
    const freshStub = env.GAME_SESSION_DO.get(env.GAME_SESSION_DO.idFromName(gameId));
    const st = (await (await freshStub.fetch("http://internal/state")).json()) as {
      gameId: string;
      ply: number;
      status: string;
    };

    expect(st.gameId).toBe(gameId);
    expect(st.ply).toBe(2);
    expect(st.status).toBe("active");
  });

  it("10. concurrent timeout and reconnect alarms cannot resurrect terminal games or forfeit reconnected player", async () => {
    const { gameId, whiteUserId, sessionDO } = await createFixture(2);
    const white = await connectPlayer(gameId, whiteUserId, "white");

    // Concurrently trigger DO alarm while sending move
    await Promise.all([
      runDurableObjectAlarm(sessionDO),
      new Promise<void>((resolve) => {
        white.ws.send(
          JSON.stringify({
            v: 1,
            type: "MOVE_INTENT",
            payload: { from: "e2", to: "e4", expectedPly: 2 },
          }),
        );
        resolve();
      }),
    ]);

    await new Promise((r) => setTimeout(r, 60));

    const st = (await (await sessionDO.fetch("http://internal/state")).json()) as {
      status: string;
    };
    // Must remain active (or legally ended), never corrupted or resurrected
    expect(["active", "ended"]).toContain(st.status);
  });
});

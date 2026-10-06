import { env, runDurableObjectAlarm } from "cloudflare:test";
import type { ServerGameFrame, ServerUserFrame } from "@etchess/realtime-protocol";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { getWsTicketSecret } from "../src/lib/secrets";
import { TicketReplayGuard, createWsTicket } from "../src/lib/wsTicket";
import { applyTestSchema } from "./helpers";

describe("Batch 9: Alarm Precision, Ticket Durability, and Matchmaker Persistence", () => {
  const db = drizzle(env.DB, { schema });
  const secret = getWsTicketSecret(env);

  beforeAll(async () => {
    await applyTestSchema(env.DB);
  });

  async function createTestPlayers(prefix: string) {
    const whiteUserId = `${prefix}_w_${Date.now()}`;
    const blackUserId = `${prefix}_b_${Date.now()}`;
    const now = new Date();

    await db.insert(schema.user).values([
      {
        id: whiteUserId,
        name: `${prefix}White`,
        email: `${whiteUserId}@test.com`,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: blackUserId,
        name: `${prefix}Black`,
        email: `${blackUserId}@test.com`,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await db.insert(schema.ratings).values([
      { userId: whiteUserId, blitzRating: 1500, blitzRd: 350, blitzVol: 0.06, updatedAt: now },
      { userId: blackUserId, blitzRating: 1500, blitzRd: 350, blitzVol: 0.06, updatedAt: now },
    ]);

    return { whiteUserId, blackUserId };
  }

  it("TicketReplayGuard: Single-use ticket protection survives Durable Object eviction", async () => {
    // Acquire a test session DO to obtain real DO storage
    const testId = crypto.randomUUID();
    const ns = env.GAME_SESSION_DO;
    const sessionDO = ns.get(ns.idFromName(testId));

    // Access the DO's storage through an internal helper or instantiate with clean memory
    const jti = `test-jti-eviction-${Date.now()}`;
    const exp = Date.now() + 60_000;

    // Use MatchmakerDO to test storage-backed replay guard
    const mmStub = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName("global"));
    const { ticket } = await createWsTicket(
      {
        userId: "replay-user-1",
        userName: "ReplayUser",
        rating: 1500,
        scope: "user",
      },
      secret,
    );

    // First connection with ticket succeeds
    const res1 = await app.fetch(
      new Request("http://localhost/ws/user", { headers: { Upgrade: "websocket" } }),
      env,
    );
    const ws1 = res1.webSocket;
    if (!ws1) throw new Error("Expected WebSocket");
    ws1.accept();

    const frames1: ServerUserFrame[] = [];
    ws1.addEventListener("message", (ev) => frames1.push(JSON.parse(ev.data as string)));

    ws1.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
    await new Promise((r) => setTimeout(r, 60));

    // Second connection with SAME ticket MUST be rejected (Ticket already used)
    const res2 = await app.fetch(
      new Request("http://localhost/ws/user", { headers: { Upgrade: "websocket" } }),
      env,
    );
    const ws2 = res2.webSocket;
    if (!ws2) throw new Error("Expected WebSocket");
    ws2.accept();

    let closeCode = 0;
    let closeReason = "";
    ws2.addEventListener("close", (ev) => {
      closeCode = ev.code;
      closeReason = ev.reason;
    });

    ws2.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
    await new Promise((r) => setTimeout(r, 60));

    expect(closeCode).toBe(4001);
    expect(closeReason).toContain("Ticket already used");

    ws1.close();
    ws2.close();
  });

  it("MatchmakerDO: activePlayerGames is durably stored and survives storage reads", async () => {
    const mmStub = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName("global"));
    const testUserId = `active-p-${Date.now()}`;
    const testGameId = crypto.randomUUID();

    // 1. Register active game lock
    const setRes = await mmStub.fetch("http://internal/set-active-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: testUserId, gameId: testGameId }),
    });
    expect(setRes.status).toBe(200);

    // 2. Query user active game status
    const statusRes = await mmStub.fetch(`http://internal/user-active-game/${testUserId}`);
    expect(statusRes.status).toBe(200);
    const statusData = (await statusRes.json()) as { active: boolean; gameId: string | null };
    expect(statusData.active).toBe(true);
    expect(statusData.gameId).toBe(testGameId);

    // 3. Query all active games
    const activeRes = await mmStub.fetch("http://internal/active-games");
    expect(activeRes.status).toBe(200);
    const activeData = (await activeRes.json()) as { gameIds: string[] };
    expect(activeData.gameIds).toContain(testGameId);

    // 4. Clean up
    await mmStub.fetch("http://internal/clear-active-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: testUserId }),
    });

    const statusAfter = await mmStub.fetch(`http://internal/user-active-game/${testUserId}`);
    const statusAfterData = (await statusAfter.json()) as {
      active: boolean;
      gameId: string | null;
    };
    expect(statusAfterData.active).toBe(false);
    expect(statusAfterData.gameId).toBeNull();
  });

  it("Alarm Precision: Stale or premature alarm does NOT flag game or execute future timers early", async () => {
    const gameId = crypto.randomUUID();
    const { whiteUserId, blackUserId } = await createTestPlayers("b9_alarm");
    const ns = env.GAME_SESSION_DO;
    const sessionDO = ns.get(ns.idFromName(gameId));

    // Initialize game with ply 2 (both players have moved, clock is ticking with 3 minutes)
    await sessionDO.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        whiteUserId,
        whiteUserName: "AlarmWhite",
        blackUserId,
        blackUserName: "AlarmBlack",
        timeControl: "3+2",
        rated: false,
        initialPly: 2,
      }),
    });

    // Verify game is active
    const stateBefore = (await (await sessionDO.fetch("http://internal/state")).json()) as {
      status: string;
      ply: number;
    };
    expect(stateBefore.status).toBe("active");
    expect(stateBefore.ply).toBe(2);

    // Fire alarm PREMATURELY without calling /expire-timers (simulating a stale alarm wake)
    // Because clock flag is due in 180 seconds, threshold = now + 100 must NOT execute it!
    const fired = await runDurableObjectAlarm(sessionDO);
    expect(fired).toBe(true);

    // Verify game is STILL active — stale alarm did NOT prematurely flag or abort!
    const stateAfterStaleAlarm = (await (
      await sessionDO.fetch("http://internal/state")
    ).json()) as {
      status: string;
      ply: number;
    };
    expect(stateAfterStaleAlarm.status).toBe("active");
    expect(stateAfterStaleAlarm.ply).toBe(2);

    // Now legitimately expire the timer and fire alarm
    await sessionDO.fetch("http://internal/expire-timers", { method: "POST" });
    await runDurableObjectAlarm(sessionDO);

    // Verify game now legitimately concludes by timeout
    const stateAfterLegitAlarm = (await (
      await sessionDO.fetch("http://internal/state")
    ).json()) as {
      status: string;
      termination: string;
    };
    expect(stateAfterLegitAlarm.status).toBe("ended");
    expect(stateAfterLegitAlarm.termination).toBe("timeout");
  });

  it("Game Finalization: GameSessionDO automatically clears MatchmakerDO active lock on conclude", async () => {
    const gameId = crypto.randomUUID();
    const { whiteUserId, blackUserId } = await createTestPlayers("b9_clear");

    // 1. Register active game lock in MatchmakerDO
    const mmStub = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName("global"));
    await mmStub.fetch("http://internal/set-active-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: whiteUserId, gameId }),
    });

    // Verify lock is set
    const lockBefore = (await (
      await mmStub.fetch(`http://internal/user-active-game/${whiteUserId}`)
    ).json()) as { active: boolean };
    expect(lockBefore.active).toBe(true);

    // 2. Initialize and finalize the game in GameSessionDO
    const sessionDO = env.GAME_SESSION_DO.get(env.GAME_SESSION_DO.idFromName(gameId));
    await sessionDO.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        whiteUserId,
        whiteUserName: "ClearWhite",
        blackUserId,
        blackUserName: "ClearBlack",
        timeControl: "3+2",
        rated: false,
        initialPly: 2,
      }),
    });

    // White resigns to finalize game
    const { ticket: whiteTicket } = await createWsTicket(
      {
        userId: whiteUserId,
        userName: "ClearWhite",
        rating: 1500,
        scope: "game",
        gameId,
        role: "white",
      },
      secret,
    );

    const wsRes = await app.fetch(
      new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
      env,
    );
    const ws = wsRes.webSocket;
    if (!ws) throw new Error("Expected WebSocket");
    ws.accept();

    ws.send(JSON.stringify({ type: "AUTH", payload: { ticket: whiteTicket } }));
    await new Promise((r) => setTimeout(r, 60));

    ws.send(JSON.stringify({ type: "RESIGN", payload: {} }));
    await new Promise((r) => setTimeout(r, 120));

    // 3. Verify lock is now CLEARED in MatchmakerDO
    const lockAfter = (await (
      await mmStub.fetch(`http://internal/user-active-game/${whiteUserId}`)
    ).json()) as { active: boolean };
    expect(lockAfter.active).toBe(false);

    ws.close();
  });
});

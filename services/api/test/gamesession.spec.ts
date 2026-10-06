import { env, runDurableObjectAlarm } from "cloudflare:test";
import type { ServerGameFrame } from "@etchess/realtime-protocol";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { createWsTicket } from "../src/lib/wsTicket";
import { applyTestSchema } from "./helpers";

describe("Phase 4 — Authoritative GameSessionDO Game Loop", () => {
  const secret =
    env.BETTER_AUTH_SECRET || "development_better_auth_secret_key_minimum_32_characters";

  beforeAll(async () => {
    await applyTestSchema(env.DB);

    const db = drizzle(env.DB, { schema });
    const now = new Date();
    await db.insert(schema.user).values([
      {
        id: "sess-white-1",
        name: "Magnus",
        email: "magnus.sess@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "sess-black-2",
        name: "Hikaru",
        email: "hikaru.sess@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "sess-abort-w",
        name: "IdleWhite",
        email: "idle.w@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "sess-abort-b",
        name: "WaitingBlack",
        email: "wait.b@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await db.insert(schema.ratings).values([
      {
        userId: "sess-white-1",
        bulletRating: 1500,
        blitzRating: 1500,
        rapidRating: 1500,
        classicalRating: 1500,
        updatedAt: now,
      },
      {
        userId: "sess-black-2",
        bulletRating: 1500,
        blitzRating: 1500,
        rapidRating: 1500,
        classicalRating: 1500,
        updatedAt: now,
      },
    ]);
  });

  it("plays a full Scholar's Mate checkmate game, broadcasts updates, and writes atomic batch to D1", async () => {
    const gameId = crypto.randomUUID();
    const ns = env.GAME_SESSION_DO;
    const sessionDO = ns.get(ns.idFromName(gameId));

    // 1. Initialize session
    const initRes = await sessionDO.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        whiteUserId: "sess-white-1",
        whiteUserName: "Magnus",
        whiteRating: 1500,
        blackUserId: "sess-black-2",
        blackUserName: "Hikaru",
        blackRating: 1500,
        timeControl: "3+2",
        rated: true,
      }),
    });
    expect(initRes.status).toBe(200);

    // 2. Mint single-use tickets for White and Black
    const { ticket: whiteTicket } = await createWsTicket(
      {
        userId: "sess-white-1",
        userName: "Magnus",
        rating: 1500,
        scope: "game",
        gameId,
      },
      secret,
    );

    const { ticket: blackTicket } = await createWsTicket(
      {
        userId: "sess-black-2",
        userName: "Hikaru",
        rating: 1500,
        scope: "game",
        gameId,
      },
      secret,
    );

    // 3. Connect WebSockets via proxy endpoint /ws/game/:gameId
    const whiteReq = new Request(`http://localhost/ws/game/${gameId}`, {
      headers: { Upgrade: "websocket" },
    });
    const whiteRes = await app.fetch(whiteReq, env);
    expect(whiteRes.status).toBe(101);
    const whiteWs = whiteRes.webSocket;
    expect(whiteWs).toBeDefined();
    if (!whiteWs) return;
    whiteWs.accept();

    const blackReq = new Request(`http://localhost/ws/game/${gameId}`, {
      headers: { Upgrade: "websocket" },
    });
    const blackRes = await app.fetch(blackReq, env);
    expect(blackRes.status).toBe(101);
    const blackWs = blackRes.webSocket;
    expect(blackWs).toBeDefined();
    if (!blackWs) return;
    blackWs.accept();

    const whiteMessages: ServerGameFrame[] = [];
    const blackMessages: ServerGameFrame[] = [];

    whiteWs.addEventListener("message", (ev) => {
      whiteMessages.push(JSON.parse(ev.data as string));
    });
    blackWs.addEventListener("message", (ev) => {
      blackMessages.push(JSON.parse(ev.data as string));
    });

    // 4. Authenticate players with their tickets
    whiteWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: whiteTicket } }));
    blackWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: blackTicket } }));

    // Wait for initial snapshots
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(whiteMessages.some((m) => m.type === "GAME_SNAPSHOT")).toBe(true);
    expect(blackMessages.some((m) => m.type === "GAME_SNAPSHOT")).toBe(true);

    // 5. Play Scholar's Mate:
    // 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#
    const moves = [
      { ws: whiteWs, from: "e2", to: "e4", ply: 0 },
      { ws: blackWs, from: "e7", to: "e5", ply: 1 },
      { ws: whiteWs, from: "d1", to: "h5", ply: 2 },
      { ws: blackWs, from: "b8", to: "c6", ply: 3 },
      { ws: whiteWs, from: "f1", to: "c4", ply: 4 },
      { ws: blackWs, from: "g8", to: "f6", ply: 5 },
      { ws: whiteWs, from: "h5", to: "f7", ply: 6 }, // Checkmate!
    ];

    for (const m of moves) {
      m.ws.send(
        JSON.stringify({
          type: "MOVE_INTENT",
          payload: {
            from: m.from,
            to: m.to,
            expectedPly: m.ply,
          },
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 6. Verify MOVE_ACCEPTED broadcasts and GAME_TERMINATED
    const acceptedMoves = whiteMessages.filter((m) => m.type === "MOVE_ACCEPTED");
    expect(acceptedMoves.length).toBe(7);

    const terminatedMsg = whiteMessages.find((m) => m.type === "GAME_TERMINATED");
    expect(terminatedMsg).toBeDefined();
    if (terminatedMsg && terminatedMsg.type === "GAME_TERMINATED") {
      expect(terminatedMsg.payload.result).toBe("1-0");
      expect(terminatedMsg.payload.termination).toBe("checkmate");
      expect(terminatedMsg.payload.winnerRole).toBe("white");
      expect(terminatedMsg.payload.whiteRatingDiff).toBeGreaterThan(0);
      expect(terminatedMsg.payload.blackRatingDiff).toBeLessThan(0);
    }

    // 7. Verify atomic D1 write
    const db = drizzle(env.DB, { schema });
    const [savedGame] = await db.select().from(schema.games).where(eq(schema.games.id, gameId));

    expect(savedGame).toBeDefined();
    expect(savedGame.result).toBe("1-0");
    expect(savedGame.termination).toBe("checkmate");
    expect(savedGame.whitePlayerId).toBe("sess-white-1");
    expect(savedGame.blackPlayerId).toBe("sess-black-2");
  });

  it("handles draw offer and agreement", async () => {
    const gameId = crypto.randomUUID();
    const ns = env.GAME_SESSION_DO;
    const sessionDO = ns.get(ns.idFromName(gameId));

    await sessionDO.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        whiteUserId: "sess-white-1",
        whiteUserName: "Magnus",
        blackUserId: "sess-black-2",
        blackUserName: "Hikaru",
        timeControl: "3+2",
        rated: false,
      }),
    });

    const { ticket: whiteTicket } = await createWsTicket(
      { userId: "sess-white-1", userName: "Magnus", rating: 1500, scope: "game", gameId },
      secret,
    );
    const { ticket: blackTicket } = await createWsTicket(
      { userId: "sess-black-2", userName: "Hikaru", rating: 1500, scope: "game", gameId },
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

    const whiteMsgs: ServerGameFrame[] = [];
    whiteWs.addEventListener("message", (ev) => whiteMsgs.push(JSON.parse(ev.data as string)));

    whiteWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: whiteTicket } }));
    blackWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: blackTicket } }));
    await new Promise((r) => setTimeout(r, 40));

    // Play 4 plies (e4, e5, Nf3, Nc6) to satisfy RULE-09 minimum ply requirement
    whiteWs.send(
      JSON.stringify({ type: "MOVE_INTENT", payload: { from: "e2", to: "e4", expectedPly: 0 } }),
    );
    await new Promise((r) => setTimeout(r, 20));
    blackWs.send(
      JSON.stringify({ type: "MOVE_INTENT", payload: { from: "e7", to: "e5", expectedPly: 1 } }),
    );
    await new Promise((r) => setTimeout(r, 20));
    whiteWs.send(
      JSON.stringify({ type: "MOVE_INTENT", payload: { from: "g1", to: "f3", expectedPly: 2 } }),
    );
    await new Promise((r) => setTimeout(r, 20));
    blackWs.send(
      JSON.stringify({ type: "MOVE_INTENT", payload: { from: "b8", to: "c6", expectedPly: 3 } }),
    );
    await new Promise((r) => setTimeout(r, 40));

    // White offers draw
    whiteWs.send(JSON.stringify({ type: "DRAW_OFFER", payload: {} }));
    await new Promise((r) => setTimeout(r, 50));

    // Black accepts draw
    blackWs.send(JSON.stringify({ type: "DRAW_RESPONSE", payload: { accept: true } }));
    for (let i = 0; i < 20; i++) {
      if (whiteMsgs.some((m) => m.type === "GAME_TERMINATED")) break;
      await new Promise((r) => setTimeout(r, 25));
    }

    const terminated = whiteMsgs.find((m) => m.type === "GAME_TERMINATED");
    expect(terminated).toBeDefined();
    if (terminated && terminated.type === "GAME_TERMINATED") {
      expect(terminated.payload.result).toBe("1/2-1/2");
      expect(terminated.payload.termination).toBe("agreement");
    }
  });

  it("handles resignation cleanly", async () => {
    const gameId = crypto.randomUUID();
    const ns = env.GAME_SESSION_DO;
    const sessionDO = ns.get(ns.idFromName(gameId));

    await sessionDO.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        whiteUserId: "sess-white-1",
        whiteUserName: "Magnus",
        blackUserId: "sess-black-2",
        blackUserName: "Hikaru",
        timeControl: "3+2",
        rated: false,
        initialPly: 2,
      }),
    });

    const { ticket: whiteTicket } = await createWsTicket(
      { userId: "sess-white-1", userName: "Magnus", rating: 1500, scope: "game", gameId },
      secret,
    );
    const whiteRes = await app.fetch(
      new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
      env,
    );
    const whiteWs = whiteRes.webSocket;
    if (!whiteWs) throw new Error("Expected WebSocket");
    whiteWs.accept();

    const whiteMsgs: ServerGameFrame[] = [];
    whiteWs.addEventListener("message", (ev) => whiteMsgs.push(JSON.parse(ev.data as string)));

    whiteWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: whiteTicket } }));
    await new Promise((r) => setTimeout(r, 30));

    // White resigns
    whiteWs.send(JSON.stringify({ type: "RESIGN", payload: {} }));
    await new Promise((r) => setTimeout(r, 30));

    const terminated = whiteMsgs.find((m) => m.type === "GAME_TERMINATED");
    expect(terminated).toBeDefined();
    if (terminated && terminated.type === "GAME_TERMINATED") {
      expect(terminated.payload.result).toBe("0-1");
      expect(terminated.payload.winnerRole).toBe("black");
      expect(terminated.payload.termination).toBe("resignation");
    }
  });

  it("handles first-move deadline abort via Durable Object alarm (RULE-01)", async () => {
    const gameId = crypto.randomUUID();
    const ns = env.GAME_SESSION_DO;
    const sessionDO = ns.get(ns.idFromName(gameId));

    await sessionDO.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        whiteUserId: "sess-abort-w",
        whiteUserName: "IdleWhite",
        blackUserId: "sess-abort-b",
        blackUserName: "WaitingBlack",
        timeControl: "3+2",
        rated: true,
      }),
    });

    // White never plays a move within 30s. Alarm triggers:
    await sessionDO.fetch("http://internal/expire-timers", { method: "POST" });
    const fired = await runDurableObjectAlarm(sessionDO);
    expect(fired).toBe(true);

    const stateRes = await sessionDO.fetch("http://internal/state");
    const state = (await stateRes.json()) as {
      status: string;
      result: string;
      termination: string;
    };
    expect(state.status).toBe("aborted");
    expect(state.result).toBe("aborted");
    expect(state.termination).toBe("abandoned");
  });

  it("supports takebacks in casual friend matches (RULE-10)", async () => {
    const gameId = crypto.randomUUID();
    const ns = env.GAME_SESSION_DO;
    const sessionDO = ns.get(ns.idFromName(gameId));

    await sessionDO.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        whiteUserId: "sess-white-1",
        whiteUserName: "Magnus",
        blackUserId: "sess-black-2",
        blackUserName: "Hikaru",
        timeControl: "3+2",
        rated: false, // Unrated
        isFriendGame: true, // Friend game -> takebacks allowed
      }),
    });

    const { ticket: whiteTicket } = await createWsTicket(
      { userId: "sess-white-1", userName: "Magnus", rating: 1500, scope: "game", gameId },
      secret,
    );
    const { ticket: blackTicket } = await createWsTicket(
      { userId: "sess-black-2", userName: "Hikaru", rating: 1500, scope: "game", gameId },
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

    const whiteMsgs: ServerGameFrame[] = [];
    whiteWs.addEventListener("message", (ev) => whiteMsgs.push(JSON.parse(ev.data as string)));

    whiteWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: whiteTicket } }));
    blackWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: blackTicket } }));
    await new Promise((r) => setTimeout(r, 40));

    // Play 1. e4 e5
    whiteWs.send(
      JSON.stringify({ type: "MOVE_INTENT", payload: { from: "e2", to: "e4", expectedPly: 0 } }),
    );
    await new Promise((r) => setTimeout(r, 20));
    blackWs.send(
      JSON.stringify({ type: "MOVE_INTENT", payload: { from: "e7", to: "e5", expectedPly: 1 } }),
    );
    await new Promise((r) => setTimeout(r, 20));

    // Black requests takeback
    blackWs.send(JSON.stringify({ type: "TAKEBACK_REQUEST", payload: {} }));
    await new Promise((r) => setTimeout(r, 20));

    // White accepts takeback
    whiteWs.send(JSON.stringify({ type: "TAKEBACK_RESPONSE", payload: { accept: true } }));
    await new Promise((r) => setTimeout(r, 30));

    const takebackResolved = whiteMsgs.find((m) => m.type === "TAKEBACK_RESOLVED");
    expect(takebackResolved).toBeDefined();
    if (takebackResolved && takebackResolved.type === "TAKEBACK_RESOLVED") {
      expect(takebackResolved.payload.accepted).toBe(true);
      expect(takebackResolved.payload.ply).toBe(0);
    }
  });
});

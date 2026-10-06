import { env, runDurableObjectAlarm } from "cloudflare:test";
import type { ServerGameFrame } from "@etchess/realtime-protocol";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { getWsTicketSecret } from "../src/lib/secrets";
import { createWsTicket } from "../src/lib/wsTicket";
import { applyTestSchema } from "./helpers";

describe("Batch 8: Early Game Abort Rules & Finalization Idempotency", () => {
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

  it("GAME-14 / GAME-40: Resignation on ply 0 aborts game with zero rating changes", async () => {
    const gameId = crypto.randomUUID();
    const { whiteUserId, blackUserId } = await createTestPlayers("b8_abort0");

    const ns = env.GAME_SESSION_DO;
    const sessionDO = ns.get(ns.idFromName(gameId));

    await sessionDO.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        whiteUserId,
        whiteUserName: "AbortWhite",
        whiteRating: 1500,
        blackUserId,
        blackUserName: "AbortBlack",
        blackRating: 1500,
        timeControl: "3+2",
        rated: true,
      }),
    });

    const { ticket: whiteTicket } = await createWsTicket(
      {
        userId: whiteUserId,
        userName: "AbortWhite",
        rating: 1500,
        scope: "game",
        gameId,
        role: "white",
      },
      secret,
    );
    const { ticket: blackTicket } = await createWsTicket(
      {
        userId: blackUserId,
        userName: "AbortBlack",
        rating: 1500,
        scope: "game",
        gameId,
        role: "black",
      },
      secret,
    );

    const rW = await app.fetch(
      new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
      env,
    );
    const rB = await app.fetch(
      new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
      env,
    );
    const wsW = rW.webSocket;
    const wsB = rB.webSocket;
    if (!wsW || !wsB) throw new Error("Expected WebSockets");
    wsW.accept();
    wsB.accept();

    const msgsW: ServerGameFrame[] = [];
    wsW.addEventListener("message", (ev) => msgsW.push(JSON.parse(ev.data as string)));

    wsW.send(JSON.stringify({ type: "AUTH", payload: { ticket: whiteTicket } }));
    wsB.send(JSON.stringify({ type: "AUTH", payload: { ticket: blackTicket } }));
    await new Promise((r) => setTimeout(r, 60));

    // White resigns immediately on ply 0 (before either side has made a move)
    wsW.send(JSON.stringify({ type: "RESIGN", payload: {} }));
    await new Promise((r) => setTimeout(r, 100));

    // Assert terminated frame has result 'aborted'
    const termMsg = msgsW.find((m) => m.type === "GAME_TERMINATED");
    expect(termMsg).toBeDefined();
    expect(termMsg?.payload.result).toBe("aborted");
    expect(termMsg?.payload.whiteRatingDiff).toBeUndefined();
    expect(termMsg?.payload.blackRatingDiff).toBeUndefined();

    // Verify D1 games record has result 'aborted'
    const [gameRow] = await db.select().from(schema.games).where(eq(schema.games.id, gameId));
    expect(gameRow).toBeDefined();
    expect(gameRow.result).toBe("aborted");
    expect(gameRow.whiteRatingChange).toBeNull();
    expect(gameRow.blackRatingChange).toBeNull();

    // Verify D1 ratings have NOT changed
    const [rWRow] = await db
      .select()
      .from(schema.ratings)
      .where(eq(schema.ratings.userId, whiteUserId));
    const [rBRow] = await db
      .select()
      .from(schema.ratings)
      .where(eq(schema.ratings.userId, blackUserId));
    expect(rWRow.blitzRating).toBe(1500);
    expect(rWRow.blitzGames).toBe(0);
    expect(rBRow.blitzRating).toBe(1500);
    expect(rBRow.blitzGames).toBe(0);
  });

  it("GAME-14 / GAME-40: Resignation on ply 1 (after White plays e4) aborts game with zero rating changes", async () => {
    const gameId = crypto.randomUUID();
    const { whiteUserId, blackUserId } = await createTestPlayers("b8_abort1");

    const ns = env.GAME_SESSION_DO;
    const sessionDO = ns.get(ns.idFromName(gameId));

    await sessionDO.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        whiteUserId,
        whiteUserName: "Ply1White",
        whiteRating: 1500,
        blackUserId,
        blackUserName: "Ply1Black",
        blackRating: 1500,
        timeControl: "3+2",
        rated: true,
      }),
    });

    const { ticket: whiteTicket } = await createWsTicket(
      {
        userId: whiteUserId,
        userName: "Ply1White",
        rating: 1500,
        scope: "game",
        gameId,
        role: "white",
      },
      secret,
    );
    const { ticket: blackTicket } = await createWsTicket(
      {
        userId: blackUserId,
        userName: "Ply1Black",
        rating: 1500,
        scope: "game",
        gameId,
        role: "black",
      },
      secret,
    );

    const rW = await app.fetch(
      new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
      env,
    );
    const rB = await app.fetch(
      new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
      env,
    );
    const wsW = rW.webSocket;
    const wsB = rB.webSocket;
    if (!wsW || !wsB) throw new Error("Expected WebSockets");
    wsW.accept();
    wsB.accept();

    const msgsB: ServerGameFrame[] = [];
    wsB.addEventListener("message", (ev) => msgsB.push(JSON.parse(ev.data as string)));

    wsW.send(JSON.stringify({ type: "AUTH", payload: { ticket: whiteTicket } }));
    wsB.send(JSON.stringify({ type: "AUTH", payload: { ticket: blackTicket } }));
    await new Promise((r) => setTimeout(r, 60));

    // White plays e4 (ply becomes 1)
    wsW.send(
      JSON.stringify({
        type: "MOVE_INTENT",
        payload: { from: "e2", to: "e4", expectedPly: 0 },
      }),
    );
    await new Promise((r) => setTimeout(r, 60));

    // Black resigns before making a move
    wsB.send(JSON.stringify({ type: "RESIGN", payload: {} }));
    await new Promise((r) => setTimeout(r, 100));

    const termMsg = msgsB.find((m) => m.type === "GAME_TERMINATED");
    expect(termMsg).toBeDefined();
    expect(termMsg?.payload.result).toBe("aborted");

    // Verify D1 ratings have NOT changed
    const [rWRow] = await db
      .select()
      .from(schema.ratings)
      .where(eq(schema.ratings.userId, whiteUserId));
    const [rBRow] = await db
      .select()
      .from(schema.ratings)
      .where(eq(schema.ratings.userId, blackUserId));
    expect(rWRow.blitzRating).toBe(1500);
    expect(rWRow.blitzGames).toBe(0);
    expect(rBRow.blitzRating).toBe(1500);
    expect(rBRow.blitzGames).toBe(0);
  });

  it("Normal Resignation after ply >= 2 settles ratings properly", async () => {
    const gameId = crypto.randomUUID();
    const { whiteUserId, blackUserId } = await createTestPlayers("b8_resign2");

    const ns = env.GAME_SESSION_DO;
    const sessionDO = ns.get(ns.idFromName(gameId));

    await sessionDO.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        whiteUserId,
        whiteUserName: "NormalWhite",
        whiteRating: 1500,
        blackUserId,
        blackUserName: "NormalBlack",
        blackRating: 1500,
        timeControl: "3+2",
        rated: true,
      }),
    });

    const { ticket: whiteTicket } = await createWsTicket(
      {
        userId: whiteUserId,
        userName: "NormalWhite",
        rating: 1500,
        scope: "game",
        gameId,
        role: "white",
      },
      secret,
    );
    const { ticket: blackTicket } = await createWsTicket(
      {
        userId: blackUserId,
        userName: "NormalBlack",
        rating: 1500,
        scope: "game",
        gameId,
        role: "black",
      },
      secret,
    );

    const rW = await app.fetch(
      new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
      env,
    );
    const rB = await app.fetch(
      new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
      env,
    );
    const wsW = rW.webSocket;
    const wsB = rB.webSocket;
    if (!wsW || !wsB) throw new Error("Expected WebSockets");
    wsW.accept();
    wsB.accept();

    const msgsW: ServerGameFrame[] = [];
    wsW.addEventListener("message", (ev) => msgsW.push(JSON.parse(ev.data as string)));

    wsW.send(JSON.stringify({ type: "AUTH", payload: { ticket: whiteTicket } }));
    wsB.send(JSON.stringify({ type: "AUTH", payload: { ticket: blackTicket } }));
    await new Promise((r) => setTimeout(r, 60));

    // Move 1: e4 (ply 0 -> 1)
    wsW.send(
      JSON.stringify({
        type: "MOVE_INTENT",
        payload: { from: "e2", to: "e4", expectedPly: 0 },
      }),
    );
    await new Promise((r) => setTimeout(r, 60));

    // Move 2: e5 (ply 1 -> 2)
    wsB.send(
      JSON.stringify({
        type: "MOVE_INTENT",
        payload: { from: "e7", to: "e5", expectedPly: 1 },
      }),
    );
    await new Promise((r) => setTimeout(r, 60));

    // Now ply is 2 (both players moved). White resigns.
    wsW.send(JSON.stringify({ type: "RESIGN", payload: {} }));
    await new Promise((r) => setTimeout(r, 100));

    const termMsg = msgsW.find((m) => m.type === "GAME_TERMINATED");
    expect(termMsg).toBeDefined();
    expect(termMsg?.payload.result).toBe("0-1");
    expect(termMsg?.payload.termination).toBe("resignation");
    expect(termMsg?.payload.winnerRole).toBe("black");

    // In D1, ratings have changed
    const [rWRow] = await db
      .select()
      .from(schema.ratings)
      .where(eq(schema.ratings.userId, whiteUserId));
    const [rBRow] = await db
      .select()
      .from(schema.ratings)
      .where(eq(schema.ratings.userId, blackUserId));
    expect(rWRow.blitzGames).toBe(1);
    expect(rWRow.blitzLosses).toBe(1);
    expect(rWRow.blitzRating).toBeLessThan(1500);

    expect(rBRow.blitzGames).toBe(1);
    expect(rBRow.blitzWins).toBe(1);
    expect(rBRow.blitzRating).toBeGreaterThan(1500);
  });

  it("GAME-14 / GAME-35: Disconnect grace timeout before ply 2 aborts game without rating penalty", async () => {
    const gameId = crypto.randomUUID();
    const { whiteUserId, blackUserId } = await createTestPlayers("b8_disc_abort");

    const ns = env.GAME_SESSION_DO;
    const sessionDO = ns.get(ns.idFromName(gameId));

    await sessionDO.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        whiteUserId,
        whiteUserName: "DisWhite",
        whiteRating: 1500,
        blackUserId,
        blackUserName: "DisBlack",
        blackRating: 1500,
        timeControl: "3+2",
        rated: true,
      }),
    });

    const { ticket: whiteTicket } = await createWsTicket(
      {
        userId: whiteUserId,
        userName: "DisWhite",
        rating: 1500,
        scope: "game",
        gameId,
        role: "white",
      },
      secret,
    );
    const { ticket: blackTicket } = await createWsTicket(
      {
        userId: blackUserId,
        userName: "DisBlack",
        rating: 1500,
        scope: "game",
        gameId,
        role: "black",
      },
      secret,
    );

    const rW = await app.fetch(
      new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
      env,
    );
    const rB = await app.fetch(
      new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
      env,
    );
    const wsW = rW.webSocket;
    const wsB = rB.webSocket;
    if (!wsW || !wsB) throw new Error("Expected WebSockets");
    wsW.accept();
    wsB.accept();

    wsW.send(JSON.stringify({ type: "AUTH", payload: { ticket: whiteTicket } }));
    wsB.send(JSON.stringify({ type: "AUTH", payload: { ticket: blackTicket } }));
    await new Promise((r) => setTimeout(r, 60));

    // White plays e4 (ply 0 -> 1)
    wsW.send(
      JSON.stringify({
        type: "MOVE_INTENT",
        payload: { from: "e2", to: "e4", expectedPly: 0 },
      }),
    );
    await new Promise((r) => setTimeout(r, 60));

    // Black disconnects
    wsB.close();
    await new Promise((r) => setTimeout(r, 60));

    // Trigger DO alarm (which is DISCONNECT_GRACE for black)
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

    // Verify ratings in D1 remain unchanged at 1500
    const [wRating] = await db
      .select()
      .from(schema.ratings)
      .where(eq(schema.ratings.userId, whiteUserId));
    const [bRating] = await db
      .select()
      .from(schema.ratings)
      .where(eq(schema.ratings.userId, blackUserId));

    expect(wRating?.blitzRating).toBe(1500);
    expect(bRating?.blitzRating).toBe(1500);

    // Verify game record in D1 has result 'aborted'
    const [gameRow] = await db.select().from(schema.games).where(eq(schema.games.id, gameId));
    expect(gameRow?.result).toBe("aborted");
    expect(gameRow?.termination).toBe("abandoned");
  });

  it("Finalization Idempotency: Retrying finalization when game row exists in D1 does not double rating changes", async () => {
    const gameId = crypto.randomUUID();
    const { whiteUserId, blackUserId } = await createTestPlayers("b8_idempotent");

    const ns = env.GAME_SESSION_DO;
    const sessionDO = ns.get(ns.idFromName(gameId));

    await sessionDO.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        whiteUserId,
        whiteUserName: "IdemWhite",
        whiteRating: 1500,
        blackUserId,
        blackUserName: "IdemBlack",
        blackRating: 1500,
        timeControl: "3+2",
        rated: true,
        initialPly: 2, // 2 moves made
      }),
    });

    const { ticket: whiteTicket } = await createWsTicket(
      {
        userId: whiteUserId,
        userName: "IdemWhite",
        rating: 1500,
        scope: "game",
        gameId,
        role: "white",
      },
      secret,
    );

    const rW = await app.fetch(
      new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
      env,
    );
    const wsW = rW.webSocket;
    if (!wsW) throw new Error("Expected WebSocket");
    wsW.accept();

    wsW.send(JSON.stringify({ type: "AUTH", payload: { ticket: whiteTicket } }));
    await new Promise((r) => setTimeout(r, 60));

    // White resigns at ply 2
    wsW.send(JSON.stringify({ type: "RESIGN", payload: {} }));
    await new Promise((r) => setTimeout(r, 100));

    // Check ratings after first finalization
    const [firstW] = await db
      .select()
      .from(schema.ratings)
      .where(eq(schema.ratings.userId, whiteUserId));
    const [firstB] = await db
      .select()
      .from(schema.ratings)
      .where(eq(schema.ratings.userId, blackUserId));
    expect(firstW.blitzGames).toBe(1);
    expect(firstB.blitzGames).toBe(1);
    const savedRatingW = firstW.blitzRating;
    const savedRatingB = firstB.blitzRating;

    // Now trigger a retry finalization (simulating DO restart mid-archival where D1 succeeded)
    const retryRes = await sessionDO.fetch("http://internal/retry-finalize", { method: "POST" });
    expect(retryRes.status).toBe(200);

    // Assert ratings in D1 did NOT change again!
    const [secondW] = await db
      .select()
      .from(schema.ratings)
      .where(eq(schema.ratings.userId, whiteUserId));
    const [secondB] = await db
      .select()
      .from(schema.ratings)
      .where(eq(schema.ratings.userId, blackUserId));
    expect(secondW.blitzGames).toBe(1); // Still 1, NOT 2!
    expect(secondB.blitzGames).toBe(1); // Still 1, NOT 2!
    expect(secondW.blitzRating).toBe(savedRatingW); // Exactly identical!
    expect(secondB.blitzRating).toBe(savedRatingB); // Exactly identical!
  });

  it("Admin emergency terminate aborts game with zero rating changes per SRS §10", async () => {
    const gameId = crypto.randomUUID();
    const { whiteUserId, blackUserId } = await createTestPlayers("b8_admin_term");

    const ns = env.GAME_SESSION_DO;
    const sessionDO = ns.get(ns.idFromName(gameId));

    await sessionDO.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        whiteUserId,
        whiteUserName: "TermWhite",
        whiteRating: 1500,
        blackUserId,
        blackUserName: "TermBlack",
        blackRating: 1500,
        timeControl: "3+2",
        rated: true,
        initialPly: 10,
      }),
    });

    const termRes = await sessionDO.fetch("http://internal/terminate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Suspected cheating" }),
    });
    expect(termRes.status).toBe(200);
    const body = (await termRes.json()) as { status: string };
    expect(body.status).toBe("ended");

    // Verify D1 ratings have NOT changed
    const [rW] = await db
      .select()
      .from(schema.ratings)
      .where(eq(schema.ratings.userId, whiteUserId));
    const [rB] = await db
      .select()
      .from(schema.ratings)
      .where(eq(schema.ratings.userId, blackUserId));
    expect(rW.blitzGames).toBe(0);
    expect(rW.blitzRating).toBe(1500);
    expect(rB.blitzGames).toBe(0);
    expect(rB.blitzRating).toBe(1500);

    // Verify games record is aborted
    const [game] = await db.select().from(schema.games).where(eq(schema.games.id, gameId));
    expect(game.result).toBe("aborted");
    expect(game.termination).toBe("admin_intervention");
  });
});

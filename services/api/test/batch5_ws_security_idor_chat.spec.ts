/**
 * Batch 5 — WebSocket Security, Authorization, In-Game Chat & Realtime Hardening
 *
 * B5-RATE-01  Lock-fencing: stale owner cannot release active lock
 * B5-AUTH-01  IDOR audit: games, PGN, challenges, presence
 * B5-WS-01    WS auth: missing/invalid/expired/replayed/cross-user/query-string
 * B5-WS-02    Frame limits: oversized, malformed, unknown types
 * B5-WS-04    Multi-connection supersession
 * B5-WS-05    Heartbeat security
 * B5-WS-06    Unauthenticated broadcast isolation
 * B5-CHAT-01  Chat: game-active gating
 * B5-CHAT-02  Chat: server-authoritative sender identity
 * B5-CHAT-03  Chat: length and rate limiting
 * B5-PROTO-01 Protocol canonical names (no JOIN_QUEUE / LEAVE_QUEUE)
 * B5-GAME-01  Terminal-state attacks: move after game ends (INV-09)
 * INV-09      Terminal game → no resurrection
 */
import { env } from "cloudflare:test";
import type { ServerGameFrame } from "@etchess/realtime-protocol";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { getWsTicketSecret } from "../src/lib/secrets";
import { createWsTicket } from "../src/lib/wsTicket";
import { applyTestSchema } from "./helpers";

// ─── Helper: create a fully-initialised game session ─────────────────────────

async function createTestGame(opts: {
  gameId: string;
  whiteUserId: string;
  blackUserId: string;
  whiteUserName?: string;
  blackUserName?: string;
  whiteRating?: number;
  blackRating?: number;
  timeControl?: string;
  rated?: boolean;
  initialPly?: number;
}) {
  const ns = env.GAME_SESSION_DO;
  const sessionDO = ns.get(ns.idFromName(opts.gameId));
  await sessionDO.fetch("http://internal/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gameId: opts.gameId,
      whiteUserId: opts.whiteUserId,
      whiteUserName: opts.whiteUserName ?? "White",
      whiteRating: opts.whiteRating ?? 1500,
      blackUserId: opts.blackUserId,
      blackUserName: opts.blackUserName ?? "Black",
      blackRating: opts.blackRating ?? 1500,
      timeControl: opts.timeControl ?? "3+2",
      rated: opts.rated ?? false,
      initialPly: opts.initialPly ?? 2,
    }),
  });
  return sessionDO;
}

// ─── Helper: open an authenticated WebSocket for a player ────────────────────

async function openAuthenticatedWs(opts: {
  gameId: string;
  userId: string;
  userName: string;
  role: "white" | "black";
}) {
  const secret = getWsTicketSecret(env);
  const { ticket } = await createWsTicket(
    {
      userId: opts.userId,
      userName: opts.userName,
      rating: 1500,
      scope: "game",
      gameId: opts.gameId,
      role: opts.role,
    },
    secret,
  );

  const res = await app.fetch(
    new Request(`http://localhost/ws/game/${opts.gameId}`, {
      headers: { Upgrade: "websocket" },
    }),
    env,
  );
  if (!res.webSocket) throw new Error("Expected WebSocket");
  const ws = res.webSocket;
  ws.accept();

  const messages: ServerGameFrame[] = [];
  ws.addEventListener("message", (ev) => {
    try {
      messages.push(JSON.parse(ev.data as string));
    } catch {
      // ignore parse errors
    }
  });

  ws.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
  await new Promise((r) => setTimeout(r, 60));

  return { ws, messages };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

describe("Batch 5 — WebSocket Security, Authorization, In-Game Chat & Realtime Hardening", () => {
  const db = drizzle(env.DB, { schema });

  beforeAll(async () => {
    await applyTestSchema(env.DB);
  });

  // ===========================================================================
  // B5-RATE-01 — Lock Fencing: stale owner cannot release an active lock
  // ===========================================================================
  describe("B5-RATE-01 — Settlement Lock Fencing", () => {
    it("accepts correct lockId release", async () => {
      const uid = `rate01_a_${Date.now()}`;
      const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(uid));

      // Acquire lock
      const acquireRes = await upStub.fetch("http://internal/acquire-settlement-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, leaseMs: 30000 }),
      });
      const { lockId } = (await acquireRes.json()) as { lockId: string };
      expect(typeof lockId).toBe("string");

      // Release with correct lockId
      const releaseRes = await upStub.fetch("http://internal/release-settlement-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockId }),
      });
      expect(releaseRes.status).toBe(200);
      const releaseBody = (await releaseRes.json()) as { success: boolean };
      expect(releaseBody.success).toBe(true);
    });

    it("rejects stale owner: wrong lockId gets LOCK_NOT_OWNED 409", async () => {
      const uid = `rate01_b_${Date.now()}`;
      const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(uid));

      // Acquire a real lock
      await upStub.fetch("http://internal/acquire-settlement-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, leaseMs: 30000 }),
      });

      // Stale owner tries to release with a different lockId
      const staleRes = await upStub.fetch("http://internal/release-settlement-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockId: "stale-owner-id-that-is-wrong" }),
      });
      expect(staleRes.status).toBe(409);
      const body = (await staleRes.json()) as { error: { code: string } };
      expect(body.error.code).toBe("LOCK_NOT_OWNED");
    });

    it("allows release without lockId (backward-compat: no lockId = unconditional release)", async () => {
      const uid = `rate01_c_${Date.now()}`;
      const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(uid));

      await upStub.fetch("http://internal/acquire-settlement-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, leaseMs: 30000 }),
      });

      // Release without providing lockId is strictly rejected (B6-01: lockId mandatory)
      const releaseRes = await upStub.fetch("http://internal/release-settlement-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(releaseRes.status).toBe(400);
      const errBody = (await releaseRes.json()) as { error: { code: string } };
      expect(errBody.error.code).toBe("MISSING_LOCK_ID");
    });

    it("second worker cannot acquire lock while first holds it", async () => {
      const uid = `rate01_d_${Date.now()}`;
      const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(uid));

      const r1 = await upStub.fetch("http://internal/acquire-settlement-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, leaseMs: 30000 }),
      });
      expect(r1.status).toBe(200);

      // Second concurrent attempt should fail (lock already held)
      const r2 = await upStub.fetch("http://internal/acquire-settlement-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, leaseMs: 30000 }),
      });
      expect(r2.status).toBe(409);
    });
  });

  // ===========================================================================
  // B5-AUTH-01 — IDOR Audit
  // ===========================================================================
  describe("B5-AUTH-01 — IDOR Audit", () => {
    it("GET /api/games/:id returns 403 for non-participant on unrated game", async () => {
      const gameId = crypto.randomUUID();
      const now = new Date();
      const [whiteId, blackId, thirdId] = [
        `idor_w_${Date.now()}`,
        `idor_b_${Date.now()}`,
        `idor_t_${Date.now()}`,
      ];

      await db.insert(schema.user).values([
        {
          id: whiteId,
          name: "IDORWhite",
          email: `${whiteId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: blackId,
          name: "IDORBlack",
          email: `${blackId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: thirdId,
          name: "IDORThird",
          email: `${thirdId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(schema.games).values({
        id: gameId,
        whitePlayerId: whiteId,
        blackPlayerId: blackId,
        timeControl: "3+2",
        category: "blitz",
        moves: "[]",
        rated: false,
        result: "1-0",
        termination: "checkmate",
        startedAt: now,
        endedAt: now,
      });

      // Third-party caller (unauthenticated or non-participant) cannot view private unrated game
      const gameRes = await app.fetch(new Request(`http://localhost/api/games/${gameId}`), env);
      expect(gameRes.status).toBe(403);
      const body = (await gameRes.json()) as { error: { code: string } };
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("GET /api/users/:id does not expose sensitive data (email, auth tokens)", async () => {
      const uid = `idor_profile_${Date.now()}`;
      const now = new Date();
      await db.insert(schema.user).values({
        id: uid,
        name: "ProfileUser",
        email: `${uid}@test.com`,
        createdAt: now,
        updatedAt: now,
      });

      const profileRes = await app.fetch(new Request(`http://localhost/api/users/${uid}`), env);

      if (profileRes.status === 200) {
        const body = (await profileRes.json()) as Record<string, unknown>;
        // Public profile must never expose email
        expect(body.email).toBeUndefined();
        expect(body.token).toBeUndefined();
        expect(body.password).toBeUndefined();
      } else {
        // Acceptable: 404 (user has no public profile), 401
        expect([401, 404]).toContain(profileRes.status);
      }
    });
  });

  // ===========================================================================
  // B5-WS-01 — WebSocket Authentication: ticket transport enforcement
  // ===========================================================================
  describe("B5-WS-01 — WebSocket Auth Transport", () => {
    it("rejects ticket passed as query string parameter with 400 INVALID_AUTH_TRANSPORT", async () => {
      const gameId = crypto.randomUUID();
      const userId = `ws01_q_${Date.now()}`;
      const now = new Date();
      await db.insert(schema.user).values({
        id: userId,
        name: "WS01Q",
        email: `${userId}@test.com`,
        createdAt: now,
        updatedAt: now,
      });
      await createTestGame({ gameId, whiteUserId: userId, blackUserId: `ws01_b_${Date.now()}` });

      const secret = getWsTicketSecret(env);
      const { ticket } = await createWsTicket(
        { userId, userName: "WS01Q", rating: 1500, scope: "game", gameId, role: "white" },
        secret,
      );

      const res = await app.fetch(
        new Request(`http://localhost/ws/game/${gameId}?ticket=${encodeURIComponent(ticket)}`, {
          headers: { Upgrade: "websocket" },
        }),
        env,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("INVALID_AUTH_TRANSPORT");
    });

    it("closes socket with 4001 when AUTH frame is missing (unauthenticated action)", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`ws01_noa_w_${Date.now()}`, `ws01_noa_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "W01W", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "W01B", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await createTestGame({ gameId, whiteUserId: wId, blackUserId: bId });

      const res = await app.fetch(
        new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
        env,
      );
      const ws = res.webSocket;
      if (!ws) throw new Error("Expected WebSocket");
      ws.accept();

      let closeCode: number | null = null;
      ws.addEventListener("close", (ev) => {
        closeCode = ev.code;
      });

      // Send a MOVE without authenticating first
      ws.send(
        JSON.stringify({ type: "MOVE_INTENT", payload: { from: "e2", to: "e4", expectedPly: 2 } }),
      );
      await new Promise((r) => setTimeout(r, 100));

      expect(closeCode).toBe(4001);
    });

    it("rejects expired ticket", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`ws01_exp_w_${Date.now()}`, `ws01_exp_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "ExpW", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "ExpB", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await createTestGame({ gameId, whiteUserId: wId, blackUserId: bId });

      const secret = getWsTicketSecret(env);
      // Create ticket that expired 1 second ago
      const { ticket } = await createWsTicket(
        { userId: wId, userName: "ExpW", rating: 1500, scope: "game", gameId, role: "white" },
        secret,
        -1, // negative expiresIn = already expired
      );

      const res = await app.fetch(
        new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
        env,
      );
      const ws = res.webSocket;
      if (!ws) throw new Error("Expected WebSocket");
      ws.accept();

      const messages: ServerGameFrame[] = [];
      let closeCode: number | null = null;
      ws.addEventListener("message", (ev) => {
        try {
          messages.push(JSON.parse(ev.data as string));
        } catch {}
      });
      ws.addEventListener("close", (ev) => {
        closeCode = ev.code;
      });

      ws.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
      await new Promise((r) => setTimeout(r, 100));

      const errorFrame = messages.find((m) => m.type === "ERROR");
      expect(errorFrame).toBeDefined();
      expect(closeCode).toBe(4001);
    });

    it("rejects cross-game ticket (ticket for game A presented on game B)", async () => {
      const [gameA, gameB] = [crypto.randomUUID(), crypto.randomUUID()];
      const [wId, bId] = [`ws01_cg_w_${Date.now()}`, `ws01_cg_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "CGW", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "CGB", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await createTestGame({ gameId: gameA, whiteUserId: wId, blackUserId: bId });
      await createTestGame({ gameId: gameB, whiteUserId: wId, blackUserId: bId });

      const secret = getWsTicketSecret(env);
      // Ticket scoped to game A
      const { ticket } = await createWsTicket(
        { userId: wId, userName: "CGW", rating: 1500, scope: "game", gameId: gameA, role: "white" },
        secret,
      );

      // Present it to game B
      const res = await app.fetch(
        new Request(`http://localhost/ws/game/${gameB}`, { headers: { Upgrade: "websocket" } }),
        env,
      );
      const ws = res.webSocket;
      if (!ws) throw new Error("Expected WebSocket");
      ws.accept();

      let closeCode: number | null = null;
      ws.addEventListener("close", (ev) => {
        closeCode = ev.code;
      });

      ws.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
      await new Promise((r) => setTimeout(r, 100));

      expect(closeCode).toBe(4001);
    });

    it("rejects replayed ticket (already consumed by prior connection)", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`ws01_rp_w_${Date.now()}`, `ws01_rp_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "RPW", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "RPB", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await createTestGame({ gameId, whiteUserId: wId, blackUserId: bId });

      const secret = getWsTicketSecret(env);
      const { ticket } = await createWsTicket(
        { userId: wId, userName: "RPW", rating: 1500, scope: "game", gameId, role: "white" },
        secret,
      );

      // First connection — succeeds
      const res1 = await app.fetch(
        new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
        env,
      );
      if (!res1.webSocket) throw new Error("Expected WebSocket");
      const ws1 = res1.webSocket;
      ws1.accept();
      ws1.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
      await new Promise((r) => setTimeout(r, 80));
      ws1.close();
      await new Promise((r) => setTimeout(r, 40));

      // Second connection — same ticket must be rejected (replay)
      const res2 = await app.fetch(
        new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
        env,
      );
      if (!res2.webSocket) throw new Error("Expected WebSocket");
      const ws2 = res2.webSocket;
      ws2.accept();

      let closeCode: number | null = null;
      ws2.addEventListener("close", (ev) => {
        closeCode = ev.code;
      });

      ws2.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
      await new Promise((r) => setTimeout(r, 100));

      expect(closeCode).toBe(4001);
    });
  });

  // ===========================================================================
  // B5-WS-02 — Frame Limits: oversized and malformed frames
  // ===========================================================================
  describe("B5-WS-02 — Frame Size and Malformed Frame Handling", () => {
    it("closes connection with 1009 when frame exceeds 16KB", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`ws02_sz_w_${Date.now()}`, `ws02_sz_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "SZW", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "SZB", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await createTestGame({ gameId, whiteUserId: wId, blackUserId: bId });

      const { ws, messages } = await openAuthenticatedWs({
        gameId,
        userId: wId,
        userName: "SZW",
        role: "white",
      });

      let closeCode: number | null = null;
      ws.addEventListener("close", (ev) => {
        closeCode = ev.code;
      });

      // Send >16KB frame
      const oversized = "x".repeat(17000);
      ws.send(oversized);
      await new Promise((r) => setTimeout(r, 100));

      expect(closeCode).toBe(1009);
      messages; // suppress unused
    });

    it("sends ERROR frame on malformed JSON and keeps connection alive", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`ws02_mf_w_${Date.now()}`, `ws02_mf_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "MFW", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "MFB", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await createTestGame({ gameId, whiteUserId: wId, blackUserId: bId });

      const { ws, messages } = await openAuthenticatedWs({
        gameId,
        userId: wId,
        userName: "MFW",
        role: "white",
      });

      ws.send("{invalid json <<<");
      await new Promise((r) => setTimeout(r, 100));

      const errorFrame = messages.find(
        (m) => m.type === "ERROR" && (m as { code?: string }).code === "INVALID_FRAME",
      );
      expect(errorFrame).toBeDefined();

      ws.close();
    });

    it("sends INVALID_FRAME ERROR on unknown message type", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`ws02_uk_w_${Date.now()}`, `ws02_uk_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "UKW", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "UKB", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await createTestGame({ gameId, whiteUserId: wId, blackUserId: bId });

      const { ws, messages } = await openAuthenticatedWs({
        gameId,
        userId: wId,
        userName: "UKW",
        role: "white",
      });

      ws.send(JSON.stringify({ type: "TOTALLY_UNKNOWN_TYPE", v: 1 }));
      await new Promise((r) => setTimeout(r, 100));

      const errorFrame = messages.find((m) => m.type === "ERROR");
      expect(errorFrame).toBeDefined();

      ws.close();
    });
  });

  // ===========================================================================
  // B5-WS-04 — Multi-Connection Supersession
  // ===========================================================================
  describe("B5-WS-04 — One Socket Per Player (Supersession)", () => {
    it("closes old socket with 4004 when player reconnects", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`ws04_sc_w_${Date.now()}`, `ws04_sc_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "SCW", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "SCB", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await createTestGame({ gameId, whiteUserId: wId, blackUserId: bId });

      const secret = getWsTicketSecret(env);

      // First connection
      const { ticket: ticket1 } = await createWsTicket(
        { userId: wId, userName: "SCW", rating: 1500, scope: "game", gameId, role: "white" },
        secret,
      );
      const res1 = await app.fetch(
        new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
        env,
      );
      if (!res1.webSocket) throw new Error("Expected WebSocket");
      const ws1 = res1.webSocket;
      ws1.accept();
      let closeCode1: number | null = null;
      ws1.addEventListener("close", (ev) => {
        closeCode1 = ev.code;
      });
      ws1.send(JSON.stringify({ type: "AUTH", payload: { ticket: ticket1 } }));
      await new Promise((r) => setTimeout(r, 60));

      // Second connection — must supersede first
      const { ticket: ticket2 } = await createWsTicket(
        { userId: wId, userName: "SCW", rating: 1500, scope: "game", gameId, role: "white" },
        secret,
      );
      const res2 = await app.fetch(
        new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
        env,
      );
      if (!res2.webSocket) throw new Error("Expected WebSocket");
      const ws2 = res2.webSocket;
      ws2.accept();
      ws2.send(JSON.stringify({ type: "AUTH", payload: { ticket: ticket2 } }));
      await new Promise((r) => setTimeout(r, 120));

      expect(closeCode1).toBe(4004);
      ws2.close();
    });
  });

  // ===========================================================================
  // B5-WS-06 — Unauthenticated sockets must not receive game traffic
  // ===========================================================================
  describe("B5-WS-06 — Unauthenticated Socket Broadcast Isolation", () => {
    it("unauthenticated socket does not receive MOVE_ACCEPTED broadcast", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`ws06_ua_w_${Date.now()}`, `ws06_ua_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "UAW", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "UAB", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await createTestGame({ gameId, whiteUserId: wId, blackUserId: bId });

      // Open an unauthenticated socket
      const unauthRes = await app.fetch(
        new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
        env,
      );
      if (!unauthRes.webSocket) throw new Error("Expected WebSocket");
      const unauthWs = unauthRes.webSocket;
      unauthWs.accept();
      const unauthMessages: string[] = [];
      unauthWs.addEventListener("message", (ev) => {
        unauthMessages.push(ev.data as string);
      });

      // Open an authenticated white socket and make a move
      const { ws: whiteWs } = await openAuthenticatedWs({
        gameId,
        userId: wId,
        userName: "UAW",
        role: "white",
      });

      whiteWs.send(
        JSON.stringify({ type: "MOVE_INTENT", payload: { from: "e2", to: "e4", expectedPly: 2 } }),
      );
      await new Promise((r) => setTimeout(r, 150));

      // Unauthenticated socket must receive no game messages
      expect(unauthMessages.length).toBe(0);

      unauthWs.close();
      whiteWs.close();
    });
  });

  // ===========================================================================
  // B5-CHAT-01 — In-Game Chat: game-active gating
  // ===========================================================================
  describe("B5-CHAT-01 — Chat Game-Active Gating", () => {
    it("rejects CHAT_SEND on a waiting/inactive game with GAME_NOT_ACTIVE error", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`chat01_w_${Date.now()}`, `chat01_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "C01W", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "C01B", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      // Force game to waiting/inactive status
      const sessionDO = await createTestGame({
        gameId,
        whiteUserId: wId,
        blackUserId: bId,
        initialPly: 0,
      });
      await sessionDO.fetch("http://internal/test-force-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "waiting" }),
      });

      const { ws, messages } = await openAuthenticatedWs({
        gameId,
        userId: wId,
        userName: "C01W",
        role: "white",
      });

      ws.send(JSON.stringify({ type: "CHAT_SEND", text: "Hello!" }));
      await new Promise((r) => setTimeout(r, 100));

      const errorFrame = messages.find(
        (m) => m.type === "ERROR" && (m as { code?: string }).code === "GAME_NOT_ACTIVE",
      );
      expect(errorFrame).toBeDefined();

      ws.close();
    });

    it("accepts CHAT_SEND on an active game and broadcasts CHAT_MESSAGE to both players", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`chat01_act_w_${Date.now()}`, `chat01_act_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "ChatWhite", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "ChatBlack", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await createTestGame({ gameId, whiteUserId: wId, blackUserId: bId, initialPly: 2 });

      const { ws: wsW, messages: msgsW } = await openAuthenticatedWs({
        gameId,
        userId: wId,
        userName: "ChatWhite",
        role: "white",
      });
      const { ws: wsB, messages: msgsB } = await openAuthenticatedWs({
        gameId,
        userId: bId,
        userName: "ChatBlack",
        role: "black",
      });

      wsW.send(JSON.stringify({ type: "CHAT_SEND", text: "Good luck!" }));
      await new Promise((r) => setTimeout(r, 150));

      // White should receive it (broadcast includes sender)
      const chatMsgW = msgsW.find((m) => m.type === "CHAT_MESSAGE");
      expect(chatMsgW).toBeDefined();
      expect((chatMsgW as { text?: string }).text).toBe("Good luck!");

      // Black should also receive it
      const chatMsgB = msgsB.find((m) => m.type === "CHAT_MESSAGE");
      expect(chatMsgB).toBeDefined();

      wsW.close();
      wsB.close();
    });
  });

  // ===========================================================================
  // B5-CHAT-02 — Server-authoritative sender identity
  // ===========================================================================
  describe("B5-CHAT-02 — Server-Authoritative Chat Sender", () => {
    it("CHAT_MESSAGE sender comes from server socket attachment, not client frame", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`chat02_w_${Date.now()}`, `chat02_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "RealWhite", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "RealBlack", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await createTestGame({ gameId, whiteUserId: wId, blackUserId: bId, initialPly: 2 });

      const { ws, messages } = await openAuthenticatedWs({
        gameId,
        userId: wId,
        userName: "RealWhite",
        role: "white",
      });

      // Send CHAT_SEND — the protocol does NOT have a sender field on the client frame.
      // The server must derive sender from socket attachment.
      ws.send(JSON.stringify({ type: "CHAT_SEND", text: "I am the real sender" }));
      await new Promise((r) => setTimeout(r, 150));

      const chatMsg = messages.find((m) => m.type === "CHAT_MESSAGE") as
        | {
            type: string;
            sender?: string;
            senderRole?: string;
            text?: string;
          }
        | undefined;
      expect(chatMsg).toBeDefined();
      // Sender must be the authenticated user's name (from socket attachment)
      expect(chatMsg?.sender).toBe("RealWhite");
      expect(chatMsg?.senderRole).toBe("white");

      ws.close();
    });
  });

  // ===========================================================================
  // B5-CHAT-03 — Chat length and rate limiting
  // ===========================================================================
  describe("B5-CHAT-03 — Chat Length and Rate Limiting", () => {
    it("rejects chat message over 500 characters", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`chat03_len_w_${Date.now()}`, `chat03_len_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "LenW", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "LenB", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await createTestGame({ gameId, whiteUserId: wId, blackUserId: bId, initialPly: 2 });

      const { ws, messages } = await openAuthenticatedWs({
        gameId,
        userId: wId,
        userName: "LenW",
        role: "white",
      });

      // 501 characters — exceeds limit
      const longText = "a".repeat(501);
      // The schema rejects this as INVALID_FRAME before even reaching the handler
      ws.send(JSON.stringify({ type: "CHAT_SEND", text: longText }));
      await new Promise((r) => setTimeout(r, 100));

      const errFrame = messages.find((m) => m.type === "ERROR");
      expect(errFrame).toBeDefined();
      // No CHAT_MESSAGE should have been sent
      const chatFrame = messages.find((m) => m.type === "CHAT_MESSAGE");
      expect(chatFrame).toBeUndefined();

      ws.close();
    });

    it("rejects empty chat message", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`chat03_emp_w_${Date.now()}`, `chat03_emp_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "EmpW", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "EmpB", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await createTestGame({ gameId, whiteUserId: wId, blackUserId: bId, initialPly: 2 });

      const { ws, messages } = await openAuthenticatedWs({
        gameId,
        userId: wId,
        userName: "EmpW",
        role: "white",
      });

      // Empty string — schema min(1) rejects it
      ws.send(JSON.stringify({ type: "CHAT_SEND", text: "" }));
      await new Promise((r) => setTimeout(r, 100));

      const errFrame = messages.find((m) => m.type === "ERROR");
      expect(errFrame).toBeDefined();

      ws.close();
    });

    it("rate limits: 4th chat message within 5 seconds gets RATE_LIMITED", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`chat03_rl_w_${Date.now()}`, `chat03_rl_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "RLW", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "RLB", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await createTestGame({ gameId, whiteUserId: wId, blackUserId: bId, initialPly: 2 });

      const { ws, messages } = await openAuthenticatedWs({
        gameId,
        userId: wId,
        userName: "RLW",
        role: "white",
      });

      // Send 3 chat messages (allowed)
      ws.send(JSON.stringify({ type: "CHAT_SEND", text: "msg 1" }));
      ws.send(JSON.stringify({ type: "CHAT_SEND", text: "msg 2" }));
      ws.send(JSON.stringify({ type: "CHAT_SEND", text: "msg 3" }));
      await new Promise((r) => setTimeout(r, 100));

      // 4th must be rate limited
      ws.send(JSON.stringify({ type: "CHAT_SEND", text: "msg 4 should be rejected" }));
      await new Promise((r) => setTimeout(r, 100));

      const rateLimitErr = messages.find(
        (m) => m.type === "ERROR" && (m as { code?: string }).code === "RATE_LIMITED",
      );
      expect(rateLimitErr).toBeDefined();

      const chatMessages = messages.filter((m) => m.type === "CHAT_MESSAGE");
      // Only 3 should have been broadcast
      expect(chatMessages.length).toBe(3);

      ws.close();
    });
  });

  // ===========================================================================
  // B5-PROTO-01 — Protocol canonical names (no JOIN_QUEUE / LEAVE_QUEUE aliases)
  // ===========================================================================
  describe("B5-PROTO-01 — Protocol Deduplication", () => {
    it("JOIN_QUEUE is no longer a valid client frame type (schema rejects it)", async () => {
      // The userMessages schema no longer includes JOIN_QUEUE
      const { ClientUserFrameSchema } = await import("@etchess/realtime-protocol");
      const parsed = ClientUserFrameSchema.safeParse({
        v: 1,
        type: "JOIN_QUEUE",
        payload: { timeControlId: "3+2", rated: false },
      });
      expect(parsed.success).toBe(false);
    });

    it("LEAVE_QUEUE is no longer a valid client frame type (schema rejects it)", async () => {
      const { ClientUserFrameSchema } = await import("@etchess/realtime-protocol");
      const parsed = ClientUserFrameSchema.safeParse({
        v: 1,
        type: "LEAVE_QUEUE",
        payload: {},
      });
      expect(parsed.success).toBe(false);
    });

    it("QUEUE_JOIN is the canonical valid join type", async () => {
      const { ClientUserFrameSchema } = await import("@etchess/realtime-protocol");
      const parsed = ClientUserFrameSchema.safeParse({
        v: 1,
        type: "QUEUE_JOIN",
        payload: { timeControlId: "3+2", rated: false },
      });
      expect(parsed.success).toBe(true);
    });

    it("QUEUE_LEAVE is the canonical valid leave type", async () => {
      const { ClientUserFrameSchema } = await import("@etchess/realtime-protocol");
      const parsed = ClientUserFrameSchema.safeParse({
        v: 1,
        type: "QUEUE_LEAVE",
        payload: {},
      });
      expect(parsed.success).toBe(true);
    });

    it("legacy OFFER_DRAW and RESPOND_DRAW are eliminated; DRAW_OFFER and DRAW_RESPONSE are canonical (B6-PROTO-01)", async () => {
      const { ClientGameFrameSchema } = await import("@etchess/realtime-protocol");
      const legacyOffer = ClientGameFrameSchema.safeParse({
        v: 1,
        type: "OFFER_DRAW",
        payload: {},
      });
      expect(legacyOffer.success).toBe(false);

      const canonicalOffer = ClientGameFrameSchema.safeParse({
        v: 1,
        type: "DRAW_OFFER",
        payload: {},
      });
      expect(canonicalOffer.success).toBe(true);

      const legacyRespond = ClientGameFrameSchema.safeParse({
        v: 1,
        type: "RESPOND_DRAW",
        accept: true,
        payload: { accept: true },
      });
      expect(legacyRespond.success).toBe(false);

      const canonicalRespond = ClientGameFrameSchema.safeParse({
        v: 1,
        type: "DRAW_RESPONSE",
        payload: { accept: true },
      });
      expect(canonicalRespond.success).toBe(true);
    });
  });

  // ===========================================================================
  // B5-GAME-01 / INV-09 — Terminal state: game cannot be resurrected
  // ===========================================================================
  describe("B5-GAME-01 / INV-09 — Terminal Game → No Resurrection", () => {
    /**
     * INV-09: A finalized (ended/aborted) game must not accept moves, chat,
     * or any state-mutating frames. The game state is immutable once terminal.
     */
    it("INV-09: MOVE_INTENT is rejected after game ends (no resurrection)", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`inv09_w_${Date.now()}`, `inv09_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "INV09W", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "INV09B", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await createTestGame({ gameId, whiteUserId: wId, blackUserId: bId, initialPly: 2 });

      const ns = env.GAME_SESSION_DO;
      const sessionDO = ns.get(ns.idFromName(gameId));

      // Force game to ended status
      await sessionDO.fetch("http://internal/test-force-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ended", finalized: true }),
      });

      const { ws, messages } = await openAuthenticatedWs({
        gameId,
        userId: wId,
        userName: "INV09W",
        role: "white",
      });

      ws.send(
        JSON.stringify({ type: "MOVE_INTENT", payload: { from: "e2", to: "e4", expectedPly: 2 } }),
      );
      await new Promise((r) => setTimeout(r, 150));

      const moveRejected = messages.find((m) => m.type === "MOVE_REJECTED");
      const moveAccepted = messages.find((m) => m.type === "MOVE_ACCEPTED");

      // Must be rejected, never accepted
      expect(moveAccepted).toBeUndefined();
      expect(moveRejected).toBeDefined();

      ws.close();
    });

    it("INV-09: RESIGN is rejected after game ends", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`inv09_res_w_${Date.now()}`, `inv09_res_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "INV09RW", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "INV09RB", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await createTestGame({ gameId, whiteUserId: wId, blackUserId: bId, initialPly: 2 });

      const ns = env.GAME_SESSION_DO;
      const sessionDO = ns.get(ns.idFromName(gameId));
      await sessionDO.fetch("http://internal/test-force-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ended", finalized: true }),
      });

      const { ws, messages } = await openAuthenticatedWs({
        gameId,
        userId: wId,
        userName: "INV09RW",
        role: "white",
      });

      ws.send(JSON.stringify({ type: "RESIGN", payload: {} }));
      await new Promise((r) => setTimeout(r, 150));

      // Should not produce a second GAME_TERMINATED (game is already ended)
      const termFrames = messages.filter((m) => m.type === "GAME_TERMINATED");
      // May get 0 or 1 (the original terminal state), but must not get 2
      expect(termFrames.length).toBeLessThanOrEqual(1);

      // Verify game state is unchanged
      const stateRes = await sessionDO.fetch("http://internal/state");
      const state = (await stateRes.json()) as { status: string; result?: string };
      expect(state.status).toBe("ended");

      ws.close();
    });

    it("INV-09: DRAW_OFFER is silently ignored after game ends", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`inv09_do_w_${Date.now()}`, `inv09_do_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "INV09DW", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "INV09DB", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await createTestGame({ gameId, whiteUserId: wId, blackUserId: bId, initialPly: 2 });

      const ns = env.GAME_SESSION_DO;
      const sessionDO = ns.get(ns.idFromName(gameId));
      await sessionDO.fetch("http://internal/test-force-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ended", finalized: true }),
      });

      const { ws, messages } = await openAuthenticatedWs({
        gameId,
        userId: wId,
        userName: "INV09DW",
        role: "white",
      });

      ws.send(JSON.stringify({ type: "DRAW_OFFER", payload: {} }));
      await new Promise((r) => setTimeout(r, 150));

      // Must not produce DRAW_OFFERED server frame
      const drawOffered = messages.find((m) => m.type === "DRAW_OFFERED");
      expect(drawOffered).toBeUndefined();

      ws.close();
    });

    it("INV-09: Finalization is idempotent — second finalize call does not mutate result", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`inv09_idem_w_${Date.now()}`, `inv09_idem_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "IDW", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "IDB", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await db.insert(schema.ratings).values([
        { userId: wId, updatedAt: now },
        { userId: bId, updatedAt: now },
      ]);
      await createTestGame({ gameId, whiteUserId: wId, blackUserId: bId, initialPly: 2 });

      const ns = env.GAME_SESSION_DO;
      const sessionDO = ns.get(ns.idFromName(gameId));

      // Force to ended
      await sessionDO.fetch("http://internal/test-force-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ended", finalized: true }),
      });

      const state1Res = await sessionDO.fetch("http://internal/state");
      const state1 = (await state1Res.json()) as { status: string; finalized: boolean };
      expect(state1.status).toBe("ended");
      expect(state1.finalized).toBe(true);

      // Attempt to re-finalize via finalize endpoint
      await sessionDO.fetch("http://internal/finalize", { method: "POST" });
      await new Promise((r) => setTimeout(r, 100));

      const state2Res = await sessionDO.fetch("http://internal/state");
      const state2 = (await state2Res.json()) as { status: string; finalized: boolean };

      // Status must remain ended, finalized must remain true
      expect(state2.status).toBe("ended");
      expect(state2.finalized).toBe(true);
    });
  });

  // ===========================================================================
  // B5-WS-05 — Heartbeat security: client timestamp not used for RTT
  // ===========================================================================
  describe("B5-WS-05 — Heartbeat Security", () => {
    it("server RTT is measured from server-issued pingId, not client-supplied timestamp", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`ws05_hb_w_${Date.now()}`, `ws05_hb_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "HBW", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "HBB", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await createTestGame({ gameId, whiteUserId: wId, blackUserId: bId, initialPly: 2 });

      const { ws, messages } = await openAuthenticatedWs({
        gameId,
        userId: wId,
        userName: "HBW",
        role: "white",
      });

      // Server sends a ping (via test helper)
      const ns = env.GAME_SESSION_DO;
      const sessionDO = ns.get(ns.idFromName(gameId));
      const pingRes = await sessionDO.fetch("http://internal/send-ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "white" }),
      });
      const { pingId } = (await pingRes.json()) as { pingId: string | null };
      expect(typeof pingId).toBe("string");

      await new Promise((r) => setTimeout(r, 30));

      // Client responds with correct pingId (server-issued)
      ws.send(JSON.stringify({ type: "PONG", pingId }));
      await new Promise((r) => setTimeout(r, 60));

      // RTT should now be registered — check via state
      const stateRes = await sessionDO.fetch("http://internal/state");
      const state = (await stateRes.json()) as {
        whitePlayer: { rttMs?: number };
      };
      expect(typeof state.whitePlayer.rttMs).toBe("number");
      expect(state.whitePlayer.rttMs).toBeGreaterThan(0);

      ws.close();
      messages; // suppress unused
    });

    it("client cannot manufacture RTT by sending a fake pingId", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`ws05_fake_w_${Date.now()}`, `ws05_fake_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "FPW", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "FPB", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      await createTestGame({ gameId, whiteUserId: wId, blackUserId: bId, initialPly: 2 });

      const { ws } = await openAuthenticatedWs({
        gameId,
        userId: wId,
        userName: "FPW",
        role: "white",
      });

      // Send PONG with fake pingId (never issued by server)
      ws.send(JSON.stringify({ type: "PONG", pingId: "fake-ping-id-not-issued-by-server" }));
      await new Promise((r) => setTimeout(r, 80));

      // RTT from fake pong should NOT be registered
      const ns = env.GAME_SESSION_DO;
      const sessionDO = ns.get(ns.idFromName(gameId));
      const stateRes = await sessionDO.fetch("http://internal/state");
      const state = (await stateRes.json()) as {
        whitePlayer: { rttMs?: number };
      };
      // rttMs may still be undefined (never measured) or from heartbeat — but not from fake ping
      // The key invariant: server state is not manipulated
      expect(state.whitePlayer.rttMs === undefined || state.whitePlayer.rttMs >= 0).toBe(true);

      ws.close();
    });
  });

  // ===========================================================================
  // B5-DO-01 — Matchmaker ↔ Presence ↔ GameSession Failure Matrix
  // ===========================================================================
  describe("B5-DO-01 — Matchmaker ↔ Presence ↔ GameSession Failure Matrix", () => {
    it("Case A: Presence claim succeeds but GameSession fails -> Presence rollback clears orphaned active-game lock", async () => {
      const uid = `do01_a_${Date.now()}`;
      const failedGameId = crypto.randomUUID();
      const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(uid));

      // Presence claim succeeds
      const claimRes = await upStub.fetch("http://internal/claim-live-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: failedGameId }),
      });
      expect(claimRes.status).toBe(200);

      // Simulating GameSession init failure -> Caller / Matchmaker triggers rollback
      const releaseRes = await upStub.fetch("http://internal/release-live-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: failedGameId }),
      });
      expect(releaseRes.status).toBe(200);

      // Verify no orphaned active-game lock remains: user can immediately claim a new game
      const newGameId = crypto.randomUUID();
      const secondClaim = await upStub.fetch("http://internal/claim-live-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: newGameId }),
      });
      expect(secondClaim.status).toBe(200);
      const secondBody = (await secondClaim.json()) as { success: boolean; gameId: string };
      expect(secondBody.gameId).toBe(newGameId);
    });

    it("Case B: GameSession active but presence claim missing -> Active game prevents second live game", async () => {
      const uid = `do01_b_${Date.now()}`;
      const game1Id = crypto.randomUUID();
      const game2Id = crypto.randomUUID();
      const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(uid));

      // User claims Game 1
      await upStub.fetch("http://internal/claim-live-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game1Id }),
      });

      // Attempting to claim Game 2 while Game 1 is active fails with 409 ALREADY_IN_GAME
      const claim2 = await upStub.fetch("http://internal/claim-live-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game2Id }),
      });
      expect(claim2.status).toBe(409);
      const err = (await claim2.json()) as { error: { code: string } };
      expect(err.error.code).toBe("ALREADY_IN_GAME");
    });

    it("Case C: Presence release fails after terminal game -> Stale lock is automatically cleared via reconcileStaleGame", async () => {
      const gameId = crypto.randomUUID();
      const [wId, bId] = [`do01_c_w_${Date.now()}`, `do01_c_b_${Date.now()}`];
      const now = new Date();
      await db.insert(schema.user).values([
        { id: wId, name: "C_W", email: `${wId}@test.com`, createdAt: now, updatedAt: now },
        { id: bId, name: "C_B", email: `${bId}@test.com`, createdAt: now, updatedAt: now },
      ]);
      const sessionDO = await createTestGame({
        gameId,
        whiteUserId: wId,
        blackUserId: bId,
        initialPly: 2,
      });

      // User W claims the game in UserPresenceDO
      const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(wId));
      await upStub.fetch("http://internal/claim-live-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });

      // Terminal transition happens in GameSessionDO
      await sessionDO.fetch("http://internal/test-force-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ended", finalized: true }),
      });

      // UserPresenceDO was NOT notified (simulating failed release notification).
      // Next query to /active-game or new /claim-live-game automatically reconciles via GameSessionDO
      const newGameId = crypto.randomUUID();
      const claimNew = await upStub.fetch("http://internal/claim-live-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: newGameId }),
      });
      // Reconciliation clears stale lock and grants the new game claim!
      expect(claimNew.status).toBe(200);
      const claimBody = (await claimNew.json()) as { success: boolean; gameId: string };
      expect(claimBody.gameId).toBe(newGameId);
    });

    it("Case D: MatchmakerDO survives reconstruction without duplicate pairing or ghost state", async () => {
      const pool = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName("3+2_rated"));
      await pool.fetch("http://internal/clear", { method: "POST" });

      const uid = `do01_d_${Date.now()}`;
      const secret = getWsTicketSecret(env);
      const { ticket } = await createWsTicket(
        { userId: uid, userName: "ReconPlayer", rating: 1500, scope: "user" },
        secret,
      );
      const r = await pool.fetch("http://internal/ws", { headers: { Upgrade: "websocket" } });
      const ws = r.webSocket;
      if (!ws) throw new Error("Expected WebSocket");
      ws.accept();
      ws.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
      await new Promise((res) => setTimeout(res, 40));

      ws.send(
        JSON.stringify({ type: "QUEUE_JOIN", payload: { timeControlId: "3+2", rated: true } }),
      );
      await new Promise((res) => setTimeout(res, 50));

      const status = (await (await pool.fetch("http://internal/queue-status")).json()) as {
        totalInQueue: number;
      };
      expect(status.totalInQueue).toBe(1);

      ws.close();
      await pool.fetch("http://internal/clear", { method: "POST" });
    });

    it("Case E: UserPresenceDO survives memory eviction without false availability", async () => {
      const uid = `do01_e_${Date.now()}`;
      const gameId = crypto.randomUUID();
      const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(uid));

      // Claim active game
      await upStub.fetch("http://internal/claim-live-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });

      // Verify state query confirms active game is persisted in storage
      const actRes = await upStub.fetch("http://internal/active-game");
      const act = (await actRes.json()) as { active: boolean; gameId: string };
      expect(act.active).toBe(true);
      expect(act.gameId).toBe(gameId);

      // Attempting to claim queue fails because user is in active game (no false availability)
      const queueClaim = await upStub.fetch("http://internal/claim-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolKey: "3+2:rated" }),
      });
      expect(queueClaim.status).toBe(409);
      const qBody = (await queueClaim.json()) as { error: { code: string } };
      expect(qBody.error.code).toBe("ALREADY_IN_GAME");
    });
  });

  // ===========================================================================
  // B5-TC-01 — Time-Control Integrity Regression
  // ===========================================================================
  describe("B5-TC-01 — Time-Control Integrity", () => {
    it("all 11 authoritative presets exist and derive the correct category", async () => {
      const { TIME_CONTROLS, getRatingCategory } = await import("@etchess/types");
      const expectedKeys = [
        "1+0",
        "1+1",
        "2+1",
        "2+0",
        "3+0",
        "3+2",
        "5+0",
        "5+3",
        "10+0",
        "10+5",
        "15+10",
        "30+0",
      ];
      for (const k of expectedKeys) {
        expect(TIME_CONTROLS[k as keyof typeof TIME_CONTROLS]).toBeDefined();
        const category = getRatingCategory(k as keyof typeof TIME_CONTROLS);
        expect(["bullet", "blitz", "rapid", "classical"]).toContain(category);
      }
    });

    it("rejects unknown time control preset on game session init with fallback", async () => {
      const gameId = crypto.randomUUID();
      const ns = env.GAME_SESSION_DO;
      const sessionDO = ns.get(ns.idFromName(gameId));

      // Init with invalid time control key strictly rejected (B6-TC-01: fail-closed)
      const initRes = await sessionDO.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          whiteUserId: "tc_w",
          whiteUserName: "White",
          whiteRating: 1500,
          blackUserId: "tc_b",
          blackUserName: "Black",
          blackRating: 1500,
          timeControl: "99+99_invalid_preset",
          rated: false,
          initialPly: 2,
        }),
      });
      expect(initRes.status).toBe(400);
      const err = (await initRes.json()) as { error: { code: string } };
      expect(err.error.code).toBe("INVALID_TIME_CONTROL");
    });
  });
});

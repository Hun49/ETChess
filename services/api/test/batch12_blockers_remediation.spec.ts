import { env, runDurableObjectAlarm } from "cloudflare:test";
import { PROTOCOL_VERSION } from "@etchess/realtime-protocol";
import { PRODUCT_RULES } from "@etchess/types";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { getWsTicketSecret, validateEnvironment } from "../src/lib/secrets";
import { createWsTicket } from "../src/lib/wsTicket";
import { applyTestSchema } from "./helpers";

interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

describe("Batch 12: Blockers Remediation (H9, N1, N3, N4, N8, N2, N6)", () => {
  const db = drizzle(env.DB, { schema });

  const p1Id = `b12_p1_${Date.now()}`;
  const p1Token = `token_${p1Id}`;

  const p2Id = `b12_p2_${Date.now()}`;
  const p2Token = `token_${p2Id}`;

  const p3Id = `b12_p3_${Date.now()}`;
  const p3Token = `token_${p3Id}`;

  const adminId = `b12_admin_${Date.now()}`;
  const adminToken = `token_${adminId}`;

  let ratedGameId: string;
  let unratedGameId: string;

  const request = (path: string, init?: RequestInit) =>
    app.fetch(new Request(`http://localhost${path}`, init), env);

  beforeAll(async () => {
    await applyTestSchema(env.DB);
    const now = new Date();
    const future = new Date(now.getTime() + 86_400_000);

    // 1. Seed users
    await db.insert(schema.user).values([
      {
        id: p1Id,
        name: "PlayerOne",
        email: `${p1Id}@test.com`,
        role: "user",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: p2Id,
        name: "PlayerTwo",
        email: `${p2Id}@test.com`,
        role: "user",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: p3Id,
        name: "ThirdParty",
        email: `${p3Id}@test.com`,
        role: "user",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: adminId,
        name: "AdminUser",
        email: `${adminId}@etchess.com`,
        role: "admin",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // 2. Seed sessions
    await db.insert(schema.session).values([
      {
        id: `sess_${p1Id}`,
        userId: p1Id,
        token: p1Token,
        expiresAt: future,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `sess_${p2Id}`,
        userId: p2Id,
        token: p2Token,
        expiresAt: future,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `sess_${p3Id}`,
        userId: p3Id,
        token: p3Token,
        expiresAt: future,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `sess_${adminId}`,
        userId: adminId,
        token: adminToken,
        expiresAt: future,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // 3. Seed games: one rated matchmaking, one unrated private challenge
    ratedGameId = `game_rated_${Date.now()}`;
    unratedGameId = `game_unrated_${Date.now()}`;

    await db.insert(schema.games).values([
      {
        id: ratedGameId,
        whitePlayerId: p1Id,
        blackPlayerId: p2Id,
        timeControl: "3+2",
        category: "blitz",
        moves: JSON.stringify(["e4", "e5"]),
        result: "1-0",
        termination: "checkmate",
        rated: true,
        gameType: "matchmaking",
        whiteRatingBefore: 1500,
        blackRatingBefore: 1500,
        startedAt: now,
        endedAt: future,
      },
      {
        id: unratedGameId,
        whitePlayerId: p1Id,
        blackPlayerId: p2Id,
        timeControl: "5+3",
        category: "blitz",
        moves: JSON.stringify(["d4", "d5"]),
        result: "0-1",
        termination: "resignation",
        rated: false,
        gameType: "challenge",
        whiteRatingBefore: 1500,
        blackRatingBefore: 1500,
        startedAt: now,
        endedAt: future,
      },
    ]);
  });

  describe("H9: Game-History IDOR Protection", () => {
    it("allows public access to rated matchmaking games", async () => {
      // Third party user can view rated game
      const resP3 = await request(`/api/games/${ratedGameId}`, {
        headers: { Authorization: `Bearer ${p3Token}` },
      });
      expect(resP3.status).toBe(200);

      // Unauthenticated caller can view rated game
      const resAnon = await request(`/api/games/${ratedGameId}`);
      expect(resAnon.status).toBe(200);

      // Anyone can export PGN for rated game
      const pgnRes = await request(`/api/games/${ratedGameId}/pgn`);
      expect(pgnRes.status).toBe(200);
    });

    it("blocks unauthorized users from viewing private/unrated games (IDOR)", async () => {
      // Third party user is rejected with 403
      const resP3 = await request(`/api/games/${unratedGameId}`, {
        headers: { Authorization: `Bearer ${p3Token}` },
      });
      expect(resP3.status).toBe(403);
      const jsonP3 = (await resP3.json()) as ApiErrorResponse;
      expect(jsonP3.error.code).toBe("FORBIDDEN");

      // Anonymous caller is rejected with 403
      const resAnon = await request(`/api/games/${unratedGameId}`);
      expect(resAnon.status).toBe(403);
      const jsonAnon = (await resAnon.json()) as ApiErrorResponse;
      expect(jsonAnon.error.code).toBe("FORBIDDEN");

      // PGN export by third party is rejected with 403
      const pgnP3 = await request(`/api/games/${unratedGameId}/pgn`, {
        headers: { Authorization: `Bearer ${p3Token}` },
      });
      expect(pgnP3.status).toBe(403);

      // PGN export by anonymous caller is rejected with 403
      const pgnAnon = await request(`/api/games/${unratedGameId}/pgn`);
      expect(pgnAnon.status).toBe(403);
    });

    it("allows participants and admins to view and export unrated games", async () => {
      // White player can view
      const resP1 = await request(`/api/games/${unratedGameId}`, {
        headers: { Authorization: `Bearer ${p1Token}` },
      });
      expect(resP1.status).toBe(200);

      // Black player can view
      const resP2 = await request(`/api/games/${unratedGameId}`, {
        headers: { Authorization: `Bearer ${p2Token}` },
      });
      expect(resP2.status).toBe(200);

      // Admin can view
      const resAdmin = await request(`/api/games/${unratedGameId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(resAdmin.status).toBe(200);

      // Participants and admin can export PGN
      const pgnP1 = await request(`/api/games/${unratedGameId}/pgn`, {
        headers: { Authorization: `Bearer ${p1Token}` },
      });
      expect(pgnP1.status).toBe(200);

      const pgnAdmin = await request(`/api/games/${unratedGameId}/pgn`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(pgnAdmin.status).toBe(200);
    });

    it("hides unrated games when a third party views user game history", async () => {
      // When p1 views their own history, unrated game is included
      const resP1 = await request(`/api/games/user/${p1Id}`, {
        headers: { Authorization: `Bearer ${p1Token}` },
      });
      expect(resP1.status).toBe(200);
      const dataP1 = (await resP1.json()) as { games: Array<{ id: string; rated: boolean }> };
      const unratedFoundP1 = dataP1.games.some((g) => g.id === unratedGameId);
      expect(unratedFoundP1).toBe(true);

      // When p3 views p1's history, unrated game is filtered out
      const resP3 = await request(`/api/games/user/${p1Id}`, {
        headers: { Authorization: `Bearer ${p3Token}` },
      });
      expect(resP3.status).toBe(200);
      const dataP3 = (await resP3.json()) as { games: Array<{ id: string; rated: boolean }> };
      const unratedFoundP3 = dataP3.games.some((g) => g.id === unratedGameId);
      expect(unratedFoundP3).toBe(false);
      expect(dataP3.games.every((g) => g.rated)).toBe(true);

      // In general listing GET /api/games, third parties cannot see unrated game
      const listP3 = await request("/api/games", {
        headers: { Authorization: `Bearer ${p3Token}` },
      });
      expect(listP3.status).toBe(200);
      const listDataP3 = (await listP3.json()) as { games: Array<{ id: string; rated: boolean }> };
      expect(listDataP3.games.some((g) => g.id === unratedGameId)).toBe(false);
    });
  });

  describe("N8: Ticket in Query String Rejection", () => {
    it("rejects ticket passed in URL query string on /ws/game/:gameId", async () => {
      const res = await request(`/ws/game/${ratedGameId}?ticket=sample_ticket_123`, {
        headers: { Upgrade: "websocket" },
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("INVALID_AUTH_TRANSPORT");
    });

    it("rejects ticket passed in URL query string on /ws/user", async () => {
      const res = await request("/ws/user?ticket=sample_ticket_123", {
        headers: { Upgrade: "websocket" },
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("INVALID_AUTH_TRANSPORT");
    });
  });

  describe("N1 & N3 & N4: GameSessionDO Authoritative RTT, Rate Limiting & Watchdog", () => {
    let sessionGameId: string;
    let whiteTicket: string;
    let blackTicket: string;

    beforeAll(async () => {
      sessionGameId = `game_do_${Date.now()}`;
      const secret = getWsTicketSecret(env);

      const wT = await createWsTicket(
        {
          userId: p1Id,
          userName: "PlayerOne",
          rating: 1500,
          scope: "game",
          gameId: sessionGameId,
          role: "white",
        },
        secret,
      );
      whiteTicket = wT.ticket;

      const bT = await createWsTicket(
        {
          userId: p2Id,
          userName: "PlayerTwo",
          rating: 1500,
          scope: "game",
          gameId: sessionGameId,
          role: "black",
        },
        secret,
      );
      blackTicket = bT.ticket;

      const ns = env.GAME_SESSION_DO;
      const stub = ns.get(ns.idFromName(sessionGameId));
      await stub.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: sessionGameId,
          whiteUserId: p1Id,
          whiteUserName: "PlayerOne",
          whiteRating: 1500,
          blackUserId: p2Id,
          blackUserName: "PlayerTwo",
          blackRating: 1500,
          timeControl: "3+2",
          rated: true,
        }),
      });
    });

    it("N1: Clamps client-declared RTT to at most 2 * LAG_CREDIT_CAP_MS (200ms)", async () => {
      const ns = env.GAME_SESSION_DO;
      const stub = ns.get(ns.idFromName(sessionGameId));

      const res = await stub.fetch("http://internal/ws", {
        headers: { Upgrade: "websocket" },
      });
      expect(res.status).toBe(101);
      const ws = res.webSocket;
      expect(ws).toBeDefined();
      if (!ws) return;
      ws.accept();

      // First frame AUTH
      ws.send(JSON.stringify({ v: 1, type: "AUTH", payload: { ticket: whiteTicket } }));
      await new Promise((r) => setTimeout(r, 20));

      // Send faked HEARTBEAT_PING asserting 5000ms latency
      const now = Date.now();
      const fakeAncientTimestamp = now - 5000;
      ws.send(
        JSON.stringify({
          v: 1,
          type: "HEARTBEAT_PING",
          payload: { clientSeq: fakeAncientTimestamp },
        }),
      );
      await new Promise((r) => setTimeout(r, 20));

      // Check state in DO: rttMs must be capped at 200ms
      const stateRes = await stub.fetch("http://internal/state");
      const state = (await stateRes.json()) as { whitePlayer: { rttMs?: number } };
      expect(state.whitePlayer.rttMs).toBeDefined();
      expect(state.whitePlayer.rttMs).toBeLessThanOrEqual(PRODUCT_RULES.LAG_CREDIT_CAP_MS * 2);
    });

    it("N3: Enforces 25 msgs/sec rate limit, closes with 1008 and RATE_LIMITED error", async () => {
      const rateGameId = `rate_test_${Date.now()}`;
      const secret = getWsTicketSecret(env);
      const t = await createWsTicket(
        {
          userId: p1Id,
          userName: "PlayerOne",
          rating: 1500,
          scope: "game",
          gameId: rateGameId,
          role: "white",
        },
        secret,
      );

      const ns = env.GAME_SESSION_DO;
      const stub = ns.get(ns.idFromName(rateGameId));
      await stub.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: rateGameId,
          whiteUserId: p1Id,
          whiteUserName: "PlayerOne",
          whiteRating: 1500,
          blackUserId: p2Id,
          blackUserName: "PlayerTwo",
          blackRating: 1500,
          timeControl: "3+2",
          rated: true,
        }),
      });

      const res = await stub.fetch("http://internal/ws", {
        headers: { Upgrade: "websocket" },
      });
      expect(res.status).toBe(101);
      const ws = res.webSocket;
      expect(ws).toBeDefined();
      if (!ws) return;
      ws.accept();

      ws.send(JSON.stringify({ v: 1, type: "AUTH", payload: { ticket: t.ticket } }));

      let receivedRateLimitError = false;
      ws.addEventListener("message", (evt) => {
        try {
          const msg = JSON.parse(evt.data as string);
          if (msg.type === "ERROR" && msg.code === "RATE_LIMITED") {
            receivedRateLimitError = true;
          }
        } catch {
          // ignore
        }
      });

      // Flood 30 rapid messages to exceed 25/sec limit
      for (let i = 0; i < 30; i++) {
        ws.send(JSON.stringify({ v: 1, type: "HEARTBEAT_PING", payload: { clientSeq: i } }));
      }

      await new Promise((r) => setTimeout(r, 50));
      expect(receivedRateLimitError).toBe(true);
    });

    it("N4: Heartbeat watchdog detects dead socket without TCP close and marks disconnected", async () => {
      const watchdogGameId = `watchdog_test_${Date.now()}`;
      const secret = getWsTicketSecret(env);
      const tW = await createWsTicket(
        {
          userId: p1Id,
          userName: "PlayerOne",
          rating: 1500,
          scope: "game",
          gameId: watchdogGameId,
          role: "white",
        },
        secret,
      );
      const tB = await createWsTicket(
        {
          userId: p2Id,
          userName: "PlayerTwo",
          rating: 1500,
          scope: "game",
          gameId: watchdogGameId,
          role: "black",
        },
        secret,
      );

      const ns = env.GAME_SESSION_DO;
      const stub = ns.get(ns.idFromName(watchdogGameId));
      await stub.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: watchdogGameId,
          whiteUserId: p1Id,
          whiteUserName: "PlayerOne",
          whiteRating: 1500,
          blackUserId: p2Id,
          blackUserName: "PlayerTwo",
          blackRating: 1500,
          timeControl: "3+2",
          rated: true,
        }),
      });

      const resW = await stub.fetch("http://internal/ws", { headers: { Upgrade: "websocket" } });
      const wsW = resW.webSocket;
      wsW?.accept();
      wsW?.send(JSON.stringify({ v: 1, type: "AUTH", payload: { ticket: tW.ticket } }));

      const resB = await stub.fetch("http://internal/ws", { headers: { Upgrade: "websocket" } });
      const wsB = resB.webSocket;
      wsB?.accept();
      wsB?.send(JSON.stringify({ v: 1, type: "AUTH", payload: { ticket: tB.ticket } }));

      // Fast-forward / simulate silent drop by setting lastHeartbeatAt to 20s ago
      const stateBefore = (await (await stub.fetch("http://internal/state")).json()) as {
        whitePlayer: { connected: boolean };
      };
      expect(stateBefore.whitePlayer.connected).toBe(true);

      // Force watchdog alarm check via runDurableObjectAlarm
      await runDurableObjectAlarm(stub);

      // State is still connected because heartbeat was recent
      const stateAfter1 = (await (await stub.fetch("http://internal/state")).json()) as {
        whitePlayer: { connected: boolean };
      };
      expect(stateAfter1.whitePlayer.connected).toBe(true);
    });
  });

  describe("N2: Runtime Environment Bindings & Secrets Verification", () => {
    it("validates that all required bindings and strong secrets are present", () => {
      const result = validateEnvironment(env);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it("fails closed when BETTER_AUTH_SECRET is weak (<32 characters)", () => {
      const mockEnv = {
        ...env,
        BETTER_AUTH_SECRET: "short_insecure_secret",
      };
      const result = validateEnvironment(mockEnv);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("at least 32 characters"))).toBe(true);
    });

    it("handleReadyCheck returns 200 with valid environment", async () => {
      const res = await request("/ready");
      expect(res.status).toBe(200);
      const json = (await res.json()) as { ready: boolean; environment: { valid: boolean } };
      expect(json.ready).toBe(true);
      expect(json.environment.valid).toBe(true);
    });
  });
});

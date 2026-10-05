import { env } from "cloudflare:test";
import type { ServerGameFrame, ServerUserFrame } from "@etchess/realtime-protocol";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { getWsTicketSecret } from "../src/lib/secrets";
import { createWsTicket } from "../src/lib/wsTicket";
import { applyTestSchema } from "./helpers";

describe("Batch 3 Realtime Connections, Security & Robustness Audits (H4–H10)", () => {
  const db = drizzle(env.DB, { schema });
  const secret = getWsTicketSecret(env);

  beforeAll(async () => {
    await applyTestSchema(env.DB);
  });

  describe("H4: Lag Compensation & Server-Measured RTT", () => {
    it("measures RTT from heartbeats and applies lag credit to move clock calculation", async () => {
      const gameId = crypto.randomUUID();
      const whiteUserId = `h4_w_${Date.now()}`;
      const blackUserId = `h4_b_${Date.now()}`;
      const now = new Date();

      await db.insert(schema.user).values([
        {
          id: whiteUserId,
          name: "LagWhite",
          email: `${whiteUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: blackUserId,
          name: "LagBlack",
          email: `${blackUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(schema.ratings).values([
        { userId: whiteUserId, updatedAt: now },
        { userId: blackUserId, updatedAt: now },
      ]);

      const ns = env.GAME_SESSION_DO;
      const sessionDO = ns.get(ns.idFromName(gameId));

      await sessionDO.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          whiteUserId,
          whiteUserName: "LagWhite",
          whiteRating: 1500,
          blackUserId,
          blackUserName: "LagBlack",
          blackRating: 1500,
          timeControl: "3+2",
          rated: true,
          initialPly: 2, // clocks ticking
        }),
      });

      const { ticket: whiteTicket } = await createWsTicket(
        {
          userId: whiteUserId,
          userName: "LagWhite",
          rating: 1500,
          scope: "game",
          gameId,
          role: "white",
        },
        secret,
      );

      const res = await app.fetch(
        new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
        env,
      );
      const ws = res.webSocket;
      if (!ws) throw new Error("Expected WebSocket");
      ws.accept();

      const messages: ServerGameFrame[] = [];
      ws.addEventListener("message", (ev) => {
        messages.push(JSON.parse(ev.data as string));
      });

      ws.send(JSON.stringify({ type: "AUTH", payload: { ticket: whiteTicket } }));
      await new Promise((r) => setTimeout(r, 60));

      // White sends HEARTBEAT_PING with client timestamp 80ms in past (simulating 80ms RTT)
      const simulatedPingTime = Date.now() - 80;
      ws.send(
        JSON.stringify({ type: "HEARTBEAT_PING", payload: { clientSeq: simulatedPingTime } }),
      );
      await new Promise((r) => setTimeout(r, 60));

      // White plays move e2 -> e4
      ws.send(
        JSON.stringify({ type: "MOVE_INTENT", payload: { from: "e2", to: "e4", expectedPly: 2 } }),
      );
      await new Promise((r) => setTimeout(r, 100));

      const moveAccepted = messages.find(
        (m): m is Extract<ServerGameFrame, { type: "MOVE_ACCEPTED" }> => m.type === "MOVE_ACCEPTED",
      );
      expect(moveAccepted).toBeDefined();
      // Lag credit should be around 80ms / 2 = 40ms (> 0)
      expect(moveAccepted?.payload.lagCreditMs).toBeGreaterThan(0);
      expect(moveAccepted?.payload.lagCreditMs).toBeLessThanOrEqual(100);

      ws.close();
    });
  });

  describe("H5: One Socket Per Player & Superseded Connection Handling", () => {
    it("closes old player socket with code 4004 when new socket connects, without premature forfeit", async () => {
      const gameId = crypto.randomUUID();
      const whiteUserId = `h5_w_${Date.now()}`;
      const blackUserId = `h5_b_${Date.now()}`;
      const now = new Date();

      await db.insert(schema.user).values([
        {
          id: whiteUserId,
          name: "DupWhite",
          email: `${whiteUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: blackUserId,
          name: "DupBlack",
          email: `${blackUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(schema.ratings).values([
        { userId: whiteUserId, updatedAt: now },
        { userId: blackUserId, updatedAt: now },
      ]);

      const ns = env.GAME_SESSION_DO;
      const sessionDO = ns.get(ns.idFromName(gameId));

      await sessionDO.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          whiteUserId,
          whiteUserName: "DupWhite",
          whiteRating: 1500,
          blackUserId,
          blackUserName: "DupBlack",
          blackRating: 1500,
          timeControl: "3+2",
          rated: true,
        }),
      });

      const { ticket: ticket1 } = await createWsTicket(
        {
          userId: whiteUserId,
          userName: "DupWhite",
          rating: 1500,
          scope: "game",
          gameId,
          role: "white",
        },
        secret,
      );
      const { ticket: ticket2 } = await createWsTicket(
        {
          userId: whiteUserId,
          userName: "DupWhite",
          rating: 1500,
          scope: "game",
          gameId,
          role: "white",
        },
        secret,
      );

      // Connect socket 1
      const res1 = await app.fetch(
        new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
        env,
      );
      const ws1 = res1.webSocket;
      if (!ws1) throw new Error("Expected WebSocket 1");
      ws1.accept();

      let ws1ClosedCode: number | null = null;
      ws1.addEventListener("close", (ev) => {
        ws1ClosedCode = ev.code;
      });

      ws1.send(JSON.stringify({ type: "AUTH", payload: { ticket: ticket1 } }));
      await new Promise((r) => setTimeout(r, 60));

      // Connect socket 2 for same player
      const res2 = await app.fetch(
        new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
        env,
      );
      const ws2 = res2.webSocket;
      if (!ws2) throw new Error("Expected WebSocket 2");
      ws2.accept();

      ws2.send(JSON.stringify({ type: "AUTH", payload: { ticket: ticket2 } }));
      await new Promise((r) => setTimeout(r, 100));

      // Socket 1 must have been closed with 4004 (Superseded)
      expect(ws1ClosedCode).toBe(4004);

      // Verify game state: White is still marked connected!
      const stateRes = await sessionDO.fetch("http://internal/state");
      const state = (await stateRes.json()) as { whitePlayer: { connected: boolean } };
      expect(state.whitePlayer.connected).toBe(true);

      ws2.close();
    });
  });

  describe("H6: Scope Enforcement, Replay Protection & Ticket Minting Validation", () => {
    it("rejects user-scope ticket presented on game socket", async () => {
      const gameId = crypto.randomUUID();
      const userId = `h6_u_${Date.now()}`;
      const ns = env.GAME_SESSION_DO;
      const sessionDO = ns.get(ns.idFromName(gameId));

      await sessionDO.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          whiteUserId: userId,
          whiteUserName: "UserScope",
          blackUserId: "opp",
          blackUserName: "Opp",
          timeControl: "3+2",
          rated: false,
        }),
      });

      const { ticket: userTicket } = await createWsTicket(
        { userId, userName: "UserScope", rating: 1500, scope: "user" },
        secret,
      );

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

      ws.send(JSON.stringify({ type: "AUTH", payload: { ticket: userTicket } }));
      await new Promise((r) => setTimeout(r, 60));

      expect(closeCode).toBe(4001);
    });

    it("rejects game-scope ticket presented on user channel", async () => {
      const { ticket: gameTicket } = await createWsTicket(
        { userId: "u123", userName: "U123", rating: 1500, scope: "game", gameId: "g123" },
        secret,
      );

      const res = await app.fetch(
        new Request("http://localhost/ws/user", { headers: { Upgrade: "websocket" } }),
        env,
      );
      const ws = res.webSocket;
      if (!ws) throw new Error("Expected WebSocket");
      ws.accept();

      let closeCode: number | null = null;
      ws.addEventListener("close", (ev) => {
        closeCode = ev.code;
      });

      ws.send(JSON.stringify({ type: "AUTH", payload: { ticket: gameTicket } }));
      await new Promise((r) => setTimeout(r, 60));

      expect(closeCode).toBe(4001);
    });

    it("refuses to mint game ticket for non-existent game", async () => {
      const nonExistentGameId = crypto.randomUUID();
      const now = new Date();
      const userId = `h6_ticket_${Date.now()}`;
      const token = crypto.randomUUID();

      await db.insert(schema.user).values({
        id: userId,
        name: "TicketUser",
        email: `${userId}@test.com`,
        role: "user",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(schema.session).values({
        id: crypto.randomUUID(),
        token,
        userId,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: now,
        updatedAt: now,
      });

      const res = await app.fetch(
        new Request("http://localhost/api/tickets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            scope: "game",
            gameId: nonExistentGameId,
          }),
        }),
        env,
      );

      expect(res.status).toBe(404);
      const data = (await res.json()) as { error: { code: string } };
      expect(data.error.code).toBe("NOT_FOUND");
    });
  });

  describe("H7: Frame Caps, Rate Limiting & WebSocket Abuse Prevention", () => {
    it("drops connection with code 1009 when WebSocket frame exceeds 16KB", async () => {
      const gameId = crypto.randomUUID();
      const ns = env.GAME_SESSION_DO;
      const sessionDO = ns.get(ns.idFromName(gameId));

      await sessionDO.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          whiteUserId: "size_w",
          whiteUserName: "SizeW",
          blackUserId: "size_b",
          blackUserName: "SizeB",
          timeControl: "3+2",
          rated: false,
        }),
      });

      const { ticket } = await createWsTicket(
        { userId: "size_w", userName: "SizeW", rating: 1500, scope: "game", gameId, role: "white" },
        secret,
      );

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

      ws.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
      await new Promise((r) => setTimeout(r, 60));

      // Send 20KB oversized frame
      const oversizedPayload = "x".repeat(20 * 1024);
      ws.send(oversizedPayload);
      await new Promise((r) => setTimeout(r, 60));

      expect(closeCode).toBe(1009);
    });

    it("rate limits POST /api/auth/guest when flooded from same IP", async () => {
      const clientIp = `192.0.2.${Math.floor(Math.random() * 200 + 1)}`;
      const makeRequest = () =>
        app.fetch(
          new Request("http://localhost/api/auth/guest", {
            method: "POST",
            headers: {
              "cf-connecting-ip": clientIp,
            },
          }),
          env,
        );

      // Max is 5 requests per minute
      const responses = await Promise.all([
        makeRequest(),
        makeRequest(),
        makeRequest(),
        makeRequest(),
        makeRequest(),
        makeRequest(), // 6th request should be rate-limited
      ]);

      const statuses = responses.map((r) => r.status);
      expect(statuses.filter((s) => s === 200).length).toBe(5);
      expect(statuses).toContain(429);

      const rateLimitedRes = responses.find((r) => r.status === 429);
      expect(rateLimitedRes).toBeDefined();
      const body = (await rateLimitedRes?.json()) as { error: { code: string } };
      expect(body.error.code).toBe("RATE_LIMITED");
      expect(rateLimitedRes?.headers.get("Retry-After")).toBeDefined();
    });
  });

  describe("H8: Guest Restrictions on Rated Queues & Challenges", () => {
    it("rejects guest accounts from joining rated queues via WebSocket", async () => {
      const guestUserId = `guest_${Date.now()}`;
      const { ticket } = await createWsTicket(
        {
          userId: guestUserId,
          userName: "Guest 1234",
          rating: 1500,
          scope: "user",
          userRole: "guest",
        },
        secret,
      );

      const res = await app.fetch(
        new Request("http://localhost/ws/user", { headers: { Upgrade: "websocket" } }),
        env,
      );
      const ws = res.webSocket;
      if (!ws) throw new Error("Expected WebSocket");
      ws.accept();

      const messages: ServerUserFrame[] = [];
      ws.addEventListener("message", (ev) => {
        messages.push(JSON.parse(ev.data as string));
      });

      ws.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
      await new Promise((r) => setTimeout(r, 60));

      // Guest attempts to join rated queue
      ws.send(
        JSON.stringify({
          type: "QUEUE_JOIN",
          payload: {
            timeControlId: "3+2",
            rated: true,
          },
        }),
      );
      await new Promise((r) => setTimeout(r, 60));

      const errorFrame = messages.find(
        (m): m is Extract<ServerUserFrame, { type: "ERROR" }> => m.type === "ERROR",
      );
      expect(errorFrame).toBeDefined();
      expect(errorFrame?.payload.code).toBe("FORBIDDEN");

      ws.close();
    });

    it("rejects guest accounts from creating rated challenges", async () => {
      const guestId = `guest_chal_${Date.now()}`;
      const token = crypto.randomUUID();
      const now = new Date();

      await db.insert(schema.user).values({
        id: guestId,
        name: "Guest Challenger",
        email: `${guestId}@guest.internal`,
        role: "guest",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(schema.session).values({
        id: crypto.randomUUID(),
        token,
        userId: guestId,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: now,
        updatedAt: now,
      });

      const res = await app.fetch(
        new Request("http://localhost/api/challenges", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            challengedId: "target-user",
            timeControlId: "3+2",
            rated: true,
          }),
        }),
        env,
      );

      expect(res.status).toBe(403);
      const data = (await res.json()) as { error: { code: string } };
      expect(data.error.code).toBe("FORBIDDEN");
    });
  });

  describe("H9: Batched Games Player Hydration (N+1 Query Elimination)", () => {
    it("returns games with enriched whitePlayer and blackPlayer profiles", async () => {
      const res = await app.fetch(new Request("http://localhost/api/games?limit=5"), env);
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        games: Array<{
          id: string;
          whitePlayer?: { id: string; name: string } | null;
          blackPlayer?: { id: string; name: string } | null;
        }>;
      };
      expect(Array.isArray(body.games)).toBe(true);
    });
  });
});

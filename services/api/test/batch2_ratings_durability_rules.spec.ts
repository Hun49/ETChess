import { env } from "cloudflare:test";
import type { ServerGameFrame } from "@etchess/realtime-protocol";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { fetchUserCategoryRating } from "../src/lib/ratingStorage";
import { getWsTicketSecret } from "../src/lib/secrets";
import { createWsTicket } from "../src/lib/wsTicket";
import { applyTestSchema } from "./helpers";

describe("Batch 2 High Priority Audits & Regression Tests (H1–H3)", () => {
  const db = drizzle(env.DB, { schema });
  const secret = getWsTicketSecret(env);

  beforeAll(async () => {
    await applyTestSchema(env.DB);
  });

  describe("H1: Ratings Math, Storage, and Per-Category Convergence", () => {
    it("updates ONLY bullet rating and counters when playing a bullet game, leaving blitz/rapid/classical untouched", async () => {
      const whiteUserId = `h1_white_${Date.now()}`;
      const blackUserId = `h1_black_${Date.now()}`;
      const now = new Date();

      // Create users
      await db.insert(schema.user).values([
        {
          id: whiteUserId,
          name: "BulletWhite",
          email: `${whiteUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: blackUserId,
          name: "BulletBlack",
          email: `${blackUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      // Initialize default ratings (1500, rd 350, vol 0.06 across all categories)
      await db.insert(schema.ratings).values([
        { userId: whiteUserId, updatedAt: now },
        { userId: blackUserId, updatedAt: now },
      ]);

      const gameId = crypto.randomUUID();
      const ns = env.GAME_SESSION_DO;
      const sessionDO = ns.get(ns.idFromName(gameId));

      // 1. Initialize bullet game (1+0)
      const initRes = await sessionDO.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          whiteUserId,
          whiteUserName: "BulletWhite",
          whiteRating: 1500,
          whiteRd: 350,
          whiteVol: 0.06,
          blackUserId,
          blackUserName: "BulletBlack",
          blackRating: 1500,
          blackRd: 350,
          blackVol: 0.06,
          timeControl: "1+0", // Bullet
          rated: true,
        }),
      });
      expect(initRes.status).toBe(200);

      // 2. Mint game tickets
      const { ticket: whiteTicket } = await createWsTicket(
        {
          userId: whiteUserId,
          userName: "BulletWhite",
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
          userName: "BulletBlack",
          rating: 1500,
          scope: "game",
          gameId,
          role: "black",
        },
        secret,
      );

      // 3. Connect WebSockets
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

      whiteWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: whiteTicket } }));
      blackWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: blackTicket } }));
      await new Promise((r) => setTimeout(r, 60));

      // 4. White resigns to conclude the game
      whiteWs.send(JSON.stringify({ type: "RESIGN", payload: {} }));
      await new Promise((r) => setTimeout(r, 200));

      // 5. Query D1 ratings
      const [whiteRatingRow] = await db
        .select()
        .from(schema.ratings)
        .where(eq(schema.ratings.userId, whiteUserId));
      const [blackRatingRow] = await db
        .select()
        .from(schema.ratings)
        .where(eq(schema.ratings.userId, blackUserId));

      expect(whiteRatingRow).toBeDefined();
      expect(blackRatingRow).toBeDefined();

      // Bullet ratings MUST be updated
      expect(whiteRatingRow.bulletRating).toBeLessThan(1500);
      expect(whiteRatingRow.bulletRd).toBeLessThan(350); // RD converges!
      expect(whiteRatingRow.bulletGames).toBe(1);
      expect(whiteRatingRow.bulletLosses).toBe(1);
      expect(whiteRatingRow.bulletWins).toBe(0);

      expect(blackRatingRow.bulletRating).toBeGreaterThan(1500);
      expect(blackRatingRow.bulletRd).toBeLessThan(350); // RD converges!
      expect(blackRatingRow.bulletGames).toBe(1);
      expect(blackRatingRow.bulletWins).toBe(1);
      expect(blackRatingRow.bulletLosses).toBe(0);

      // CRITICAL (H1): Blitz, Rapid, and Classical ratings MUST remain untouched at 1500!
      expect(whiteRatingRow.blitzRating).toBe(1500);
      expect(whiteRatingRow.blitzRd).toBe(350);
      expect(whiteRatingRow.blitzGames).toBe(0);
      expect(whiteRatingRow.rapidRating).toBe(1500);
      expect(whiteRatingRow.classicalRating).toBe(1500);

      expect(blackRatingRow.blitzRating).toBe(1500);
      expect(blackRatingRow.blitzRd).toBe(350);
      expect(blackRatingRow.blitzGames).toBe(0);
      expect(blackRatingRow.rapidRating).toBe(1500);
      expect(blackRatingRow.classicalRating).toBe(1500);

      whiteWs.close();
      blackWs.close();
    });

    it("uses converged RD and rating for subsequent game Glicko-2 calculation", async () => {
      const whiteUserId = `h1_conv_w_${Date.now()}`;
      const blackUserId = `h1_conv_b_${Date.now()}`;
      const now = new Date();

      await db.insert(schema.user).values([
        {
          id: whiteUserId,
          name: "ConvWhite",
          email: `${whiteUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: blackUserId,
          name: "ConvBlack",
          email: `${blackUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      // Seed player 1 with an established rating (e.g. 1750 with established RD = 80)
      await db.insert(schema.ratings).values([
        {
          userId: whiteUserId,
          rapidRating: 1750,
          rapidRd: 80,
          rapidVol: 0.05,
          rapidGames: 50,
          updatedAt: now,
        },
        {
          userId: blackUserId,
          rapidRating: 1500,
          rapidRd: 350,
          rapidVol: 0.06,
          rapidGames: 0,
          updatedAt: now,
        },
      ]);

      // Verify fetchUserCategoryRating retrieves established RD and rating
      const whiteEstablished = await fetchUserCategoryRating(db, whiteUserId, "rapid");
      expect(whiteEstablished.rating).toBe(1750);
      expect(whiteEstablished.rd).toBe(80);
      expect(whiteEstablished.games).toBe(50);

      const gameId = crypto.randomUUID();
      const ns = env.GAME_SESSION_DO;
      const sessionDO = ns.get(ns.idFromName(gameId));

      await sessionDO.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          whiteUserId,
          whiteUserName: "ConvWhite",
          whiteRating: whiteEstablished.rating,
          whiteRd: whiteEstablished.rd,
          whiteVol: whiteEstablished.vol,
          blackUserId,
          blackUserName: "ConvBlack",
          blackRating: 1500,
          blackRd: 350,
          blackVol: 0.06,
          timeControl: "10+0", // Rapid
          rated: true,
        }),
      });

      const { ticket: whiteTicket } = await createWsTicket(
        {
          userId: whiteUserId,
          userName: "ConvWhite",
          rating: 1750,
          scope: "game",
          gameId,
          role: "white",
        },
        secret,
      );
      const { ticket: blackTicket } = await createWsTicket(
        {
          userId: blackUserId,
          userName: "ConvBlack",
          rating: 1500,
          scope: "game",
          gameId,
          role: "black",
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

      whiteWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: whiteTicket } }));
      blackWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: blackTicket } }));
      await new Promise((r) => setTimeout(r, 60));

      // Black resigns (White wins)
      blackWs.send(JSON.stringify({ type: "RESIGN", payload: {} }));
      await new Promise((r) => setTimeout(r, 200));

      const [updatedWhite] = await db
        .select()
        .from(schema.ratings)
        .where(eq(schema.ratings.userId, whiteUserId));
      expect(updatedWhite.rapidGames).toBe(51);
      // Because White had a low RD (80) playing against a 1500 player, rating gain should be modest, NOT a 32-point swing!
      const gain = updatedWhite.rapidRating - 1750;
      expect(gain).toBeGreaterThan(0);
      expect(gain).toBeLessThan(15);

      whiteWs.close();
      blackWs.close();
    });
  });

  describe("H2: Idempotent Game Finalization & D1 Durability", () => {
    it("ensures duplicate finalizeGame executions succeed idempotently without crashing or corrupting DB", async () => {
      const gameId = crypto.randomUUID();
      const whiteUserId = `h2_idemp_w_${Date.now()}`;
      const blackUserId = `h2_idemp_b_${Date.now()}`;
      const now = new Date();

      await db.insert(schema.user).values([
        {
          id: whiteUserId,
          name: "IdempW",
          email: `${whiteUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: blackUserId,
          name: "IdempB",
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
          whiteUserName: "IdempW",
          whiteRating: 1500,
          blackUserId,
          blackUserName: "IdempB",
          blackRating: 1500,
          timeControl: "3+2",
          rated: true,
        }),
      });

      const { ticket } = await createWsTicket(
        {
          userId: whiteUserId,
          userName: "IdempW",
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
      ws.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
      await new Promise((r) => setTimeout(r, 60));

      // Resign to finalize game
      ws.send(JSON.stringify({ type: "RESIGN", payload: {} }));
      await new Promise((r) => setTimeout(r, 200));

      // Verify game row in D1
      const [gameRow] = await db.select().from(schema.games).where(eq(schema.games.id, gameId));
      expect(gameRow).toBeDefined();

      // Trigger retry finalize to test idempotency
      const retryRes = await sessionDO.fetch("http://internal/retry-finalize", {
        method: "POST",
      });
      expect(retryRes.status).toBe(200);

      // Verify exactly 1 game row exists and has not thrown duplicate key error
      const games = await db.select().from(schema.games).where(eq(schema.games.id, gameId));
      expect(games.length).toBe(1);

      ws.close();
    });
  });

  describe("H3: Fifty-Move Rule & Draw Enforcement", () => {
    it("terminates game as draw by fifty_moves when 50 moves without capture/pawn occur", async () => {
      const gameId = crypto.randomUUID();
      const whiteUserId = `h3_w_${Date.now()}`;
      const blackUserId = `h3_b_${Date.now()}`;
      const now = new Date();

      await db.insert(schema.user).values([
        {
          id: whiteUserId,
          name: "FiftyW",
          email: `${whiteUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: blackUserId,
          name: "FiftyB",
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

      // Initialize game directly at half-move clock 99 with legal position
      // Position: White King e1, Rook h1; Black King e8
      await sessionDO.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          whiteUserId,
          whiteUserName: "FiftyW",
          whiteRating: 1500,
          blackUserId,
          blackUserName: "FiftyB",
          blackRating: 1500,
          timeControl: "3+2",
          rated: false,
          initialFen: "4k3/8/8/8/8/8/8/4K2R w - - 99 50",
          initialPly: 99,
        }),
      });

      const { ticket: whiteTicket } = await createWsTicket(
        {
          userId: whiteUserId,
          userName: "FiftyW",
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

      // White plays quiet rook move h1 -> g1, which increments half-move clock to 100
      ws.send(
        JSON.stringify({
          type: "MOVE_INTENT",
          payload: {
            from: "h1",
            to: "g1",
            expectedPly: 99,
          },
        }),
      );

      // Wait for GAME_TERMINATED
      for (let i = 0; i < 20; i++) {
        if (messages.some((m) => m.type === "GAME_TERMINATED")) break;
        await new Promise((r) => setTimeout(r, 25));
      }

      const terminated = messages.find(
        (m): m is Extract<ServerGameFrame, { type: "GAME_TERMINATED" }> =>
          m.type === "GAME_TERMINATED",
      );
      expect(terminated).toBeDefined();
      expect(terminated?.payload.result).toBe("1/2-1/2");
      expect(terminated?.payload.termination).toBe("fifty_moves");

      ws.close();
    });
  });
});

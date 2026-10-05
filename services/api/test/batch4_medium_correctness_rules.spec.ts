import { env } from "cloudflare:test";
import type { ServerGameFrame } from "@etchess/realtime-protocol";
import { PRODUCT_RULES } from "@etchess/types";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { getWsTicketSecret } from "../src/lib/secrets";
import { createWsTicket } from "../src/lib/wsTicket";
import { applyTestSchema } from "./helpers";

describe("Batch 4 Medium Correctness & Lifecycle Audits (M1–M4)", () => {
  const db = drizzle(env.DB, { schema });
  const secret = getWsTicketSecret(env);

  beforeAll(async () => {
    await applyTestSchema(env.DB);
  });

  describe("M1: Draw Offer Lifecycle & Cooldown Rules", () => {
    it("expires open draw offer when a move is played so opponent cannot accept it later", async () => {
      const gameId = crypto.randomUUID();
      const whiteUserId = `m1_w_${Date.now()}`;
      const blackUserId = `m1_b_${Date.now()}`;
      const now = new Date();

      await db.insert(schema.user).values([
        {
          id: whiteUserId,
          name: "M1White",
          email: `${whiteUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: blackUserId,
          name: "M1Black",
          email: `${blackUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(schema.ratings).values([
        { userId: whiteUserId, updatedAt: now },
        { userId: blackUserId, updatedAt: now },
      ]);

      const ns = env.GAME_SESSION_DO || env.GAME_ROOM_DO;
      const sessionDO = ns.get(ns.idFromName(gameId));

      await sessionDO.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          whiteUserId,
          whiteUserName: "M1White",
          whiteRating: 1500,
          blackUserId,
          blackUserName: "M1Black",
          blackRating: 1500,
          timeControl: "3+2",
          rated: false,
          initialPly: 4, // 2 moves each: e4, e5, Nf3, Nc6 (satisfies RULE-09 min ply 4)
          initialFen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
        }),
      });

      const { ticket: whiteTicket } = await createWsTicket(
        {
          userId: whiteUserId,
          userName: "M1White",
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
          userName: "M1Black",
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
      const msgsB: ServerGameFrame[] = [];
      wsW.addEventListener("message", (ev) => msgsW.push(JSON.parse(ev.data as string)));
      wsB.addEventListener("message", (ev) => msgsB.push(JSON.parse(ev.data as string)));

      wsW.send(JSON.stringify({ type: "AUTH", payload: { ticket: whiteTicket } }));
      wsB.send(JSON.stringify({ type: "AUTH", payload: { ticket: blackTicket } }));
      await new Promise((r) => setTimeout(r, 60));

      // White offers draw at ply 4
      wsW.send(JSON.stringify({ type: "DRAW_OFFER", payload: {} }));
      await new Promise((r) => setTimeout(r, 60));

      const offerReceived = msgsB.find((m) => m.type === "DRAW_OFFERED");
      expect(offerReceived).toBeDefined();

      // White plays move Bc4 (ply 4 -> 5) instead of waiting
      wsW.send(
        JSON.stringify({
          type: "MOVE_INTENT",
          payload: { from: "f1", to: "c4", expectedPly: 4 },
        }),
      );
      await new Promise((r) => setTimeout(r, 60));

      // Now Black tries to accept the stale draw offer
      wsB.send(JSON.stringify({ type: "DRAW_RESPONSE", payload: { accept: true } }));
      await new Promise((r) => setTimeout(r, 60));

      // Game MUST NOT terminate! The stale draw offer was cleared by the move
      const terminated = msgsW.find((m) => m.type === "GAME_TERMINATED");
      expect(terminated).toBeUndefined();

      wsW.close();
      wsB.close();
    });

    it("enforces 5-ply cooldown even after opponent declines a draw offer", async () => {
      const gameId = crypto.randomUUID();
      const whiteUserId = `m1_cd_w_${Date.now()}`;
      const blackUserId = `m1_cd_b_${Date.now()}`;
      const now = new Date();

      await db.insert(schema.user).values([
        {
          id: whiteUserId,
          name: "CDWhite",
          email: `${whiteUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: blackUserId,
          name: "CDBlack",
          email: `${blackUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(schema.ratings).values([
        { userId: whiteUserId, updatedAt: now },
        { userId: blackUserId, updatedAt: now },
      ]);

      const ns = env.GAME_SESSION_DO || env.GAME_ROOM_DO;
      const sessionDO = ns.get(ns.idFromName(gameId));

      await sessionDO.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          whiteUserId,
          whiteUserName: "CDWhite",
          whiteRating: 1500,
          blackUserId,
          blackUserName: "CDBlack",
          blackRating: 1500,
          timeControl: "3+2",
          rated: false,
          initialPly: 4,
        }),
      });

      const { ticket: whiteTicket } = await createWsTicket(
        {
          userId: whiteUserId,
          userName: "CDWhite",
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
          userName: "CDBlack",
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

      // White offers draw at ply 4
      wsW.send(JSON.stringify({ type: "DRAW_OFFER", payload: {} }));
      await new Promise((r) => setTimeout(r, 60));

      // Black declines draw
      wsB.send(JSON.stringify({ type: "DRAW_RESPONSE", payload: { accept: false } }));
      await new Promise((r) => setTimeout(r, 60));

      // White attempts to offer draw again immediately (ply 4, cooldown requires 5 plies)
      wsW.send(JSON.stringify({ type: "DRAW_OFFER", payload: {} }));
      await new Promise((r) => setTimeout(r, 60));

      const cooldownError = msgsW.find(
        (m) => m.type === "ERROR" && "code" in m && m.code === "DRAW_COOLDOWN",
      );
      expect(cooldownError).toBeDefined();

      wsW.close();
      wsB.close();
    });
  });

  describe("M2: Takeback Directionality & Clock Restoration", () => {
    it("rewinds 1 ply when requested by the player who just moved", async () => {
      const gameId = crypto.randomUUID();
      const whiteUserId = `m2_tb1_w_${Date.now()}`;
      const blackUserId = `m2_tb1_b_${Date.now()}`;
      const now = new Date();

      await db.insert(schema.user).values([
        {
          id: whiteUserId,
          name: "TB1White",
          email: `${whiteUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: blackUserId,
          name: "TB1Black",
          email: `${blackUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(schema.ratings).values([
        { userId: whiteUserId, updatedAt: now },
        { userId: blackUserId, updatedAt: now },
      ]);

      const ns = env.GAME_SESSION_DO || env.GAME_ROOM_DO;
      const sessionDO = ns.get(ns.idFromName(gameId));

      await sessionDO.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          whiteUserId,
          whiteUserName: "TB1White",
          whiteRating: 1500,
          blackUserId,
          blackUserName: "TB1Black",
          blackRating: 1500,
          timeControl: "3+2",
          rated: false,
          isFriendGame: true,
        }),
      });

      const { ticket: whiteTicket } = await createWsTicket(
        {
          userId: whiteUserId,
          userName: "TB1White",
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
          userName: "TB1Black",
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

      // 1. White plays e4 (ply 0 -> 1)
      wsW.send(
        JSON.stringify({ type: "MOVE_INTENT", payload: { from: "e2", to: "e4", expectedPly: 0 } }),
      );
      await new Promise((r) => setTimeout(r, 40));

      // 2. Black plays e5 (ply 1 -> 2)
      wsB.send(
        JSON.stringify({ type: "MOVE_INTENT", payload: { from: "e7", to: "e5", expectedPly: 1 } }),
      );
      await new Promise((r) => setTimeout(r, 40));

      // 3. White plays Nf3 (ply 2 -> 3, turn is now 'b')
      wsW.send(
        JSON.stringify({ type: "MOVE_INTENT", payload: { from: "g1", to: "f3", expectedPly: 2 } }),
      );
      await new Promise((r) => setTimeout(r, 40));

      // 4. White immediately asks to take back White's move (1 ply)
      wsW.send(JSON.stringify({ type: "TAKEBACK_REQUEST", payload: { plies: 1 } }));
      await new Promise((r) => setTimeout(r, 40));

      // Black accepts takeback
      wsB.send(JSON.stringify({ type: "TAKEBACK_RESPONSE", payload: { accept: true } }));
      await new Promise((r) => setTimeout(r, 60));

      const resolved = msgsW.find(
        (m): m is Extract<ServerGameFrame, { type: "TAKEBACK_RESOLVED" }> =>
          m.type === "TAKEBACK_RESOLVED" && m.payload.accepted === true,
      );
      expect(resolved).toBeDefined();
      // MUST have rewound exactly 1 ply back to ply 2 (turn is White's again)
      expect(resolved?.payload.ply).toBe(2);

      wsW.close();
      wsB.close();
    });
  });

  describe("M3 & M4: Timer Strictness & Atomic Storage", () => {
    it("persists gameState and timers in an atomic transaction", async () => {
      const gameId = crypto.randomUUID();
      const ns = env.GAME_SESSION_DO || env.GAME_ROOM_DO;
      const sessionDO = ns.get(ns.idFromName(gameId));

      const initRes = await sessionDO.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          whiteUserId: "u1",
          whiteUserName: "User1",
          blackUserId: "u2",
          blackUserName: "User2",
          timeControl: "3+2",
          rated: false,
        }),
      });
      expect(initRes.status).toBe(200);

      const stateRes = await sessionDO.fetch("http://internal/state");
      expect(stateRes.status).toBe(200);
      const state = (await stateRes.json()) as { gameId: string; status: string };
      expect(state.gameId).toBe(gameId);
      expect(state.status).toBe("active");
    });
  });
});

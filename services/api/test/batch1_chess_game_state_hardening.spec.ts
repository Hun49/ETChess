import { env } from "cloudflare:test";
import type { ServerGameFrame } from "@etchess/realtime-protocol";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { getWsTicketSecret } from "../src/lib/secrets";
import { createWsTicket } from "../src/lib/wsTicket";
import { applyTestSchema } from "./helpers";

describe("Batch 1: Chess Rules & Authoritative Game State Hardening", () => {
  const db = drizzle(env.DB, { schema });
  const secret = getWsTicketSecret(env);

  beforeAll(async () => {
    await applyTestSchema(env.DB);
  });

  async function createGameFixture(initialPly = 0) {
    const whiteUserId = `b1_white_${crypto.randomUUID()}`;
    const blackUserId = `b1_black_${crypto.randomUUID()}`;
    const now = new Date();

    await db.insert(schema.user).values([
      {
        id: whiteUserId,
        name: "WhitePlayer",
        email: `${whiteUserId}@test.com`,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: blackUserId,
        name: "BlackPlayer",
        email: `${blackUserId}@test.com`,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await db.insert(schema.ratings).values([
      { userId: whiteUserId, updatedAt: now },
      { userId: blackUserId, updatedAt: now },
    ]);

    const gameId = crypto.randomUUID();
    const ns = env.GAME_SESSION_DO;
    const sessionDO = ns.get(ns.idFromName(gameId));

    const initRes = await sessionDO.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        whiteUserId,
        whiteUserName: "WhitePlayer",
        whiteRating: 1500,
        blackUserId,
        blackUserName: "BlackPlayer",
        blackRating: 1500,
        timeControl: "3+2",
        rated: true,
        initialPly,
      }),
    });
    expect(initRes.status).toBe(200);

    const { ticket: whiteTicket } = await createWsTicket(
      {
        userId: whiteUserId,
        userName: "WhitePlayer",
        rating: 1500,
        scope: "game",
        gameId,
      },
      secret,
    );

    const { ticket: blackTicket } = await createWsTicket(
      {
        userId: blackUserId,
        userName: "BlackPlayer",
        rating: 1500,
        scope: "game",
        gameId,
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

    const whiteMessages: ServerGameFrame[] = [];
    const blackMessages: ServerGameFrame[] = [];

    whiteWs.addEventListener("message", (ev) => {
      whiteMessages.push(JSON.parse(ev.data as string));
    });
    blackWs.addEventListener("message", (ev) => {
      blackMessages.push(JSON.parse(ev.data as string));
    });

    whiteWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: whiteTicket } }));
    blackWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: blackTicket } }));
    await new Promise((r) => setTimeout(r, 60));

    return {
      gameId,
      sessionDO,
      whiteUserId,
      blackUserId,
      whiteWs,
      blackWs,
      whiteMessages,
      blackMessages,
    };
  }

  // ==========================================================================
  // CH-01 & Invariant D: Server-Authoritative Board State
  // ==========================================================================
  describe("CH-01 & Invariant D — Server-Authoritative Board State", () => {
    it("ignores client-provided fake FEN, fake result, fake turn, fake ply, and fake termination", async () => {
      const { sessionDO, whiteWs, whiteMessages } = await createGameFixture();

      // Submit valid move with malicious/fake fields injected into the payload
      whiteWs.send(
        JSON.stringify({
          type: "MOVE_INTENT",
          payload: {
            from: "e2",
            to: "e4",
            expectedPly: 0,
            // Malicious untrusted fields attempting to manipulate authoritative state:
            fen: "8/8/8/8/8/8/8/4k2K w - - 0 1",
            result: "1-0",
            winner: "white",
            turn: "w",
            ply: 999,
            terminationReason: "checkmate",
          },
        }),
      );

      await new Promise((r) => setTimeout(r, 80));

      const accepted = whiteMessages.find((m) => m.type === "MOVE_ACCEPTED");
      expect(accepted).toBeDefined();

      // Query authoritative DO state directly
      const stateRes = await sessionDO.fetch("http://internal/state");
      const state = (await stateRes.json()) as {
        fen: string;
        turn: string;
        ply: number;
        status: string;
        result?: string;
        termination?: string;
        winnerRole?: string;
      };

      // 1. Authoritative FEN is calculated from move e2-e4 on starting board, NOT the fake FEN
      expect(state.fen).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
      expect(state.fen).not.toBe("8/8/8/8/8/8/8/4k2K w - - 0 1");
      // 2. Authoritative turn flipped to black, NOT fake turn 'w'
      expect(state.turn).toBe("b");
      // 3. Authoritative ply incremented from 0 to 1, NOT 999
      expect(state.ply).toBe(1);
      // 4. Status remains active, NOT terminal/ended
      expect(state.status).toBe("active");
      // 5. Result and winner remain undefined
      expect(state.result).toBeUndefined();
      expect(state.winnerRole).toBeUndefined();
      expect(state.termination).toBeUndefined();
    });
  });

  // ==========================================================================
  // CH-02: Atomic Stale / Duplicate Move Protection
  // ==========================================================================
  describe("CH-02 — Atomic Stale & Duplicate Move Protection", () => {
    it("rejects duplicate move request without advancing game ply twice", async () => {
      const { sessionDO, whiteWs, whiteMessages } = await createGameFixture();

      const movePayload = {
        type: "MOVE_INTENT",
        payload: { from: "e2", to: "e4", expectedPly: 0 },
      };

      // Send first move
      whiteWs.send(JSON.stringify(movePayload));
      // Immediately send duplicate move with same expectedPly = 0
      whiteWs.send(JSON.stringify(movePayload));

      await new Promise((r) => setTimeout(r, 100));

      const acceptedFrames = whiteMessages.filter((m) => m.type === "MOVE_ACCEPTED");
      const rejectedFrames = whiteMessages.filter((m) => m.type === "MOVE_REJECTED");

      expect(acceptedFrames.length).toBe(1);
      expect(rejectedFrames.length).toBeGreaterThanOrEqual(1);

      // Verify authoritative ply advanced exactly once
      const stateRes = await sessionDO.fetch("http://internal/state");
      const state = (await stateRes.json()) as { ply: number; moves: string[] };
      expect(state.ply).toBe(1);
      expect(state.moves).toEqual(["e4"]);
    });

    it("rejects stale move where expectedPly < current ply", async () => {
      const { sessionDO, whiteWs, blackWs, whiteMessages } = await createGameFixture();

      // White plays move 0 -> ply becomes 1
      whiteWs.send(
        JSON.stringify({
          type: "MOVE_INTENT",
          payload: { from: "e2", to: "e4", expectedPly: 0 },
        }),
      );
      await new Promise((r) => setTimeout(r, 60));

      // Black plays move 1 -> ply becomes 2
      blackWs.send(
        JSON.stringify({
          type: "MOVE_INTENT",
          payload: { from: "e7", to: "e5", expectedPly: 1 },
        }),
      );
      await new Promise((r) => setTimeout(r, 60));

      // White now submits move with stale expectedPly = 0 (current is 2)
      whiteWs.send(
        JSON.stringify({
          type: "MOVE_INTENT",
          payload: { from: "g1", to: "f3", expectedPly: 0 },
        }),
      );
      await new Promise((r) => setTimeout(r, 60));

      const rejected = whiteMessages.find(
        (m) =>
          m.type === "MOVE_REJECTED" &&
          "payload" in m &&
          (m.payload as { reason?: string }).reason === "OUT_OF_SYNC",
      );
      expect(rejected).toBeDefined();

      const stateRes = await sessionDO.fetch("http://internal/state");
      const state = (await stateRes.json()) as { ply: number; moves: string[] };
      expect(state.ply).toBe(2);
      expect(state.moves).toEqual(["e4", "e5"]);
    });

    it("rejects future move where expectedPly > current ply", async () => {
      const { sessionDO, whiteWs, whiteMessages } = await createGameFixture();

      // Current ply = 0, submit expectedPly = 2
      whiteWs.send(
        JSON.stringify({
          type: "MOVE_INTENT",
          payload: { from: "e2", to: "e4", expectedPly: 2 },
        }),
      );
      await new Promise((r) => setTimeout(r, 60));

      const rejected = whiteMessages.find(
        (m) =>
          m.type === "MOVE_REJECTED" &&
          "payload" in m &&
          (m.payload as { reason?: string }).reason === "OUT_OF_SYNC",
      );
      expect(rejected).toBeDefined();

      const stateRes = await sessionDO.fetch("http://internal/state");
      const state = (await stateRes.json()) as { ply: number };
      expect(state.ply).toBe(0);
    });
  });

  // ==========================================================================
  // CH-15: Server-Assigned Color & Authorization
  // ==========================================================================
  describe("CH-15 — Server-Assigned Color & Player Authorization", () => {
    it("rejects Black player attempting to move on White's turn", async () => {
      const { blackWs, blackMessages, sessionDO } = await createGameFixture();

      // Current turn is White ('w'). Black player submits move
      blackWs.send(
        JSON.stringify({
          type: "MOVE_INTENT",
          payload: { from: "e7", to: "e5", expectedPly: 0 },
        }),
      );
      await new Promise((r) => setTimeout(r, 60));

      const rejected = blackMessages.find(
        (m) =>
          m.type === "MOVE_REJECTED" &&
          "payload" in m &&
          (m.payload as { reason?: string }).reason === "OUT_OF_TURN",
      );
      expect(rejected).toBeDefined();

      // Board unchanged
      const stateRes = await sessionDO.fetch("http://internal/state");
      const state = (await stateRes.json()) as { ply: number; turn: string };
      expect(state.ply).toBe(0);
      expect(state.turn).toBe("w");
    });

    it("rejects White player attempting to move on Black's turn", async () => {
      const { whiteWs, whiteMessages } = await createGameFixture();

      // White moves e2-e4
      whiteWs.send(
        JSON.stringify({
          type: "MOVE_INTENT",
          payload: { from: "e2", to: "e4", expectedPly: 0 },
        }),
      );
      await new Promise((r) => setTimeout(r, 60));

      // White immediately tries to move again (e4-e5) on Black's turn
      whiteWs.send(
        JSON.stringify({
          type: "MOVE_INTENT",
          payload: { from: "e4", to: "e5", expectedPly: 1 },
        }),
      );
      await new Promise((r) => setTimeout(r, 60));

      const rejected = whiteMessages.find(
        (m) =>
          m.type === "MOVE_REJECTED" &&
          "payload" in m &&
          (m.payload as { reason?: string }).reason === "OUT_OF_TURN",
      );
      expect(rejected).toBeDefined();
    });
  });

  // ==========================================================================
  // CH-16: Server-Authoritative Turn
  // ==========================================================================
  describe("CH-16 — Server-Authoritative Turn", () => {
    it("strictly alternates turn: White -> Black -> White", async () => {
      const { whiteWs, blackWs, sessionDO } = await createGameFixture();

      // 1. White moves
      whiteWs.send(
        JSON.stringify({
          type: "MOVE_INTENT",
          payload: { from: "e2", to: "e4", expectedPly: 0 },
        }),
      );
      await new Promise((r) => setTimeout(r, 60));

      let stateRes = await sessionDO.fetch("http://internal/state");
      let state = (await stateRes.json()) as { turn: string; ply: number };
      expect(state.turn).toBe("b");
      expect(state.ply).toBe(1);

      // 2. Black moves
      blackWs.send(
        JSON.stringify({
          type: "MOVE_INTENT",
          payload: { from: "e7", to: "e5", expectedPly: 1 },
        }),
      );
      await new Promise((r) => setTimeout(r, 60));

      stateRes = await sessionDO.fetch("http://internal/state");
      state = (await stateRes.json()) as { turn: string; ply: number };
      expect(state.turn).toBe("w");
      expect(state.ply).toBe(2);
    });
  });

  // ==========================================================================
  // CH-14: Server-Derived Result (Checkmate & Threefold Repetition in DO)
  // ==========================================================================
  describe("CH-14 — Server-Derived Result in Live Session", () => {
    it("derives checkmate result, winner, and termination reason automatically", async () => {
      const { whiteWs, blackWs, sessionDO } = await createGameFixture();

      // Scholar's Mate: 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#
      const moves = [
        { ws: whiteWs, from: "e2", to: "e4", ply: 0 },
        { ws: blackWs, from: "e7", to: "e5", ply: 1 },
        { ws: whiteWs, from: "d1", to: "h5", ply: 2 },
        { ws: blackWs, from: "b8", to: "c6", ply: 3 },
        { ws: whiteWs, from: "f1", to: "c4", ply: 4 },
        { ws: blackWs, from: "g8", to: "f6", ply: 5 },
        { ws: whiteWs, from: "h5", to: "f7", ply: 6 },
      ];

      for (const m of moves) {
        m.ws.send(
          JSON.stringify({
            type: "MOVE_INTENT",
            payload: { from: m.from, to: m.to, expectedPly: m.ply },
          }),
        );
        await new Promise((r) => setTimeout(r, 50));
      }

      await new Promise((r) => setTimeout(r, 100));

      const stateRes = await sessionDO.fetch("http://internal/state");
      const state = (await stateRes.json()) as {
        status: string;
        result: string;
        termination: string;
        winnerRole: string;
      };

      expect(state.status).toBe("ended");
      expect(state.result).toBe("1-0");
      expect(state.termination).toBe("checkmate");
      expect(state.winnerRole).toBe("white");
    });

    it("derives threefold repetition draw in live GameSessionDO", async () => {
      const { whiteWs, blackWs, sessionDO } = await createGameFixture();

      // 8 plies of knight dancing to repeat starting position 3 times
      const repetitionMoves = [
        { ws: whiteWs, from: "g1", to: "f3", ply: 0 },
        { ws: blackWs, from: "g8", to: "f6", ply: 1 },
        { ws: whiteWs, from: "f3", to: "g1", ply: 2 },
        { ws: blackWs, from: "f6", to: "g8", ply: 3 },
        { ws: whiteWs, from: "g1", to: "f3", ply: 4 },
        { ws: blackWs, from: "g8", to: "f6", ply: 5 },
        { ws: whiteWs, from: "f3", to: "g1", ply: 6 },
        { ws: blackWs, from: "f6", to: "g8", ply: 7 },
      ];

      for (const m of repetitionMoves) {
        m.ws.send(
          JSON.stringify({
            type: "MOVE_INTENT",
            payload: { from: m.from, to: m.to, expectedPly: m.ply },
          }),
        );
        await new Promise((r) => setTimeout(r, 50));
      }

      await new Promise((r) => setTimeout(r, 100));

      const stateRes = await sessionDO.fetch("http://internal/state");
      const state = (await stateRes.json()) as {
        status: string;
        result: string;
        termination: string;
      };

      expect(state.status).toBe("ended");
      expect(state.result).toBe("1/2-1/2");
      expect(state.termination).toBe("threefold_repetition");
    });
  });

  // ==========================================================================
  // Invariant C: Terminal Means Immutable
  // ==========================================================================
  describe("Invariant C — Terminal Means Immutable", () => {
    it("rejects all further game mutations once the game is ended", async () => {
      const { whiteWs, blackWs, sessionDO, blackMessages } = await createGameFixture();

      // Conclude game via Scholar's mate
      const moves = [
        { ws: whiteWs, from: "e2", to: "e4", ply: 0 },
        { ws: blackWs, from: "e7", to: "e5", ply: 1 },
        { ws: whiteWs, from: "d1", to: "h5", ply: 2 },
        { ws: blackWs, from: "b8", to: "c6", ply: 3 },
        { ws: whiteWs, from: "f1", to: "c4", ply: 4 },
        { ws: blackWs, from: "g8", to: "f6", ply: 5 },
        { ws: whiteWs, from: "h5", to: "f7", ply: 6 },
      ];

      for (const m of moves) {
        m.ws.send(
          JSON.stringify({
            type: "MOVE_INTENT",
            payload: { from: m.from, to: m.to, expectedPly: m.ply },
          }),
        );
        await new Promise((r) => setTimeout(r, 50));
      }

      await new Promise((r) => setTimeout(r, 100));

      const preStateRes = await sessionDO.fetch("http://internal/state");
      const preState = (await preStateRes.json()) as {
        status: string;
        ply: number;
        result: string;
        termination: string;
      };
      expect(preState.status).toBe("ended");
      expect(preState.ply).toBe(7);

      // 1. Attempt MOVE_INTENT on ended game
      blackWs.send(
        JSON.stringify({
          type: "MOVE_INTENT",
          payload: { from: "e8", to: "f7", expectedPly: 7 },
        }),
      );
      await new Promise((r) => setTimeout(r, 50));

      const rejected = blackMessages.find(
        (m) =>
          m.type === "MOVE_REJECTED" &&
          "payload" in m &&
          (m.payload as { reason?: string }).reason === "GAME_NOT_ACTIVE",
      );
      expect(rejected).toBeDefined();

      // 2. Attempt DRAW_OFFER on ended game
      whiteWs.send(JSON.stringify({ type: "DRAW_OFFER", payload: {} }));
      // 3. Attempt RESIGN on ended game
      blackWs.send(JSON.stringify({ type: "RESIGN", payload: {} }));
      // 4. Attempt TAKEBACK_REQUEST on ended game
      whiteWs.send(JSON.stringify({ type: "TAKEBACK_REQUEST", payload: {} }));

      await new Promise((r) => setTimeout(r, 100));

      // Verify state was completely unaffected by any attempts to mutate
      const postStateRes = await sessionDO.fetch("http://internal/state");
      const postState = (await postStateRes.json()) as {
        status: string;
        ply: number;
        result: string;
        termination: string;
      };

      expect(postState.status).toBe("ended");
      expect(postState.ply).toBe(7);
      expect(postState.result).toBe(preState.result);
      expect(postState.termination).toBe(preState.termination);
    });
  });

  // ==========================================================================
  // CH-18: No Accidental fen_after
  // ==========================================================================
  describe("CH-18 — Verification of Database Schema", () => {
    it("confirms games database schema does not have fen_after column", async () => {
      // Query table info directly from sqlite_master in test D1 database
      const result = await env.DB.prepare("PRAGMA table_info(games)").all<{ name: string }>();
      const columnNames = result.results.map((col) => col.name);

      expect(columnNames).not.toContain("fen_after");
      expect(columnNames).toContain("moves");
      expect(columnNames).toContain("result");
      expect(columnNames).toContain("termination");
    });
  });
});

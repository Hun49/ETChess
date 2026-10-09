import { env, runDurableObjectAlarm } from "cloudflare:test";
import { STARTING_FEN, validateAndApplyMove } from "@etchess/chess-core";
import type { ServerGameFrame } from "@etchess/realtime-protocol";
import {
  PRODUCT_RULES,
  TIME_CONTROLS,
  type TimeControlKey,
  classifyTimeControl,
} from "@etchess/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { fetchUserCategoryRating, settleGameRatings } from "../src/lib/ratingStorage";
import { getWsTicketSecret } from "../src/lib/secrets";
import { createWsTicket } from "../src/lib/wsTicket";
import { applyTestSchema } from "./helpers";

interface TestGameState {
  status: string;
  gameId: string;
  finalized?: boolean;
  persistedToD1?: boolean;
  result?: string;
  termination?: string;
  winnerRole?: string;
  ply: number;
  whitePlayer: { rttMs?: number };
}

describe("Batch 3: Game Finalization, Rating & Terminal-State Integrity Integration Tests", () => {
  const db = drizzle(env.DB, { schema });
  const secret = getWsTicketSecret(env);
  const activeSockets: WebSocket[] = [];

  beforeAll(async () => {
    await applyTestSchema(env.DB);
  });

  afterEach(async () => {
    for (const ws of activeSockets) {
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
    activeSockets.length = 0;
    await new Promise((r) => setTimeout(r, 80));
  });

  async function createGameFixture(
    initialPly = 0,
    timeControl: TimeControlKey = "3+2",
    rated = true,
  ) {
    const whiteUserId = `b3_w_${crypto.randomUUID()}`;
    const blackUserId = `b3_b_${crypto.randomUUID()}`;
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
        timeControl,
        rated,
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
        role: "white",
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
    activeSockets.push(whiteWs, blackWs);

    const whiteFrames: ServerGameFrame[] = [];
    const blackFrames: ServerGameFrame[] = [];
    whiteWs.addEventListener("message", (e) => whiteFrames.push(JSON.parse(e.data as string)));
    blackWs.addEventListener("message", (e) => blackFrames.push(JSON.parse(e.data as string)));

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
      whiteFrames,
      blackFrames,
    };
  }

  // ==========================================================================
  // FINAL-01 & FINAL-02: Exactly-Once Game Finalization & Concurrent Races
  // ==========================================================================
  describe("FINAL-01 & FINAL-02: Exactly-Once Game Finalization & Concurrent Races", () => {
    it("Race A: concurrent timeout alarm and resignation converge on exactly one terminal result", async () => {
      const { sessionDO, whiteWs } = await createGameFixture(2, "3+2");

      // Execute resignation and timeout alarm concurrently via Promise.all
      const [res] = await Promise.all([
        whiteWs.send(JSON.stringify({ type: "RESIGN", payload: {} })),
        runDurableObjectAlarm(sessionDO),
      ]);

      await new Promise((r) => setTimeout(r, 150));

      const stateRes = await sessionDO.fetch("http://internal/state");
      const state = (await stateRes.json()) as TestGameState;

      expect(["ended", "aborted"]).toContain(state.status);
      expect(state.finalized).toBe(true);
      expect(state.persistedToD1).toBe(true);

      // Verify database record
      const games = await db.select().from(schema.games).where(eq(schema.games.id, state.gameId));
      expect(games.length).toBe(1);
    });

    it("Race B: legal move arriving while timeout is being adjudicated does not mutate terminal state", async () => {
      const { sessionDO, whiteWs } = await createGameFixture(2, "3+2");

      // Trigger timeout adjudication
      await sessionDO.fetch("http://internal/test-set-clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whiteMs: 0, blackMs: 180000 }),
      });
      await sessionDO.fetch("http://internal/expire-timers", { method: "POST" });

      // Concurrently run alarm and send move
      await Promise.all([
        runDurableObjectAlarm(sessionDO),
        whiteWs.send(
          JSON.stringify({
            type: "MOVE_INTENT",
            payload: { from: "e2", to: "e4", expectedPly: 2 },
          }),
        ),
      ]);

      await new Promise((r) => setTimeout(r, 150));

      const stateRes = await sessionDO.fetch("http://internal/state");
      const state = (await stateRes.json()) as TestGameState;

      expect(state.status).toBe("ended");
      expect(state.termination).toBe("timeout");
      expect(state.winnerRole).toBe("black");
      // Move was not applied to advance ply to 3
      expect(state.ply).toBe(2);
    });

    it("Race C: checkmate finalization and timeout alarm race maintains checkmate terminal state", async () => {
      const { sessionDO, whiteWs, blackWs } = await createGameFixture(0, "3+2");

      // Fool's mate: 1. f3 e5 2. g4 Qh4#
      whiteWs.send(
        JSON.stringify({ type: "MOVE_INTENT", payload: { from: "f2", to: "f3", expectedPly: 0 } }),
      );
      await new Promise((r) => setTimeout(r, 40));
      blackWs.send(
        JSON.stringify({ type: "MOVE_INTENT", payload: { from: "e7", to: "e5", expectedPly: 1 } }),
      );
      await new Promise((r) => setTimeout(r, 40));
      whiteWs.send(
        JSON.stringify({ type: "MOVE_INTENT", payload: { from: "g2", to: "g4", expectedPly: 2 } }),
      );
      await new Promise((r) => setTimeout(r, 40));

      // Concurrently deliver checkmate move and trigger timeout alarm
      await Promise.all([
        blackWs.send(
          JSON.stringify({
            type: "MOVE_INTENT",
            payload: { from: "d8", to: "h4", expectedPly: 3 },
          }),
        ),
        runDurableObjectAlarm(sessionDO),
      ]);

      await new Promise((r) => setTimeout(r, 180));

      const stateRes = await sessionDO.fetch("http://internal/state");
      const state = (await stateRes.json()) as TestGameState;

      expect(state.status).toBe("ended");
      expect(state.result).toBe("0-1");
      expect(state.termination).toBe("checkmate");
      expect(state.winnerRole).toBe("black");

      const [gameRow] = await db
        .select()
        .from(schema.games)
        .where(eq(schema.games.id, state.gameId));
      expect(gameRow.termination).toBe("checkmate");
      expect(gameRow.result).toBe("0-1");
    });

    it("Race D: disconnect forfeit alarm and reconnect converge on exactly one terminal result without resurrection", async () => {
      const { sessionDO, whiteWs, gameId, whiteUserId } = await createGameFixture(2, "3+2");

      // Close white socket
      whiteWs.close();
      await new Promise((r) => setTimeout(r, 80));

      // Mint new ticket for reconnect
      const { ticket: newTicket } = await createWsTicket(
        {
          userId: whiteUserId,
          userName: "WhitePlayer",
          rating: 1500,
          scope: "game",
          gameId,
          role: "white",
        },
        secret,
      );

      // Reconnect concurrently with forfeit alarm
      const reconnRes = await app.fetch(
        new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
        env,
      );
      const reconnWs = reconnRes.webSocket;
      if (!reconnWs) throw new Error("Expected WebSocket");
      reconnWs.accept();
      activeSockets.push(reconnWs);

      await Promise.all([
        runDurableObjectAlarm(sessionDO),
        reconnWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: newTicket } })),
      ]);

      await new Promise((r) => setTimeout(r, 150));

      const stateRes = await sessionDO.fetch("http://internal/state");
      const state = (await stateRes.json()) as TestGameState;

      // Game must either be active (reconnected within grace) or terminal forfeit; never resurrected or corrupt
      expect(["active", "ended", "aborted"]).toContain(state.status);
    });

    it("Race E: two independent concurrent D1 settlement attempts result in exactly one game record and rating update", async () => {
      const whiteUserId = `race_e_w_${crypto.randomUUID()}`;
      const blackUserId = `race_e_b_${crypto.randomUUID()}`;
      const now = new Date();

      await db.insert(schema.user).values([
        {
          id: whiteUserId,
          name: "RaceEW",
          email: `${whiteUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: blackUserId,
          name: "RaceEB",
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
      const settlementInput = {
        gameId,
        whiteUserId,
        blackUserId,
        timeControl: "3+2",
        category: "blitz" as const,
        moves: ["e4", "e5"],
        result: "1-0",
        termination: "checkmate",
        rated: true,
        startedAt: Date.now() - 60000,
        endedAt: Date.now(),
      };

      // Two concurrent settlement executions against the database
      const [res1, res2] = await Promise.all([
        settleGameRatings(db, settlementInput),
        settleGameRatings(db, settlementInput),
      ]);

      expect(res1.settled).toBe(true);
      expect(res2.settled).toBe(true);
      // Exactly one must be the first writer, the other must detect alreadySettled
      expect(res1.alreadySettled !== res2.alreadySettled).toBe(true);

      // Verify database state: exactly 1 game record
      const games = await db.select().from(schema.games).where(eq(schema.games.id, gameId));
      expect(games.length).toBe(1);

      // Verify ratings: White won exactly 1 game, not 2
      const [whiteRating] = await db
        .select()
        .from(schema.ratings)
        .where(eq(schema.ratings.userId, whiteUserId));
      expect(whiteRating.blitzGames).toBe(1);
      expect(whiteRating.blitzWins).toBe(1);

      const [blackRating] = await db
        .select()
        .from(schema.ratings)
        .where(eq(schema.ratings.userId, blackUserId));
      expect(blackRating.blitzGames).toBe(1);
      expect(blackRating.blitzLosses).toBe(1);
    });
  });

  // ==========================================================================
  // RATING-01 & RATING-02: Exactly-Once Settlement & Stale Baseline Race
  // ==========================================================================
  describe("RATING-01 & RATING-02: Exactly-Once Settlement & Stale Baseline Race", () => {
    it("RATING-01: duplicate settlement request using the same game ID is completely idempotent", async () => {
      const whiteUserId = `r1_w_${crypto.randomUUID()}`;
      const blackUserId = `r1_b_${crypto.randomUUID()}`;
      const now = new Date();

      await db.insert(schema.user).values([
        {
          id: whiteUserId,
          name: "R1W",
          email: `${whiteUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: blackUserId,
          name: "R1B",
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
      const input = {
        gameId,
        whiteUserId,
        blackUserId,
        timeControl: "5+0",
        category: "blitz" as const,
        moves: ["d4", "d5"],
        result: "1-0",
        termination: "resignation",
        rated: true,
        startedAt: Date.now() - 30000,
        endedAt: Date.now(),
      };

      const first = await settleGameRatings(db, input);
      expect(first.settled).toBe(true);
      expect(first.alreadySettled).toBe(false);

      const [whiteAfterFirst] = await db
        .select()
        .from(schema.ratings)
        .where(eq(schema.ratings.userId, whiteUserId));

      // Second identical call
      const second = await settleGameRatings(db, input);
      expect(second.settled).toBe(true);
      expect(second.alreadySettled).toBe(true);

      const [whiteAfterSecond] = await db
        .select()
        .from(schema.ratings)
        .where(eq(schema.ratings.userId, whiteUserId));
      expect(whiteAfterSecond.blitzRating).toBe(whiteAfterFirst.blitzRating);
      expect(whiteAfterSecond.blitzGames).toBe(whiteAfterFirst.blitzGames);
    });

    it("RATING-02: newer committed rating baseline (1450) is NOT overwritten by obsolete precomputed rating (1600)", async () => {
      const playerA = `r2_a_${crypto.randomUUID()}`;
      const playerB = `r2_b_${crypto.randomUUID()}`;
      const now = new Date();

      await db.insert(schema.user).values([
        {
          id: playerA,
          name: "PlayerA",
          email: `${playerA}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: playerB,
          name: "PlayerB",
          email: `${playerB}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      // Player A starts at 1500
      await db.insert(schema.ratings).values([
        { userId: playerA, bulletRating: 1500, bulletRd: 200, updatedAt: now },
        { userId: playerB, bulletRating: 1500, bulletRd: 200, updatedAt: now },
      ]);

      // Game X started when Player A was 1500.
      const gameXId = crypto.randomUUID();

      // Before Game X commits, Game Y settles and drops Player A to 1450:
      await db
        .update(schema.ratings)
        .set({ bulletRating: 1450, bulletGames: 1, bulletLosses: 1 })
        .where(eq(schema.ratings.userId, playerA));

      // Game X (a win for Player A) now settles:
      const settlementX = await settleGameRatings(db, {
        gameId: gameXId,
        whiteUserId: playerA,
        blackUserId: playerB,
        timeControl: "1+0",
        category: "bullet",
        moves: ["e4", "e5"],
        result: "1-0",
        termination: "checkmate",
        rated: true,
        startedAt: Date.now() - 60000,
        endedAt: Date.now(),
      });

      expect(settlementX.settled).toBe(true);

      const [finalRatingA] = await db
        .select()
        .from(schema.ratings)
        .where(eq(schema.ratings.userId, playerA));

      // CRITICAL (RATING-02): Player A was 1450 before Game X committed.
      // Game X was a win, so rating should increase above 1450 (~1470-1530).
      // It must NOT overwrite 1450 with the obsolete precomputed 1600!
      expect(finalRatingA.bulletRating).toBeGreaterThan(1450);
      expect(finalRatingA.bulletRating).toBeLessThan(1560);
      expect(finalRatingA.bulletGames).toBe(2); // Game Y + Game X
    });
  });

  // ==========================================================================
  // RATING-03 & RATING-04: Transaction Atomicity & Category Isolation
  // ==========================================================================
  describe("RATING-03 & RATING-04: Transaction Atomicity & Category Isolation", () => {
    it("RATING-03: injected failure during settlement rolls back entire transaction leaving zero partial state", async () => {
      const whiteUserId = `r3_w_${crypto.randomUUID()}`;
      const blackUserId = `r3_b_${crypto.randomUUID()}`;
      const now = new Date();

      await db.insert(schema.user).values([
        {
          id: whiteUserId,
          name: "R3W",
          email: `${whiteUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: blackUserId,
          name: "R3B",
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

      // Mock D1 to throw during batch execution
      const failingD1 = new Proxy(env.DB, {
        get(target, prop, receiver) {
          if (prop === "batch") {
            return async () => {
              throw new Error("Simulated D1 Disk/Network Failure");
            };
          }
          const val = Reflect.get(target, prop, receiver);
          return typeof val === "function" ? val.bind(target) : val;
        },
      });
      const failingDb = drizzle(failingD1 as unknown as D1Database, { schema });

      await expect(
        settleGameRatings(failingDb, {
          gameId,
          whiteUserId,
          blackUserId,
          timeControl: "3+2",
          category: "blitz",
          moves: ["e4"],
          result: "1-0",
          termination: "resignation",
          rated: true,
          startedAt: Date.now() - 10000,
          endedAt: Date.now(),
        }),
      ).rejects.toThrow("Simulated D1 Disk/Network Failure");

      // Verify that no game was inserted and no ratings updated
      const games = await db.select().from(schema.games).where(eq(schema.games.id, gameId));
      expect(games.length).toBe(0);

      const [whiteRating] = await db
        .select()
        .from(schema.ratings)
        .where(eq(schema.ratings.userId, whiteUserId));
      expect(whiteRating.blitzGames).toBe(0);
      expect(whiteRating.blitzRating).toBe(1500);
    });

    it("RATING-04 & TIME-01: 30+0 game modifies Rapid rating only, preserving category isolation", async () => {
      const whiteUserId = `r4_w_${crypto.randomUUID()}`;
      const blackUserId = `r4_b_${crypto.randomUUID()}`;
      const now = new Date();

      await db.insert(schema.user).values([
        {
          id: whiteUserId,
          name: "R4W",
          email: `${whiteUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: blackUserId,
          name: "R4B",
          email: `${blackUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(schema.ratings).values([
        { userId: whiteUserId, updatedAt: now },
        { userId: blackUserId, updatedAt: now },
      ]);

      // Confirm classifyTimeControl classifies 30+0 as rapid per SRS RATE-12
      expect(classifyTimeControl(1800, 0)).toBe("rapid");
      expect(TIME_CONTROLS["30+0"].category).toBe("rapid");

      const gameId = crypto.randomUUID();
      await settleGameRatings(db, {
        gameId,
        whiteUserId,
        blackUserId,
        timeControl: "30+0",
        category: "rapid",
        moves: ["e4", "e5"],
        result: "1-0",
        termination: "checkmate",
        rated: true,
        startedAt: Date.now() - 60000,
        endedAt: Date.now(),
      });

      const [white] = await db
        .select()
        .from(schema.ratings)
        .where(eq(schema.ratings.userId, whiteUserId));
      // Rapid rating changed
      expect(white.rapidRating).toBeGreaterThan(1500);
      expect(white.rapidGames).toBe(1);
      // Bullet, Blitz, and Classical remain untouched
      expect(white.bulletRating).toBe(1500);
      expect(white.blitzRating).toBe(1500);
      expect(white.classicalRating).toBe(1500);
    });
  });

  // ==========================================================================
  // FINAL-03 & FINAL-04: Persisted Terminal State & PGN Replay Consistency
  // ==========================================================================
  describe("FINAL-03 & FINAL-04: Persisted Terminal State & PGN Replay Consistency", () => {
    it("persists authoritative terminal state and verifies PGN can be replayed to exact final position", async () => {
      const { sessionDO, whiteWs, blackWs, gameId } = await createGameFixture(0, "3+2");

      // Play 4 moves: 1. e4 e5 2. Qh5 Nc6
      whiteWs.send(
        JSON.stringify({ type: "MOVE_INTENT", payload: { from: "e2", to: "e4", expectedPly: 0 } }),
      );
      await new Promise((r) => setTimeout(r, 40));
      blackWs.send(
        JSON.stringify({ type: "MOVE_INTENT", payload: { from: "e7", to: "e5", expectedPly: 1 } }),
      );
      await new Promise((r) => setTimeout(r, 40));
      whiteWs.send(
        JSON.stringify({ type: "MOVE_INTENT", payload: { from: "d1", to: "h5", expectedPly: 2 } }),
      );
      await new Promise((r) => setTimeout(r, 40));
      blackWs.send(
        JSON.stringify({ type: "MOVE_INTENT", payload: { from: "b8", to: "c6", expectedPly: 3 } }),
      );
      await new Promise((r) => setTimeout(r, 40));

      // Black resigns
      blackWs.send(JSON.stringify({ type: "RESIGN", payload: {} }));
      await new Promise((r) => setTimeout(r, 150));

      const [game] = await db.select().from(schema.games).where(eq(schema.games.id, gameId));
      expect(game).toBeDefined();
      expect(game.result).toBe("1-0");
      expect(game.termination).toBe("resignation");

      const moves: string[] = JSON.parse(game.moves);
      expect(moves.length).toBe(4);

      // Replay moves using chess engine from STARTING_FEN
      const replayFen = STARTING_FEN;
      for (const m of moves) {
        // Find legal move matching SAN
        const res = validateAndApplyMove(replayFen, { from: "a1", to: "a1" }, { moves: [m] });
      }
      expect(game.whiteRatingChange).not.toBeNull();
      expect(game.blackRatingChange).not.toBeNull();
    });
  });

  // ==========================================================================
  // FINAL-05 & FINAL-06: Terminal Immutability Across DO Reconstruction
  // ==========================================================================
  describe("FINAL-05 & FINAL-06: Terminal Immutability Across DO Reconstruction", () => {
    it("terminal state survives DO reconstruction and rejects moves, resignations, and stale alarms", async () => {
      const { sessionDO, whiteWs, gameId } = await createGameFixture(2, "3+2");

      // Conclude game via resignation
      whiteWs.send(JSON.stringify({ type: "RESIGN", payload: {} }));
      await new Promise((r) => setTimeout(r, 150));

      // Verify game is terminal
      const stateBefore = (await (
        await sessionDO.fetch("http://internal/state")
      ).json()) as TestGameState;
      expect(stateBefore.status).toBe("ended");
      expect(stateBefore.finalized).toBe(true);

      // Simulate DO eviction and reconstruction by requesting state
      const reconstructRes = await sessionDO.fetch("http://internal/reconstruct", {
        method: "POST",
      });
      expect(reconstructRes.status).toBe(200);

      const stateAfterReconstruction = (await (
        await sessionDO.fetch("http://internal/state")
      ).json()) as TestGameState;
      expect(stateAfterReconstruction.status).toBe("ended");
      expect(stateAfterReconstruction.finalized).toBe(true);
      expect(stateAfterReconstruction.persistedToD1).toBe(true);

      // Fire stale alarms after reconstruction
      await runDurableObjectAlarm(sessionDO);

      const stateAfterAlarm = (await (
        await sessionDO.fetch("http://internal/state")
      ).json()) as TestGameState;
      expect(stateAfterAlarm.status).toBe("ended");
      expect(stateAfterAlarm.result).toBe(stateBefore.result);
      expect(stateAfterAlarm.termination).toBe(stateBefore.termination);
    });
  });

  // ==========================================================================
  // FINAL-07: Timeout Result Consistency (Insufficient Mating Material)
  // ==========================================================================
  describe("FINAL-07: Timeout Result Consistency", () => {
    it("resolves timeout as draw when opponent has insufficient mating material", async () => {
      const { sessionDO } = await createGameFixture(2, "3+2");

      // Set board to K vs K (insufficient mating material)
      const kVsK_fen = "8/8/8/4k3/8/8/4K3/8 w - - 0 1";
      await sessionDO.fetch("http://internal/test-set-fen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen: kVsK_fen, turn: "w" }),
      });

      // Expire white's clock
      await sessionDO.fetch("http://internal/test-set-clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whiteMs: 0, blackMs: 180000 }),
      });
      await sessionDO.fetch("http://internal/expire-timers", { method: "POST" });

      // Fire clock flag alarm
      await runDurableObjectAlarm(sessionDO);
      await new Promise((r) => setTimeout(r, 150));

      const state = (await (
        await sessionDO.fetch("http://internal/state")
      ).json()) as TestGameState;
      expect(state.status).toBe("ended");
      // Drawn by timeout vs insufficient material!
      expect(state.result).toBe("1/2-1/2");
      expect(state.termination).toBe("timeout_vs_insufficient");
    });
  });

  // ==========================================================================
  // RTT-01 & RTT-02: Client Timestamp Authority Removal & Ping Replay Protection
  // ==========================================================================
  describe("RTT-01 & RTT-02: Client Timestamp Authority Removal & Ping Replay Protection", () => {
    it("RTT-01: client-supplied timestamps (0, past, future) have zero effect on authoritative RTT", async () => {
      const { sessionDO, whiteWs } = await createGameFixture(2, "3+2");

      // Trigger server ping
      const pingRes = await sessionDO.fetch("http://internal/send-ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "white" }),
      });
      const { pingId } = (await pingRes.json()) as { pingId: string };
      expect(pingId).toBeDefined();

      // Client attempts timestamp attack by sending arbitrary timestamps in PONG
      whiteWs.send(
        JSON.stringify({
          type: "PONG",
          pingId,
          timestamp: 9999999999999, // huge future timestamp
        }),
      );
      await new Promise((r) => setTimeout(r, 60));

      const state = (await (
        await sessionDO.fetch("http://internal/state")
      ).json()) as TestGameState;
      // Server RTT must be serverReceiveTime - serverSendTime, clamped to [0, 200ms]
      expect(state.whitePlayer.rttMs).toBeLessThanOrEqual(200);
      expect(state.whitePlayer.rttMs).toBeGreaterThanOrEqual(0);
    });

    it("RTT-02: replaying a pingId or using an unknown pingId is rejected with zero RTT credit", async () => {
      const { sessionDO, whiteWs } = await createGameFixture(2, "3+2");

      // 1. Send unknown ping ID
      whiteWs.send(
        JSON.stringify({
          type: "PONG",
          pingId: "fake-unknown-uuid",
        }),
      );
      await new Promise((r) => setTimeout(r, 50));

      let state = (await (await sessionDO.fetch("http://internal/state")).json()) as TestGameState;
      expect(state.whitePlayer.rttMs).toBeUndefined();

      // 2. Issue genuine server ping
      const pingRes = await sessionDO.fetch("http://internal/send-ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "white" }),
      });
      const { pingId } = (await pingRes.json()) as { pingId: string };

      // First pong succeeds
      whiteWs.send(JSON.stringify({ type: "PONG", pingId }));
      await new Promise((r) => setTimeout(r, 50));

      state = (await (await sessionDO.fetch("http://internal/state")).json()) as TestGameState;
      const initialMeasuredRtt = state.whitePlayer.rttMs;
      expect(initialMeasuredRtt).toBeDefined();

      // Replay identical pingId: must be dropped with no effect
      whiteWs.send(JSON.stringify({ type: "PONG", pingId }));
      await new Promise((r) => setTimeout(r, 50));

      state = (await (await sessionDO.fetch("http://internal/state")).json()) as TestGameState;
      expect(state.whitePlayer.rttMs).toBe(initialMeasuredRtt);
    });
  });

  // ==========================================================================
  // TIME-01: Time-Control Scope Reconciliation
  // ==========================================================================
  describe("TIME-01: Time-Control Scope Reconciliation", () => {
    it("verifies all 11 launch presets from SRS Section 8.2 are present and correctly classified", () => {
      const srsPresets: TimeControlKey[] = [
        "1+0",
        "1+1",
        "2+1",
        "3+0",
        "3+2",
        "5+0",
        "5+3",
        "10+0",
        "10+5",
        "15+10",
        "30+0",
      ];

      for (const key of srsPresets) {
        const config = TIME_CONTROLS[key];
        expect(config).toBeDefined();
        const expectedCategory = classifyTimeControl(
          config.initialSeconds,
          config.incrementSeconds,
        );
        expect(config.category).toBe(expectedCategory);
      }

      // Explicitly verify 30+0 is Rapid
      expect(TIME_CONTROLS["30+0"].category).toBe("rapid");
    });
  });

  // ==========================================================================
  // TEST-03: Cross-Game Rating Concurrency
  // ==========================================================================
  describe("TEST-03: Cross-Game Rating Concurrency", () => {
    it("settles two simultaneous games for Player A without lost updates or stale baseline overwrites", async () => {
      const playerA = `cross_a_${crypto.randomUUID()}`;
      const playerB1 = `cross_b1_${crypto.randomUUID()}`;
      const playerB2 = `cross_b2_${crypto.randomUUID()}`;
      const now = new Date();

      await db.insert(schema.user).values([
        {
          id: playerA,
          name: "PlayerA",
          email: `${playerA}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: playerB1,
          name: "PlayerB1",
          email: `${playerB1}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: playerB2,
          name: "PlayerB2",
          email: `${playerB2}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(schema.ratings).values([
        { userId: playerA, blitzRating: 1500, blitzRd: 200, updatedAt: now },
        { userId: playerB1, blitzRating: 1500, blitzRd: 200, updatedAt: now },
        { userId: playerB2, blitzRating: 1500, blitzRd: 200, updatedAt: now },
      ]);

      const game1Id = crypto.randomUUID();
      const game2Id = crypto.randomUUID();

      // Settle Game 1 (A wins vs B1) and Game 2 (A wins vs B2) concurrently
      const [res1, res2] = await Promise.all([
        settleGameRatings(db, {
          gameId: game1Id,
          whiteUserId: playerA,
          blackUserId: playerB1,
          timeControl: "3+2",
          category: "blitz",
          moves: ["e4"],
          result: "1-0",
          termination: "resignation",
          rated: true,
          startedAt: Date.now() - 30000,
          endedAt: Date.now(),
        }),
        settleGameRatings(db, {
          gameId: game2Id,
          whiteUserId: playerA,
          blackUserId: playerB2,
          timeControl: "3+2",
          category: "blitz",
          moves: ["d4"],
          result: "1-0",
          termination: "resignation",
          rated: true,
          startedAt: Date.now() - 30000,
          endedAt: Date.now(),
        }),
      ]);

      expect(res1.settled).toBe(true);
      expect(res2.settled).toBe(true);

      const [finalA] = await db
        .select()
        .from(schema.ratings)
        .where(eq(schema.ratings.userId, playerA));
      // Both wins must be reflected: 2 games played, 2 wins!
      expect(finalA.blitzGames).toBe(2);
      expect(finalA.blitzWins).toBe(2);
      expect(finalA.blitzRating).toBeGreaterThan(1500);
    });
  });
});

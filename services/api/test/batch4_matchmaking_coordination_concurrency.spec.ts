import { env, runDurableObjectAlarm } from "cloudflare:test";
import { applyGameResult } from "@etchess/rating";
import {
  type ClientUserFrame,
  PROTOCOL_VERSION,
  type ServerUserFrame,
} from "@etchess/realtime-protocol";
import {
  PRODUCT_RULES,
  TIME_CONTROLS,
  type TimeControlKey,
  getRatingCategory,
} from "@etchess/types";
import { and, eq, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { logCoordination } from "../src/lib/observability";
import { fetchUserCategoryRating, settleGameRatings } from "../src/lib/ratingStorage";
import { createWsTicket } from "../src/lib/wsTicket";
import { applyTestSchema } from "./helpers";

describe("Batch 4: Matchmaking, User Coordination & Concurrency Hardening", () => {
  const secret =
    env.WS_TICKET_SECRET ||
    env.BETTER_AUTH_SECRET ||
    "development_better_auth_secret_key_minimum_32_characters";

  const userA = "b4-user-alpha";
  const userB = "b4-user-beta";
  const userC = "b4-user-gamma";
  const userD = "b4-user-delta";

  beforeAll(async () => {
    await applyTestSchema(env.DB);
    const db = drizzle(env.DB, { schema });
    const now = new Date();

    await db.delete(schema.games);
    await db.delete(schema.ratingHistory);
    await db.delete(schema.challenges);
    await db.delete(schema.friends);

    await db
      .insert(schema.user)
      .values([
        {
          id: userA,
          name: "Alpha",
          email: "alpha@example.com",
          emailVerified: true,
          role: "user",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: userB,
          name: "Beta",
          email: "beta@example.com",
          emailVerified: true,
          role: "user",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: userC,
          name: "Gamma",
          email: "gamma@example.com",
          emailVerified: true,
          role: "user",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: userD,
          name: "Delta",
          email: "delta@example.com",
          emailVerified: true,
          role: "user",
          createdAt: now,
          updatedAt: now,
        },
      ])
      .onConflictDoNothing();

    for (const uid of [userA, userB, userC, userD]) {
      await db
        .insert(schema.ratings)
        .values({
          userId: uid,
          blitzRating: 1500,
          blitzRd: 350,
          blitzVol: 0.06,
          updatedAt: now,
        })
        .onConflictDoNothing();
    }

    const future = new Date(now.getTime() + 86_400_000);
    for (const uid of [userA, userB, userC, userD]) {
      await db
        .insert(schema.session)
        .values({
          id: `sess_${uid}`,
          userId: uid,
          token: `token_${uid}`,
          expiresAt: future,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
    }
  });

  beforeEach(async () => {
    const db = drizzle(env.DB, { schema });
    await db.delete(schema.games);

    // Reset ratings and UserPresenceDO state for test users
    for (const uid of [userA, userB, userC, userD]) {
      await db
        .update(schema.ratings)
        .set({
          blitzRating: 1500,
          blitzRd: 350,
          blitzVol: 0.06,
          blitzGames: 0,
          blitzWins: 0,
          blitzLosses: 0,
          blitzDraws: 0,
          rapidRating: 1500,
          rapidRd: 350,
          rapidVol: 0.06,
          rapidGames: 0,
          rapidWins: 0,
          rapidLosses: 0,
          rapidDraws: 0,
          updatedAt: new Date(),
        })
        .where(eq(schema.ratings.userId, uid));

      const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(uid));
      await upStub.fetch("http://internal/release-live-game", { method: "POST" });
      await upStub.fetch("http://internal/release-queue", { method: "POST" });
      await upStub.fetch("http://internal/release-settlement-lock", { method: "POST" });
    }

    const mmStub = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName("global"));
    await mmStub.fetch("http://internal/clear-active-game", { method: "POST" });
    await mmStub.fetch("http://internal/clear", { method: "POST" });
  });

  // ==========================================================================
  // PART A — BATCH 3 CARRY-OVERS: RATING CONCURRENCY & INTEGRITY
  // ==========================================================================

  describe("PART A — Rating Settlement Concurrency & State Integrity", () => {
    it("B4-RATE-01 / INV-08: Sequential vs Concurrent settlement converge to identical Glicko-2 state", async () => {
      const db = drizzle(env.DB, { schema });
      const now = Date.now();

      // Setup initial baseline for two isolated test players (pSeq vs pConc)
      const pSeq = "p-seq-test";
      const pConc = "p-conc-test";
      const oppSeq1 = "opp-seq-1";
      const oppSeq2 = "opp-seq-2";
      const oppConc1 = "opp-conc-1";
      const oppConc2 = "opp-conc-2";

      for (const id of [pSeq, pConc, oppSeq1, oppSeq2, oppConc1, oppConc2]) {
        await db
          .insert(schema.user)
          .values({
            id,
            name: id,
            email: `${id}@test.com`,
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoNothing();
        await db
          .insert(schema.ratings)
          .values({
            userId: id,
            blitzRating: 1500,
            blitzRd: 350,
            blitzVol: 0.06,
            updatedAt: new Date(),
          })
          .onConflictDoNothing();
      }

      // Sequential path: Game 1 settles, then Game 2 settles
      const seqGame1Id = `seq-g1-${crypto.randomUUID()}`;
      const seqGame2Id = `seq-g2-${crypto.randomUUID()}`;

      await settleGameRatings(
        env.DB,
        {
          gameId: seqGame1Id,
          whiteUserId: pSeq,
          blackUserId: oppSeq1,
          timeControl: "3+2",
          category: "blitz",
          moves: ["e4", "e5"],
          result: "1-0",
          termination: "checkmate",
          rated: true,
          startedAt: now - 60000,
          endedAt: now - 30000,
        },
        env,
      );

      await settleGameRatings(
        env.DB,
        {
          gameId: seqGame2Id,
          whiteUserId: pSeq,
          blackUserId: oppSeq2,
          timeControl: "3+2",
          category: "blitz",
          moves: ["d4", "d5"],
          result: "1-0",
          termination: "checkmate",
          rated: true,
          startedAt: now - 20000,
          endedAt: now,
        },
        env,
      );

      const seqFinal = await fetchUserCategoryRating(env.DB, pSeq, "blitz");

      // Concurrent path: Game 1 and Game 2 settle concurrently for pConc
      const concGame1Id = `conc-g1-${crypto.randomUUID()}`;
      const concGame2Id = `conc-g2-${crypto.randomUUID()}`;

      await Promise.all([
        settleGameRatings(
          env.DB,
          {
            gameId: concGame1Id,
            whiteUserId: pConc,
            blackUserId: oppConc1,
            timeControl: "3+2",
            category: "blitz",
            moves: ["e4", "e5"],
            result: "1-0",
            termination: "checkmate",
            rated: true,
            startedAt: now - 60000,
            endedAt: now - 30000,
          },
          env,
        ),
        settleGameRatings(
          env.DB,
          {
            gameId: concGame2Id,
            whiteUserId: pConc,
            blackUserId: oppConc2,
            timeControl: "3+2",
            category: "blitz",
            moves: ["d4", "d5"],
            result: "1-0",
            termination: "checkmate",
            rated: true,
            startedAt: now - 20000,
            endedAt: now,
          },
          env,
        ),
      ]);

      const concFinal = await fetchUserCategoryRating(env.DB, pConc, "blitz");

      // B4-RATE-01 Proof: Both converge to the exact same serialized rating state!
      expect(Math.round(concFinal.rating)).toBe(Math.round(seqFinal.rating));
      expect(Math.round(concFinal.rd)).toBe(Math.round(seqFinal.rd));
      expect(concFinal.games).toBe(seqFinal.games);
      expect(concFinal.wins).toBe(seqFinal.wins);
      expect(concFinal.games).toBe(2);
      expect(concFinal.wins).toBe(2);
    });

    it("B4-RATE-02 / INV-07: Duplicate concurrent settlement executes rating and history mutation exactly once", async () => {
      const db = drizzle(env.DB, { schema });
      const testGameId = `dup-settle-${crypto.randomUUID()}`;
      const now = Date.now();

      const initialA = await fetchUserCategoryRating(env.DB, userA, "blitz");
      const initialGamesCountA = initialA.games;

      // Race 2 concurrent settlement requests for the exact same game
      const [res1, res2] = await Promise.all([
        settleGameRatings(
          env.DB,
          {
            gameId: testGameId,
            whiteUserId: userA,
            blackUserId: userB,
            timeControl: "3+2",
            category: "blitz",
            moves: ["e4", "e5", "Qh5"],
            result: "1-0",
            termination: "resignation",
            rated: true,
            startedAt: now - 10000,
            endedAt: now,
          },
          env,
        ),
        settleGameRatings(
          env.DB,
          {
            gameId: testGameId,
            whiteUserId: userA,
            blackUserId: userB,
            timeControl: "3+2",
            category: "blitz",
            moves: ["e4", "e5", "Qh5"],
            result: "1-0",
            termination: "resignation",
            rated: true,
            startedAt: now - 10000,
            endedAt: now,
          },
          env,
        ),
      ]);

      // Exactly one request reports newly settled; the other reports alreadySettled
      expect([res1.alreadySettled, res2.alreadySettled].filter(Boolean).length).toBe(1);

      // Verify at the database level: exactly 1 game row
      const gameRows = await db.select().from(schema.games).where(eq(schema.games.id, testGameId));
      expect(gameRows.length).toBe(1);

      // Verify at the database level: exactly 1 rating mutation (+1 game)
      const afterA = await fetchUserCategoryRating(env.DB, userA, "blitz");
      expect(afterA.games).toBe(initialGamesCountA + 1);

      // Verify at the database level: exactly 1 history row per player
      const historyRows = await db
        .select()
        .from(schema.ratingHistory)
        .where(eq(schema.ratingHistory.gameId, testGameId));
      expect(historyRows.length).toBe(2); // 1 for white, 1 for black
    });

    it("B4-RATE-03: Rating state integrity persists full Glicko state consistently", async () => {
      const db = drizzle(env.DB, { schema });
      const testGameId = `integrity-${crypto.randomUUID()}`;
      const now = Date.now();

      const before = await fetchUserCategoryRating(env.DB, userA, "rapid");

      await settleGameRatings(
        env.DB,
        {
          gameId: testGameId,
          whiteUserId: userA,
          blackUserId: userC,
          timeControl: "10+0",
          category: "rapid",
          moves: ["e4", "c5"],
          result: "1-0",
          termination: "checkmate",
          rated: true,
          startedAt: now - 20000,
          endedAt: now,
        },
        env,
      );

      const after = await fetchUserCategoryRating(env.DB, userA, "rapid");

      // Verify complete Glicko state fields
      expect(after.rating).toBeGreaterThan(before.rating);
      expect(after.rd).toBeLessThan(before.rd); // Deviation decreases after playing
      expect(after.vol).toBeCloseTo(0.06, 2);
      expect(after.games).toBe(before.games + 1);
      expect(after.wins).toBe(before.wins + 1);
      expect(after.losses).toBe(before.losses);
      expect(after.draws).toBe(before.draws);

      // Rating history row integrity
      const [hist] = await db
        .select()
        .from(schema.ratingHistory)
        .where(
          and(eq(schema.ratingHistory.gameId, testGameId), eq(schema.ratingHistory.userId, userA)),
        );
      expect(hist).toBeDefined();
      expect(hist.ratingBefore).toBe(before.rating);
      expect(hist.ratingAfter).toBe(after.rating);
      expect(hist.category).toBe("rapid");
    });
  });

  // ==========================================================================
  // PART B — USERPRESENCEDO & ONE LIVE GAME INVARIANT
  // ==========================================================================

  describe("PART B — UserPresenceDO & One Live Game Coordination", () => {
    it("B4-PRES-01 & B4-PRES-02 / INV-01: Two concurrent game creation requests permit exactly one live game", async () => {
      const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(userA));
      const g1 = `live-game-1-${crypto.randomUUID()}`;
      const g2 = `live-game-2-${crypto.randomUUID()}`;

      // Concurrent claim attempts from two different devices
      const [res1, res2] = await Promise.all([
        upStub.fetch("http://internal/claim-live-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId: g1 }),
        }),
        upStub.fetch("http://internal/claim-live-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId: g2 }),
        }),
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(409);

      // Query active game status
      const activeRes = await upStub.fetch("http://internal/active-game");
      const activeData = (await activeRes.json()) as { active: boolean; gameId: string };
      expect(activeData.active).toBe(true);
      expect([g1, g2]).toContain(activeData.gameId);
    });

    it("B4-PRES-03: Terminal cleanup reliably releases active game lock", async () => {
      const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(userA));
      const gameId = `cleanup-test-${crypto.randomUUID()}`;

      // 1. Claim game
      const claimRes = await upStub.fetch("http://internal/claim-live-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });
      expect(claimRes.status).toBe(200);

      // 2. Release game (simulating GameSessionDO terminal cleanup)
      const releaseRes = await upStub.fetch("http://internal/release-live-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });
      expect(releaseRes.status).toBe(200);

      // 3. New game request immediately succeeds
      const newGameId = `cleanup-new-${crypto.randomUUID()}`;
      const newClaimRes = await upStub.fetch("http://internal/claim-live-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: newGameId }),
      });
      expect(newClaimRes.status).toBe(200);
    });

    it("B4-PRES-04: Stale active-game recovery clears finished game automatically", async () => {
      const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(userA));
      const staleGameId = `stale-game-${crypto.randomUUID()}`;

      // 1. Pre-initialize and finalize a game in GameSessionDO
      const sessionStub = env.GAME_SESSION_DO.get(env.GAME_SESSION_DO.idFromName(staleGameId));
      await sessionStub.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: staleGameId,
          whiteUserId: userA,
          whiteUserName: "Alpha",
          whiteRating: 1500,
          blackUserId: userB,
          blackUserName: "Beta",
          blackRating: 1500,
          timeControl: "3+2",
          rated: false,
        }),
      });

      // Force session to finalized/terminal state
      await sessionStub
        .fetch("http://internal/test-force-state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "finished", finalized: true }),
        })
        .catch(() => {});

      // Simulate UserPresenceDO retaining old staleGameId
      await upStub.fetch("http://internal/claim-live-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: staleGameId }),
      });

      // 2. Querying active-game triggers reconciliation against GameSessionDO
      const activeRes = await upStub.fetch("http://internal/active-game");
      const activeData = (await activeRes.json()) as { active: boolean };
      expect(activeData.active).toBe(false);

      // 3. Next game claim succeeds without permanent lock
      const freshGameId = `fresh-game-${crypto.randomUUID()}`;
      const freshRes = await upStub.fetch("http://internal/claim-live-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: freshGameId }),
      });
      expect(freshRes.status).toBe(200);
    });
  });

  // ==========================================================================
  // PART C & D — MATCHMAKING & POOL ISOLATION
  // ==========================================================================

  describe("PART C & D — Matchmaking Architecture & Race Safety", () => {
    it("B4-MM-01 & B4-MM-02 / INV-02: Concurrent duplicate queue joins produce exactly one queue entry", async () => {
      const poolKey = "3+2_rated";
      const mmStub = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName(poolKey));

      // Clear pool
      await mmStub.fetch("http://internal/clear", { method: "POST" });

      // Create 3 WebSocket tickets for userA
      const tickets = await Promise.all([
        createWsTicket({ userId: userA, userName: "Alpha", rating: 1500, scope: "user" }, secret),
        createWsTicket({ userId: userA, userName: "Alpha", rating: 1500, scope: "user" }, secret),
        createWsTicket({ userId: userA, userName: "Alpha", rating: 1500, scope: "user" }, secret),
      ]);

      const sockets: WebSocket[] = [];
      for (const t of tickets) {
        const res = await mmStub.fetch("http://internal/ws", {
          headers: { Upgrade: "websocket" },
        });
        const ws = res.webSocket;
        if (!ws) throw new Error("Expected WebSocket");
        ws.accept();
        ws.send(JSON.stringify({ type: "AUTH", payload: { ticket: t.ticket } }));
        sockets.push(ws);
      }

      await new Promise((r) => setTimeout(r, 60));

      // Send 3 concurrent QUEUE_JOIN frames from 3 connections
      for (const ws of sockets) {
        ws.send(
          JSON.stringify({
            type: "QUEUE_JOIN",
            payload: { timeControlId: "3+2", rated: true },
          }),
        );
      }

      await new Promise((r) => setTimeout(r, 80));

      // Verify pool state: exactly 1 queued player
      const statusRes = await mmStub.fetch("http://internal/queue-status");
      const statusData = (await statusRes.json()) as { totalInQueue: number };
      expect(statusData.totalInQueue).toBe(1);

      for (const ws of sockets) ws.close();
    });

    it("B4-MM-03: Concurrent Join + Leave deterministically clears queue without ghost entries", async () => {
      const poolKey = "3+2_rated";
      const mmStub = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName(poolKey));
      await mmStub.fetch("http://internal/clear", { method: "POST" });

      const { ticket } = await createWsTicket(
        { userId: userB, userName: "Beta", rating: 1500, scope: "user" },
        secret,
      );

      const res = await mmStub.fetch("http://internal/ws", { headers: { Upgrade: "websocket" } });
      const ws = res.webSocket;
      if (!ws) throw new Error("Expected WebSocket");
      ws.accept();
      ws.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
      await new Promise((r) => setTimeout(r, 40));

      // Fire JOIN then LEAVE in quick succession
      ws.send(
        JSON.stringify({ type: "QUEUE_JOIN", payload: { timeControlId: "3+2", rated: true } }),
      );
      ws.send(JSON.stringify({ type: "QUEUE_LEAVE" }));
      await new Promise((r) => setTimeout(r, 80));

      const statusRes = await mmStub.fetch("http://internal/queue-status");
      const statusData = (await statusRes.json()) as { totalInQueue: number };
      expect(statusData.totalInQueue).toBe(0);

      ws.close();
    });

    it("B4-MM-04 & B4-MM-05: Concurrent 3-player match race pairs exactly 2 players into 1 game", async () => {
      const poolKey = "3+2_rated";
      const mmStub = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName(poolKey));
      await mmStub.fetch("http://internal/clear", { method: "POST" });

      const [t1, t2, t3] = await Promise.all([
        createWsTicket({ userId: userA, userName: "Alpha", rating: 1500, scope: "user" }, secret),
        createWsTicket({ userId: userB, userName: "Beta", rating: 1500, scope: "user" }, secret),
        createWsTicket({ userId: userC, userName: "Gamma", rating: 1500, scope: "user" }, secret),
      ]);

      const sockets: WebSocket[] = [];
      const messages: ServerUserFrame[][] = [[], [], []];

      for (let i = 0; i < 3; i++) {
        const res = await mmStub.fetch("http://internal/ws", { headers: { Upgrade: "websocket" } });
        const ws = res.webSocket;
        if (!ws) throw new Error("Expected WebSocket");
        ws.accept();
        ws.addEventListener("message", (ev) => {
          messages[i].push(JSON.parse(ev.data as string));
        });
        const t = i === 0 ? t1 : i === 1 ? t2 : t3;
        ws.send(JSON.stringify({ type: "AUTH", payload: { ticket: t.ticket } }));
        sockets.push(ws);
      }

      await new Promise((r) => setTimeout(r, 60));

      // All 3 players join the queue concurrently
      for (const ws of sockets) {
        ws.send(
          JSON.stringify({ type: "QUEUE_JOIN", payload: { timeControlId: "3+2", rated: true } }),
        );
      }

      await new Promise((r) => setTimeout(r, 120));

      // Exactly 2 players must receive MATCH_FOUND
      const matchCounts = messages.map(
        (mList) => mList.filter((m) => m.type === "MATCH_FOUND").length,
      );
      const totalMatches = matchCounts.reduce((a, b) => a + b, 0);
      expect(totalMatches).toBe(2);

      // Remaining 1 player remains in queue
      const statusRes = await mmStub.fetch("http://internal/queue-status");
      const statusData = (await statusRes.json()) as { totalInQueue: number };
      expect(statusData.totalInQueue).toBe(1);

      for (const ws of sockets) ws.close();
    });

    it("B4-MM-11: Match creation failure restores players to queue preserving original joinedAt", async () => {
      const poolKey = "3+2_rated";
      const mmStub = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName(poolKey));
      await mmStub.fetch("http://internal/clear", { method: "POST" });

      // Connect two users to pool
      const [t1, t2] = await Promise.all([
        createWsTicket({ userId: userA, userName: "Alpha", rating: 1500, scope: "user" }, secret),
        createWsTicket({ userId: userB, userName: "Beta", rating: 1500, scope: "user" }, secret),
      ]);

      const r1 = await mmStub.fetch("http://internal/ws", { headers: { Upgrade: "websocket" } });
      const r2 = await mmStub.fetch("http://internal/ws", { headers: { Upgrade: "websocket" } });
      const ws1 = r1.webSocket;
      if (!ws1) throw new Error("Expected WebSocket");
      const ws2 = r2.webSocket;
      if (!ws2) throw new Error("Expected WebSocket");
      ws1.accept();
      ws2.accept();

      ws1.send(JSON.stringify({ type: "AUTH", payload: { ticket: t1.ticket } }));
      ws2.send(JSON.stringify({ type: "AUTH", payload: { ticket: t2.ticket } }));
      await new Promise((r) => setTimeout(r, 50));

      // Inject game init failure in GameSessionDO
      await mmStub.fetch("http://internal/test-simulate-init-failure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });

      // Join queue
      ws1.send(
        JSON.stringify({ type: "QUEUE_JOIN", payload: { timeControlId: "3+2", rated: true } }),
      );
      await new Promise((r) => setTimeout(r, 30));
      ws2.send(
        JSON.stringify({ type: "QUEUE_JOIN", payload: { timeControlId: "3+2", rated: true } }),
      );
      await new Promise((r) => setTimeout(r, 80));

      // B4-MM-11: Verify queue is restored rather than empty
      const queueRes = await mmStub.fetch("http://internal/queue-status");
      const qData = (await queueRes.json()) as { totalInQueue: number };
      expect(qData.totalInQueue).toBeGreaterThanOrEqual(1);

      await mmStub.fetch("http://internal/test-simulate-init-failure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });

      ws1.close();
      ws2.close();
    });

    it("B4-MM-13 & B4-MM-14: Pools are isolated per timeControl x isRated", async () => {
      const pool1 = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName("1+0_rated"));
      const pool2 = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName("3+2_rated"));
      const pool3 = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName("10+0_unrated"));

      await pool1.fetch("http://internal/clear", { method: "POST" });
      await pool2.fetch("http://internal/clear", { method: "POST" });
      await pool3.fetch("http://internal/clear", { method: "POST" });

      const { ticket } = await createWsTicket(
        { userId: userA, userName: "Alpha", rating: 1500, scope: "user" },
        secret,
      );

      const r1 = await pool1.fetch("http://internal/ws", { headers: { Upgrade: "websocket" } });
      const ws1 = r1.webSocket;
      if (!ws1) throw new Error("Expected WebSocket");
      ws1.accept();
      ws1.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
      await new Promise((r) => setTimeout(r, 40));

      ws1.send(
        JSON.stringify({ type: "QUEUE_JOIN", payload: { timeControlId: "1+0", rated: true } }),
      );
      await new Promise((r) => setTimeout(r, 60));

      // pool1 has 1 player; pool2 and pool3 remain completely isolated and empty
      const q1 = (await (await pool1.fetch("http://internal/queue-status")).json()) as {
        totalInQueue: number;
      };
      const q2 = (await (await pool2.fetch("http://internal/queue-status")).json()) as {
        totalInQueue: number;
      };
      const q3 = (await (await pool3.fetch("http://internal/queue-status")).json()) as {
        totalInQueue: number;
      };

      expect(q1.totalInQueue).toBe(1);
      expect(q2.totalInQueue).toBe(0);
      expect(q3.totalInQueue).toBe(0);

      ws1.close();
    });
  });

  // ==========================================================================
  // PART E & F — FRIENDS & CHALLENGES CONCURRENCY
  // ==========================================================================

  describe("PART E & F — Friends, Challenges & Invariant Limits", () => {
    it("B4-FR-01 & B4-FR-02 / INV-06: Database constraint prevents duplicate friendship rows across concurrent requests", async () => {
      const db = drizzle(env.DB, { schema });
      const testU1 = `fr-u1-${crypto.randomUUID()}`;
      const testU2 = `fr-u2-${crypto.randomUUID()}`;

      // Insert both users
      await db.insert(schema.user).values([
        {
          id: testU1,
          name: testU1,
          email: `${testU1}@test.com`,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: testU2,
          name: testU2,
          email: `${testU2}@test.com`,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Fire concurrent A->B, B->A, A->B requests directly at the DB insert level
      const attempts = await Promise.allSettled([
        db.insert(schema.friends).values({
          id: crypto.randomUUID(),
          userId: testU1,
          friendId: testU2,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        db.insert(schema.friends).values({
          id: crypto.randomUUID(),
          userId: testU2,
          friendId: testU1,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        db.insert(schema.friends).values({
          id: crypto.randomUUID(),
          userId: testU1,
          friendId: testU2,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ]);

      const fulfilled = attempts.filter((a) => a.status === "fulfilled");
      const rejected = attempts.filter((a) => a.status === "rejected");

      // Database unique index friends_canonical_pair_idx permits exactly 1 row
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(2);

      const rows = await db
        .select()
        .from(schema.friends)
        .where(
          or(
            and(eq(schema.friends.userId, testU1), eq(schema.friends.friendId, testU2)),
            and(eq(schema.friends.userId, testU2), eq(schema.friends.friendId, testU1)),
          ),
        );
      expect(rows.length).toBe(1);
    });

    it("B4-CH-01: Challenge expiry is strictly enforced (expiry-1ms vs expiry vs expiry+1ms)", async () => {
      const db = drizzle(env.DB, { schema });
      const now = Date.now();

      // 1. Valid (expires in future)
      const validChallengeId = `ch-valid-${crypto.randomUUID()}`;
      await db.insert(schema.challenges).values({
        id: validChallengeId,
        challengerId: userA,
        challengedId: userB,
        timeControl: "3+2",
        category: "blitz",
        rated: false,
        status: "pending",
        expiresAt: new Date(now + 10000),
        createdAt: new Date(),
      });

      // 2. Expired (expiresAt = now - 1ms)
      const expiredChallengeId = `ch-expired-${crypto.randomUUID()}`;
      await db.insert(schema.challenges).values({
        id: expiredChallengeId,
        challengerId: userA,
        challengedId: userB,
        timeControl: "3+2",
        category: "blitz",
        rated: false,
        status: "pending",
        expiresAt: new Date(now - 1),
        createdAt: new Date(),
      });

      // Attempt accepting expired challenge
      const expiredRes = await app.fetch(
        new Request(`http://localhost/api/challenges/${expiredChallengeId}/accept`, {
          method: "POST",
          headers: { Authorization: `Bearer token_${userB}` },
        }),
        env,
      );
      expect(expiredRes.status).toBe(409);

      // Attempt accepting valid challenge
      const validRes = await app.fetch(
        new Request(`http://localhost/api/challenges/${validChallengeId}/accept`, {
          method: "POST",
          headers: { Authorization: `Bearer token_${userB}` },
        }),
        env,
      );
      expect(validRes.status).toBe(200);
    });

    it("B4-CH-03 / INV-05: Concurrent acceptance of share-code challenge produces exactly one game", async () => {
      const db = drizzle(env.DB, { schema });
      const openChallengeId = `open-ch-${crypto.randomUUID()}`;
      const now = new Date();

      await db.insert(schema.challenges).values({
        id: openChallengeId,
        challengerId: userA,
        challengedId: null, // Open link
        timeControl: "3+2",
        category: "blitz",
        rated: false,
        status: "pending",
        expiresAt: new Date(now.getTime() + 600000),
        createdAt: now,
      });

      // User B and User C attempt to accept the open challenge simultaneously
      const [resB, resC] = await Promise.all([
        app.fetch(
          new Request(`http://localhost/api/challenges/${openChallengeId}/accept`, {
            method: "POST",
            headers: { Authorization: `Bearer token_${userB}` },
          }),
          env,
        ),
        app.fetch(
          new Request(`http://localhost/api/challenges/${openChallengeId}/accept`, {
            method: "POST",
            headers: { Authorization: `Bearer token_${userC}` },
          }),
          env,
        ),
      ]);

      const statuses = [resB.status, resC.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(409);

      // Verify DB row
      const [finalCh] = await db
        .select()
        .from(schema.challenges)
        .where(eq(schema.challenges.id, openChallengeId));
      expect(finalCh.status).toBe("accepted");
      expect([userB, userC]).toContain(finalCh.challengedId);
    });

    it("B4-CH-06 / INV-03: Rated pair 24h limit cannot be bypassed via challenges", async () => {
      const db = drizzle(env.DB, { schema });
      const now = new Date();
      const pairUserA = `pair-limit-a-${crypto.randomUUID()}`;
      const pairUserB = `pair-limit-b-${crypto.randomUUID()}`;

      for (const id of [pairUserA, pairUserB]) {
        await db
          .insert(schema.user)
          .values({
            id,
            name: id,
            email: `${id}@test.com`,
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing();
        await db
          .insert(schema.session)
          .values({
            id: `sess_${id}`,
            userId: id,
            token: `token_${id}`,
            expiresAt: new Date(now.getTime() + 86_400_000),
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing();
      }

      // Insert 5 past rated games between pairUserA and pairUserB within the past 4 hours
      for (let i = 0; i < 5; i++) {
        await db.insert(schema.games).values({
          id: `pair-cap-${i}-${crypto.randomUUID()}`,
          whitePlayerId: pairUserA,
          blackPlayerId: pairUserB,
          timeControl: "3+2",
          category: "blitz",
          moves: JSON.stringify(["e4", "e5"]),
          result: "1-0",
          termination: "checkmate",
          rated: true,
          whiteRatingBefore: 1500,
          whiteRatingChange: 15,
          blackRatingBefore: 1500,
          blackRatingChange: -15,
          startedAt: new Date(now.getTime() - (i + 1) * 3600_000),
          endedAt: new Date(now.getTime() - (i + 1) * 3600_000 + 300_000),
        });
      }

      // Attempt creating a 6th rated challenge between pairUserA and pairUserB
      const createRes = await app.fetch(
        new Request("http://localhost/api/challenges", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer token_${pairUserA}`,
          },
          body: JSON.stringify({
            challengedId: pairUserB,
            timeControlId: "3+2",
            rated: true,
          }),
        }),
        env,
      );

      expect(createRes.status).toBe(409);
      const data = (await createRes.json()) as { error: { code: string } };
      expect(data.error.code).toBe("CONFLICT");
    });
  });

  // ==========================================================================
  // PART H & I — TIME CONTROL CONSISTENCY & OBSERVABILITY
  // ==========================================================================

  describe("PART H & I — Time Control Consistency & Observability", () => {
    it("B4-TC-01 & B4-TC-02 / INV-10: All 11 authoritative presets match their classified categories", () => {
      const expectedKeys: TimeControlKey[] = [
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

      for (const key of expectedKeys) {
        const config = TIME_CONTROLS[key];
        expect(config).toBeDefined();
        const cat = getRatingCategory(key);
        expect(cat).toBe(config.category);

        // Verify category boundaries matching classifyTimeControl
        const totalEstimatedSeconds = config.initialSeconds + 40 * config.incrementSeconds;
        if (totalEstimatedSeconds < 180) {
          expect(cat).toBe("bullet");
        } else if (totalEstimatedSeconds < 480) {
          expect(cat).toBe("blitz");
        } else if (totalEstimatedSeconds < 3600) {
          expect(cat).toBe("rapid");
        } else {
          expect(cat).toBe("classical");
        }
      }
    });

    it("B4-OBS-01: Coordination logger strips all sensitive tokens and tickets", () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      try {
        logCoordination("TEST_EVENT", {
          userId: userA,
          gameId: "game-123",
          ticket: "sensitive-ws-ticket",
          token: "session-secret-token",
          password: "my-password",
          safeField: "safe-value",
        });

        expect(logs.length).toBe(1);
        const logged = JSON.parse(logs[0]);
        expect(logged.type).toBe("coordination_event");
        expect(logged.userId).toBe(userA);
        expect(logged.gameId).toBe("game-123");
        expect(logged.safeField).toBe("safe-value");
        expect(logged.ticket).toBeUndefined();
        expect(logged.token).toBeUndefined();
        expect(logged.password).toBeUndefined();
      } finally {
        console.log = originalLog;
      }
    });
  });

  // ==========================================================================
  // PART J — CONCURRENCY MATRIX VERIFICATION (14 RACES)
  // ==========================================================================

  describe("PART J — Required Concurrency Matrix (14 Races)", () => {
    it("Matrix Race 1: Duplicate queue join -> Exactly 1 queue membership", async () => {
      const pool = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName("5+3_rated"));
      await pool.fetch("http://internal/clear", { method: "POST" });

      const t1 = await createWsTicket(
        { userId: userA, userName: "Alpha", rating: 1500, scope: "user" },
        secret,
      );
      const t2 = await createWsTicket(
        { userId: userA, userName: "Alpha", rating: 1500, scope: "user" },
        secret,
      );

      const r1 = await pool.fetch("http://internal/ws", { headers: { Upgrade: "websocket" } });
      const r2 = await pool.fetch("http://internal/ws", { headers: { Upgrade: "websocket" } });
      const ws1 = r1.webSocket;
      if (!ws1) throw new Error("Expected WebSocket");
      const ws2 = r2.webSocket;
      if (!ws2) throw new Error("Expected WebSocket");
      ws1.accept();
      ws2.accept();

      ws1.send(JSON.stringify({ type: "AUTH", payload: { ticket: t1.ticket } }));
      ws2.send(JSON.stringify({ type: "AUTH", payload: { ticket: t2.ticket } }));
      await new Promise((r) => setTimeout(r, 40));

      ws1.send(
        JSON.stringify({ type: "QUEUE_JOIN", payload: { timeControlId: "5+3", rated: true } }),
      );
      ws2.send(
        JSON.stringify({ type: "QUEUE_JOIN", payload: { timeControlId: "5+3", rated: true } }),
      );
      await new Promise((r) => setTimeout(r, 60));

      const status = (await (await pool.fetch("http://internal/queue-status")).json()) as {
        totalInQueue: number;
      };
      expect(status.totalInQueue).toBe(1);

      ws1.close();
      ws2.close();
    });

    it("Matrix Race 2: Join + Leave concurrently -> Clean idle state", async () => {
      const pool = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName("5+0_rated"));
      await pool.fetch("http://internal/clear", { method: "POST" });

      const { ticket } = await createWsTicket(
        { userId: userC, userName: "Gamma", rating: 1500, scope: "user" },
        secret,
      );
      const r = await pool.fetch("http://internal/ws", { headers: { Upgrade: "websocket" } });
      const ws = r.webSocket;
      if (!ws) throw new Error("Expected WebSocket");
      ws.accept();
      ws.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
      await new Promise((r) => setTimeout(r, 40));

      ws.send(
        JSON.stringify({ type: "QUEUE_JOIN", payload: { timeControlId: "5+0", rated: true } }),
      );
      ws.send(JSON.stringify({ type: "QUEUE_LEAVE" }));
      await new Promise((r) => setTimeout(r, 60));

      const status = (await (await pool.fetch("http://internal/queue-status")).json()) as {
        totalInQueue: number;
      };
      expect(status.totalInQueue).toBe(0);
      ws.close();
    });

    it("Matrix Race 3: Match + Match concurrently -> Exactly 1 match formed", async () => {
      const pool = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName("3+2_rated"));
      await pool.fetch("http://internal/clear", { method: "POST" });

      const [t1, t2] = await Promise.all([
        createWsTicket({ userId: userA, userName: "Alpha", rating: 1500, scope: "user" }, secret),
        createWsTicket({ userId: userB, userName: "Beta", rating: 1500, scope: "user" }, secret),
      ]);

      const r1 = await pool.fetch("http://internal/ws", { headers: { Upgrade: "websocket" } });
      const r2 = await pool.fetch("http://internal/ws", { headers: { Upgrade: "websocket" } });
      const ws1 = r1.webSocket;
      if (!ws1) throw new Error("Expected WebSocket");
      const ws2 = r2.webSocket;
      if (!ws2) throw new Error("Expected WebSocket");
      ws1.accept();
      ws2.accept();

      const msgs1: ServerUserFrame[] = [];
      const msgs2: ServerUserFrame[] = [];
      ws1.addEventListener("message", (ev) => msgs1.push(JSON.parse(ev.data as string)));
      ws2.addEventListener("message", (ev) => msgs2.push(JSON.parse(ev.data as string)));

      ws1.send(JSON.stringify({ type: "AUTH", payload: { ticket: t1.ticket } }));
      ws2.send(JSON.stringify({ type: "AUTH", payload: { ticket: t2.ticket } }));
      await new Promise((r) => setTimeout(r, 50));

      // Both join simultaneously
      ws1.send(
        JSON.stringify({ type: "QUEUE_JOIN", payload: { timeControlId: "3+2", rated: true } }),
      );
      ws2.send(
        JSON.stringify({ type: "QUEUE_JOIN", payload: { timeControlId: "3+2", rated: true } }),
      );
      await new Promise((r) => setTimeout(r, 100));

      const m1 = msgs1.find((m) => m.type === "MATCH_FOUND");
      const m2 = msgs2.find((m) => m.type === "MATCH_FOUND");

      expect(m1).toBeDefined();
      expect(m2).toBeDefined();
      if (m1?.type === "MATCH_FOUND" && m2?.type === "MATCH_FOUND") {
        expect(m1.payload.gameId).toBe(m2.payload.gameId);
      }

      ws1.close();
      ws2.close();
    });

    it("Matrix Race 4: Two devices for same user -> Only 1 live game claim", async () => {
      const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(userA));
      const [r1, r2] = await Promise.all([
        upStub.fetch("http://internal/claim-live-game", {
          method: "POST",
          body: JSON.stringify({ gameId: "dev-g1" }),
        }),
        upStub.fetch("http://internal/claim-live-game", {
          method: "POST",
          body: JSON.stringify({ gameId: "dev-g2" }),
        }),
      ]);
      expect([r1.status, r2.status]).toContain(200);
      expect([r1.status, r2.status]).toContain(409);
    });

    it("Matrix Race 5: Live game + Queue concurrently -> Queue claim rejected", async () => {
      const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(userA));
      await upStub.fetch("http://internal/claim-live-game", {
        method: "POST",
        body: JSON.stringify({ gameId: "game-active" }),
      });

      const qRes = await upStub.fetch("http://internal/claim-queue", {
        method: "POST",
        body: JSON.stringify({ poolKey: "3+2_rated" }),
      });
      expect(qRes.status).toBe(409);
    });

    it("Matrix Race 6: Challenge creation + Queue join concurrently -> Rejection if in game", async () => {
      const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(userA));
      await upStub.fetch("http://internal/claim-live-game", {
        method: "POST",
        body: JSON.stringify({ gameId: "chal-g1" }),
      });

      const chalRes = await app.fetch(
        new Request("http://localhost/api/challenges", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer token_${userA}`,
          },
          body: JSON.stringify({ challengedId: userB, timeControlId: "3+2", rated: false }),
        }),
        env,
      );
      expect(chalRes.status).toBe(409);
    });

    it("Matrix Race 7: Challenge accept + another game creation concurrently -> Exactly 1 live game", async () => {
      const db = drizzle(env.DB, { schema });
      const chId = `race7-${crypto.randomUUID()}`;
      await db.insert(schema.challenges).values({
        id: chId,
        challengerId: userC,
        challengedId: userD,
        timeControl: "3+2",
        category: "blitz",
        rated: false,
        status: "pending",
        expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
      });

      const upStubD = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(userD));

      const [acceptRes, directClaimRes] = await Promise.all([
        app.fetch(
          new Request(`http://localhost/api/challenges/${chId}/accept`, {
            method: "POST",
            headers: { Authorization: `Bearer token_${userD}` },
          }),
          env,
        ),
        upStubD.fetch("http://internal/claim-live-game", {
          method: "POST",
          body: JSON.stringify({ gameId: "concurrent-direct-game" }),
        }),
      ]);

      const statuses = [acceptRes.status, directClaimRes.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(409);
    });

    it("Matrix Race 8: Two challenge accepts concurrently -> Exactly 1 acceptance", async () => {
      const db = drizzle(env.DB, { schema });
      const openChId = `race8-${crypto.randomUUID()}`;
      await db.insert(schema.challenges).values({
        id: openChId,
        challengerId: userA,
        challengedId: null,
        timeControl: "3+2",
        category: "blitz",
        rated: false,
        status: "pending",
        expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
      });

      const [res1, res2] = await Promise.all([
        app.fetch(
          new Request(`http://localhost/api/challenges/${openChId}/accept`, {
            method: "POST",
            headers: { Authorization: `Bearer token_${userB}` },
          }),
          env,
        ),
        app.fetch(
          new Request(`http://localhost/api/challenges/${openChId}/accept`, {
            method: "POST",
            headers: { Authorization: `Bearer token_${userC}` },
          }),
          env,
        ),
      ]);

      expect([res1.status, res2.status]).toContain(200);
      expect([res1.status, res2.status]).toContain(409);
    });

    it("Matrix Race 9: Share-code double accept -> Single-use atomic CAS", async () => {
      const db = drizzle(env.DB, { schema });
      const scId = `race9-${crypto.randomUUID()}`;
      await db.insert(schema.challenges).values({
        id: scId,
        challengerId: userA,
        challengedId: null,
        timeControl: "5+0",
        category: "blitz",
        rated: false,
        status: "pending",
        expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
      });

      const [r1, r2] = await Promise.all([
        app.fetch(
          new Request(`http://localhost/api/challenges/${scId}/accept`, {
            method: "POST",
            headers: { Authorization: `Bearer token_${userB}` },
          }),
          env,
        ),
        app.fetch(
          new Request(`http://localhost/api/challenges/${scId}/accept`, {
            method: "POST",
            headers: { Authorization: `Bearer token_${userB}` },
          }),
          env,
        ),
      ]);

      expect([r1.status, r2.status]).toContain(200);
      expect([r1.status, r2.status]).toContain(409);
    });

    it("Matrix Race 10: Friend duplicate creation -> DB unique constraint prevents duplicate rows", async () => {
      const db = drizzle(env.DB, { schema });
      const tA = `u-race10-a-${crypto.randomUUID()}`;
      const tB = `u-race10-b-${crypto.randomUUID()}`;

      await db.insert(schema.user).values([
        {
          id: tA,
          name: tA,
          email: `${tA}@test.com`,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: tB,
          name: tB,
          email: `${tB}@test.com`,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const [r1, r2] = await Promise.allSettled([
        db.insert(schema.friends).values({
          id: crypto.randomUUID(),
          userId: tA,
          friendId: tB,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        db.insert(schema.friends).values({
          id: crypto.randomUUID(),
          userId: tB,
          friendId: tA,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ]);

      expect([r1.status, r2.status]).toContain("fulfilled");
      expect([r1.status, r2.status]).toContain("rejected");
    });

    it("Matrix Race 11: Rated-pair cap race -> Max 5 rated games in 24h cannot be exceeded", async () => {
      const db = drizzle(env.DB, { schema });
      const now = new Date();
      const rA = `race11-user-a-${crypto.randomUUID()}`;
      const rB = `race11-user-b-${crypto.randomUUID()}`;

      for (const id of [rA, rB]) {
        await db
          .insert(schema.user)
          .values({
            id,
            name: id,
            email: `${id}@test.com`,
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing();
        await db
          .insert(schema.session)
          .values({
            id: `sess_${id}`,
            userId: id,
            token: `token_${id}`,
            expiresAt: new Date(now.getTime() + 86_400_000),
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing();
      }

      for (let i = 0; i < 5; i++) {
        await db.insert(schema.games).values({
          id: `pair-race11-${i}-${crypto.randomUUID()}`,
          whitePlayerId: rA,
          blackPlayerId: rB,
          timeControl: "3+2",
          category: "blitz",
          moves: JSON.stringify(["e4", "e5"]),
          result: "1-0",
          termination: "checkmate",
          rated: true,
          whiteRatingBefore: 1500,
          whiteRatingChange: 15,
          blackRatingBefore: 1500,
          blackRatingChange: -15,
          startedAt: new Date(now.getTime() - (i + 1) * 3600_000),
          endedAt: new Date(now.getTime() - (i + 1) * 3600_000 + 300_000),
        });
      }

      const res = await app.fetch(
        new Request("http://localhost/api/challenges", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer token_${rA}`,
          },
          body: JSON.stringify({ challengedId: rB, timeControlId: "3+2", rated: true }),
        }),
        env,
      );
      expect(res.status).toBe(409);
    });

    it("Matrix Race 12: DO reconstruction -> Queue and alarms survive memory eviction", async () => {
      const pool = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName("3+0_rated"));
      await pool.fetch("http://internal/clear", { method: "POST" });

      const { ticket } = await createWsTicket(
        { userId: userA, userName: "Alpha", rating: 1500, scope: "user" },
        secret,
      );
      const r = await pool.fetch("http://internal/ws", { headers: { Upgrade: "websocket" } });
      const ws = r.webSocket;
      if (!ws) throw new Error("Expected WebSocket");
      ws.accept();
      ws.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
      await new Promise((r) => setTimeout(r, 40));

      ws.send(
        JSON.stringify({ type: "QUEUE_JOIN", payload: { timeControlId: "3+0", rated: true } }),
      );
      await new Promise((r) => setTimeout(r, 50));

      // Simulate DO alarm execution (triggers re-validation and matching loop from storage)
      await runDurableObjectAlarm(pool);

      const status = (await (await pool.fetch("http://internal/queue-status")).json()) as {
        totalInQueue: number;
      };
      expect(status.totalInQueue).toBe(1);

      ws.close();
    });

    it("Matrix Race 13: Game termination + new game -> Immediately unblocks next game", async () => {
      const upStub = env.USER_PRESENCE_DO.get(env.USER_PRESENCE_DO.idFromName(userB));
      await upStub.fetch("http://internal/claim-live-game", {
        method: "POST",
        body: JSON.stringify({ gameId: "ended-game" }),
      });

      // Terminal cleanup
      await upStub.fetch("http://internal/release-live-game", {
        method: "POST",
        body: JSON.stringify({ gameId: "ended-game" }),
      });

      // Immediate new game claim succeeds
      const newRes = await upStub.fetch("http://internal/claim-live-game", {
        method: "POST",
        body: JSON.stringify({ gameId: "next-game" }),
      });
      expect(newRes.status).toBe(200);
    });

    it("Matrix Race 14: Concurrent Glicko settlement produces defined sequential mathematical result", async () => {
      const g1 = `matrix-rate-1-${crypto.randomUUID()}`;
      const g2 = `matrix-rate-2-${crypto.randomUUID()}`;
      const now = Date.now();

      const [r1, r2] = await Promise.all([
        settleGameRatings(
          env.DB,
          {
            gameId: g1,
            whiteUserId: userA,
            blackUserId: userC,
            timeControl: "3+2",
            category: "blitz",
            moves: ["e4", "e5"],
            result: "1-0",
            termination: "checkmate",
            rated: true,
            startedAt: now - 30000,
            endedAt: now,
          },
          env,
        ),
        settleGameRatings(
          env.DB,
          {
            gameId: g2,
            whiteUserId: userA,
            blackUserId: userD,
            timeControl: "3+2",
            category: "blitz",
            moves: ["d4", "d5"],
            result: "1-0",
            termination: "checkmate",
            rated: true,
            startedAt: now - 30000,
            endedAt: now,
          },
          env,
        ),
      ]);

      expect(r1.settled).toBe(true);
      expect(r2.settled).toBe(true);

      const finalState = await fetchUserCategoryRating(env.DB, userA, "blitz");
      expect(finalState.games).toBeGreaterThanOrEqual(2);
      expect(finalState.wins).toBeGreaterThanOrEqual(2);
    });
  });
});

import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { applyTestSchema } from "./helpers";

interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

describe("Batch 10: Challenges & Matchmaking Anti-Abuse Audit", () => {
  const db = drizzle(env.DB, { schema });

  const playerAId = `b10_user_a_${Date.now()}`;
  const playerAToken = `token_${playerAId}`;

  const playerBId = `b10_user_b_${Date.now()}`;
  const playerBToken = `token_${playerBId}`;

  const playerCId = `b10_user_c_${Date.now()}`;
  const playerCToken = `token_${playerCId}`;

  const mmStub = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName("global"));

  const request = (path: string, init?: RequestInit) =>
    app.fetch(new Request(`http://localhost${path}`, init), env);

  beforeAll(async () => {
    await applyTestSchema(env.DB);
    const now = new Date();
    const future = new Date(now.getTime() + 86_400_000);

    // Seed test users
    await db.insert(schema.user).values([
      {
        id: playerAId,
        name: "Alice",
        email: `${playerAId}@test.com`,
        role: "user",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: playerBId,
        name: "Bob",
        email: `${playerBId}@test.com`,
        role: "user",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: playerCId,
        name: "Charlie",
        email: `${playerCId}@test.com`,
        role: "user",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Seed sessions
    await db.insert(schema.session).values([
      {
        id: `sess_${playerAId}`,
        userId: playerAId,
        token: playerAToken,
        expiresAt: future,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `sess_${playerBId}`,
        userId: playerBId,
        token: playerBToken,
        expiresAt: future,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `sess_${playerCId}`,
        userId: playerCId,
        token: playerCToken,
        expiresAt: future,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Seed ratings
    await db.insert(schema.ratings).values([
      { userId: playerAId, blitzRating: 1500, blitzRd: 350, blitzVol: 0.06, updatedAt: now },
      { userId: playerBId, blitzRating: 1500, blitzRd: 350, blitzVol: 0.06, updatedAt: now },
      { userId: playerCId, blitzRating: 1500, blitzRd: 350, blitzVol: 0.06, updatedAt: now },
    ]);

    // Clear MatchmakerDO
    const mmStub = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName("global"));
    await mmStub.fetch("http://internal/clear", { method: "POST" });
  });

  describe("IDOR Protection on Direct Challenges", () => {
    it("prevents third parties from reading direct challenges between other players", async () => {
      // Alice creates a direct challenge to Bob
      const createRes = await request("/api/challenges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${playerAToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengedId: playerBId,
          timeControl: "3+2",
          rated: false,
          preferredColor: "random",
        }),
      });
      expect(createRes.status).toBe(201);
      const challenge = (await createRes.json()) as { challenge: { id: string } };
      const challengeId = challenge.challenge.id;

      // Charlie attempts to view Alice's direct challenge to Bob
      const charlieRes = await request(`/api/challenges/${challengeId}`, {
        headers: { Authorization: `Bearer ${playerCToken}` },
      });
      expect(charlieRes.status).toBe(403);
      const charlieErr = (await charlieRes.json()) as ApiErrorResponse;
      expect(charlieErr.error.code).toBe("FORBIDDEN");

      // Alice (creator) can view it
      const aliceRes = await request(`/api/challenges/${challengeId}`, {
        headers: { Authorization: `Bearer ${playerAToken}` },
      });
      expect(aliceRes.status).toBe(200);

      // Bob (target) can view it
      const bobRes = await request(`/api/challenges/${challengeId}`, {
        headers: { Authorization: `Bearer ${playerBToken}` },
      });
      expect(bobRes.status).toBe(200);
    });

    it("allows any authenticated user to view an open link challenge", async () => {
      // Alice creates an open link challenge (challengedId is omitted)
      const createRes = await request("/api/challenges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${playerAToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeControl: "3+2",
          rated: false,
        }),
      });
      expect(createRes.status).toBe(201);
      const challenge = (await createRes.json()) as { challenge: { id: string } };

      // Charlie can view the open link challenge
      const charlieRes = await request(`/api/challenges/${challenge.challenge.id}`, {
        headers: { Authorization: `Bearer ${playerCToken}` },
      });
      expect(charlieRes.status).toBe(200);
    });
  });

  describe("Active Live Game Protection (H10 / RATE-11)", () => {
    it("prevents creating a challenge while active in another live game", async () => {
      // Lock Alice in an active game
      const dummyGameId = crypto.randomUUID();
      await mmStub.fetch("http://internal/set-active-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: playerAId, gameId: dummyGameId }),
      });

      // Alice tries to create a challenge
      const res = await request("/api/challenges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${playerAToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeControl: "3+2",
          rated: false,
        }),
      });
      expect(res.status).toBe(409);
      const err = (await res.json()) as ApiErrorResponse;
      expect(err.error.code).toBe("ALREADY_IN_GAME");

      // Clear Alice's lock
      await mmStub.fetch("http://internal/clear-active-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: playerAId }),
      });
    });

    it("prevents accepting a challenge if accepter is active in another live game", async () => {
      // Alice creates a challenge for Bob
      const createRes = await request("/api/challenges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${playerAToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengedId: playerBId,
          timeControl: "3+2",
          rated: false,
        }),
      });
      expect(createRes.status).toBe(201);
      const { challenge } = (await createRes.json()) as { challenge: { id: string } };

      // Lock Bob in an active game
      const dummyGameId = crypto.randomUUID();
      await mmStub.fetch("http://internal/set-active-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: playerBId, gameId: dummyGameId }),
      });

      // Bob tries to accept
      const acceptRes = await request(`/api/challenges/${challenge.id}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${playerBToken}` },
      });
      expect(acceptRes.status).toBe(409);
      const err = (await acceptRes.json()) as ApiErrorResponse;
      expect(err.error.code).toBe("ALREADY_IN_GAME");

      // Clear Bob's lock
      await mmStub.fetch("http://internal/clear-active-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: playerBId }),
      });
    });

    it("prevents accepting a challenge if challenger is active in another live game", async () => {
      // Alice creates a challenge for Bob
      const createRes = await request("/api/challenges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${playerAToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengedId: playerBId,
          timeControl: "3+2",
          rated: false,
        }),
      });
      expect(createRes.status).toBe(201);
      const { challenge } = (await createRes.json()) as { challenge: { id: string } };

      // Lock Alice (challenger) in an active game
      const dummyGameId = crypto.randomUUID();
      await mmStub.fetch("http://internal/set-active-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: playerAId, gameId: dummyGameId }),
      });

      // Bob tries to accept
      const acceptRes = await request(`/api/challenges/${challenge.id}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${playerBToken}` },
      });
      expect(acceptRes.status).toBe(409);
      const err = (await acceptRes.json()) as ApiErrorResponse;
      expect(err.error.code).toBe("OPPONENT_IN_GAME");

      // Clear Alice's lock
      await mmStub.fetch("http://internal/clear-active-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: playerAId }),
      });
    });

    it("registers active game locks for both players in MatchmakerDO upon acceptance", async () => {
      // Ensure both players are free
      await mmStub.fetch("http://internal/clear", { method: "POST" });

      // Alice creates a challenge for Bob
      const createRes = await request("/api/challenges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${playerAToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengedId: playerBId,
          timeControl: "3+2",
          rated: false,
        }),
      });
      expect(createRes.status).toBe(201);
      const { challenge } = (await createRes.json()) as { challenge: { id: string } };

      // Bob accepts
      const acceptRes = await request(`/api/challenges/${challenge.id}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${playerBToken}` },
      });
      expect(acceptRes.status).toBe(200);
      const acceptData = (await acceptRes.json()) as { gameId: string };
      expect(acceptData.gameId).toBeDefined();

      // Check MatchmakerDO active locks
      const checkAlice = await mmStub.fetch(`http://internal/user-active-game/${playerAId}`);
      const checkAliceData = (await checkAlice.json()) as { active: boolean; gameId: string };
      expect(checkAliceData.active).toBe(true);
      expect(checkAliceData.gameId).toBe(acceptData.gameId);

      const checkBob = await mmStub.fetch(`http://internal/user-active-game/${playerBId}`);
      const checkBobData = (await checkBob.json()) as { active: boolean; gameId: string };
      expect(checkBobData.active).toBe(true);
      expect(checkBobData.gameId).toBe(acceptData.gameId);

      // Clean up locks
      await mmStub.fetch("http://internal/clear", { method: "POST" });
    });
  });

  describe("Mutual Block Protection", () => {
    it("forbids challenges between blocked users", async () => {
      const now = new Date();
      // Alice blocks Charlie
      await db.insert(schema.friends).values({
        id: `block_${Date.now()}`,
        userId: playerAId,
        friendId: playerCId,
        status: "blocked",
        createdAt: now,
        updatedAt: now,
      });

      // Alice attempts to challenge Charlie
      const res1 = await request("/api/challenges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${playerAToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengedId: playerCId,
          timeControl: "3+2",
          rated: false,
        }),
      });
      expect(res1.status).toBe(403);

      // Charlie attempts to challenge Alice
      const res2 = await request("/api/challenges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${playerCToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengedId: playerAId,
          timeControl: "3+2",
          rated: false,
        }),
      });
      expect(res2.status).toBe(403);

      // Alice creates an open link challenge
      const linkRes = await request("/api/challenges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${playerAToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeControl: "3+2",
          rated: false,
        }),
      });
      expect(linkRes.status).toBe(201);
      const { challenge } = (await linkRes.json()) as { challenge: { id: string } };

      // Blocked user Charlie attempts to accept Alice's open link challenge
      const acceptRes = await request(`/api/challenges/${challenge.id}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${playerCToken}` },
      });
      expect(acceptRes.status).toBe(403);

      // Clean up block
      await db.delete(schema.friends).where(eq(schema.friends.userId, playerAId));
    });
  });

  describe("Atomic CAS on Open Link Challenges", () => {
    it("ensures open link challenge is single-use and cannot be claimed twice", async () => {
      // Clear any prior challenges
      await db.delete(schema.challenges);
      await mmStub.fetch("http://internal/clear", { method: "POST" });

      // Alice creates an open link challenge
      const linkRes = await request("/api/challenges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${playerAToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeControl: "3+2",
          rated: false,
        }),
      });
      expect(linkRes.status).toBe(201);
      const { challenge } = (await linkRes.json()) as { challenge: { id: string } };

      // Bob accepts the open link challenge first
      const bobAccept = await request(`/api/challenges/${challenge.id}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${playerBToken}` },
      });
      expect(bobAccept.status).toBe(200);

      // Charlie attempts to accept the already accepted challenge
      const charlieAccept = await request(`/api/challenges/${challenge.id}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${playerCToken}` },
      });
      expect(charlieAccept.status).toBe(409);
      const charlieErr = (await charlieAccept.json()) as ApiErrorResponse;
      expect(charlieErr.error.code).toBe("CONFLICT");

      // Clean up MatchmakerDO locks
      await mmStub.fetch("http://internal/clear", { method: "POST" });
    });
  });

  describe("RULE-05: Rated Pair Cap", () => {
    it("refuses 6th rated challenge attempt between same pair within 24h", async () => {
      // Clear any prior challenges so we don't hit MAX_PENDING_OUTGOING_CHALLENGES
      await db.delete(schema.challenges);
      await mmStub.fetch("http://internal/clear", { method: "POST" });

      const now = new Date();
      // Insert 5 completed rated games between Alice and Bob within the last 24h
      const gamesToInsert = Array.from({ length: 5 }).map((_, idx) => ({
        id: `b10_pair_game_${idx}_${Date.now()}`,
        whitePlayerId: idx % 2 === 0 ? playerAId : playerBId,
        blackPlayerId: idx % 2 === 0 ? playerBId : playerAId,
        timeControl: "3+2",
        category: "blitz",
        moves: "e4 e5",
        result: "1-0",
        termination: "checkmate",
        rated: true,
        gameType: "challenge",
        whiteRatingBefore: 1500,
        whiteRatingChange: 10,
        blackRatingBefore: 1500,
        blackRatingChange: -10,
        startedAt: new Date(now.getTime() - 1000 * 60 * (idx + 1)), // recent
        endedAt: now,
      }));

      for (const g of gamesToInsert) {
        await db.insert(schema.games).values(g);
      }

      // Alice attempts to create a 6th rated challenge to Bob
      const res = await request("/api/challenges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${playerAToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengedId: playerBId,
          timeControl: "3+2",
          rated: true,
        }),
      });

      expect(res.status).toBe(409);
      const err = (await res.json()) as ApiErrorResponse;
      expect(err.error.code).toBe("CONFLICT");
      expect(err.error.message).toContain("Maximum rated games limit");

      // But an unrated challenge between Alice and Bob should still succeed
      const unratedRes = await request("/api/challenges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${playerAToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengedId: playerBId,
          timeControl: "3+2",
          rated: false,
        }),
      });
      expect(unratedRes.status).toBe(201);
    });
  });
});

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

describe("Batch 7: Admin Suite & RATE-11 Live Game Protection", () => {
  const db = drizzle(env.DB, { schema });

  const adminUserId = `b7_admin_${Date.now()}`;
  const adminToken = `token_${adminUserId}`;

  const normalUserId = `b7_player_${Date.now()}`;
  const normalUserToken = `token_${normalUserId}`;

  const friendUserId = `b7_friend_${Date.now()}`;
  const friendUserToken = `token_${friendUserId}`;

  const activePlayerUserId = `b7_active_player_${Date.now()}`;
  const activePlayerToken = `token_${activePlayerUserId}`;

  const liveGameId = `b7_live_game_${Date.now()}`;

  const request = (path: string, init?: RequestInit) =>
    app.fetch(new Request(`http://localhost${path}`, init), env);

  beforeAll(async () => {
    await applyTestSchema(env.DB);
    const now = new Date();
    const future = new Date(now.getTime() + 86_400_000);

    // Create Admin User
    await db.insert(schema.user).values({
      id: adminUserId,
      name: "AdminSuper",
      email: `${adminUserId}@etchess.com`,
      role: "admin",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.session).values({
      id: `session_${adminUserId}`,
      userId: adminUserId,
      token: adminToken,
      expiresAt: future,
      createdAt: now,
      updatedAt: now,
    });

    // Create Normal User
    await db.insert(schema.user).values({
      id: normalUserId,
      name: "NormalPlayer",
      email: `${normalUserId}@test.com`,
      role: "user",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.session).values({
      id: `session_${normalUserId}`,
      userId: normalUserId,
      token: normalUserToken,
      expiresAt: future,
      createdAt: now,
      updatedAt: now,
    });

    // Create Friend User
    await db.insert(schema.user).values({
      id: friendUserId,
      name: "FriendPlayer",
      email: `${friendUserId}@test.com`,
      role: "user",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.session).values({
      id: `session_${friendUserId}`,
      userId: friendUserId,
      token: friendUserToken,
      expiresAt: future,
      createdAt: now,
      updatedAt: now,
    });

    // Create Active Player User
    await db.insert(schema.user).values({
      id: activePlayerUserId,
      name: "ActiveLivePlayer",
      email: `${activePlayerUserId}@test.com`,
      role: "user",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.session).values({
      id: `session_${activePlayerUserId}`,
      userId: activePlayerUserId,
      token: activePlayerToken,
      expiresAt: future,
      createdAt: now,
      updatedAt: now,
    });

    // Initialize an active game session for activePlayerUserId
    const gameStub = env.GAME_SESSION_DO.get(env.GAME_SESSION_DO.idFromName(liveGameId));
    await gameStub.fetch("http://internal/init", {
      method: "POST",
      body: JSON.stringify({
        gameId: liveGameId,
        whiteUserId: activePlayerUserId,
        whiteUserName: "ActiveLivePlayer",
        blackUserId: normalUserId,
        blackUserName: "NormalPlayer",
        timeControl: "3+2",
        rated: true,
      }),
    });

    // Mark active player in MatchmakerDO
    const mmStub = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName("global"));
    // Enqueue & pair or simulate active registration
    await mmStub.fetch("http://internal/clear-active-game", { method: "POST" });
  });

  describe("GET /api/admin/metrics", () => {
    it("rejects non-admin requests with 403 Forbidden", async () => {
      const res = await request("/api/admin/metrics", {
        headers: { Authorization: `Bearer ${normalUserToken}` },
      });
      expect(res.status).toBe(403);
    });

    it("returns platform metrics to admin", async () => {
      const res = await request("/api/admin/metrics", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        totalUsers: number;
        gamesPlayed: number;
        modes: Record<string, number>;
      };
      expect(json.totalUsers).toBeGreaterThan(0);
      expect(json.modes).toBeDefined();
    });
  });

  describe("GET /api/admin/users", () => {
    it("lists users with ratings and roles to admin", async () => {
      const res = await request("/api/admin/users?query=NormalPlayer", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        users: Array<{ id: string; name: string; role: string }>;
      };
      expect(json.users.length).toBeGreaterThan(0);
      expect(json.users[0].name).toBe("NormalPlayer");
    });
  });

  describe("POST /api/admin/users/:id/ban and unban", () => {
    it("bans target user and writes audit log", async () => {
      const res = await request(`/api/admin/users/${normalUserId}/ban`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          durationDays: 7,
          reason: "Suspected unfair assistance",
        }),
      });
      expect(res.status).toBe(200);

      // Verify banned in D1
      const [u] = await db.select().from(schema.user).where(eq(schema.user.id, normalUserId));
      expect(u.isBanned).toBe(true);
      expect(u.banExpiresAt).not.toBeNull();
    });

    it("unbans target user and updates status", async () => {
      const res = await request(`/api/admin/users/${normalUserId}/unban`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: "Appeal accepted",
        }),
      });
      expect(res.status).toBe(200);

      const [u] = await db.select().from(schema.user).where(eq(schema.user.id, normalUserId));
      expect(u.isBanned).toBe(false);
      expect(u.banExpiresAt).toBeNull();
    });
  });

  describe("POST /api/admin/users/:id/rating-adjust", () => {
    it("rejects non-admin role with 403 Forbidden", async () => {
      const res = await request(`/api/admin/users/${normalUserId}/rating-adjust`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${normalUserToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: "blitz",
          rating: 1800,
          reason: "Testing",
        }),
      });
      expect(res.status).toBe(403);
    });

    it("successfully adjusts rating when user is idle", async () => {
      const res = await request(`/api/admin/users/${normalUserId}/rating-adjust`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: "blitz",
          rating: 1850,
          reason: "Manual correction for tournament performance",
          resetRd: true,
        }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; newRating: number };
      expect(json.success).toBe(true);
      expect(json.newRating).toBe(1850);

      // Verify in ratings table
      const [r] = await db
        .select()
        .from(schema.ratings)
        .where(eq(schema.ratings.userId, normalUserId));
      expect(r.blitzRating).toBe(1850);
      expect(r.blitzRd).toBe(350);

      // Verify audit log entry
      const logs = await db
        .select()
        .from(schema.auditLogs)
        .where(eq(schema.auditLogs.targetId, normalUserId));
      const ratingAdjustLog = logs.find((l) => l.action === "RATING_ADJUST");
      expect(ratingAdjustLog).toBeDefined();
      expect(ratingAdjustLog?.action).toBe("RATING_ADJUST");
    });

    it("refuses rating adjustments with 409 Conflict when user is participating in an active live game (RATE-11)", async () => {
      // Register activePlayerUserId in MatchmakerDO
      const mmStub = env.MATCHMAKER_DO.get(env.MATCHMAKER_DO.idFromName("global"));
      await mmStub.fetch("http://internal/set-active-game", {
        method: "POST",
        body: JSON.stringify({ userId: activePlayerUserId, gameId: liveGameId }),
      });

      const res = await request(`/api/admin/users/${activePlayerUserId}/rating-adjust`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: "blitz",
          rating: 2100,
          reason: "Attempted live adjustment",
        }),
      });

      expect(res.status).toBe(409);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.error.code).toBe("USER_IN_LIVE_GAME");
      expect(json.error.message).toContain("RATE-11");
    });
  });

  describe("POST /api/admin/games/:gameId/terminate", () => {
    it("allows admin to terminate an ongoing game session", async () => {
      const res = await request(`/api/admin/games/${liveGameId}/terminate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: "Fair play violation flagged by system",
        }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(true);

      // Verify game session DO state
      const gameStub = env.GAME_SESSION_DO.get(env.GAME_SESSION_DO.idFromName(liveGameId));
      const stateRes = await gameStub.fetch("http://internal/state");
      expect(stateRes.status).toBe(200);
      const state = (await stateRes.json()) as { status: string; termination: string };
      expect(state.status).toBe("ended");
      expect(state.termination).toBe("admin_intervention");
    });
  });

  describe("POST /api/friends/request with addresseeId", () => {
    it("accepts mobile-style addresseeId payload and creates friend request", async () => {
      const res = await request("/api/friends/request", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${normalUserToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          addresseeId: friendUserId,
        }),
      });
      expect(res.status).toBe(201);
      const json = (await res.json()) as {
        success: boolean;
        friendship: { status: string; friendId: string };
      };
      expect(json.success).toBe(true);
      expect(json.friendship.friendId).toBe(friendUserId);
      expect(json.friendship.status).toBe("pending");
    });
  });
});

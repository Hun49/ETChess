import { env } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { applyTestSchema } from "./helpers";

describe("Phase 7 — Game History, PGN Export, and Admin Moderation", () => {
  const adminToken = "token-admin-user";
  const modToken = "token-mod-user";
  const player1Token = "token-player-1";
  const player2Token = "token-player-2";

  const adminUserId = "p7-admin-1";
  const modUserId = "p7-mod-1";
  const p1UserId = "p7-player-1";
  const p2UserId = "p7-player-2";

  let testGameId: string;

  beforeAll(async () => {
    await applyTestSchema(env.DB);

    const db = drizzle(env.DB, { schema });
    const now = new Date();
    const future = new Date(now.getTime() + 86400_000);

    // 1. Create users with different roles
    await db.insert(schema.user).values([
      {
        id: adminUserId,
        name: "Admin Alice",
        email: "admin@etchess.com",
        emailVerified: true,
        role: "admin",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: modUserId,
        name: "Mod Max",
        email: "mod@etchess.com",
        emailVerified: true,
        role: "moderator",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: p1UserId,
        name: "Player One",
        email: "p1@etchess.com",
        emailVerified: true,
        role: "user",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: p2UserId,
        name: "Player Two",
        email: "p2@etchess.com",
        emailVerified: true,
        role: "user",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // 2. Create valid sessions for Bearer auth
    await db.insert(schema.session).values([
      {
        id: "sess-admin",
        token: adminToken,
        userId: adminUserId,
        expiresAt: future,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "sess-mod",
        token: modToken,
        userId: modUserId,
        expiresAt: future,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "sess-p1",
        token: player1Token,
        userId: p1UserId,
        expiresAt: future,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "sess-p2",
        token: player2Token,
        userId: p2UserId,
        expiresAt: future,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // 3. Seed some historical games
    testGameId = `game-p7-${crypto.randomUUID()}`;
    await db.insert(schema.games).values([
      {
        id: testGameId,
        whitePlayerId: p1UserId,
        blackPlayerId: p2UserId,
        timeControl: "3+2",
        category: "blitz",
        moves: JSON.stringify(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]),
        result: "1-0",
        termination: "checkmate",
        whiteRatingBefore: 1600,
        whiteRatingChange: 12,
        blackRatingBefore: 1580,
        blackRatingChange: -12,
        startedAt: new Date(now.getTime() - 10_000),
        endedAt: now,
      },
      {
        id: `game-rapid-${crypto.randomUUID()}`,
        whitePlayerId: p2UserId,
        blackPlayerId: p1UserId,
        timeControl: "10+0",
        category: "rapid",
        moves: JSON.stringify(["d4", "d5", "c4"]),
        result: "1/2-1/2",
        termination: "draw_by_agreement",
        whiteRatingBefore: 1550,
        whiteRatingChange: 0,
        blackRatingBefore: 1550,
        blackRatingChange: 0,
        startedAt: new Date(now.getTime() - 20_000),
        endedAt: new Date(now.getTime() - 15_000),
      },
    ]);
  });

  describe("Game History & Details Endpoints", () => {
    it("lists games with hydrated player metadata and parsed moves", async () => {
      const res = await app.fetch(new Request("http://localhost/api/games"), env);
      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        games: Array<{
          id: string;
          moves: string[];
          whitePlayer: { id: string; name: string } | null;
          blackPlayer: { id: string; name: string } | null;
        }>;
      };
      expect(data.games.length).toBeGreaterThanOrEqual(2);

      const target = data.games.find((g) => g.id === testGameId);
      expect(target).toBeDefined();
      if (target) {
        expect(target.whitePlayer?.name).toBe("Player One");
        expect(target.blackPlayer?.name).toBe("Player Two");
        expect(target.moves).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]);
      }
    });

    it("filters games by category and userId", async () => {
      // Filter by category: rapid
      const rapidRes = await app.fetch(
        new Request("http://localhost/api/games?category=rapid"),
        env,
      );
      expect(rapidRes.status).toBe(200);
      const rapidData = (await rapidRes.json()) as { games: Array<{ category: string }> };
      expect(rapidData.games.every((g) => g.category === "rapid")).toBe(true);

      // Filter by user convenience route
      const userRes = await app.fetch(
        new Request(`http://localhost/api/games/user/${p1UserId}`),
        env,
      );
      expect(userRes.status).toBe(200);
      const userData = (await userRes.json()) as {
        games: Array<{ whitePlayerId: string; blackPlayerId: string }>;
      };
      expect(userData.games.length).toBeGreaterThanOrEqual(2);
      expect(
        userData.games.every((g) => g.whitePlayerId === p1UserId || g.blackPlayerId === p1UserId),
      ).toBe(true);
    });

    it("retrieves game details by ID and handles 404", async () => {
      const res = await app.fetch(new Request(`http://localhost/api/games/${testGameId}`), env);
      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        game: { id: string; result: string; moves: string[]; whitePlayer: { name: string } };
      };
      expect(data.game.id).toBe(testGameId);
      expect(data.game.result).toBe("1-0");
      expect(data.game.whitePlayer.name).toBe("Player One");

      const notFoundRes = await app.fetch(
        new Request("http://localhost/api/games/non-existent-game-id"),
        env,
      );
      expect(notFoundRes.status).toBe(404);
      const err = (await notFoundRes.json()) as { error: { code: string; message: string } };
      expect(err.error.code).toBe("NOT_FOUND");
    });

    it("exports game PGN with standard 7-tag roster and moves", async () => {
      const res = await app.fetch(new Request(`http://localhost/api/games/${testGameId}/pgn`), env);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/x-chess-pgn");
      expect(res.headers.get("content-disposition")).toContain(`etchess-${testGameId}.pgn`);

      const pgnText = await res.text();
      expect(pgnText).toContain('[Event "ET Chess Online Match"]');
      expect(pgnText).toContain('[White "Player One"]');
      expect(pgnText).toContain('[Black "Player Two"]');
      expect(pgnText).toContain('[Result "1-0"]');
      expect(pgnText).toContain('[WhiteElo "1600"]');
      expect(pgnText).toContain('[BlackElo "1580"]');
      expect(pgnText).toContain('[TimeControl "3+2"]');
      expect(pgnText).toContain("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0");
    });
  });

  describe("User Reporting Endpoint (POST /api/reports)", () => {
    it("rejects unauthenticated requests", async () => {
      const res = await app.fetch(
        new Request("http://localhost/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportedId: p2UserId,
            reason: "cheating",
          }),
        }),
        env,
      );
      expect(res.status).toBe(401);
    });

    it("prevents self-reporting", async () => {
      const res = await app.fetch(
        new Request("http://localhost/api/reports", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${player1Token}`,
          },
          body: JSON.stringify({
            reportedId: p1UserId,
            reason: "harassment",
          }),
        }),
        env,
      );
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: { message: string } };
      expect(data.error.message).toContain("Cannot report yourself");
    });

    it("creates a report successfully and prevents duplicate pending reports", async () => {
      const res = await app.fetch(
        new Request("http://localhost/api/reports", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${player1Token}`,
          },
          body: JSON.stringify({
            reportedId: p2UserId,
            gameId: testGameId,
            reason: "cheating",
            details: "Used engine assistance in blitz endgame",
          }),
        }),
        env,
      );
      expect(res.status).toBe(201);
      const data = (await res.json()) as {
        report: { id: string; status: string; reason: string; reporterId: string };
      };
      expect(data.report.status).toBe("pending");
      expect(data.report.reason).toBe("cheating");
      expect(data.report.reporterId).toBe(p1UserId);

      // Duplicate report attempt
      const dupRes = await app.fetch(
        new Request("http://localhost/api/reports", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${player1Token}`,
          },
          body: JSON.stringify({
            reportedId: p2UserId,
            reason: "harassment",
          }),
        }),
        env,
      );
      expect(dupRes.status).toBe(409);
      const dupData = (await dupRes.json()) as { error: { message: string } };
      expect(dupData.error.message).toContain("pending report for this user already exists");
    });
  });

  describe("Admin Moderation & Ban Management", () => {
    let reportId: string;

    it("enforces role-based access control (RBAC)", async () => {
      // Ordinary player cannot access admin routes
      const playerRes = await app.fetch(
        new Request("http://localhost/api/admin/reports", {
          headers: { Authorization: `Bearer ${player1Token}` },
        }),
        env,
      );
      expect(playerRes.status).toBe(403);

      // Moderator can list reports
      const modRes = await app.fetch(
        new Request("http://localhost/api/admin/reports", {
          headers: { Authorization: `Bearer ${modToken}` },
        }),
        env,
      );
      expect(modRes.status).toBe(200);

      // But moderator CANNOT ban users (admin only)
      const modBanRes = await app.fetch(
        new Request("http://localhost/api/admin/ban", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${modToken}`,
          },
          body: JSON.stringify({
            userId: p2UserId,
            reason: "Suspicious behavior",
          }),
        }),
        env,
      );
      expect(modBanRes.status).toBe(403);
    });

    it("lists reports and resolves report with audit log", async () => {
      const reportsRes = await app.fetch(
        new Request("http://localhost/api/admin/reports?status=pending", {
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        env,
      );
      expect(reportsRes.status).toBe(200);
      const data = (await reportsRes.json()) as {
        reports: Array<{
          id: string;
          status: string;
          reporter: { name: string };
          reported: { name: string };
        }>;
      };
      expect(data.reports.length).toBeGreaterThanOrEqual(1);
      reportId = data.reports[0].id;
      expect(data.reports[0].reporter.name).toBe("Player One");
      expect(data.reports[0].reported.name).toBe("Player Two");

      // Resolve report
      const resolveRes = await app.fetch(
        new Request(`http://localhost/api/admin/reports/${reportId}/resolve`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            status: "resolved",
            notes: "Confirmed suspicious engine use",
          }),
        }),
        env,
      );
      expect(resolveRes.status).toBe(200);
    });

    it("bans user, enforces ban across API, and unbans user with audit logging", async () => {
      // 1. Admin bans Player Two for 7 days
      const banRes = await app.fetch(
        new Request("http://localhost/api/admin/ban", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            userId: p2UserId,
            durationDays: 7,
            reason: "Engine assistance verified",
          }),
        }),
        env,
      );
      expect(banRes.status).toBe(200);

      // 2. Banned user is immediately rejected on any authenticated route
      const bannedActionRes = await app.fetch(
        new Request("http://localhost/api/ws-ticket", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${player2Token}`,
          },
          body: JSON.stringify({ scope: "user" }),
        }),
        env,
      );
      expect(bannedActionRes.status).toBe(403);
      const banErr = (await bannedActionRes.json()) as { error: { code: string; message: string } };
      expect(banErr.error.code).toBe("FORBIDDEN");
      expect(banErr.error.message).toBe("Account is banned");

      // 3. Admin unbans Player Two
      const unbanRes = await app.fetch(
        new Request("http://localhost/api/admin/unban", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            userId: p2UserId,
            reason: "Appeal accepted upon review",
          }),
        }),
        env,
      );
      expect(unbanRes.status).toBe(200);

      // 4. Player Two can now authenticate again!
      const unbannedActionRes = await app.fetch(
        new Request("http://localhost/api/ws-ticket", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${player2Token}`,
          },
          body: JSON.stringify({ scope: "user" }),
        }),
        env,
      );
      expect(unbannedActionRes.status).toBe(200);

      // 5. Verify audit logs record all actions
      const logsRes = await app.fetch(
        new Request("http://localhost/api/admin/audit-logs", {
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        env,
      );
      expect(logsRes.status).toBe(200);
      const logsData = (await logsRes.json()) as {
        auditLogs: Array<{ action: string; targetId: string }>;
      };
      const actions = logsData.auditLogs.map((l) => l.action);
      expect(actions).toContain("REPORT_RESOLVED");
      expect(actions).toContain("BAN_USER");
      expect(actions).toContain("UNBAN_USER");
    });
  });
});

import { env } from "cloudflare:test";
import type { ClientGameFrame, ServerGameFrame } from "@etchess/realtime-protocol";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { getWsTicketSecret } from "../src/lib/secrets";
import { createWsTicket } from "../src/lib/wsTicket";
import { applyTestSchema } from "./helpers";

describe("Batch 5: Lifecycle, Protocol & Hygiene Audits (M5, M8, M9, M10, M11)", () => {
  const db = drizzle(env.DB, { schema });
  const secret = getWsTicketSecret(env);

  const challengerUserId = `b5_challenger_${Date.now()}`;
  const challengedUserId = `b5_challenged_${Date.now()}`;
  const blockedUserId = `b5_blocked_${Date.now()}`;
  const thirdPartyUserId = `b5_thirdparty_${Date.now()}`;
  const adminUserId = `b5_admin_${Date.now()}`;

  const challengerToken = `token_${challengerUserId}`;
  const challengedToken = `token_${challengedUserId}`;
  const blockedToken = `token_${blockedUserId}`;
  const thirdPartyToken = `token_${thirdPartyUserId}`;
  const adminToken = `token_${adminUserId}`;

  const request = (path: string, init?: RequestInit) =>
    app.fetch(new Request(`http://localhost${path}`, init), env);

  beforeAll(async () => {
    await applyTestSchema(env.DB);
    const now = new Date();
    const future = new Date(now.getTime() + 86_400_000);

    await db.insert(schema.user).values([
      {
        id: challengerUserId,
        name: "ChallengerUser",
        email: `${challengerUserId}@test.com`,
        role: "user",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: challengedUserId,
        name: "ChallengedUser",
        email: `${challengedUserId}@test.com`,
        role: "user",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: blockedUserId,
        name: "BlockedUser",
        email: `${blockedUserId}@test.com`,
        role: "user",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: thirdPartyUserId,
        name: "ThirdPartyUser",
        email: `${thirdPartyUserId}@test.com`,
        role: "user",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: adminUserId,
        name: "AdminAuditor",
        email: `${adminUserId}@test.com`,
        role: "admin",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await db.insert(schema.session).values([
      {
        id: `sess_${challengerUserId}`,
        token: challengerToken,
        userId: challengerUserId,
        expiresAt: future,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `sess_${challengedUserId}`,
        token: challengedToken,
        userId: challengedUserId,
        expiresAt: future,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `sess_${blockedUserId}`,
        token: blockedToken,
        userId: blockedUserId,
        expiresAt: future,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `sess_${thirdPartyUserId}`,
        token: thirdPartyToken,
        userId: thirdPartyUserId,
        expiresAt: future,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `sess_${adminUserId}`,
        token: adminToken,
        userId: adminUserId,
        expiresAt: future,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    for (const uid of [
      challengerUserId,
      challengedUserId,
      blockedUserId,
      thirdPartyUserId,
      adminUserId,
    ]) {
      await db.insert(schema.ratings).values({ userId: uid, updatedAt: now });
    }

    // Establish a block: challenger blocked blockedUserId
    await db.insert(schema.friends).values({
      id: crypto.randomUUID(),
      userId: challengerUserId,
      friendId: blockedUserId,
      status: "blocked",
      createdAt: now,
      updatedAt: now,
    });
  });

  describe("M11: Challenge Cancellation Endpoints", () => {
    it("rejects unauthenticated cancel request with 401", async () => {
      const res = await request("/api/challenges/test-id/cancel", {
        method: "POST",
      });
      expect(res.status).toBe(401);
    });

    it("rejects cancelling a non-existent challenge with 404", async () => {
      const res = await request("/api/challenges/non-existent-id/cancel", {
        method: "POST",
        headers: { Authorization: `Bearer ${challengerToken}` },
      });
      expect(res.status).toBe(404);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("rejects cancelling a challenge by a non-challenger with 403", async () => {
      // Create pending challenge
      const createRes = await request("/api/challenges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${challengerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengedId: challengedUserId,
          timeControlId: "3+2",
          rated: false,
        }),
      });
      expect(createRes.status).toBe(201);
      const createJson = (await createRes.json()) as { challenge: { id: string } };
      const challengeId = createJson.challenge.id;

      // Third party attempts cancel
      const cancelRes = await request(`/api/challenges/${challengeId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${thirdPartyToken}` },
      });
      expect(cancelRes.status).toBe(403);
      const cancelJson = (await cancelRes.json()) as { error: { code: string } };
      expect(cancelJson.error.code).toBe("FORBIDDEN");
    });

    it("allows challenger to cancel a pending challenge via POST /:id/cancel and sets status to canceled", async () => {
      const createRes = await request("/api/challenges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${challengerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengedId: challengedUserId,
          timeControlId: "3+2",
          rated: false,
        }),
      });
      const createJson = (await createRes.json()) as { challenge: { id: string } };
      const challengeId = createJson.challenge.id;

      const cancelRes = await request(`/api/challenges/${challengeId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${challengerToken}` },
      });
      expect(cancelRes.status).toBe(200);
      const cancelJson = (await cancelRes.json()) as { success: boolean; status: string };
      expect(cancelJson.success).toBe(true);
      expect(cancelJson.status).toBe("canceled");

      // Verify in D1
      const [row] = await db
        .select()
        .from(schema.challenges)
        .where(eq(schema.challenges.id, challengeId));
      expect(row?.status).toBe("canceled");

      // Cannot cancel again (no longer pending)
      const repeatCancel = await request(`/api/challenges/${challengeId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${challengerToken}` },
      });
      expect(repeatCancel.status).toBe(409);
    });

    it("supports DELETE /api/challenges/:id as alias to cancel", async () => {
      const createRes = await request("/api/challenges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${challengerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeControlId: "5+3",
          rated: false,
        }),
      });
      const createJson = (await createRes.json()) as { challenge: { id: string } };
      const challengeId = createJson.challenge.id;

      const deleteRes = await request(`/api/challenges/${challengeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${challengerToken}` },
      });
      expect(deleteRes.status).toBe(200);
      const deleteJson = (await deleteRes.json()) as { success: boolean; status: string };
      expect(deleteJson.status).toBe("canceled");
    });
  });

  describe("M11: Block Enforcement on Creation and Acceptance", () => {
    it("rejects challenge creation when challenger has blocked target user", async () => {
      const res = await request("/api/challenges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${challengerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengedId: blockedUserId,
          timeControlId: "3+2",
          rated: false,
        }),
      });
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: { code: string; message: string } };
      expect(json.error.code).toBe("FORBIDDEN");
      expect(json.error.message).toContain("blocked");
    });

    it("rejects challenge acceptance when a block exists between challenger and accepter", async () => {
      // Create open link challenge by challenger
      const createRes = await request("/api/challenges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${challengerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeControlId: "3+2",
          rated: false,
        }),
      });
      const createJson = (await createRes.json()) as { challenge: { id: string } };
      const challengeId = createJson.challenge.id;

      // Blocked user attempts to accept
      const acceptRes = await request(`/api/challenges/${challengeId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${blockedToken}` },
      });
      expect(acceptRes.status).toBe(403);
      const acceptJson = (await acceptRes.json()) as { error: { code: string; message: string } };
      expect(acceptJson.error.code).toBe("FORBIDDEN");
      expect(acceptJson.error.message).toContain("block");
    });
  });

  describe("M11: Atomic Compare-and-Set Concurrent Acceptance", () => {
    it("allows only one accepter when two concurrent accept requests arrive", async () => {
      // Create an open link challenge
      const createRes = await request("/api/challenges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${challengerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeControlId: "3+2",
          rated: false,
        }),
      });
      const createJson = (await createRes.json()) as { challenge: { id: string } };
      const challengeId = createJson.challenge.id;

      // Dispatch concurrent accept requests from challengedUser and thirdPartyUser
      const [res1, res2] = await Promise.all([
        request(`/api/challenges/${challengeId}/accept`, {
          method: "POST",
          headers: { Authorization: `Bearer ${challengedToken}` },
        }),
        request(`/api/challenges/${challengeId}/accept`, {
          method: "POST",
          headers: { Authorization: `Bearer ${thirdPartyToken}` },
        }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);
    });
  });

  describe("M10: Profile Input Validation", () => {
    it("rejects reserved impersonation usernames", async () => {
      const reserved = ["admin", "ADMIN", "moderator", "system", "official", "stockfish"];
      for (const name of reserved) {
        const res = await request("/api/users/me", {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${thirdPartyToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name }),
        });
        expect(res.status).toBe(400);
      }
    });

    it("rejects names with invalid characters (XSS/special chars)", async () => {
      const res = await request("/api/users/me", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${thirdPartyToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Player<script>" }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects non-http/https image URLs", async () => {
      const res = await request("/api/users/me", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${thirdPartyToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: "javascript:alert(1)" }),
      });
      expect(res.status).toBe(400);
    });

    it("accepts valid alphanumeric username and https image URL", async () => {
      const res = await request("/api/users/me", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${thirdPartyToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Valid_Grandmaster-99",
          image: "https://example.com/avatar.png",
        }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as { user: { name: string; image: string } };
      expect(json.user.name).toBe("Valid_Grandmaster-99");
      expect(json.user.image).toBe("https://example.com/avatar.png");
    });
  });

  describe("M9: Moderation Report Resolution Details Preservation", () => {
    it("preserves reporter details when moderator resolves report with notes", async () => {
      // 1. Submit report
      const originalDetails = "Opponent stalled the game for 5 minutes and insulted in chat";
      const submitRes = await request("/api/reports", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${challengerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportedId: challengedUserId,
          reason: "stalling",
          details: originalDetails,
        }),
      });
      expect(submitRes.status).toBe(201);
      const submitJson = (await submitRes.json()) as { report: { id: string } };
      const reportId = submitJson.report.id;

      // 2. Moderator resolves report with resolution notes
      const modNotes = "Warning issued to player for stalling behavior";
      const resolveRes = await request(`/api/admin/reports/${reportId}/resolve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "resolved",
          notes: modNotes,
        }),
      });
      expect(resolveRes.status).toBe(200);

      // 3. Verify in D1 that original details was NOT destroyed
      const [resolvedReport] = await db
        .select()
        .from(schema.reports)
        .where(eq(schema.reports.id, reportId));

      expect(resolvedReport?.details).toBe(originalDetails);
      expect(resolvedReport?.resolutionNotes).toBe(modNotes);
      expect(resolvedReport?.resolvedBy).toBe(adminUserId);
      expect(resolvedReport?.resolvedAt).toBeInstanceOf(Date);
      expect(resolvedReport?.status).toBe("resolved");
    });
  });

  describe("M5: Mandatory expectedPly Move Frame Sequence Enforcement", () => {
    it("rejects move frame with OUT_OF_SYNC when expectedPly is omitted or mismatched", async () => {
      const gameId = crypto.randomUUID();
      const whiteUserId = `m5_w_${Date.now()}`;
      const blackUserId = `m5_b_${Date.now()}`;
      const now = new Date();

      await db.insert(schema.user).values([
        {
          id: whiteUserId,
          name: "M5White",
          email: `${whiteUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: blackUserId,
          name: "M5Black",
          email: `${blackUserId}@test.com`,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(schema.ratings).values({ userId: whiteUserId, updatedAt: now });
      await db.insert(schema.ratings).values({ userId: blackUserId, updatedAt: now });

      const sessionDO = env.GAME_SESSION_DO.get(env.GAME_SESSION_DO.idFromName(gameId));
      await sessionDO.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          whiteUserId,
          whiteUserName: "M5White",
          whiteRating: 1500,
          blackUserId,
          blackUserName: "M5Black",
          blackRating: 1500,
          timeControl: "3+2",
          rated: true,
        }),
      });

      const whiteTicket = await createWsTicket(
        {
          userId: whiteUserId,
          userName: "M5White",
          rating: 1500,
          gameId,
          scope: "game",
          userRole: "user",
        },
        secret,
      );

      const wsRes = await app.fetch(
        new Request(`http://localhost/ws/game/${gameId}`, { headers: { Upgrade: "websocket" } }),
        env,
      );
      const clientWs = wsRes.webSocket;
      if (!clientWs) throw new Error("Expected WebSocket");
      clientWs.accept();

      const messages: ServerGameFrame[] = [];
      clientWs.addEventListener("message", (evt) => {
        messages.push(JSON.parse(evt.data as string));
      });

      clientWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: whiteTicket.ticket } }));
      await new Promise((r) => setTimeout(r, 100));

      // Attempt move with mismatched expectedPly (e.g. 5 instead of 0)
      clientWs.send(
        JSON.stringify({
          type: "MOVE_INTENT",
          payload: { from: "e2", to: "e4", expectedPly: 5 },
        }),
      );
      await new Promise((r) => setTimeout(r, 100));

      const rejected = messages.find(
        (m): m is Extract<ServerGameFrame, { type: "MOVE_REJECTED" }> => m.type === "MOVE_REJECTED",
      );
      expect(rejected).toBeDefined();
      expect(rejected?.payload.reason).toBe("OUT_OF_SYNC");
      expect(rejected?.payload.expectedPly).toBe(0);

      // Attempt valid move with expectedPly: 0
      clientWs.send(
        JSON.stringify({
          type: "MOVE_INTENT",
          payload: { from: "e2", to: "e4", expectedPly: 0 },
        }),
      );
      await new Promise((r) => setTimeout(r, 100));

      const accepted = messages.find((m) => m.type === "MOVE_ACCEPTED");
      expect(accepted).toBeDefined();

      // Attempt duplicate/replayed move frame with expectedPly: 0
      clientWs.send(
        JSON.stringify({
          type: "MOVE_INTENT",
          payload: { from: "e2", to: "e4", expectedPly: 0 },
        }),
      );
      await new Promise((r) => setTimeout(r, 100));

      const allRejections = messages.filter(
        (m): m is Extract<ServerGameFrame, { type: "MOVE_REJECTED" }> => m.type === "MOVE_REJECTED",
      );
      expect(allRejections.length).toBe(2);
      expect(allRejections[0]?.payload.reason).toBe("OUT_OF_SYNC");
      expect(allRejections[1]?.payload.reason).toBe("OUT_OF_TURN");

      clientWs.close();
    });
  });
});

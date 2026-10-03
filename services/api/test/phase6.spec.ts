import { env } from "cloudflare:test";
import type { ServerUserFrame } from "@etchess/realtime-protocol";
import { PRODUCT_RULES } from "@etchess/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { createWsTicket } from "../src/lib/wsTicket";
import { applyTestSchema } from "./helpers";

describe("Phase 6 — Friends & Challenges Integration", () => {
  const secret =
    env.BETTER_AUTH_SECRET || "development_better_auth_secret_key_minimum_32_characters";

  const u1Token = "token-user-1";
  const u2Token = "token-user-2";
  const u3Token = "token-user-3";

  beforeAll(async () => {
    await applyTestSchema(env.DB);

    const db = drizzle(env.DB, { schema });
    const now = new Date();

    // 1. Create users
    await db.insert(schema.user).values([
      {
        id: "p6-user-1",
        name: "Alice",
        email: "alice@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "p6-user-2",
        name: "Bob",
        email: "bob@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "p6-user-3",
        name: "Charlie",
        email: "charlie@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // 2. Create sessions for auth middleware
    await db.insert(schema.session).values([
      {
        id: "sess-p6-1",
        token: u1Token,
        userId: "p6-user-1",
        expiresAt: new Date(now.getTime() + 86400000),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "sess-p6-2",
        token: u2Token,
        userId: "p6-user-2",
        expiresAt: new Date(now.getTime() + 86400000),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "sess-p6-3",
        token: u3Token,
        userId: "p6-user-3",
        expiresAt: new Date(now.getTime() + 86400000),
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // 3. Create initial ratings
    await db.insert(schema.ratings).values([
      { userId: "p6-user-1", blitzRating: 1600, updatedAt: now },
      { userId: "p6-user-2", blitzRating: 1550, updatedAt: now },
      { userId: "p6-user-3", blitzRating: 1500, updatedAt: now },
    ]);
  });

  it("handles friend request lifecycle: send, prevent self-friending, accept, list, and remove", async () => {
    // 1. Cannot friend oneself
    const selfRes = await app.fetch(
      new Request("http://localhost/api/friends/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${u1Token}`,
        },
        body: JSON.stringify({ targetUserId: "p6-user-1" }),
      }),
      env,
    );
    expect(selfRes.status).toBe(400);

    // 2. Alice sends friend request to Bob
    const sendRes = await app.fetch(
      new Request("http://localhost/api/friends/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${u1Token}`,
        },
        body: JSON.stringify({ targetUserId: "p6-user-2" }),
      }),
      env,
    );
    expect(sendRes.status).toBe(201);
    const sendData = (await sendRes.json()) as { friendship: { id: string; status: string } };
    expect(sendData.friendship.status).toBe("pending");
    const requestId = sendData.friendship.id;

    // 3. Alice cannot send duplicate request while pending
    const dupRes = await app.fetch(
      new Request("http://localhost/api/friends/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${u1Token}`,
        },
        body: JSON.stringify({ targetUserId: "p6-user-2" }),
      }),
      env,
    );
    expect(dupRes.status).toBe(409);

    // 4. Bob accepts friend request
    const acceptRes = await app.fetch(
      new Request(`http://localhost/api/friends/requests/${requestId}/accept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${u2Token}`,
        },
      }),
      env,
    );
    expect(acceptRes.status).toBe(200);

    // 5. Alice's friend list now includes Bob
    const listRes = await app.fetch(
      new Request("http://localhost/api/friends", {
        headers: {
          Authorization: `Bearer ${u1Token}`,
        },
      }),
      env,
    );
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as {
      friends: Array<{ friend: { id: string; name: string } }>;
    };
    expect(listData.friends.length).toBe(1);
    expect(listData.friends[0].friend.id).toBe("p6-user-2");
    expect(listData.friends[0].friend.name).toBe("Bob");

    // 6. Alice removes Bob from friends
    const removeRes = await app.fetch(
      new Request("http://localhost/api/friends/p6-user-2/remove", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${u1Token}`,
        },
      }),
      env,
    );
    expect(removeRes.status).toBe(200);

    // List is now empty
    const emptyListRes = await app.fetch(
      new Request("http://localhost/api/friends", {
        headers: {
          Authorization: `Bearer ${u1Token}`,
        },
      }),
      env,
    );
    const emptyListData = (await emptyListRes.json()) as { friends: unknown[] };
    expect(emptyListData.friends.length).toBe(0);
  });

  it("handles direct challenge lifecycle with real-time /ws/user notifications and DO pre-init", async () => {
    // Connect Bob to /ws/user to receive real-time challenge notifications
    const { ticket: bobTicket } = await createWsTicket(
      { userId: "p6-user-2", userName: "Bob", rating: 1550, scope: "user" },
      secret,
    );
    const bobWsRes = await app.fetch(
      new Request("http://localhost/ws/user", { headers: { Upgrade: "websocket" } }),
      env,
    );
    const bobWs = bobWsRes.webSocket;
    if (!bobWs) throw new Error("Expected WebSocket");
    bobWs.accept();

    const bobMessages: ServerUserFrame[] = [];
    bobWs.addEventListener("message", (ev) => bobMessages.push(JSON.parse(ev.data as string)));
    bobWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: bobTicket } }));
    await new Promise((r) => setTimeout(r, 40));

    // Connect Alice to /ws/user as well
    const { ticket: aliceTicket } = await createWsTicket(
      { userId: "p6-user-1", userName: "Alice", rating: 1600, scope: "user" },
      secret,
    );
    const aliceWsRes = await app.fetch(
      new Request("http://localhost/ws/user", { headers: { Upgrade: "websocket" } }),
      env,
    );
    const aliceWs = aliceWsRes.webSocket;
    if (!aliceWs) throw new Error("Expected WebSocket");
    aliceWs.accept();

    const aliceMessages: ServerUserFrame[] = [];
    aliceWs.addEventListener("message", (ev) => aliceMessages.push(JSON.parse(ev.data as string)));
    aliceWs.send(JSON.stringify({ type: "AUTH", payload: { ticket: aliceTicket } }));
    await new Promise((r) => setTimeout(r, 40));

    // 1. Alice creates direct challenge to Bob (3+2, unrated)
    const chalRes = await app.fetch(
      new Request("http://localhost/api/challenges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${u1Token}`,
        },
        body: JSON.stringify({
          challengedId: "p6-user-2",
          timeControlId: "3+2",
          rated: false,
          preferredColor: "white",
        }),
      }),
      env,
    );
    expect(chalRes.status).toBe(201);
    const chalData = (await chalRes.json()) as { challenge: { id: string; expiresAt: number } };
    const challengeId = chalData.challenge.id;

    await new Promise((r) => setTimeout(r, 50));

    // 2. Bob should have received CHALLENGE_RECEIVED over /ws/user
    const receivedMsg = bobMessages.find((m) => m.type === "CHALLENGE_RECEIVED");
    expect(receivedMsg).toBeDefined();
    if (receivedMsg && receivedMsg.type === "CHALLENGE_RECEIVED") {
      expect(receivedMsg.payload.challengeId).toBe(challengeId);
      expect(receivedMsg.payload.challenger.id).toBe("p6-user-1");
      expect(receivedMsg.payload.challenger.name).toBe("Alice");
      expect(receivedMsg.payload.timeControlId).toBe("3+2");
    }

    // 3. Bob accepts the challenge
    const acceptRes = await app.fetch(
      new Request(`http://localhost/api/challenges/${challengeId}/accept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${u2Token}`,
        },
      }),
      env,
    );
    expect(acceptRes.status).toBe(200);
    const acceptData = (await acceptRes.json()) as { gameId: string; timeControlId: string };
    expect(acceptData.gameId).toBeDefined();
    expect(acceptData.timeControlId).toBe("3+2");

    await new Promise((r) => setTimeout(r, 50));

    // 4. Alice receives CHALLENGE_ACCEPTED with gameId on /ws/user
    const acceptedNotice = aliceMessages.find((m) => m.type === "CHALLENGE_ACCEPTED");
    expect(acceptedNotice).toBeDefined();
    if (acceptedNotice && acceptedNotice.type === "CHALLENGE_ACCEPTED") {
      expect(acceptedNotice.payload.challengeId).toBe(challengeId);
      expect(acceptedNotice.payload.gameId).toBe(acceptData.gameId);
    }

    // 5. Verify GameSessionDO was pre-initialized and ready for both players
    const ns = env.GAME_SESSION_DO || env.GAME_ROOM_DO;
    const sessionStub = ns.get(ns.idFromName(acceptData.gameId));
    const stateRes = await sessionStub.fetch("http://internal/state");
    expect(stateRes.status).toBe(200);
    const state = (await stateRes.json()) as {
      status: string;
      canTakeback: boolean;
      rated: boolean;
    };
    expect(state.status).toBe("active");
    expect(state.rated).toBe(false);
    expect(state.canTakeback).toBe(true); // RULE-10: takebacks allowed in unrated friend games!

    aliceWs.close();
    bobWs.close();
  });

  it("handles open shareable link challenge creation and acceptance", async () => {
    // 1. Charlie creates open link challenge (10 min expiry)
    const linkRes = await app.fetch(
      new Request("http://localhost/api/challenges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${u3Token}`,
        },
        body: JSON.stringify({
          timeControlId: "5+0",
          rated: false,
        }),
      }),
      env,
    );
    expect(linkRes.status).toBe(201);
    const linkData = (await linkRes.json()) as { challenge: { id: string; expiresAt: number } };
    const linkChalId = linkData.challenge.id;

    // Link challenge expiry is ~10 minutes (PRODUCT_RULES.CHALLENGE_LINK_EXPIRY_MS = 600,000)
    const expectedExpiryApprox = Date.now() + PRODUCT_RULES.CHALLENGE_LINK_EXPIRY_MS;
    expect(linkData.challenge.expiresAt).toBeGreaterThan(expectedExpiryApprox - 5000);

    // 2. Alice accepts Charlie's open link challenge
    const acceptRes = await app.fetch(
      new Request(`http://localhost/api/challenges/${linkChalId}/accept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${u1Token}`,
        },
      }),
      env,
    );
    expect(acceptRes.status).toBe(200);
    const acceptData = (await acceptRes.json()) as { gameId: string };
    expect(acceptData.gameId).toBeDefined();
  });

  it("enforces RULE-08: maximum 5 pending outgoing challenges limit", async () => {
    const db = drizzle(env.DB, { schema });
    await db.delete(schema.challenges).where(eq(schema.challenges.challengerId, "p6-user-1"));

    // Alice creates 5 challenges
    for (let i = 0; i < 5; i++) {
      const res = await app.fetch(
        new Request("http://localhost/api/challenges", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${u1Token}`,
          },
          body: JSON.stringify({
            timeControlId: "3+2",
            rated: false,
          }),
        }),
        env,
      );
      expect(res.status).toBe(201);
    }

    // 6th challenge must be refused with 409 CONFLICT
    const sixthRes = await app.fetch(
      new Request("http://localhost/api/challenges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${u1Token}`,
        },
        body: JSON.stringify({
          timeControlId: "3+2",
          rated: false,
        }),
      }),
      env,
    );
    expect(sixthRes.status).toBe(409);
    const err = (await sixthRes.json()) as { error: { message: string } };
    expect(err.error.message).toContain("Maximum pending outgoing challenges (5) reached");
  });

  it("enforces RULE-05: rated pair cap on challenge creation", async () => {
    const db = drizzle(env.DB, { schema });
    const now = new Date();

    // Insert 5 past rated games between Charlie and Bob in rolling 24h
    for (let i = 0; i < 5; i++) {
      await db.insert(schema.games).values({
        id: `p6-rated-cap-${i}-${crypto.randomUUID()}`,
        whitePlayerId: "p6-user-3",
        blackPlayerId: "p6-user-2",
        timeControl: "3+2",
        category: "blitz",
        moves: JSON.stringify(["e4", "e5"]),
        result: "1-0",
        termination: "checkmate",
        whiteRatingBefore: 1500,
        whiteRatingChange: 10,
        blackRatingBefore: 1500,
        blackRatingChange: -10,
        startedAt: new Date(now.getTime() - (i + 1) * 3600_000),
        endedAt: new Date(now.getTime() - (i + 1) * 3600_000 + 300_000),
      });
    }

    // Charlie attempts to challenge Bob to a rated game -> refused
    const ratedRes = await app.fetch(
      new Request("http://localhost/api/challenges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${u3Token}`,
        },
        body: JSON.stringify({
          challengedId: "p6-user-2",
          timeControlId: "3+2",
          rated: true,
        }),
      }),
      env,
    );
    expect(ratedRes.status).toBe(409);
    const err = (await ratedRes.json()) as { error: { message: string } };
    expect(err.error.message).toContain("Maximum rated games limit (5 per 24 hours)");

    // But an unrated challenge between them is allowed!
    const unratedRes = await app.fetch(
      new Request("http://localhost/api/challenges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${u3Token}`,
        },
        body: JSON.stringify({
          challengedId: "p6-user-2",
          timeControlId: "3+2",
          rated: false,
        }),
      }),
      env,
    );
    expect(unratedRes.status).toBe(201);
  });
});

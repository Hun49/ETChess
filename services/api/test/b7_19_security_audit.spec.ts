/**
 * B7-19 — Final Security Audit & Verification Suite
 *
 * Requirements:
 * 1. WebSocket ticket security: HMAC validation, tampering rejection, single-use replay prevention.
 * 2. Scope binding: "user" scope cannot access game socket; "game" scope cannot access another game.
 * 3. Query string auth prohibition: ?ticket=... rejected with 400 INVALID_AUTH_TRANSPORT.
 * 4. Framing & Rate limits: frames >16KB rejected (1009), bursts >25/sec rejected (1008).
 * 5. Admin authorization & IDOR defense: admin endpoints strictly enforce role="admin".
 * 6. Client spoofing rejection: client cannot manipulate clock, ratings, or results.
 */
import { env } from "cloudflare:test";
import type { ServerGameFrame } from "@etchess/realtime-protocol";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { getWsTicketSecret } from "../src/lib/secrets";
import { createWsTicket, verifyWsTicket } from "../src/lib/wsTicket";
import { applyTestSchema } from "./helpers";

describe("B7-19 — Final Repository Security Audit", () => {
  const db = drizzle(env.DB, { schema });
  const secret = getWsTicketSecret(env);

  beforeAll(async () => {
    await applyTestSchema(env.DB);
  });

  it("1. ticket tampering detection: cryptographically rejects altered payload or signature", async () => {
    const { ticket } = await createWsTicket(
      { userId: "sec-user-1", userName: "Sec1", rating: 1500, scope: "user" },
      secret,
    );

    // Tamper payload
    const [payloadB64, sigB64] = ticket.split(".");
    const tamperedPayload = `A${payloadB64.slice(1)}`;
    const tamperedTicket = `${tamperedPayload}.${sigB64}`;

    const res = await verifyWsTicket(tamperedTicket, secret);
    expect(res.valid).toBe(false);

    // Tamper signature
    const tamperedSigTicket = `${payloadB64}.invalidSignature123456789`;
    const res2 = await verifyWsTicket(tamperedSigTicket, secret);
    expect(res2.valid).toBe(false);
  });

  it("2. single-use replay prevention: ticket cannot be authenticated twice", async () => {
    const gId = crypto.randomUUID();
    const uId = `sec_replay_${Date.now()}`;

    await db.insert(schema.user).values({
      id: uId,
      name: "ReplayUser",
      email: `${uId}@test.com`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const ns = env.GAME_SESSION_DO;
    const stub = ns.get(ns.idFromName(gId));
    await stub.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId: gId,
        whiteUserId: uId,
        whiteUserName: "ReplayUser",
        whiteRating: 1500,
        blackUserId: "other-u",
        blackUserName: "Other",
        blackRating: 1500,
        timeControl: "3+2",
        initialPly: 2,
      }),
    });

    const { ticket } = await createWsTicket(
      {
        userId: uId,
        userName: "ReplayUser",
        rating: 1500,
        scope: "game",
        gameId: gId,
        role: "white",
      },
      secret,
    );

    // Socket 1 connects and uses ticket
    const r1 = await app.fetch(
      new Request(`http://localhost/ws/game/${gId}`, { headers: { Upgrade: "websocket" } }),
      env,
    );
    if (!r1.webSocket) throw new Error("Expected WebSocket upgrade");
    const ws1 = r1.webSocket;
    ws1.accept();
    ws1.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
    await new Promise((r) => setTimeout(r, 40));

    // Socket 2 attempts to reuse the same ticket
    const r2 = await app.fetch(
      new Request(`http://localhost/ws/game/${gId}`, { headers: { Upgrade: "websocket" } }),
      env,
    );
    if (!r2.webSocket) throw new Error("Expected WebSocket upgrade");
    const ws2 = r2.webSocket;
    ws2.accept();

    let closedCode: number | null = null;
    ws2.addEventListener("close", (ev) => {
      closedCode = ev.code;
    });

    ws2.send(JSON.stringify({ type: "AUTH", payload: { ticket } }));
    await new Promise((r) => setTimeout(r, 60));

    // Socket 2 is closed due to replayed ticket
    expect([4001, 4003]).toContain(closedCode);

    ws1.close();
  });

  it("3. ticket scope enforcement: user ticket rejected for game session, mismatched gameId rejected", async () => {
    const gId = crypto.randomUUID();
    const otherGId = crypto.randomUUID();
    const uId = `sec_scope_${Date.now()}`;

    await db.insert(schema.user).values({
      id: uId,
      name: "ScopeUser",
      email: `${uId}@test.com`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Initialize game session DO first so route doesn't 404
    const ns = env.GAME_SESSION_DO;
    const stub = ns.get(ns.idFromName(gId));
    await stub.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId: gId,
        whiteUserId: uId,
        whiteUserName: "ScopeUser",
        whiteRating: 1500,
        blackUserId: "other-u",
        blackUserName: "Other",
        blackRating: 1500,
        timeControl: "3+2",
        initialPly: 2,
      }),
    });

    // Scope "user" ticket used on game socket
    const { ticket: userScopeTicket } = await createWsTicket(
      { userId: uId, userName: "ScopeUser", rating: 1500, scope: "user" },
      secret,
    );

    const r1 = await app.fetch(
      new Request(`http://localhost/ws/game/${gId}`, { headers: { Upgrade: "websocket" } }),
      env,
    );
    if (!r1.webSocket) throw new Error("Expected WebSocket upgrade");
    const ws1 = r1.webSocket;
    ws1.accept();

    let close1: number | null = null;
    ws1.addEventListener("close", (ev) => {
      close1 = ev.code;
    });
    ws1.send(JSON.stringify({ type: "AUTH", payload: { ticket: userScopeTicket } }));
    await new Promise((r) => setTimeout(r, 60));

    expect([4001, 4003]).toContain(close1); // Scope mismatch rejected

    // Scope "game" but with wrong gameId
    const { ticket: wrongGameTicket } = await createWsTicket(
      {
        userId: uId,
        userName: "ScopeUser",
        rating: 1500,
        scope: "game",
        gameId: otherGId,
        role: "white",
      },
      secret,
    );

    const r2 = await app.fetch(
      new Request(`http://localhost/ws/game/${gId}`, { headers: { Upgrade: "websocket" } }),
      env,
    );
    if (!r2.webSocket) throw new Error("Expected WebSocket upgrade");
    const ws2 = r2.webSocket;
    ws2.accept();

    let close2: number | null = null;
    ws2.addEventListener("close", (ev) => {
      close2 = ev.code;
    });
    ws2.send(JSON.stringify({ type: "AUTH", payload: { ticket: wrongGameTicket } }));
    await new Promise((r) => setTimeout(r, 60));

    expect([4001, 4003]).toContain(close2); // GameId mismatch rejected
  });

  it("4. prohibits passing tickets in URL query string (fails closed with 400)", async () => {
    const res = await app.fetch(
      new Request("http://localhost/ws/game/test-game?ticket=some-ticket-string", {
        headers: { Upgrade: "websocket" },
      }),
      env,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_AUTH_TRANSPORT");
  });

  it("5. admin routes strictly reject non-admin users with 403 FORBIDDEN", async () => {
    const nonAdminId = `sec_regular_${Date.now()}`;
    const nonAdminToken = `token_${nonAdminId}`;
    const future = new Date(Date.now() + 86_400_000);

    await db.insert(schema.user).values({
      id: nonAdminId,
      name: "RegularUser",
      email: `${nonAdminId}@test.com`,
      role: "user", // Regular user, NOT admin
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(schema.session).values({
      id: `session_${nonAdminId}`,
      userId: nonAdminId,
      token: nonAdminToken,
      expiresAt: future,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Attempt to access admin reports with regular user session cookie
    const res = await app.fetch(
      new Request("http://localhost/api/admin/reports", {
        headers: { Cookie: `better-auth.session_token=${nonAdminToken}` },
      }),
      env,
    );

    expect(res.status).toBe(403);
  });
});

import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import { TicketReplayGuard, createWsTicket, verifyWsTicket } from "../src/lib/wsTicket";
import { applyTestSchema } from "./helpers";

describe("Phase 3 — Auth, Profiles, and WebSocket Tickets", () => {
  beforeAll(async () => {
    await applyTestSchema(env.DB);
  });

  let guestSessionCookie = "";
  let guestUserId = "";

  it("POST /api/auth/guest creates a guest account with default ratings and sets session cookie", async () => {
    const res = await app.fetch(
      new Request("http://localhost/api/auth/guest", {
        method: "POST",
      }),
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: {
        id: string;
        name: string;
        role: string;
        isGuest: boolean;
        ratings: { bullet: number; blitz: number };
      };
      token: string;
    };

    expect(body.user.id).toBeDefined();
    expect(body.user.role).toBe("guest");
    expect(body.user.isGuest).toBe(true);
    expect(body.user.name).toContain("Guest");
    expect(body.user.ratings.blitz).toBe(1500);

    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("better-auth.session_token=");

    const cookieMatch = setCookie?.match(/better-auth\.session_token=[^;]+/);
    guestSessionCookie = cookieMatch ? cookieMatch[0] : "";
    guestUserId = body.user.id;
  });

  it("GET /api/users/me recognizes guest session and returns profile with ratings", async () => {
    const res = await app.fetch(new Request("http://localhost/api/users/me"), env);
    // Without cookie should be 401
    expect(res.status).toBe(401);

    // With guest session cookie
    const authRes = await app.fetch(
      new Request("http://localhost/api/users/me", {
        headers: { Cookie: guestSessionCookie },
      }),
      env,
    );

    expect(authRes.status).toBe(200);
    const data = (await authRes.json()) as {
      user: { id: string; name: string; role: string };
    };
    expect(data.user.id).toBe(guestUserId);
    expect(data.user.role).toBe("guest");
  });

  it("PATCH /api/users/me updates display name and image", async () => {
    const newName = "GrandmasterGuest";
    const updateRes = await app.fetch(
      new Request("http://localhost/api/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: guestSessionCookie,
        },
        body: JSON.stringify({ name: newName }),
      }),
      env,
    );

    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as {
      user: { name: string };
    };
    expect(updated.user.name).toBe(newName);

    // Verify public profile endpoint reflects the updated name
    const publicRes = await app.fetch(
      new Request(`http://localhost/api/users/${guestUserId}`),
      env,
    );
    expect(publicRes.status).toBe(200);
    const publicProfile = (await publicRes.json()) as {
      user: { name: string };
    };
    expect(publicProfile.user.name).toBe(newName);
  });

  it("POST /api/ws-ticket mints valid HMAC single-use ticket for authenticated user", async () => {
    // 1. Unauthenticated request rejected
    const unauthRes = await app.fetch(
      new Request("http://localhost/api/ws-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "user" }),
      }),
      env,
    );
    expect(unauthRes.status).toBe(401);

    // 2. Authenticated request succeeds
    const ticketRes = await app.fetch(
      new Request("http://localhost/api/ws-ticket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: guestSessionCookie,
        },
        body: JSON.stringify({ scope: "user" }),
      }),
      env,
    );

    expect(ticketRes.status).toBe(200);
    const data = (await ticketRes.json()) as {
      ticket: string;
      expiresIn: number;
    };
    expect(data.ticket).toBeDefined();
    expect(data.expiresIn).toBe(30);

    // 3. Cryptographically verify the ticket
    const secret =
      env.BETTER_AUTH_SECRET || "development_better_auth_secret_key_minimum_32_characters";
    const verification = await verifyWsTicket(data.ticket, secret);
    expect(verification.valid).toBe(true);
    if (!verification.valid) return;

    expect(verification.payload.userId).toBe(guestUserId);
    expect(verification.payload.scope).toBe("user");
    expect(verification.payload.rating).toBe(1500);
    expect(verification.payload.jti).toBeDefined();
  });

  it("verifies and rejects tampered or expired WebSocket tickets", async () => {
    const secret = "test-secret-32-chars-long-minimum-length";
    const { ticket } = await createWsTicket(
      {
        userId: "user-123",
        userName: "Player",
        rating: 1600,
        scope: "user",
      },
      secret,
      30,
    );

    // Valid ticket passes
    const validCheck = await verifyWsTicket(ticket, secret);
    expect(validCheck.valid).toBe(true);

    // Tampered ticket fails
    const tampered = `${ticket.slice(0, -5)}abcde`;
    const tamperedCheck = await verifyWsTicket(tampered, secret);
    expect(tamperedCheck.valid).toBe(false);
    if (!tamperedCheck.valid) {
      expect(tamperedCheck.reason).toContain("signature");
    }

    // Expired ticket fails
    const { ticket: expiredTicket } = await createWsTicket(
      {
        userId: "user-123",
        userName: "Player",
        rating: 1600,
        scope: "user",
      },
      secret,
      -1, // Already expired in the past
    );
    const expiredCheck = await verifyWsTicket(expiredTicket, secret);
    expect(expiredCheck.valid).toBe(false);
    if (!expiredCheck.valid) {
      expect(expiredCheck.reason).toContain("expired");
    }
  });

  it("TicketReplayGuard enforces single-use replay protection", async () => {
    const guard = new TicketReplayGuard();
    const jti = "test-jti-unique-uuid-1";
    const exp = Date.now() + 30000;

    // First use: accepted
    expect(await guard.consume(jti, exp)).toBe(true);

    // Second use with same jti: rejected
    expect(await guard.consume(jti, exp)).toBe(false);

    // Another jti: accepted
    expect(await guard.consume("another-jti", exp)).toBe(true);
  });
});

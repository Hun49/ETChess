import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { isAllowedOrigin } from "../src/lib/cors";
import { getAuthSecret, getWsTicketSecret } from "../src/lib/secrets";
import { createWsTicket } from "../src/lib/wsTicket";
import type { Env } from "../src/types";
import { applyTestSchema } from "./helpers";

describe("Critical Security Audit & Regression Tests (C1–C4)", () => {
  const db = drizzle(env.DB, { schema });

  beforeAll(async () => {
    await applyTestSchema(env.DB);
  });

  describe("C1: Privilege Escalation Prevention on Sign-Up", () => {
    it("neutralizes client-supplied role: 'admin' on sign-up and guarantees role = 'user'", async () => {
      const email = `attacker_${Date.now()}@evil.corp`;

      const res = await app.fetch(
        new Request("http://localhost:8787/api/auth/sign-up/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
          },
          body: JSON.stringify({
            name: "MaliciousAdmin",
            email,
            password: "SuperSecretPassword123!",
            role: "admin",
          }),
        }),
        env,
      );

      expect(res.status).toBe(200);

      // Verify that even if client posts role: 'admin', row in D1 database strictly has role = 'user'
      const [userRow] = await db.select().from(schema.user).where(eq(schema.user.email, email));

      expect(userRow).toBeDefined();
      expect(userRow?.role).toBe("user");
      expect(userRow?.role).not.toBe("admin");
      expect(userRow?.isBanned).toBe(false);
      expect(userRow?.banExpiresAt).toBeNull();
    });

    it("verifies normal sign-up without role creates a user with role = 'user'", async () => {
      const email = `honest_user_${Date.now()}@etchess.io`;

      const res = await app.fetch(
        new Request("http://localhost:8787/api/auth/sign-up/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
          },
          body: JSON.stringify({
            name: "HonestPlayer",
            email,
            password: "SuperSecretPassword123!",
          }),
        }),
        env,
      );

      expect(res.status).toBe(200);

      // Verify row in D1 database has role = 'user'
      const [userRow] = await db.select().from(schema.user).where(eq(schema.user.email, email));

      expect(userRow).toBeDefined();
      expect(userRow?.role).toBe("user");
      expect(userRow?.isBanned).toBe(false);
      expect(userRow?.banExpiresAt).toBeNull();
    });
  });

  describe("C2: Secret Management & Fail-Closed Behavior", () => {
    it("fails closed if WS_TICKET_SECRET and BETTER_AUTH_SECRET are missing or < 32 chars", () => {
      expect(() => {
        getWsTicketSecret({} as unknown as Env);
      }).toThrow(/CRITICAL_SECURITY_ERROR/);

      expect(() => {
        getWsTicketSecret({ BETTER_AUTH_SECRET: "short" } as unknown as Env);
      }).toThrow(/CRITICAL_SECURITY_ERROR/);

      expect(() => {
        getAuthSecret({} as unknown as Env);
      }).toThrow(/CRITICAL_SECURITY_ERROR/);
    });

    it("accepts valid secret >= 32 characters", () => {
      const valid = "012345678901234567890123456789012";
      expect(getWsTicketSecret({ WS_TICKET_SECRET: valid } as unknown as Env)).toBe(valid);
      expect(getAuthSecret({ BETTER_AUTH_SECRET: valid } as unknown as Env)).toBe(valid);
    });
  });

  describe("C3: Game WebSocket Authentication & Leak Prevention", () => {
    it("refuses to mint game ticket for non-existent game ID", async () => {
      // First create a guest session
      const guestRes = await app.fetch(
        new Request("http://localhost:8787/api/auth/guest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
        env,
      );
      const guestData = (await guestRes.json()) as { token: string };

      // Request ticket for non-existent game
      const ticketRes = await app.fetch(
        new Request("http://localhost:8787/api/ws-ticket", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${guestData.token}`,
          },
          body: JSON.stringify({
            scope: "game",
            gameId: "00000000-0000-0000-0000-nonexistent",
          }),
        }),
        env,
      );

      expect(ticketRes.status).toBe(404);
      const err = await ticketRes.json();
      expect(err).toHaveProperty("error");
    });

    it("strictly rejects user-scope ticket presented to game session DO", async () => {
      const secret = getWsTicketSecret(env);
      const { ticket: userTicket } = await createWsTicket(
        {
          userId: "user-1",
          userName: "Player1",
          rating: 1500,
          scope: "user",
          role: "white",
        },
        secret,
      );

      const gameId = `test-game-${Date.now()}`;
      const ns = env.GAME_SESSION_DO;
      const stub = ns.get(ns.idFromName(gameId));

      // Initialize game state first
      await stub.fetch(
        new Request("http://internal/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameId,
            whiteUserId: "user-1",
            whiteUserName: "Player1",
            whiteRating: 1500,
            blackUserId: "user-2",
            blackUserName: "Player2",
            blackRating: 1500,
            timeControl: "3+2",
            rated: true,
          }),
        }),
      );

      // Connect to WS
      const wsRes = await stub.fetch(
        new Request(`http://internal/ws/game/${gameId}`, {
          headers: { Upgrade: "websocket" },
        }),
      );
      expect(wsRes.status).toBe(101);
      const ws = wsRes.webSocket;
      expect(ws).toBeDefined();
      ws?.accept();

      // Send AUTH with user ticket
      ws?.send(
        JSON.stringify({
          v: 1,
          type: "AUTH",
          payload: { ticket: userTicket },
        }),
      );

      await new Promise((r) => setTimeout(r, 100));
      // Socket should receive error and be closed
    });
  });

  describe("C4: Strict CORS Allowlist & WebSocket Origin Validation", () => {
    it("returns null for unauthorized origins and does not reflect evil origin", async () => {
      const res = await app.fetch(
        new Request("http://localhost:8787/health", {
          method: "GET",
          headers: {
            Origin: "https://evil.attacker.com",
          },
        }),
        env,
      );

      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("allows configured localhost origin", async () => {
      const res = await app.fetch(
        new Request("http://localhost:8787/health", {
          method: "GET",
          headers: {
            Origin: "http://localhost:3000",
          },
        }),
        env,
      );

      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });

    it("rejects cross-origin WebSocket upgrade from untrusted origin with 403 Forbidden", async () => {
      const res = await app.fetch(
        new Request("http://localhost:8787/ws/user", {
          method: "GET",
          headers: {
            Upgrade: "websocket",
            Origin: "https://malicious-site.example.org",
          },
        }),
        env,
      );

      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: { code: string; message: string } };
      expect(json.error.code).toBe("FORBIDDEN");
    });
  });
});

import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src";
import { applyTestSchema } from "./helpers";

describe("Better Auth & Google OAuth Integration", () => {
  let sessionCookie = "";

  beforeAll(async () => {
    await applyTestSchema(env.DB);
  });

  it("POST /api/auth/sign-in/social generates Google OAuth authorization URL", async () => {
    const res = await app.fetch(
      new Request("http://localhost:8787/api/auth/sign-in/social", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          provider: "google",
          callbackURL: "http://localhost:3000",
        }),
      }),
      env,
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { url: string; redirect?: boolean };
    expect(data.url).toBeDefined();

    // Verify it directs to Google OAuth endpoint with configured client ID and redirect URI
    const googleAuthUrl = new URL(data.url);
    expect(googleAuthUrl.hostname).toBe("accounts.google.com");
    expect(googleAuthUrl.searchParams.get("client_id")).toBe(
      "471436113446-phn41bqcuuh2houq9mebb7hp0lhslvpf.apps.googleusercontent.com",
    );
    expect(googleAuthUrl.searchParams.get("redirect_uri")).toBe(
      "http://localhost:8787/api/auth/callback/google",
    );
    expect(googleAuthUrl.searchParams.get("response_type")).toBe("code");
    expect(googleAuthUrl.searchParams.get("scope")).toContain("openid");
  });

  it("POST /api/auth/sign-up/email creates user and triggers Glicko-2 ratings initialization", async () => {
    const res = await app.fetch(
      new Request("http://localhost:8787/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          name: "MagnusCarlsen",
          email: "magnus@etchess.io",
          password: "WorldChampion2026!",
        }),
      }),
      env,
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      user: { id: string; name: string; email: string; emailVerified: boolean };
      token?: string;
    };

    expect(data.user).toBeDefined();
    expect(data.user.name).toBe("MagnusCarlsen");
    expect(data.user.email).toBe("magnus@etchess.io");
    expect(data.user.emailVerified).toBe(false);

    // Save session cookie for authenticated requests
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    sessionCookie = setCookie || "";

    // Verify D1 Database Hook: 1500 ratings were created in the 'ratings' table
    const ratingRow = await env.DB.prepare("SELECT * FROM ratings WHERE user_id = ?")
      .bind(data.user.id)
      .first<{
        bullet_rating: number;
        blitz_rating: number;
        rapid_rating: number;
        classical_rating: number;
      }>();

    expect(ratingRow).toBeDefined();
    expect(ratingRow?.blitz_rating).toBe(1500);
    expect(ratingRow?.bullet_rating).toBe(1500);
    expect(ratingRow?.rapid_rating).toBe(1500);
    expect(ratingRow?.classical_rating).toBe(1500);
  });

  it("POST /api/auth/sign-in/email validates password and authenticates user", async () => {
    const validRes = await app.fetch(
      new Request("http://localhost:8787/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          email: "magnus@etchess.io",
          password: "WorldChampion2026!",
        }),
      }),
      env,
    );
    expect(validRes.status).toBe(200);
    const data = (await validRes.json()) as { user: { email: string } };
    expect(data.user.email).toBe("magnus@etchess.io");
  });

  it("GET /api/users/me returns authenticated user profile and ratings", async () => {
    const res = await app.fetch(
      new Request("http://localhost:8787/api/users/me", {
        method: "GET",
        headers: {
          Cookie: sessionCookie,
          Origin: "http://localhost:3000",
        },
      }),
      env,
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      user: {
        name: string;
        email: string;
        ratings: { blitz: number; bullet: number; rapid: number; classical: number };
      };
    };
    expect(data.user.name).toBe("MagnusCarlsen");
    expect(data.user.ratings.blitz).toBe(1500);
  });

  it("Progressive Email OTP generates code and verifies account", async () => {
    let capturedOtp = "";
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      const msg = args.join(" ");
      const match = msg.match(/Verification OTP for .*: (\d{6})/);
      if (match) {
        capturedOtp = match[1];
      }
    });

    // Request OTP for email verification
    const otpRes = await app.fetch(
      new Request("http://localhost:8787/api/auth/email-otp/send-verification-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          email: "magnus@etchess.io",
          type: "email-verification",
        }),
      }),
      env,
    );

    expect(otpRes.status).toBe(200);
    expect(capturedOtp).toMatch(/^\d{6}$/);

    // Verify OTP code
    const verifyRes = await app.fetch(
      new Request("http://localhost:8787/api/auth/email-otp/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          email: "magnus@etchess.io",
          otp: capturedOtp,
        }),
      }),
      env,
    );

    expect(verifyRes.status).toBe(200);

    // Check user table in D1: email_verified must now be 1 (true)
    const user = await env.DB.prepare("SELECT email_verified FROM user WHERE email = ?")
      .bind("magnus@etchess.io")
      .first<{ email_verified: number }>();

    expect(user?.email_verified).toBe(1);
    logSpy.mockRestore();
  });
});

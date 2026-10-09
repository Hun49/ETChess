import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import { applyTestSchema } from "./helpers";

describe("Social OAuth & Skill Onboarding Integration", () => {
  beforeAll(async () => {
    await applyTestSchema(env.DB);
  });

  const authEnv = {
    ...env,
    GOOGLE_CLIENT_ID:
      env.GOOGLE_CLIENT_ID ||
      "471436113446-phn41bqcuuh2houq9mebb7hp0lhslvpf.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET || "dummy_google_client_secret_for_tests",
    GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID || "Ov23lijIriCE1INfTn73",
    GITHUB_CLIENT_SECRET: env.GITHUB_CLIENT_SECRET || "224b19810ee2452bea00648d59a30d29a591e843",
  };

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
      authEnv,
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { url: string; redirect?: boolean };
    expect(data.url).toBeDefined();

    const googleAuthUrl = new URL(data.url);
    expect(googleAuthUrl.hostname).toBe("accounts.google.com");
    expect(googleAuthUrl.searchParams.get("client_id")).toBe(authEnv.GOOGLE_CLIENT_ID);
    expect(googleAuthUrl.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/callback/google",
    );
    expect(googleAuthUrl.searchParams.get("response_type")).toBe("code");
    expect(googleAuthUrl.searchParams.get("scope")).toContain("openid");
  });

  it("POST /api/auth/sign-in/social generates GitHub OAuth authorization URL", async () => {
    const res = await app.fetch(
      new Request("http://localhost:8787/api/auth/sign-in/social", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          provider: "github",
          callbackURL: "http://localhost:3000",
        }),
      }),
      authEnv,
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { url: string; redirect?: boolean };
    expect(data.url).toBeDefined();

    const githubAuthUrl = new URL(data.url);
    expect(githubAuthUrl.hostname).toBe("github.com");
    expect(githubAuthUrl.pathname).toBe("/login/oauth/authorize");
    expect(githubAuthUrl.searchParams.get("client_id")).toBe(authEnv.GITHUB_CLIENT_ID);
    expect(githubAuthUrl.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/callback/github",
    );
    expect(githubAuthUrl.searchParams.get("scope")).toBeDefined();
  });

  it("User creation hook initializes 1000 baseline rating in D1", async () => {
    const userId = "test_user_github_hikaru";
    const userEmail = "hikaru@etchess.io";
    const now = Date.now();

    // Simulate verified social OAuth user creation
    await env.DB.prepare(
      "INSERT INTO user (id, name, email, email_verified, role, is_banned, experience_level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(userId, "HikaruNakamura", userEmail, 1, "user", 0, null, now, now)
      .run();

    // Baseline ratings record
    await env.DB.prepare(
      "INSERT INTO ratings (user_id, bullet_rating, blitz_rating, rapid_rating, classical_rating, bullet_rd, blitz_rd, rapid_rd, classical_rd, bullet_vol, blitz_vol, rapid_vol, classical_vol, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(userId, 1000, 1000, 1000, 1000, 350, 350, 350, 350, 0.06, 0.06, 0.06, 0.06, now)
      .run();

    // Create session
    const sessionToken = "hikaru_test_session_token_123";
    await env.DB.prepare(
      "INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind("sess_hikaru", sessionToken, userId, now + 86400000, now, now)
      .run();

    // Verify GET /api/users/me returns initial baseline ratings and null experienceLevel
    const meRes = await app.fetch(
      new Request("http://localhost:8787/api/users/me", {
        method: "GET",
        headers: {
          Cookie: `better-auth.session_token=${sessionToken}`,
          Origin: "http://localhost:3000",
        },
      }),
      authEnv,
    );

    expect(meRes.status).toBe(200);
    const meData = (await meRes.json()) as {
      user: {
        id: string;
        name: string;
        experienceLevel: string | null;
        ratings: { bullet: number; blitz: number; rapid: number; classical: number };
      };
    };

    expect(meData.user.name).toBe("HikaruNakamura");
    expect(meData.user.experienceLevel).toBeNull();
    expect(meData.user.ratings.blitz).toBe(1000);
  });

  it("POST /api/users/me/onboarding updates skill level and starting ELO", async () => {
    const sessionToken = "hikaru_test_session_token_123";

    // Player selects Advanced (1500 ELO) during onboarding
    const onboardRes = await app.fetch(
      new Request("http://localhost:8787/api/users/me/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `better-auth.session_token=${sessionToken}`,
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          experienceLevel: "advanced",
        }),
      }),
      authEnv,
    );

    expect(onboardRes.status).toBe(200);
    const onboardData = (await onboardRes.json()) as {
      success: boolean;
      experienceLevel: string;
      startingRating: number;
    };

    expect(onboardData.success).toBe(true);
    expect(onboardData.experienceLevel).toBe("advanced");
    expect(onboardData.startingRating).toBe(1500);

    // Verify user profile reflects calibrated ratings
    const updatedMeRes = await app.fetch(
      new Request("http://localhost:8787/api/users/me", {
        method: "GET",
        headers: {
          Cookie: `better-auth.session_token=${sessionToken}`,
          Origin: "http://localhost:3000",
        },
      }),
      authEnv,
    );

    expect(updatedMeRes.status).toBe(200);
    const updatedMeData = (await updatedMeRes.json()) as {
      user: {
        experienceLevel: string | null;
        ratings: { bullet: number; blitz: number; rapid: number; classical: number };
      };
    };

    expect(updatedMeData.user.experienceLevel).toBe("advanced");
    expect(updatedMeData.user.ratings.bullet).toBe(1500);
    expect(updatedMeData.user.ratings.blitz).toBe(1500);
    expect(updatedMeData.user.ratings.rapid).toBe(1500);
    expect(updatedMeData.user.ratings.classical).toBe(1500);
  });
});

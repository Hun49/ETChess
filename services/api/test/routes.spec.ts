import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import { applyTestSchema } from "./helpers";

describe("API Routes", () => {
  beforeAll(async () => {
    await applyTestSchema(env.DB);
  });
  it("GET /health returns 200 and status ok", async () => {
    const res = await app.fetch(new Request("http://localhost/health"), env);
    expect(res.status).toBe(200);

    const data = (await res.json()) as { status: string; timestamp: number };
    expect(data.status).toBe("ok");
    expect(typeof data.timestamp).toBe("number");
  });

  it("GET /api/meta returns server version, protocol version, and product rules", async () => {
    const res = await app.fetch(new Request("http://localhost/api/meta"), env);
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      serverVersion: string;
      minProtocolVersion: number;
      rules: { FIRST_MOVE_DEADLINE_MS: number; DISCONNECT_GRACE_MS: number };
      timeControls: Record<string, unknown>;
    };

    expect(data.serverVersion).toBe("0.1.0");
    expect(data.minProtocolVersion).toBe(1);
    expect(data.rules.FIRST_MOVE_DEADLINE_MS).toBe(30000);
    expect(data.rules.DISCONNECT_GRACE_MS).toBe(60000);
    expect(data.timeControls["3+2"]).toBeDefined();
  });

  it("GET /api/games returns empty games list initially", async () => {
    const res = await app.fetch(new Request("http://localhost/api/games"), env);
    expect(res.status).toBe(200);

    const data = (await res.json()) as { games: unknown[] };
    expect(Array.isArray(data.games)).toBe(true);
  });

  it("GET /api/users/leaderboard/blitz returns empty leaderboard initially", async () => {
    const res = await app.fetch(new Request("http://localhost/api/users/leaderboard/blitz"), env);
    expect(res.status).toBe(200);

    const data = (await res.json()) as { category: string; leaderboard: unknown[] };
    expect(data.category).toBe("blitz");
    expect(Array.isArray(data.leaderboard)).toBe(true);
  });

  it("GET /api/games/non-existent returns 404", async () => {
    const res = await app.fetch(new Request("http://localhost/api/games/non-existent-id"), env);
    expect(res.status).toBe(404);

    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Game not found");
  });

  it("GET /api/users/non-existent returns 404", async () => {
    const res = await app.fetch(
      new Request("http://localhost/api/users/non-existent-user-id"),
      env,
    );
    expect(res.status).toBe(404);

    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("User not found");
  });
});

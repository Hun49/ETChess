import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import { MetricsCollector } from "../src/lib/observability";
import { applyTestSchema } from "./helpers";

describe("Phase 1 Foundation and Observability", () => {
  beforeAll(async () => {
    await applyTestSchema(env.DB);
  });

  it("sets X-Request-ID header on all responses and respects incoming header", async () => {
    // 1. Without incoming request ID
    const res1 = await app.fetch(new Request("http://localhost/health"), env);
    expect(res1.status).toBe(200);
    const reqId1 = res1.headers.get("X-Request-ID");
    expect(reqId1).toBeDefined();
    expect(reqId1?.length).toBeGreaterThan(0);

    // 2. With client-supplied X-Request-ID
    const customId = "custom-test-trace-id-999";
    const res2 = await app.fetch(
      new Request("http://localhost/health", {
        headers: { "X-Request-ID": customId },
      }),
      env,
    );
    expect(res2.headers.get("X-Request-ID")).toBe(customId);
  });

  it("GET /health returns 200, version, and timestamp", async () => {
    const res = await app.fetch(new Request("http://localhost/health"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; version: string; timestamp: number };
    expect(body.status).toBe("ok");
    expect(body.version).toBe("0.1.0");
    expect(typeof body.timestamp).toBe("number");
  });

  it("GET /ready checks D1 connectivity and DO namespace bindings", async () => {
    const res = await app.fetch(new Request("http://localhost/ready"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ready: boolean;
      d1: boolean;
      durableObjects: boolean;
      timestamp: number;
    };
    expect(body.ready).toBe(true);
    expect(body.d1).toBe(true);
    expect(body.durableObjects).toBe(true);
  });

  it("returns standard error shape { error: { code, message } } on 404 routes", async () => {
    const res = await app.fetch(new Request("http://localhost/api/nonexistent-route-path"), env);
    expect(res.status).toBe(404);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toContain("Route not found");
  });

  it("returns UPGRADE_REQUIRED (426) with standard error shape when calling ws routes via HTTP", async () => {
    const res = await app.fetch(new Request("http://localhost/ws/game/test-game"), env);
    expect(res.status).toBe(426);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("UPGRADE_REQUIRED");
    expect(body.error.message).toBe("Expected WebSocket upgrade");
  });

  it("records metrics via MetricsCollector without throwing", () => {
    expect(() => {
      MetricsCollector.gamesStarted({ timeControl: "3+2", rated: true });
      MetricsCollector.movesTotal(1);
      MetricsCollector.disconnectsTotal("black");
      MetricsCollector.reconnectsTotal("black");
      MetricsCollector.alarmsFired("first_move");
      MetricsCollector.alarmsStaleDropped("first_move", "game_already_started");
      MetricsCollector.matchmakerWaitTime(1250, { timeControl: "3+2", rated: true });
      MetricsCollector.gamesEnded("checkmate", { rated: true, result: "1-0" });
    }).not.toThrow();
  });
});

import { type Context, Hono } from "hono";
import { validateEnvironment } from "../lib/secrets";
import type { HonoVariables } from "../middleware/session";
import type { Env } from "../types";

export function handleHealthCheck(c: Context<{ Bindings: Env; Variables: HonoVariables }>) {
  return c.json({
    status: "ok",
    version: "0.1.0",
    timestamp: Date.now(),
  });
}

export async function handleReadyCheck(c: Context<{ Bindings: Env; Variables: HonoVariables }>) {
  try {
    // 1. Check D1 Database connectivity
    const d1Result = await c.env.DB?.prepare("SELECT 1 as ok").first<{ ok: number }>();
    const d1Healthy = d1Result?.ok === 1;

    // 2. Validate environment bindings and secrets (N2)
    const hasGameDO = !!c.env.GAME_SESSION_DO;
    const hasMatchmakerDO = !!c.env.MATCHMAKER_DO;
    const doHealthy = hasGameDO && hasMatchmakerDO;
    const envValidation = validateEnvironment(c.env);

    if (!d1Healthy || !doHealthy || !envValidation.valid) {
      return c.json(
        {
          ready: false,
          d1: d1Healthy,
          durableObjects: doHealthy,
          environment: envValidation,
          timestamp: Date.now(),
        },
        503,
      );
    }

    return c.json({
      ready: true,
      d1: true,
      durableObjects: true,
      environment: { valid: true },
      timestamp: Date.now(),
    });
  } catch (error: unknown) {
    const err = error as Error;
    return c.json(
      {
        ready: false,
        error: err.message || "Readiness check failed",
        timestamp: Date.now(),
      },
      503,
    );
  }
}

export const healthRoute = new Hono<{
  Bindings: Env;
  Variables: HonoVariables;
}>();

healthRoute.get("/", handleHealthCheck);
healthRoute.get("/ready", handleReadyCheck);

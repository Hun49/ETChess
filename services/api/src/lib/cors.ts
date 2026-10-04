import type { Env } from "../types";

/**
 * Returns the list of explicitly allowed origins.
 * In production, configured via env.ALLOWED_ORIGINS (comma-separated).
 * In local dev, falls back to safe localhost origins and BETTER_AUTH_URL.
 */
export function getAllowedOrigins(env: Env): string[] {
  if (env.ALLOWED_ORIGINS && env.ALLOWED_ORIGINS.trim().length > 0) {
    return env.ALLOWED_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }

  const origins = [
    "http://localhost:3000",
    "http://localhost:8787",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8787",
    "http://127.0.0.1:5173",
  ];

  if (env.BETTER_AUTH_URL && !origins.includes(env.BETTER_AUTH_URL)) {
    origins.push(env.BETTER_AUTH_URL);
  }

  return origins;
}

/**
 * Validates whether an incoming origin header matches the allowed origins.
 */
export function isAllowedOrigin(origin: string | null | undefined, env: Env): boolean {
  if (!origin) return false;
  const allowed = getAllowedOrigins(env);
  return allowed.includes(origin);
}

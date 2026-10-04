import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";

interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  message?: string;
  keyPrefix?: string;
}

interface ClientRecord {
  timestamps: number[];
}

/**
 * Sliding-window in-memory rate limiter middleware for Cloudflare Workers.
 */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler<{ Bindings: Env }> {
  const { windowSeconds, maxRequests, message, keyPrefix = "rl" } = options;
  const windowMs = windowSeconds * 1000;
  const store = new Map<string, ClientRecord>();

  // Periodically clean up stale client entries
  const cleanup = () => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < windowMs);
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    }
  };

  return async (c, next) => {
    const ip =
      c.req.header("cf-connecting-ip") ||
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";

    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    cleanup();

    let record = store.get(key);
    if (!record) {
      record = { timestamps: [] };
      store.set(key, record);
    }

    // Filter out timestamps outside window
    record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

    if (record.timestamps.length >= maxRequests) {
      const oldest = record.timestamps[0];
      const resetInSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));

      c.res.headers.set("Retry-After", String(resetInSeconds));
      c.res.headers.set("X-RateLimit-Limit", String(maxRequests));
      c.res.headers.set("X-RateLimit-Remaining", "0");
      c.res.headers.set(
        "X-RateLimit-Reset",
        String(Math.ceil((now + resetInSeconds * 1000) / 1000)),
      );

      return c.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: message || "Too many requests. Please slow down.",
          },
        },
        429,
      );
    }

    record.timestamps.push(now);

    c.res.headers.set("X-RateLimit-Limit", String(maxRequests));
    c.res.headers.set("X-RateLimit-Remaining", String(maxRequests - record.timestamps.length));

    await next();
  };
}

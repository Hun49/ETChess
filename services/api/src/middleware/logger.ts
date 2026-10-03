import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";
import type { HonoVariables } from "./session";

export const requestLoggerMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: HonoVariables;
}> = async (c, next) => {
  const start = performance.now();
  const requestId = c.req.header("cf-ray") || c.req.header("x-request-id") || crypto.randomUUID();

  c.set("requestId", requestId);

  try {
    await next();
  } finally {
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    c.res.headers.set("X-Request-ID", requestId);

    const user = c.get("user");
    const status = c.res.status;

    // Structured JSON log without PII (user ID only, no email or name)
    const logEntry = {
      level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
      type: "http_request",
      timestamp: new Date().toISOString(),
      requestId,
      method: c.req.method,
      path: c.req.path,
      status,
      latencyMs,
      userId: user?.id ?? null,
    };

    if (status >= 500) {
      console.error(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }
};

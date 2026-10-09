import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./auth";
import { GameSessionDO } from "./do/GameSessionDO";
import { MatchmakerDO } from "./do/MatchmakerDO";
import { UserPresenceDO } from "./do/UserPresenceDO";
import { isAllowedOrigin } from "./lib/cors";
import { globalErrorHandler, globalNotFoundHandler } from "./middleware/errorHandler";
import { requestLoggerMiddleware } from "./middleware/logger";
import { type HonoVariables, sessionMiddleware } from "./middleware/session";
import { adminRoute } from "./routes/admin";
import { challengesRoute } from "./routes/challenges";
import { friendsRoute } from "./routes/friends";
import { gamesRoute } from "./routes/games";
import { guestRoute } from "./routes/guest";
import { handleHealthCheck, handleReadyCheck, healthRoute } from "./routes/health";
import { metaRoute } from "./routes/meta";
import { reportsRoute } from "./routes/reports";
import { ticketRoute } from "./routes/tickets";
import { usersRoute } from "./routes/users";
import type { Env } from "./types";

export { GameSessionDO, MatchmakerDO, UserPresenceDO };

const app = new Hono<{
  Bindings: Env;
  Variables: HonoVariables;
}>();

// 1. Request ID and Structured Logging (First middleware in pipeline)
app.use("*", requestLoggerMiddleware);

// 2. Global CORS Middleware with strict allowlist (C4)
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      if (!origin) return null;
      return isAllowedOrigin(origin, c.env) ? origin : null;
    },
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "Cookie", "X-Request-ID"],
    exposeHeaders: ["X-Request-ID"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

// 3. Global Error and 404 Handlers
app.onError(globalErrorHandler);
app.notFound(globalNotFoundHandler);

// 4. Health and Readiness Endpoints
app.get("/health", handleHealthCheck);
app.get("/ready", handleReadyCheck);
app.route("/health", healthRoute);

// 5. Guest Session Endpoint (before general Better Auth handler)
app.route("/api/auth/guest", guestRoute);

// 6. Explicitly reject deprecated email/password authentication endpoints
app.all("/api/auth/sign-up/email", (c) =>
  c.json(
    {
      code: "EMAIL_PASSWORD_DISABLED",
      message:
        "Email and password authentication is disabled. Please use Google or GitHub sign in.",
    },
    400,
  ),
);
app.all("/api/auth/sign-in/email", (c) =>
  c.json(
    {
      code: "EMAIL_PASSWORD_DISABLED",
      message:
        "Email and password authentication is disabled. Please use Google or GitHub sign in.",
    },
    400,
  ),
);

// 7. Better Auth API Handlers
app.all("/api/auth/*", async (c) => {
  const auth = createAuth(c.env);
  try {
    return await auth.handler(c.req.raw);
  } catch (error: unknown) {
    if (error && typeof error === "object") {
      const err = error as Record<string, unknown>;
      const statusCode =
        typeof err.statusCode === "number"
          ? err.statusCode
          : typeof err.status === "number"
            ? err.status
            : 400;
      const body = err.body || {
        error: {
          code: "VALIDATION_FAILED",
          message: err.message || "Authentication error",
        },
      };
      return c.json(body, statusCode as 400);
    }
    throw error;
  }
});

// Diagnostic route to verify environment variables loaded into workerd memory
app.get("/api/debug-auth-env", (c) => {
  return c.json({
    clientIdPrefix: c.env.GOOGLE_CLIENT_ID ? c.env.GOOGLE_CLIENT_ID.slice(0, 12) : null,
    secretPrefix: c.env.GOOGLE_CLIENT_SECRET ? c.env.GOOGLE_CLIENT_SECRET.slice(0, 6) : null,
    secretLength: c.env.GOOGLE_CLIENT_SECRET?.length ?? 0,
    hasResendKey: !!c.env.RESEND_API_KEY,
    betterAuthUrl: c.env.BETTER_AUTH_URL,
  });
});

// 7. Session Middleware on API routes
app.use("/api/*", sessionMiddleware);

// 8. Chained Routes for Hono RPC
const routes = app
  .route("/api/meta", metaRoute)
  .route("/api/ws-ticket", ticketRoute)
  .route("/api/games", gamesRoute)
  .route("/api/users", usersRoute)
  .route("/api/friends", friendsRoute)
  .route("/api/challenges", challengesRoute)
  .route("/api/reports", reportsRoute)
  .route("/api/admin", adminRoute);

// 9. WebSocket Proxy to GameSessionDO
app.get("/ws/game/:gameId", async (c) => {
  const origin = c.req.header("origin");
  if (origin && !isAllowedOrigin(origin, c.env)) {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Cross-origin WebSocket connections from this origin are not allowed",
        },
      },
      403,
    );
  }

  // Reject tickets in query strings to prevent access log leakage (N8)
  if (c.req.query("ticket")) {
    return c.json(
      {
        error: {
          code: "INVALID_AUTH_TRANSPORT",
          message:
            "WebSocket tickets must not be passed in query strings. Authenticate using first-frame AUTH frame.",
        },
      },
      400,
    );
  }

  if (c.req.header("upgrade")?.toLowerCase() !== "websocket") {
    return c.json(
      {
        error: {
          code: "UPGRADE_REQUIRED",
          message: "Expected WebSocket upgrade",
        },
      },
      426,
    );
  }
  const gameId = c.req.param("gameId");
  const ns = c.env.GAME_SESSION_DO;
  const id = ns.idFromName(gameId);
  const stub = ns.get(id);
  return stub.fetch(c.req.raw);
});

// 10. WebSocket Proxy to MatchmakerDO or UserPresenceDO (/ws/user and /ws/user/:userId)
app.get("/ws/user/:userId?", async (c) => {
  const origin = c.req.header("origin");
  if (origin && !isAllowedOrigin(origin, c.env)) {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Cross-origin WebSocket connections from this origin are not allowed",
        },
      },
      403,
    );
  }

  // Reject tickets in query strings to prevent access log leakage (N8)
  if (c.req.query("ticket")) {
    return c.json(
      {
        error: {
          code: "INVALID_AUTH_TRANSPORT",
          message:
            "WebSocket tickets must not be passed in query strings. Authenticate using first-frame AUTH frame.",
        },
      },
      400,
    );
  }

  if (c.req.header("upgrade")?.toLowerCase() !== "websocket") {
    return c.json(
      {
        error: {
          code: "UPGRADE_REQUIRED",
          message: "Expected WebSocket upgrade",
        },
      },
      426,
    );
  }

  const userIdParam = c.req.param("userId") || c.req.header("x-user-id");
  if (userIdParam && c.env.USER_PRESENCE_DO) {
    const stub = c.env.USER_PRESENCE_DO.get(c.env.USER_PRESENCE_DO.idFromName(userIdParam));
    return stub.fetch(c.req.raw);
  }

  const id = c.env.MATCHMAKER_DO.idFromName("global");
  const stub = c.env.MATCHMAKER_DO.get(id);
  return stub.fetch(c.req.raw);
});

export type AppType = typeof routes;
export default app;

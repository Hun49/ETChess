import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./auth";
import { GameRoomDO } from "./do/GameRoomDO";
import { MatchmakerDO } from "./do/MatchmakerDO";
import { globalErrorHandler, globalNotFoundHandler } from "./middleware/errorHandler";
import { requestLoggerMiddleware } from "./middleware/logger";
import { type HonoVariables, sessionMiddleware } from "./middleware/session";
import { adminRoute } from "./routes/admin";
import { gamesRoute } from "./routes/games";
import { guestRoute } from "./routes/guest";
import { handleHealthCheck, handleReadyCheck, healthRoute } from "./routes/health";
import { metaRoute } from "./routes/meta";
import { ticketRoute } from "./routes/tickets";
import { usersRoute } from "./routes/users";
import type { Env } from "./types";

export { GameRoomDO, MatchmakerDO };

const app = new Hono<{
  Bindings: Env;
  Variables: HonoVariables;
}>();

// 1. Request ID and Structured Logging (First middleware in pipeline)
app.use("*", requestLoggerMiddleware);

// 2. Global CORS Middleware
app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
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

// 6. Better Auth API Handlers
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

// 7. Session Middleware on API routes
app.use("/api/*", sessionMiddleware);

// 8. Chained Routes for Hono RPC
const routes = app
  .route("/api/meta", metaRoute)
  .route("/api/ws-ticket", ticketRoute)
  .route("/api/games", gamesRoute)
  .route("/api/users", usersRoute)
  .route("/api/admin", adminRoute);

// 9. WebSocket Proxy to GameRoomDO
app.get("/ws/game/:roomId", async (c) => {
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
  const roomId = c.req.param("roomId");
  const id = c.env.GAME_ROOM_DO.idFromName(roomId);
  const stub = c.env.GAME_ROOM_DO.get(id);
  return stub.fetch(c.req.raw);
});

// 10. WebSocket Proxy to MatchmakerDO
app.get("/ws/matchmaker", async (c) => {
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
  const id = c.env.MATCHMAKER_DO.idFromName("global");
  const stub = c.env.MATCHMAKER_DO.get(id);
  return stub.fetch(c.req.raw);
});

export type AppType = typeof routes;
export default app;

import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./auth";
import { GameRoomDO } from "./do/GameRoomDO";
import { MatchmakerDO } from "./do/MatchmakerDO";
import { type HonoVariables, sessionMiddleware } from "./middleware/session";
import { adminRoute } from "./routes/admin";
import { gamesRoute } from "./routes/games";
import { metaRoute } from "./routes/meta";
import { usersRoute } from "./routes/users";
import type { Env } from "./types";

export { GameRoomDO, MatchmakerDO };

const app = new Hono<{
  Bindings: Env;
  Variables: HonoVariables;
}>();

// Global CORS Middleware
app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "Cookie"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

// Better Auth API Handlers
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
      const body = err.body || { message: err.message || "Authentication error" };
      return c.json(body, statusCode as 400);
    }
    throw error;
  }
});

// Session Middleware on API routes
app.use("/api/*", sessionMiddleware);

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: Date.now() });
});

// Chained Routes for Hono RPC
const routes = app
  .route("/api/meta", metaRoute)
  .route("/api/games", gamesRoute)
  .route("/api/users", usersRoute)
  .route("/api/admin", adminRoute);

// WebSocket Proxy to GameRoomDO
app.get("/ws/game/:roomId", async (c) => {
  if (c.req.header("upgrade")?.toLowerCase() !== "websocket") {
    return c.text("Expected WebSocket upgrade", 426);
  }
  const roomId = c.req.param("roomId");
  const id = c.env.GAME_ROOM_DO.idFromName(roomId);
  const stub = c.env.GAME_ROOM_DO.get(id);
  return stub.fetch(c.req.raw);
});

// WebSocket Proxy to MatchmakerDO
app.get("/ws/matchmaker", async (c) => {
  if (c.req.header("upgrade")?.toLowerCase() !== "websocket") {
    return c.text("Expected WebSocket upgrade", 426);
  }
  const id = c.env.MATCHMAKER_DO.idFromName("global");
  const stub = c.env.MATCHMAKER_DO.get(id);
  return stub.fetch(c.req.raw);
});

export type AppType = typeof routes;
export default app;

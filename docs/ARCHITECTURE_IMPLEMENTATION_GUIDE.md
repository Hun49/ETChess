# ET Chess — Architecture & Implementation Guide
**Authoritative Reference Implementation & Canonical Engineering Standards**
*Document Version: 1.0.0 (October 2026)*

This guide provides the official implementation patterns, verified code templates, and architectural rules for ET Chess. All patterns adhere directly to the official documentation of Cloudflare Workers, Durable Objects WebSocket Hibernation, D1, Drizzle ORM, Hono, Better Auth, chess.js, and Turborepo.

---

## Table of Contents
1. [Monorepo & Tooling Architecture](#1-monorepo--tooling-architecture)
2. [Cloudflare Workers & Hono API (`services/api`)](#2-cloudflare-workers--hono-api-servicesapi)
3. [Cloudflare D1 & Drizzle ORM](#3-cloudflare-d1--drizzle-orm)
4. [Authentication with Better Auth on Cloudflare Workers](#4-authentication-with-better-auth-on-cloudflare-workers)
5. [Realtime Engine: Durable Objects & WebSocket Hibernation](#5-realtime-engine-durable-objects--websocket-hibernation)
6. [Chess Logic Core (`packages/chess-core`)](#6-chess-logic-core-packageschess-core)
7. [Bot Engine & Stockfish WASM (`packages/bot-engine`)](#7-bot-engine--stockfish-wasm-packagesbot-engine)
8. [Realtime Protocol & Message Schemas (`packages/realtime-protocol`)](#8-realtime-protocol--message-schemas-packagesrealtime-protocol)
9. [Frontend Applications & Client State](#9-frontend-applications--client-state)
10. [Quality Gates, Testing & CI Standards](#10-quality-gates-testing--ci-standards)

---

## 1. Monorepo & Tooling Architecture

### 1.1 Tooling Summary
- **Package Manager**: `pnpm` (v11.x) with workspaces (`pnpm-workspace.yaml`).
- **Orchestration**: `turbo` (v2.x) with high-efficiency task caching.
- **Linter & Formatter**: Biome (v1.9.x) replaces ESLint and Prettier for sub-second formatting and linting.
- **TypeScript**: Shared base configuration with `strict: true` across all packages.

### 1.2 `pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
  - "services/*"
  - "packages/*"
```

### 1.3 `turbo.json` (Turborepo 2.x Schema)
```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".wrangler/**", ".output/**"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "check-types": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**/*.tsx", "src/**/*.ts", "test/**/*.ts"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### 1.4 `biome.json` (Root Configuration)
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": true,
    "includes": ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.json"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error"
      },
      "style": {
        "useConst": "error"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always"
    }
  }
}
```

### 1.5 `packages/config/tsconfig.base.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "types": []
  }
}
```

---

## 2. Cloudflare Workers & Hono API (`services/api`)

### 2.1 Hono Application Entry Point (`services/api/src/index.ts`)
```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./auth";
import { gamesRouter } from "./routes/games";
import { usersRouter } from "./routes/users";
import { matchmakingRouter } from "./routes/matchmaking";

export type Bindings = {
  DB: D1Database;
  GAME_ROOM_DO: DurableObjectNamespace;
  MATCHMAKER_DO: DurableObjectNamespace;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  APP_ENV: "development" | "production" | "test";
};

export type Variables = {
  auth: ReturnType<typeof createAuth>;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 1. Global Middleware: CORS
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      // Allow local development and production domains
      const allowed = ["http://localhost:3000", "http://localhost:3001", "https://etchanger.pages.dev"];
      return allowed.includes(origin) ? origin : allowed[0];
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

// 2. Inject per-request Better Auth instance
app.use("*", async (c, next) => {
  c.set("auth", createAuth(c.env));
  await next();
});

// 3. Mount Better Auth Handler (Before general API routes)
app.all("/api/auth/*", (c) => {
  const auth = c.get("auth");
  return auth.handler(c.req.raw);
});

// 4. Mount RPC Routers
const routes = app
  .route("/api/games", gamesRouter)
  .route("/api/users", usersRouter)
  .route("/api/matchmaking", matchmakingRouter);

// Export RPC AppType for client generation
export type AppType = typeof routes;

export default app;

// Re-export Durable Objects
export { GameRoomDO } from "./do/GameRoomDO";
export { MatchmakerDO } from "./do/MatchmakerDO";
```

### 2.2 Hono RPC Endpoint Pattern (`services/api/src/routes/games.ts`)
```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Bindings, Variables } from "../index";

export const gamesRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()
  .get(
    "/:id",
    zValidator("param", z.object({ id: z.string().uuid() })),
    async (c) => {
      const { id } = c.req.valid("param");
      // Access Cloudflare D1 via c.env.DB
      return c.json({
        id,
        status: "active",
        createdAt: new Date().toISOString(),
      });
    }
  )
  .post(
    "/create",
    zValidator(
      "json",
      z.object({
        timeControl: z.enum(["1+0", "3+0", "3+2", "5+0", "10+0", "15+10", "30+0"]),
        rated: z.boolean(),
      })
    ),
    async (c) => {
      const body = c.req.valid("json");
      const gameId = crypto.randomUUID();
      return c.json({ gameId, ...body }, 201);
    }
  );
```

### 2.3 Type-Safe Hono RPC Client Usage (Web / Mobile / Admin)
```typescript
import { hc } from "hono/client";
import type { AppType } from "@etchess/api";

export const api = hc<AppType>("http://localhost:8787", {
  init: {
    credentials: "include", // Required for Better Auth session cookies
  },
});

// Type-safe consumption with automatic query / param inference
export async function fetchGame(id: string) {
  const res = await api.api.games[":id"].$get({
    param: { id },
  });
  if (!res.ok) throw new Error("Failed to fetch game");
  return await res.json();
}
```

---

## 3. Cloudflare D1 & Drizzle ORM

### 3.1 Critical Architecture Caveats for Cloudflare D1
> [!WARNING]
> 1. **No Interactive Transactions**: Cloudflare D1 does **not** support interactive `BEGIN / COMMIT` transactions (`db.transaction` throws an error). You **must** use `db.batch([stmt1, stmt2, ...])` for atomic operations.
> 2. **Parameter Limit**: SQLite in D1 enforces a maximum of **100 bound parameters** per SQL statement. Bulk inserts must be chunked into batches of fewer than 100 total parameters.
> 3. **SQLite Specific Types**: D1 uses SQLite storage classes: `integer`, `real`, `text`, `blob`. Timestamps are stored as `integer` (UNIX epoch milliseconds) or ISO 8601 strings.

### 3.2 Schema Definition (`services/api/src/db/schema.ts`)
```typescript
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// 1. Users Table (Aligned with Better Auth + ET Chess profile)
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  role: text("role", { enum: ["user", "admin", "moderator"] }).notNull().default("user"),
  banned: integer("banned", { mode: "boolean" }).notNull().default(false),
  banReason: text("ban_reason"),
});

// 2. Ratings Table (Glicko-2)
export const ratings = sqliteTable(
  "ratings",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    category: text("category", { enum: ["bullet", "blitz", "rapid", "classical"] }).notNull(),
    rating: integer("rating").notNull().default(1500),
    deviation: integer("deviation").notNull().default(350), // Glicko-2 RD
    volatility: integer("volatility").notNull().default(60), // Glicko-2 sigma (scaled)
    gamesPlayed: integer("games_played").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("rating_user_category_idx").on(table.userId, table.category),
  ]
);

// 3. Completed Games Archive
export const games = sqliteTable("games", {
  id: text("id").primaryKey(),
  whiteUserId: text("white_user_id").references(() => users.id),
  blackUserId: text("black_user_id").references(() => users.id),
  rated: integer("rated", { mode: "boolean" }).notNull().default(true),
  timeControl: text("time_control").notNull(), // e.g. "3+2"
  result: text("result", { enum: ["1-0", "0-1", "1/2-1/2", "aborted"] }).notNull(),
  termination: text("termination", {
    enum: ["checkmate", "timeout", "resignation", "draw_agreement", "stalemate", "repetition", "insufficient_material", "forfeit_disconnect", "abandoned"]
  }).notNull(),
  movesPgn: text("moves_pgn").notNull(),
  startFen: text("start_fen").notNull(),
  endFen: text("end_fen").notNull(),
  whiteRatingDiff: integer("white_rating_diff"),
  blackRatingDiff: integer("black_rating_diff"),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp_ms" }).notNull(),
});
```

### 3.3 Atomic Batch Operations (The D1 Way)
```typescript
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { games, ratings } from "./schema";

export async function archiveGameAtomic(
  d1: D1Database,
  gameData: typeof games.$inferInsert,
  whiteRatingUpdate: { userId: string; category: "blitz"; rating: number; deviation: number },
  blackRatingUpdate: { userId: string; category: "blitz"; rating: number; deviation: number }
) {
  const db = drizzle(d1);

  // Executed as an atomic batch in a single D1 round-trip:
  return await db.batch([
    db.insert(games).values(gameData),
    db.update(ratings)
      .set({
        rating: whiteRatingUpdate.rating,
        deviation: whiteRatingUpdate.deviation,
        updatedAt: new Date(),
      })
      .where(eq(ratings.userId, whiteRatingUpdate.userId)),
    db.update(ratings)
      .set({
        rating: blackRatingUpdate.rating,
        deviation: blackRatingUpdate.deviation,
        updatedAt: new Date(),
      })
      .where(eq(ratings.userId, blackRatingUpdate.userId)),
  ]);
}
```

---

## 4. Authentication with Better Auth on Cloudflare Workers

### 4.1 Better Auth Factory Pattern (`services/api/src/auth.ts`)
```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import type { Bindings } from "./index";
import * as schema from "./db/schema";

export function createAuth(env: Bindings) {
  const db = drizzle(env.DB, { schema });

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://etchanger.pages.dev",
    ],
    emailAndPassword: {
      enabled: true,
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes cookie cache in edge worker
      },
    },
  });
}
```

### 4.2 Auth Session Middleware (`services/api/src/middleware/session.ts`)
```typescript
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Bindings, Variables } from "../index";

export const requireAuth = createMiddleware<{
  Bindings: Bindings;
  Variables: Variables & { user: { id: string; name: string; email: string } };
}>(async (c, next) => {
  const auth = c.get("auth");
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session || !session.user) {
    throw new HTTPException(401, { message: "Unauthorized access required" });
  }

  c.set("user", session.user);
  await next();
});
```

---

## 5. Realtime Engine: Durable Objects & WebSocket Hibernation

### 5.1 GameRoomDO Implementation (`services/api/src/do/GameRoomDO.ts`)
```typescript
import { DurableObject } from "cloudflare:workers";
import type { Bindings } from "../index";

interface PlayerAttachment {
  userId: string;
  role: "white" | "black" | "spectator";
  connectedAt: number;
}

export class GameRoomDO extends DurableObject<Bindings> {
  // Durable Object SQLite state or in-memory snapshot
  private gameActive = false;
  private whiteConnected = false;
  private blackConnected = false;

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      const upgradeHeader = request.headers.get("Upgrade");
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 });
      }

      const userId = url.searchParams.get("userId") || "anonymous";
      const role = (url.searchParams.get("role") || "spectator") as "white" | "black" | "spectator";

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // 1. Accept WebSocket with hibernation API & tagging
      this.ctx.acceptWebSocket(server, [role, `user:${userId}`]);

      // 2. Persist connection metadata across hibernations (up to 16KB)
      const attachment: PlayerAttachment = {
        userId,
        role,
        connectedAt: Date.now(),
      };
      server.serializeAttachment(attachment);

      // Track connection state
      if (role === "white") this.whiteConnected = true;
      if (role === "black") this.blackConnected = true;

      // Broadcast presence update
      this.broadcast(JSON.stringify({ type: "PRESENCE_UPDATE", role, status: "connected" }));

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not Found", { status: 404 });
  }

  // Invoked by Cloudflare runtime when a message arrives (waking DO if hibernated)
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = ws.deserializeAttachment() as PlayerAttachment;
    if (typeof message !== "string") return;

    try {
      const event = JSON.parse(message);

      switch (event.type) {
        case "MOVE":
          this.handleMove(attachment, event.payload);
          break;
        case "RESIGN":
          this.handleResign(attachment);
          break;
        case "OFFER_DRAW":
          this.handleDrawOffer(attachment);
          break;
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: "ERROR", message: "Invalid payload format" }));
    }
  }

  // Invoked when connection closes (cleanly or unexpectedly)
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    const attachment = ws.deserializeAttachment() as PlayerAttachment;
    if (!attachment) return;

    if (attachment.role === "white") this.whiteConnected = false;
    if (attachment.role === "black") this.blackConnected = false;

    this.broadcast(JSON.stringify({
      type: "PLAYER_DISCONNECTED",
      role: attachment.role,
      gracePeriodMs: 60_000,
    }));

    // If a game is active and a player disconnected, schedule 60s forfeit alarm
    if (this.gameActive && (!this.whiteConnected || !this.blackConnected)) {
      const existingAlarm = await this.ctx.storage.getAlarm();
      if (!existingAlarm) {
        // Schedule forfeit exactly 60 seconds from now
        await this.ctx.storage.setAlarm(Date.now() + 60_000);
      }
    }
  }

  // Cloudflare Alarm handler: Executes flag fall & 60-second disconnect forfeits
  async alarm(): Promise<void> {
    if (!this.gameActive) return;

    // Check if either player is still disconnected
    if (!this.whiteConnected) {
      this.finishGame("0-1", "forfeit_disconnect");
    } else if (!this.blackConnected) {
      this.finishGame("1-0", "forfeit_disconnect");
    }
  }

  private handleMove(player: PlayerAttachment, payload: { from: string; to: string; promotion?: string }): void {
    // 1. Validate move with pure chess-core engine
    // 2. Update clocks and next alarm
    // 3. Broadcast move to all sockets
    this.broadcast(JSON.stringify({ type: "MOVE_MADE", payload, player: player.role }));
  }

  private handleResign(player: PlayerAttachment): void {
    const result = player.role === "white" ? "0-1" : "1-0";
    this.finishGame(result, "resignation");
  }

  private handleDrawOffer(player: PlayerAttachment): void {
    const opponentTag = player.role === "white" ? "black" : "white";
    const sockets = this.ctx.getWebSockets(opponentTag);
    for (const s of sockets) {
      s.send(JSON.stringify({ type: "DRAW_OFFERED", from: player.role }));
    }
  }

  private finishGame(result: string, termination: string): void {
    this.gameActive = false;
    this.broadcast(JSON.stringify({ type: "GAME_ENDED", result, termination }));
    // Persist result into D1
  }

  private broadcast(data: string): void {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        // Connection dead; cleaned up on next close event
      }
    }
  }
}
```

---

## 6. Chess Logic Core (`packages/chess-core`)

All chess operations are pure functions that wrap `chess.js` to guarantee immutability, deterministic game verification, and zero side effects.

### 6.1 Move Validation & Execution (`packages/chess-core/src/move.ts`)
```typescript
import { Chess } from "chess.js";

export interface MoveInput {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
}

export interface GameStateSnapshot {
  fen: string;
  turn: "w" | "b";
  isGameOver: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  isStalemate: boolean;
  isThreefoldRepetition: boolean;
  isInsufficientMaterial: boolean;
  sanHistory: string[];
}

export function validateAndApplyMove(
  currentFen: string,
  move: MoveInput
): { valid: true; snapshot: GameStateSnapshot } | { valid: false; reason: string } {
  const chess = new Chess(currentFen);

  try {
    const result = chess.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion || "q",
    });

    if (!result) {
      return { valid: false, reason: "Illegal chess move" };
    }

    return {
      valid: true,
      snapshot: {
        fen: chess.fen(),
        turn: chess.turn(),
        isGameOver: chess.isGameOver(),
        isCheck: chess.inCheck(),
        isCheckmate: chess.isCheckmate(),
        isDraw: chess.isDraw(),
        isStalemate: chess.isStalemate(),
        isThreefoldRepetition: chess.isThreefoldRepetition(),
        isInsufficientMaterial: chess.isInsufficientMaterial(),
        sanHistory: chess.history(),
      },
    };
  } catch (e) {
    return { valid: false, reason: (e as Error).message };
  }
}
```

### 6.2 Pure Clock Calculation (`packages/chess-core/src/clock.ts`)
```typescript
export interface ClockConfig {
  initialMs: number;
  incrementMs: number;
}

export interface ClockState {
  whiteMs: number;
  blackMs: number;
  lastMoveTimestamp: number;
  activeTurn: "w" | "b";
}

export function calculateClockAfterMove(
  clock: ClockState,
  config: ClockConfig,
  currentTimestamp: number
): { whiteMs: number; blackMs: number; flagged: boolean } {
  const elapsed = Math.max(0, currentTimestamp - clock.lastMoveTimestamp);

  let whiteMs = clock.whiteMs;
  let blackMs = clock.blackMs;

  if (clock.activeTurn === "w") {
    whiteMs = whiteMs - elapsed + config.incrementMs;
  } else {
    blackMs = blackMs - elapsed + config.incrementMs;
  }

  const flagged = whiteMs <= 0 || blackMs <= 0;

  return {
    whiteMs: Math.max(0, whiteMs),
    blackMs: Math.max(0, blackMs),
    flagged,
  };
}
```

---

## 7. Bot Engine & Stockfish WASM (`packages/bot-engine`)

Stockfish runs strictly client-side via a single-threaded WebAssembly build inside a dedicated Web Worker. This eliminates the need for `SharedArrayBuffer` and `Cross-Origin-Embedder-Policy` (COOP/COEP) headers. The backend never computes bot moves.

### 7.1 Bot Tiers & Skill Levels
```typescript
export interface BotTierConfig {
  name: string;
  elo: number;
  skillLevel: number; // 0 to 20 in Stockfish
  depthLimit: number;
  timeLimitMs: number;
}

export const BOT_TIERS: Record<string, BotTierConfig> = {
  beginner: { name: "Sparky", elo: 800, skillLevel: 1, depthLimit: 3, timeLimitMs: 400 },
  intermediate: { name: "Rooki", elo: 1300, skillLevel: 6, depthLimit: 7, timeLimitMs: 800 },
  advanced: { name: "Grandmaster Bot", elo: 2000, skillLevel: 14, depthLimit: 12, timeLimitMs: 1500 },
  master: { name: "Stockfish Max", elo: 2800, skillLevel: 20, depthLimit: 18, timeLimitMs: 2500 },
};
```

### 7.2 UCI Protocol Worker Controller (`packages/bot-engine/src/stockfishWorker.ts`)
```typescript
export class StockfishController {
  private worker: Worker | null = null;
  private onMoveCallback: ((move: string) => void) | null = null;

  init(workerUrl: string): Promise<void> {
    return new Promise((resolve) => {
      this.worker = new Worker(workerUrl);

      this.worker.onmessage = (event: MessageEvent<string>) => {
        const line = event.data;
        if (line === "uciok") {
          resolve();
        } else if (line.startsWith("bestmove")) {
          const move = line.split(" ")[1];
          if (this.onMoveCallback && move) {
            this.onMoveCallback(move);
          }
        }
      };

      this.sendCommand("uci");
    });
  }

  setTier(tier: BotTierConfig): void {
    this.sendCommand("ucinewgame");
    this.sendCommand(`setoption name Skill Level value ${tier.skillLevel}`);
  }

  requestMove(fen: string, tier: BotTierConfig, onMove: (move: string) => void): void {
    this.onMoveCallback = onMove;
    this.sendCommand(`position fen ${fen}`);
    this.sendCommand(`go depth ${tier.depthLimit} movetime ${tier.timeLimitMs}`);
  }

  sendCommand(cmd: string): void {
    this.worker?.postMessage(cmd);
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
```

---

## 8. Realtime Protocol & Message Schemas (`packages/realtime-protocol`)

All WebSocket communication between clients and Cloudflare Durable Objects is strictly typed and validated using Zod.

### 8.1 Protocol Definitions (`packages/realtime-protocol/src/messages.ts`)
```typescript
import { z } from "zod";

// Client -> Server Messages
export const ClientMoveSchema = z.object({
  type: z.literal("MOVE"),
  payload: z.object({
    from: z.string().regex(/^[a-h][1-8]$/),
    to: z.string().regex(/^[a-h][1-8]$/),
    promotion: z.enum(["q", "r", "b", "n"]).optional(),
  }),
});

export const ClientResignSchema = z.object({
  type: z.literal("RESIGN"),
});

export const ClientDrawOfferSchema = z.object({
  type: z.literal("OFFER_DRAW"),
});

export const ClientDrawResponseSchema = z.object({
  type: z.literal("RESPOND_DRAW"),
  accepted: z.boolean(),
});

export const ClientFrameSchema = z.discriminatedUnion("type", [
  ClientMoveSchema,
  ClientResignSchema,
  ClientDrawOfferSchema,
  ClientDrawResponseSchema,
]);

export type ClientFrame = z.infer<typeof ClientFrameSchema>;

// Server -> Client Messages
export const ServerMoveMadeSchema = z.object({
  type: z.literal("MOVE_MADE"),
  payload: z.object({
    from: z.string(),
    to: z.string(),
    promotion: z.string().optional(),
    fen: z.string(),
  }),
  whiteMs: z.number(),
  blackMs: z.number(),
});

export const ServerGameEndedSchema = z.object({
  type: z.literal("GAME_ENDED"),
  result: z.enum(["1-0", "0-1", "1/2-1/2", "aborted"]),
  termination: z.string(),
  whiteRatingDiff: z.number().optional(),
  blackRatingDiff: z.number().optional(),
});

export const ServerDisconnectSchema = z.object({
  type: z.literal("PLAYER_DISCONNECTED"),
  role: z.enum(["white", "black"]),
  gracePeriodMs: z.number(),
});

export const ServerFrameSchema = z.discriminatedUnion("type", [
  ServerMoveMadeSchema,
  ServerGameEndedSchema,
  ServerDisconnectSchema,
]);

export type ServerFrame = z.infer<typeof ServerFrameSchema>;
```

---

## 9. Frontend Applications & Client State

### 9.1 React Board Component Integration (`react-chessboard`)
```tsx
import React, { useState } from "react";
import { Chessboard } from "react-chessboard";
import { validateAndApplyMove } from "@etchess/chess-core";

interface ChessGameProps {
  initialFen?: string;
  orientation: "white" | "black";
  onSendMove: (move: { from: string; to: string; promotion?: string }) => void;
}

export const PlayableBoard: React.FC<ChessGameProps> = ({
  initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  orientation,
  onSendMove,
}) => {
  const [fen, setFen] = useState(initialFen);

  function handlePieceDrop(sourceSquare: string, targetSquare: string, piece: string) {
    const move = {
      from: sourceSquare,
      to: targetSquare,
      promotion: piece[1]?.toLowerCase() === "p" ? "q" : undefined,
    };

    // Optimistic local validation
    const result = validateAndApplyMove(fen, move);
    if (!result.valid) return false;

    setFen(result.snapshot.fen);
    onSendMove(move);
    return true;
  }

  return (
    <div className="w-full max-w-[600px] aspect-square">
      <Chessboard
        position={fen}
        boardOrientation={orientation}
        onPieceDrop={handlePieceDrop}
        customBoardStyle={{
          borderRadius: "8px",
          boxShadow: "0 5px 15px rgba(0, 0, 0, 0.3)",
        }}
        customDarkSquareStyle={{ backgroundColor: "#779952" }}
        customLightSquareStyle={{ backgroundColor: "#edeed1" }}
      />
    </div>
  );
};
```

---

## 10. Quality Gates, Testing & CI Standards

1. **Strict TypeScript (`strict: true`)**: Zero `any` policy. All protocol messages and API RPC types must compile without any unchecked access.
2. **Biome Quality Check**:
   ```bash
   pnpm biome check --write .
   ```
3. **Pure Logic Unit Testing**: Every function in `packages/chess-core` and `packages/rating` must have 100% Vitest coverage.
4. **Cloudflare Worker Integration Testing**: Workers and Durable Objects tested using `@cloudflare/vitest-pool-workers`.
5. **No Local State Divergence**: Web, Mobile, and Server must share `@etchess/types`, `@etchess/chess-core`, and `@etchess/realtime-protocol`.

---
*Maintained under ET Chess Specification standards (docs/SRS.md).*

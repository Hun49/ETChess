# ET Chess — Master Handoff & Developer Architecture Bible

> **Document Version**: 1.0.0  
> **Date**: October 2026  
> **Target Audience**: Incoming Lead Developer / Engineering Partner  
> **Repository Root**: `/Users/hunwork/Documents/Work/ETChess`  
> **Stack**: Turborepo, Cloudflare Workers (Hono), Cloudflare Durable Objects, Cloudflare D1 (SQLite + Drizzle ORM), Cloudflare R2, Better Auth, Glicko-2, chess.js (strictly encapsulated), React 19 (Web & Admin), React Native / Expo (Mobile), Zustand v5, Tailwind CSS, Biome.

---

## 1. Project Summary

**ET Chess** is a modern, production-grade, ultra-low-latency online chess platform built for high concurrency and competitive integrity. It consists of:
- A high-performance **Edge API and Realtime Backend** running on Cloudflare Workers and Durable Objects.
- A **Web Application** (`apps/web`) built with React 19, Tailwind CSS, and Zustand.
- An **Admin & Moderation Portal** (`apps/admin`) built with React 19 for real-time live match observation, player moderation, rating adjustments, and system observability.
- A **Cross-Platform Mobile App** (`apps/mobile`) built with Expo / React Native.
- Six core shared packages (`@etchess/types`, `@etchess/chess-core`, `@etchess/rating`, `@etchess/bot-engine`, `@etchess/realtime-protocol`, `@etchess/assets`).

### Core Engineering Principles
1. **Authoritative Server**: The client is strictly a rendering terminal. Clients never decide clocks, remaining time, game results, rating calculations, move legality, or player identities.
2. **Mathematical Isolation**: All chess rule logic lives strictly inside `packages/chess-core`. Outside code (API, Durable Objects, Web, Mobile) is strictly forbidden from importing `chess.js` directly.
3. **Durable Before Visible**: State mutations and timers are committed to persistent Durable Object storage *before* any WebSocket frames are broadcast to clients.
4. **Single-Alarm Multiplexer**: Each Durable Object schedules exactly one alarm at `min(dueAt)`. Alarm wakes re-validate authoritative state before mutating anything, dropping stale alarms silently.
5. **Zero Trust & Replay Guards**: Realtime tickets are HMAC-SHA256 signed, scoped to specific games or user channels, expire in 30 seconds, and are strictly single-use backed by DO storage.

---

## 2. What Has Actually Been Built (Verified, Tested, Zero BS)

This is a factual account of the code as it exists in the repository right now. Everything listed here is implemented, passes automated tests, and compiles cleanly with zero TypeScript errors and zero linter warnings.

### 2.1 Backend Services (`services/api`)
- **Cloudflare Workers Edge Server** (`services/api/src/index.ts`):
  - HTTP routing with **Hono**.
  - WebSocket proxies to Durable Objects for `/ws/game/:gameId` and `/ws/user`.
  - CORS with strict configurable allowlist (`ALLOWED_ORIGINS`).
  - Structured request logger with UUID `X-Request-ID` propagation.
  - Global error handling returning RFC-compliant `{ error: { code, message } }`.
  - Readiness and health endpoints (`/health`, `/ready`) validating D1 database connectivity, Durable Object namespace bindings, and minimum 32-character security secrets.
- **Authentication & Sessions**:
  - **Better Auth** with D1 SQLite adapter (`services/api/src/auth.ts`).
  - Fallback D1 session token reader supporting Bearer tokens and cookies (`sessionMiddleware.ts`).
  - First-class **Guest Account System** (`/api/auth/guest`): generates anonymous players with UUID identifiers, 30-day session cookies, and isolated guest rate limits.
  - Role-based access control (`user`, `moderator`, `admin`).
- **Realtime Game Session Engine** (`GameSessionDO.ts`):
  - Cloudflare Durable Objects with **WebSocket Hibernation API**.
  - Authoritative clock engine: computes elapsed time, applies time control increments (from ply 2 onwards), caps network lag credit strictly at 100ms (`LAG_CREDIT_CAP_MS`), and bounds client-measured RTT to prevent retroactive time theft.
  - Authoritative move pipeline: validates ply sequence (`expectedPly`), validates turn, executes moves via `packages/chess-core`, checks terminal states (checkmate, stalemate, repetition, 50-move rule, dead positions).
  - Mutual draw offer negotiation and handling.
  - Resignation and game abandonment handling.
  - Takeback system: restricted to unrated friend games, rolls back 1 or 2 plies, restores exact clock timestamps and move history.
  - Early abort rules: game aborted with zero rating delta if fewer than 2 plies have been played.
  - Disconnect handling: 60-second grace period with `OPPONENT_PRESENCE` broadcasts, automatically forfeiting the disconnected player if they fail to return.
  - Heartbeat watchdog: checks active connections every 15 seconds; silent socket drops without clean TCP closure trigger disconnect grace periods automatically.
  - WebSocket security: rate limits connections to 25 messages/second (persisted across hibernation), enforces 16KB frame cap, and closes violators with RFC standard code `1008` (Policy Violation) or `1009` (Message Too Big).
  - Query ticket elimination: enforces first-frame `{ type: "AUTH", payload: { ticket } }` message within 5 seconds, rejecting tickets passed in plaintext URL query strings to avoid access log leaks.
  - Single-alarm architecture: single alarm synchronizes to `min(dueAt)` of active timers (`FIRST_MOVE_DEADLINE`, `CLOCK_FLAG`, `DISCONNECT_GRACE`, `AUTO_CLOSE`, `FINALIZE_RETRY`, `HEARTBEAT_WATCHDOG`). Stale alarms waking prematurely or after moves do not mutate state.
  - Exactly-once game finalization: atomic batch transaction to D1 updating game records, calculating unrounded Glicko-2 ratings, incrementing win/loss/draw counters, with idempotency guards (`persistedToD1` flag).
- **Matchmaking Engine** (`MatchmakerDO.ts`):
  - Global singleton Durable Object managing queue state.
  - Supports Bullet (1+0, 2+1), Blitz (3+0, 3+2, 5+0, 5+3), Rapid (10+0, 15+10), and Classical (30+0) categories.
  - Dynamic Elo search window expansion: starts at ±100 Elo, expands by +50 Elo every 5 seconds, capped at ±600 Elo (`RULE-06`).
  - Active game concurrency lock: prevents a player from queuing or playing multiple simultaneous live matches.
  - Anti-smurfing / anti-farming rule: restricts players from playing more than 5 rated games against the same opponent within a rolling 24-hour window (`RULE-05`).
  - 120-second queue timeout with automatic eviction and status notification.
  - Sockets track liveness and watchdog sweeps dead sockets after 30 seconds of inactivity.
  - Clean disconnect cleanup removing queued players if their socket closes.
- **REST Endpoints**:
  - `/api/ws-ticket`: Issues single-use, HMAC-SHA256 signed tickets with 30-second expiry for game or user socket authentication.
  - `/api/users`: Current profile (`/me`), user lookup (`/:id`), leaderboard by rating category (`/leaderboard/:category`), profile updates, and avatar uploads to R2 with binary magic-byte inspection (JPEG, PNG, WebP) and size limits.
  - `/api/games`: Game list with pagination, user match history (`/user/:userId`), game detail (`/:id`), and raw PGN export (`/:id/pgn`). Protected against IDOR: unrated and private challenge games are strictly invisible to third parties.
  - `/api/friends`: Friend requests, accept, reject, list friends, remove friends.
  - `/api/challenges`: Direct challenges, challenge links, accept, decline, cancel.
  - `/api/reports`: Player reporting with reason, details, and linked game IDs.
  - `/api/admin`: Metrics dashboard, live game listing, game termination, player banning/unbanning, report triage, audit logs, and rating manual adjustments.
  - `/api/meta`: Protocol version, server version, and authoritative product rules.

### 2.2 Shared Packages (`packages/`)
- **`@etchess/chess-core`**:
  - Encapsulates `chess.js` completely.
  - `validateAndApplyMove`: Pure function applying moves from FEN strings, returning SAN, UCI, new FEN, turn, check, checkmate, stalemate, repetition, and insufficient material flags.
  - `calculateClockAfterMove` & `calculateLagCredit`: Pure clock calculation with 100ms lag credit cap and increment rules.
  - `checkTimeoutResult`: Authoritative FIDE rule implementation. When a player runs out of time: if the opponent has theoretical mating material, the opponent wins (`1-0` or `0-1`); otherwise, it is a draw (`1/2-1/2`).
  - `applyTakeback`: Reconstructs game state, move list, and clocks by rolling back plies.
  - `buildPgn`: Generates standard 7-tag roster PGN strings with move history.
- **`@etchess/rating`**:
  - Complete, faithful implementation of the **Glicko-2** rating system (`glicko2.ts`).
  - Computes rating, rating deviation (RD), and rating volatility ($\sigma$) based on match outcomes.
  - Supports rating deviation expansion over periods of inactivity.
  - Stores continuous unrounded float values in database to prevent rounding drift.
- **`@etchess/bot-engine`**:
  - UCI protocol parsing and engine bridge (`uci.ts`).
  - Bot handle manager (`botHandle.ts`) with 4 preconfigured bot profiles:
    - **Easy** (Elo ~800, high blunder rate, shallow depth).
    - **Medium** (Elo ~1200, occasional blunders).
    - **Hard** (Elo ~1600, tactical awareness).
    - **Master** (Elo ~2000, high depth, minimal blunders).
- **`@etchess/realtime-protocol`**:
  - Versioned schemas (`PROTOCOL_VERSION = 1`) with strict Zod validators.
  - Client-to-server frames: `AUTH`, `MOVE_INTENT`, `MOVE`, `DRAW_OFFER`, `DRAW_RESPONSE`, `RESIGN`, `TAKEBACK_REQUEST`, `TAKEBACK_RESPONSE`, `HEARTBEAT_PING`, `QUEUE_JOIN`, `QUEUE_LEAVE`.
  - Server-to-client frames: `AUTH_SUCCESS`, `GAME_SNAPSHOT`, `MOVE_ACCEPTED`, `MOVE_REJECTED`, `GAME_TERMINATED`, `OPPONENT_PRESENCE`, `TAKEBACK_OFFERED`, `TAKEBACK_RESOLVED`, `MATCH_FOUND`, `QUEUE_STATUS`, `ERROR`.
- **`@etchess/types`**:
  - Canonical domain definitions: `ClockState`, `StoredGameSessionState`, `TimeControlKey`, `RatingCategory`, `PRODUCT_RULES`, `WS_CLOSE_CODES`, `ApiErrorCode`.
- **`@etchess/assets`**:
  - Full SVG chess piece set (King, Queen, Rook, Bishop, Knight, Pawn for white and black) licensed under CC BY-SA 3.0.
  - Helper functions for generating SVG data URLs and inline SVGs.

### 2.3 Frontend Applications (`apps/`)
- **`apps/web`**:
  - Full React 19 Single Page Application built with Vite.
  - State managed via Zustand (`apps/web/src/store/gameStore.ts`).
  - Views: Home, Online Matchmaking, Play vs Computer, Play vs Friend, Analysis Board, Game History, User Profile, Settings.
  - Modals: Auth (login/signup/guest), Matchmaking queue modal, Game over modal, Takeback modal, Draw modal, Leaderboards.
  - Sound effects for moves, captures, checks, and game end.
- **`apps/admin`**:
  - Dedicated admin web app running on Vite and React 19.
  - Views: System Health, Live Games Inspector (with live board view modal), User Moderation (ban/unban/role change), Reports triage, Audit Logs, Rating management.
- **`apps/mobile`**:
  - Cross-platform React Native / Expo app.
  - State managed via Zustand (`apps/mobile/src/store/mobileStore.ts`).
  - Views: Home, Play Online, Play Computer, Pass & Play Local, Matchmaking modal, Game over modal, Profile, History.
  - Haptic feedback integration (`expo-haptics`).
  - Secure credential storage (`expo-secure-store`).

---

## 3. What Every Folder Is & Does

```
ETChess/
├── .github/              # GitHub Actions CI workflows
│   └── workflows/ci.yml  # Master automated pipeline (Lint, Typecheck, Test, Build)
├── apps/                 # User-facing applications
│   ├── admin/            # React 19 Admin & Moderation web application
│   ├── mobile/           # Expo / React Native mobile application
│   └── web/              # React 19 Player web application
├── docs/                 # Authoritative technical specifications & UX guides
│   ├── API_REALTIME_CONTRACT.md          # Complete REST & WebSocket specification
│   ├── ARCHITECTURE_IMPLEMENTATION_GUIDE.md # Official implementation reference guide
│   ├── ET-Chess-UX-Specification.md      # UI/UX wireframes & design rules
│   └── SRS.md                            # Software Requirements Specification
├── packages/             # Shared internal monorepo libraries
│   ├── assets/           # Piece SVG vector assets and asset generators
│   ├── bot-engine/       # UCI protocol adapter & offline computer bot engine
│   ├── chess-core/       # Pure chess rules, move validator, clock math & PGN
│   ├── config/           # Base tsconfig and build configurations
│   ├── rating/           # Glicko-2 rating engine and rating conversion rules
│   ├── realtime-protocol/# Zod frame validators for game & matchmaking sockets
│   └── types/            # Canonical domain models, product rules, error codes
├── prep files/           # Legacy UI mockups and early SRS drafts
├── services/             # Backend serverless services
│   └── api/              # Cloudflare Workers API, D1 ORM, Durable Objects
└── [Root Config Files]   # Monorepo tooling, lockfiles, turbo configurations
```

---

## 4. What Every File Does (Exhaustive Catalog)

### 4.1 Root Directory Files
- `package.json`: Root monorepo definition, scripts (`build`, `dev`, `lint`, `lint:fix`, `format`, `check-types`, `test`, `ci`), and dev dependencies (Biome, Turborepo, TypeScript).
- `pnpm-workspace.yaml`: Declares workspace members (`apps/*`, `services/*`, `packages/*`).
- `turbo.json`: Turborepo pipeline configuration defining build, test, check-types, and lint dependencies and caching outputs.
- `biome.json`: Biome linter and formatter configuration enforcing strict code style, 2-space indentation, double quotes, and standard lint rules.
- `.node-version`: Pins Node.js version to 22.
- `.npmrc`: Configures pnpm behavior (strict peer dependencies, auto-install peers).
- `.gitignore`: Standard exclusion list for Node, Vite, Turbo, Cloudflare Wrangler, Expo, and environment files.
- `LICENSE` & `SECURITY.md`: Project licensing and vulnerability reporting policy.

---

### 4.2 Shared Packages (`packages/`)

#### `packages/types/`
- `package.json` & `tsconfig.json`: Package configuration exporting `@etchess/types`.
- `src/index.ts`: Central barrel exporting all type definitions.
- `src/rules.ts`: Defines canonical `PRODUCT_RULES` constants (lag credit cap: 100ms, disconnect grace: 60s, first move deadline: 30s, matchmaking start range: ±100, widen step: +50, widen interval: 5s, cap range: ±600, matchmaking timeout: 120s, max 5 rated games per opponent per 24 hours).
- `src/timeControls.ts`: Defines `TIME_CONTROLS` map and `TimeControlKey` (`1+0`, `2+1`, `3+0`, `3+2`, `5+0`, `5+3`, `10+0`, `15+10`, `30+0`).
- `src/ratings.ts`: Defines `RatingCategory` (`bullet`, `blitz`, `rapid`, `classical`) and `getRatingCategory(tc)` resolver.
- `src/game.ts`: Game state types (`GameStatus`, `GameResult`, `PlayerRole`, `Square`, `PieceSymbol`).
- `src/user.ts`: User profile, role, session data models.
- `src/bot.ts`: Computer difficulty levels (`easy`, `medium`, `hard`, `master`) and bot metadata.
- `src/errors.ts`: Standard error codes (`ApiErrorCode`) and WebSocket close codes (`WS_CLOSE_CODES`).
- `test/rules.test.ts`: Verifies rule constants and time control category mapping.
- `test/architecture_and_boundaries.test.ts`: Architectural boundary check ensuring `chess.js` is never imported outside `packages/chess-core`.

#### `packages/chess-core/`
- `src/index.ts`: Re-exports chess functionality and safely re-exports necessary types from `chess.js`.
- `src/fen.ts`: FEN validation and starting position constant (`STARTING_FEN`).
- `src/move.ts`: `validateAndApplyMove(fen, move)` applying moves, returning SAN, UCI, new FEN, turn, and game end flags.
- `src/clock.ts`: `calculateClockAfterMove` and `calculateLagCredit`, pure functions computing clocks with lag credit and increments.
- `src/timeout.ts`: `checkTimeoutResult(fen, flaggingColor)` determining whether flag fall results in a win or draw based on theoretical mating material.
- `src/takeback.ts`: `applyTakeback(moves, plies)` rolling back plies and re-computing authoritative board state.
- `src/pgn.ts`: `buildPgn` generating standard 7-tag PGN files.
- `test/*.test.ts`: 25 unit tests covering moves, clocks, takebacks, timeout edge cases, and PGN generation.

#### `packages/rating/`
- `src/index.ts`: Re-exports rating engine.
- `src/constants.ts`: Glicko-2 default constants (default rating 1500, default RD 350, default vol 0.06, tau 0.5).
- `src/glicko2.ts`: Mathematical implementation of Glicko-2 calculations for 1v1 matches.
- `src/gameResult.ts`: Match pairing and 24-hour match cap helper (`shouldRefuseRatedPair`).
- `test/glicko2.test.ts` & `test/gameResult.test.ts`: Tests verifying rating updates, draw handling, RD decay, and 24h rated match caps.

#### `packages/bot-engine/`
- `src/index.ts`: Re-exports bot engine components.
- `src/uci.ts`: Parses and formats UCI engine messages (`uci`, `isready`, `ucinewgame`, `position`, `go`, `bestmove`).
- `src/botHandle.ts`: `BotHandle` class executing moves for the selected difficulty level.
- `test/*.test.ts`: Verifies UCI parsing and bot move generation.

#### `packages/realtime-protocol/`
- `src/index.ts`: Barrel file exporting frame parsers.
- `src/gameMessages.ts`: Zod schemas for `/ws/game/:gameId` client and server frames.
- `src/matchmakerMessages.ts` & `src/userMessages.ts`: Zod schemas for `/ws/user` matchmaking frames.
- `test/protocol.test.ts`: Tests validating frame validation, error rejection, and discriminated union typing.

#### `packages/assets/`
- `src/index.ts` & `src/pieces.ts`: Vector SVG assets for classic chess pieces and inline SVG string generators.
- `pieces/classic/*.svg`: Individual SVG files for all 12 pieces.
- `LICENSE-CC-BY-SA-3.0`: Attribution document for piece artwork.

---

### 4.3 Backend Service (`services/api/`)

#### Configuration & Root Files
- `package.json`: Service dependencies (Hono, Better Auth, Drizzle ORM, Vitest, Cloudflare Workers types).
- `tsconfig.json`: TypeScript configuration targeting Cloudflare Workers runtime.
- `wrangler.jsonc`: Cloudflare configuration defining bindings: D1 database (`DB`), R2 bucket (`AVATARS_BUCKET`), Durable Objects (`GAME_SESSION_DO`, `MATCHMAKER_DO`), environment variables (`ENVIRONMENT`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`), and staging/production targets.
- `drizzle.config.ts`: Drizzle ORM migration configuration targeting D1.
- `vitest.config.ts`: Vitest configuration utilizing `@cloudflare/vitest-pool-workers`.
- `drizzle/*.sql`: D1 SQL migration files initializing schema tables and indexes.

#### Source Files (`services/api/src/`)
- `index.ts`: Main entry point mounting middlewares, REST routes, WebSocket upgrade proxies, and exporting Durable Object classes.
- `auth.ts`: Better Auth instance initialized with D1 SQLite adapter.
- `types.ts`: TypeScript definition of Cloudflare `Env` bindings.
- **`middleware/`**:
  - `logger.ts`: Request logger middleware generating and tracking `X-Request-ID`.
  - `errorHandler.ts`: Catches uncaught errors and formats standard JSON error shapes.
  - `session.ts`: Authenticates incoming cookies/Bearer tokens, populating `c.get("user")` and `c.get("session")`.
  - `rateLimit.ts`: In-memory IP rate limiter for sensitive endpoints.
- **`do/` (Durable Objects)**:
  - `GameSessionDO.ts`: Complete game session Durable Object managing active game state, clocks, moves, WebSockets, alarms, and finalization.
  - `MatchmakerDO.ts`: Global matchmaking Durable Object managing player queues, rating range expansion, pairing, and user channel WebSockets.
- **`routes/`**:
  - `health.ts`: Liveness (`/health`) and readiness (`/ready`) endpoints checking D1, Durable Objects, and secret strength.
  - `meta.ts`: Public platform metadata (`/api/meta`).
  - `guest.ts`: Guest creation endpoint (`/api/auth/guest`).
  - `tickets.ts`: Issues single-use HMAC WebSocket tickets (`/api/ws-ticket`).
  - `users.ts`: Profile retrieval, updates, leaderboards, and R2 avatar upload/delete.
  - `games.ts`: Game history, game details, and PGN export with IDOR protection.
  - `friends.ts`: Friend relationships, requests, accept/reject, removal.
  - `challenges.ts`: Direct user-to-user challenges and shareable link challenges.
  - `reports.ts`: Player reporting endpoint.
  - `admin.ts`: Admin moderation suite (live games, terminate, ban/unban, triage reports, rating adjustments, audit logs).
- **`lib/`**:
  - `secrets.ts`: Retrieves and validates `BETTER_AUTH_SECRET` and `WS_TICKET_SECRET` (failing closed if < 32 characters), and provides `validateEnvironment(env)`.
  - `wsTicket.ts`: Mints and verifies HMAC-SHA256 WebSocket tickets; implements `TicketReplayGuard` backed by DO storage.
  - `ratingStorage.ts`: Reads and updates user ratings in D1, handling unrounded continuous floats.
  - `observability.ts`: `MetricsCollector` formatting structured metrics logs.
  - `cors.ts`: Origin validation helper.
  - `notifier.ts`: Push/WebSocket notification dispatch helper.
  - `adminSeed.ts`: Helper for initializing admin users.
- **`db/`**:
  - `schema.ts`: Drizzle SQLite schema for `user`, `session`, `account`, `verification`, `ratings`, `games`, `reports`, `auditLogs`, `friends`, `challenges`.
- **`test/`**:
  - 20 comprehensive test suites with 154 automated tests verifying every aspect of security, durability, matchmaking, clocks, ratings, and APIs.

---

### 4.4 Web Application (`apps/web/`)
- `vite.config.ts`, `tsconfig.json`, `index.html`: Vite setup.
- `src/main.tsx` & `src/App.tsx`: App bootstrapping, routing, and layout shell.
- `src/index.css`: Tailwind CSS styling with custom chess board styles.
- `src/store/gameStore.ts`: Complete Zustand state store managing active view, game mode, board state, WebSocket connections, clock tickers, move history, sounds, and user session.
- `src/lib/api.ts`: API client interfacing with backend REST endpoints.
- `src/lib/sound.ts`: Audio synthesizer triggering move, capture, check, and game over sounds.
- `src/lib/localUciEngine.ts`: Offline web-worker chess bot adapter.
- `src/components/ChessBoardView.tsx`: Interactive SVG chess board supporting drag-and-drop and click-to-move, rendering legal move indicators and last move highlights.
- `src/components/TopBar.tsx`, `Sidebar.tsx`, `Navbar.tsx`, `MobileNav.tsx`: Navigation chrome.
- `src/components/GameControls.tsx`, `MoveHistory.tsx`: In-game evaluation, move list, resign, draw offer, and takeback buttons.
- `src/components/AuthModal.tsx`, `MatchmakingModal.tsx`, `GameOverModal.tsx`, `ProfileModal.tsx`, `LeaderboardModal.tsx`: Interactive modal dialogs.
- `src/views/InGameView.tsx`: Live game view rendering board, player cards, and clocks.
- `src/views/PlayOnlineView.tsx`: Matchmaking time control selection view.
- `src/views/PlayFriendView.tsx`: Challenge link and direct friend challenge view.
- `src/views/PlayComputerView.tsx`: Bot difficulty selection and offline play view.
- `src/views/AnalysisView.tsx`: Interactive analysis board with FEN/PGN import.
- `src/views/GameHistoryView.tsx`: User match history with PGN download and replay links.
- `src/views/ProfileView.tsx` & `SettingsView.tsx`: Profile customization and board theme preferences.

---

### 4.5 Admin Application (`apps/admin/`)
- `vite.config.ts`, `tsconfig.json`, `index.html`: Vite build setup.
- `src/api.ts`: Typed API client for admin endpoints.
- `src/types.ts`: Admin data types (metrics, audit logs, reports, live games).
- `src/views/DashboardView.tsx`: Real-time KPI cards (active games, online players, reports pending).
- `src/views/LiveGamesView.tsx`: Live match inspector allowing administrators to observe active games in real time and terminate suspicious games.
- `src/views/UsersView.tsx`: Player management table supporting search, ban, unban, and role changes.
- `src/views/ReportsView.tsx`: Triage queue for user reports with action notes.
- `src/views/AuditLogsView.tsx`: Immutable security audit log viewer.
- `src/views/RatingsView.tsx`: Rating adjustment tools.
- `src/components/ChessBoardModal.tsx`: Visual board preview modal for live games.

---

### 4.6 Mobile Application (`apps/mobile/`)
- `app.json`, `package.json`, `tsconfig.json`: Expo configuration.
- `App.tsx`: Navigation container and root layout.
- `src/store/mobileStore.ts`: Mobile Zustand store managing offline and online game state.
- `src/services/apiClient.ts`: Mobile API client managing tokens in Expo SecureStore.
- `src/services/realtimeClient.ts`: Mobile WebSocket manager with automatic reconnection and heartbeat ping loops.
- `src/services/haptics.ts`: Haptic feedback triggers for moves, captures, and errors.
- `src/components/ChessBoard.tsx`: Touch-optimized chess board for iOS and Android.
- `src/components/GameClock.tsx`: High-precision mobile clock component.
- `src/views/InGameView.tsx`: In-game layout with responsive orientation.
- `src/views/PlayOnlineView.tsx`, `PlayFriendView.tsx`, `PlayComputerView.tsx`, `LocalPlayView.tsx`: Game mode selection views.

---

## 5. Every Core Logic & Subsystem Explained

### 5.1 The Authoritative Move Pipeline
When a player makes a move on the web or mobile client:
1. **Client Sends Frame**: The client sends a `MOVE_INTENT` frame containing `{ from, to, promotion, expectedPly }`.
2. **Size & Rate Check**: `GameSessionDO.webSocketMessage` checks frame size (capped at 16KB) and per-connection rate limit (max 25 messages/second). Violators are closed with code `1008`. Counters are preserved via `ws.serializeAttachment`.
3. **Authentication & Authorization**: The socket attachment is checked for `authenticated: true`. The server verifies that `attachment.role` matches the player whose turn it is (`state.turn === 'w' ? 'white' : 'black'`).
4. **Sequence Verification (`expectedPly`)**: The server compares `payload.expectedPly === state.ply`. If mismatched, the move is rejected with `OUT_OF_SYNC`, preventing race conditions or duplicate network frames from mutating state out of order.
5. **Pure Chess Validation**: `validateAndApplyMove` in `@etchess/chess-core` validates the move against the authoritative FEN. If illegal, `MOVE_REJECTED` with reason `ILLEGAL_MOVE` is returned.
6. **Clock & Lag Credit Calculation**:
   - The server computes raw elapsed time: `now - lastMoveServerTime`.
   - Clocks only tick if both players have made their first move (`ply >= 2`). Before ply 2, elapsed time is zero (`RULE-01`).
   - Server-measured RTT is clamped to a maximum of 200ms (`LAG_CREDIT_CAP_MS * 2`).
   - Lag credit is computed: $\min(\lfloor \text{RTT} / 2 \rfloor, 100\text{ms})$.
   - Effective elapsed time is subtracted from the active player's clock.
   - If the clock hits 0, `handleTimeout` is called immediately.
   - Increment (e.g. +2s) is credited to the player who just moved.
7. **State Mutation**: The board FEN, SAN move string, ply counter, and clock history are updated. Open draw offers are automatically invalidated upon move execution (`RULE-M1`).
8. **Terminal State Check**: Checkmate, stalemate, threefold repetition, 50-move rule, and insufficient material are evaluated.
9. **Next Timer Scheduled**: If the game continues, the single alarm is scheduled for the earlier of the active player's clock expiration or the next heartbeat watchdog check (15s).
10. **Durable Before Visible**: `await this.persistState()` commits state and timers to DO storage in an atomic transaction.
11. **Broadcast**: `this.broadcast({ type: "MOVE_ACCEPTED", ... })` transmits the move to all authenticated sockets.

### 5.2 Authoritative Clock Math & Lag Compensation
```
Raw Elapsed = max(0, ServerNow - LastMoveServerTimestamp)
Credit = min(max(0, round(MeasuredRTT / 2)), 100ms)
Effective Elapsed = max(0, Raw Elapsed - Credit)
New Clock = Old Clock - Effective Elapsed + Increment
```
- **First Move Hold (`RULE-01`)**: Clocks do not start ticking until both white and black have completed move 1 (i.e. `ply >= 2`). White has 30 seconds to play move 1; Black has 30 seconds to play move 1. Missing this deadline aborts the match with no rating change.
- **Lag Credit Cap (`RULE-04`)**: Network latency compensation cannot exceed 100ms per move under any circumstance.
- **Server RTT Authority**: In `HEARTBEAT_PING`, the server computes RTT from ping response timestamps and strictly clamps the stored RTT to $\le 200\text{ms}$. Clients can never claim arbitrary network latency to buy extra time.

### 5.3 FIDE Timeout Rules (Mating Material Check)
When player A's clock reaches 0:
- The server does **not** automatically award a win to player B.
- Instead, `checkTimeoutResult(fen, playerAColor)` runs:
  - Can player B mathematically checkmate player A with the remaining pieces on the board?
  - If **YES** $\rightarrow$ Player B wins (`1-0` or `0-1`).
  - If **NO** (e.g. Player B only has a bare King, King + Knight, or King + Bishop) $\rightarrow$ The game ends in a **Draw** (`1/2-1/2`).

### 5.4 Disconnect Grace Period & Heartbeat Watchdogs
- When a player socket closes or errors, `webSocketClose` checks if that player has any other open sockets. If not, the player is marked `connected = false` and `disconnectedAt = Date.now()`.
- A `DISCONNECT_GRACE` timer is scheduled for `now + 60,000ms` (60 seconds, `RULE-02`).
- An `OPPONENT_PRESENCE` frame with `{ status: "disconnected", gracePeriodRemainingMs: 60000 }` is broadcast.
- If the player reconnects within 60 seconds:
  - The `DISCONNECT_GRACE` timer is cancelled.
  - The player receives a fresh `GAME_SNAPSHOT`.
  - An `OPPONENT_PRESENCE` frame with `{ status: "connected" }` is broadcast.
- If the timer expires:
  - If `ply < 2`: The match is aborted with no rating delta.
  - If `ply >= 2`: The disconnected player forfeits; the opponent is awarded the win.
- **Heartbeat Watchdog (`N4`)**: Sockets that lose connectivity silently (e.g. mobile airplane mode) without TCP FIN are detected by the DO's 15-second watchdog timer, which automatically initiates the disconnect grace period.

### 5.5 Single-Alarm Architecture & Precision
Cloudflare Durable Objects permit only **one** alarm to be scheduled at any time:
- In ET Chess, all pending events are stored in `this.timers: StoredTimer[]`.
- `this.syncAlarm()` sets the DO alarm to `Math.min(...this.timers.map(t => t.dueAt))`.
- When `alarm()` wakes:
  - It filters `dueTimers = this.timers.filter(t => t.dueAt <= now + 100)`. The `+100ms` threshold accounts for minor clock jitter while guaranteeing future timers are never prematurely fired.
  - Each timer is validated against current state. For example: if a `CLOCK_FLAG` timer was scheduled for ply 14, but the player already played ply 14, the timer is recognized as stale and dropped with zero side effects.
  - Unfinished timers remain in storage, and `syncAlarm()` re-arms for the next earliest due date.

### 5.6 Finalization & D1 Idempotency
When a game reaches a terminal state (`checkmate`, `stalemate`, `timeout`, `resignation`, `abandoned`, `aborted`):
- `GameSessionDO.finalizeGame()` executes.
- If `state.finalized && state.persistedToD1`, it exits immediately.
- If rated and not aborted, Glicko-2 ratings are calculated for both players.
- D1 batch execution commits:
  1. `games` table record insertion (with moves, result, termination, rating deltas, start/end timestamps).
  2. `ratings` table updates (continuous float ratings, RD, volatility, games/wins/losses/draws counts).
- Upon success, `state.persistedToD1 = true` and `state.finalized = true` are stored.
- If D1 fails (e.g. transient network blip), a `FINALIZE_RETRY` timer is scheduled with exponential backoff. Retries are completely idempotent: ratings are never double-applied.

### 5.7 Matchmaking Engine & Anti-Abuse
- **Search Expansion (`RULE-06`)**:
  $$\text{Search Range} = \min(100 + \lfloor \text{Elapsed Seconds} / 5 \rfloor \times 50, 600)$$
- **Anti-Self-Match**: A user cannot match with themselves under any condition.
- **Active Game Lock (`H10`)**: Before queueing, `MatchmakerDO` verifies the player has no active game in progress. If they do, they are rejected with `ALREADY_IN_GAME`.
- **Anti-Farming 24h Cap (`RULE-05`)**: D1 is queried for matches between the pair in the past 24 hours. If they have already played 5 rated games, matchmaking refuses to pair them for rated play (`shouldRefuseRatedPair`).

### 5.8 WebSocket Tickets & Replay Prevention
- Clients request a ticket via `POST /api/ws-ticket` with their session Bearer token or cookie.
- The server mints an HMAC-SHA256 token containing `{ userId, userName, rating, userRole, scope, gameId, exp, jti }` with a 30-second TTL.
- Upon connecting to the WebSocket, the client transmits `{ type: "AUTH", payload: { ticket } }`.
- The receiving Durable Object verifies the HMAC signature, checks expiration, verifies scope (`game` vs `user`), and checks `TicketReplayGuard`.
- `TicketReplayGuard` records the `jti` in DO storage. If a ticket is presented a second time, it is rejected with `Ticket already used` and closed with code `4001`.

### 5.9 Game-History IDOR Protection (`H9`)
- Public rated matchmaking games are queryable by anyone.
- Private challenges and unrated friend matches (`!game.rated`) require authorization:
  - `GET /api/games/:id` and `GET /api/games/:id/pgn` return `403 FORBIDDEN` if the requester is neither the white player, black player, nor an admin.
  - `GET /api/games/user/:userId` filters out unrated/casual games if requested by a third party, preventing leakage of private match histories.

---

## 6. Project Info & Tech Stack

| Component | Technology | Version | Notes |
| :--- | :--- | :--- | :--- |
| **Package Manager** | `pnpm` | `11.21.0` | Workspace configuration via `pnpm-workspace.yaml` |
| **Monorepo Engine** | `Turborepo` | `^2.4.4` | Caching tasks, linting, building, and tests |
| **Linter / Formatter**| `Biome` | `1.9.4` | Unified sub-second checks |
| **Edge API Runtime** | `Cloudflare Workers` | Workerd Node compat | Fast, distributed serverless execution |
| **Realtime Storage** | `Cloudflare Durable Objects` | SQLite storage backend | Hibernation WebSockets, stateful game rooms |
| **Relational DB** | `Cloudflare D1` | SQLite | Schema managed via Drizzle ORM |
| **Object Storage** | `Cloudflare R2` | S3-compatible | Avatar storage with magic-byte validation |
| **Auth System** | `Better Auth` | `^1.1.0` | D1 SQLite adapter, email/password, Google OAuth, Guests |
| **Rating System** | `Glicko-2` | Custom implementation | Continuous unrounded float storage |
| **Chess Engine** | `chess.js` | `^1.4.0` | Strictly encapsulated inside `packages/chess-core` |
| **Web App** | `React` / `Vite` / `Tailwind` | `19.3.0` / `6.4.3` | SPA client state via Zustand v5 |
| **Admin Portal** | `React` / `Vite` / `Tailwind` | `19.3.0` / `6.4.3` | SPA admin tools |
| **Mobile App** | `React Native` / `Expo` | `52.0.0` | Cross-platform iOS/Android |

---

## 7. Developer Getting Started Guide

### 7.1 Prerequisites
1. **Node.js**: Ensure Node.js 22+ is installed (`node -v`).
2. **pnpm**: Ensure pnpm 11+ is installed (`corepack enable && corepack prepare pnpm@11.21.0 --activate` or `npm install -g pnpm@11.21.0`).
3. **Cloudflare Wrangler CLI**: Installed automatically via devDependencies in `services/api`.

### 7.2 Initial Setup
1. **Install all dependencies**:
   ```bash
   pnpm install
   ```
2. **Configure Local Environment Secrets**:
   Copy the example environment file for the API:
   ```bash
   cp services/api/.dev.vars.example services/api/.dev.vars
   ```
   *Note: `services/api/.dev.vars` contains pre-configured 32+ character secrets for local development.*

### 7.3 Common Development Commands
Run all commands from the repository root:

- **Run all tests**:
  ```bash
  pnpm test
  ```
- **Run TypeScript check across all packages**:
  ```bash
  pnpm run check-types
  ```
- **Run linter and formatter check**:
  ```bash
  pnpm run lint
  ```
- **Fix linter and formatting issues**:
  ```bash
  pnpm run lint:fix
  ```
- **Build all packages and web/admin applications**:
  ```bash
  pnpm run build
  ```
- **Execute complete CI verification suite**:
  ```bash
  pnpm run ci
  ```

### 7.4 Running Locally in Development Mode
- **Start All Services Concurrently**:
  ```bash
  pnpm dev
  ```
- **Start Individual Applications**:
  - API Backend (port 8787):
    ```bash
    pnpm --filter @etchess/api dev
    ```
  - Web App (port 3000 / 5173):
    ```bash
    pnpm --filter @etchess/web dev
    ```
  - Admin App (port 3001):
    ```bash
    pnpm --filter @etchess/admin dev
    ```
  - Mobile App (Expo Metro bundler):
    ```bash
    pnpm --filter @etchess/mobile dev
    ```

### 7.5 Database Migrations (D1 + Drizzle)
When editing `services/api/src/db/schema.ts`:
1. Generate migration SQL files:
   ```bash
   pnpm --filter @etchess/api db:generate
   ```
2. Apply migrations locally:
   ```bash
   pnpm --filter @etchess/api db:migrate:local
   ```
3. Apply migrations to remote production D1:
   ```bash
   pnpm --filter @etchess/api db:migrate:prod
   ```

### 7.6 Architectural Invariants (DO NOT BREAK)
When extending the codebase, observe these rules:
1. **Never import `chess.js` outside `packages/chess-core`**: The architecture test (`packages/types/test/architecture_and_boundaries.test.ts`) will fail CI if any file outside `packages/chess-core` imports `chess.js`.
2. **Do not trust client timestamps or clocks**: All game timing must remain server-authoritative inside `GameSessionDO.ts`.
3. **Always call `ws.serializeAttachment(attachment)` after mutating socket metadata**: In Cloudflare Durable Objects WebSocket Hibernation API, mutating an object returned from `deserializeAttachment()` does not persist unless you serialize it back onto the socket.
4. **Never send tickets in query strings**: Tickets must be transmitted via the first-frame `{ type: "AUTH", payload: { ticket } }` message.
5. **Always maintain the single-alarm rule**: Do not try to schedule multiple DO alarms. Maintain the priority list in `timers` and synchronize to `min(dueAt)`.

---
*End of Master Handoff Document. Happy Hacking!*

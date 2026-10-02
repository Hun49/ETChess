# ET Chess — Software Requirements Specification (SRS)

> **Living spec for the ET Chess rebuild — v2.0 (2026-10-02).**
> All decisions about what to build, how to build it, and what stack to use are captured here first.
> Nothing gets built until it's in this document. Nothing in this document changes without an entry in the Decision Log (§20).

---

## Revision summary (v1 → v2)

**Decided by HUN**
- Tournaments dropped entirely (`TournamentDO` removed).
- A player disconnected for more than 60 seconds forfeits. Phones are not special-cased.
- In-game text chat included for all matches (with mute, block, and report).
- Optional 1-on-1 opt-in voice chat included for Private Friend games only (WebRTC peer-to-peer via `GameRoomDO` signaling).

**Fixes from the quality review** (marked *Proposed* in §20 until HUN confirms)
- Resolved contradictions: bots run client-side only (WASM on web, on-device on mobile); Expo Go dropped; time-control list unified; premoves are client-only.
- Added: game lifecycle and abort rules, Durable Object persistence rules, anti-abuse limits, REST API surface, matchmaking/queue protocol messages, security requirements, measurable NFRs, observability, CI quality gates, decision log, open items.
- Schema: `ratings` stores Glicko-2 rating, deviation, and volatility; `live_games`, `live_game_players`, `reports`, `user_blocks`, `audit_logs` added, `game_moves.fen_after` removed, result enum fixed.
- Cut from V1: time gift, openings search, admin Verifications/Settlements, extra piece styles beyond Classic, "Better Moves Every Day" banner, matchmaking ETA.

---

## 0. Conventions

- **Requirement IDs** (`GAME-`, `BOT-`, `RATE-`, `MM-`, `CHAL-`, `CHAT-`, `PROTO-`, `SEC-`, `NFR-`, `QA-`) identify testable requirements. **MUST** = required for V1. **SHOULD** = strongly preferred; deviation needs a Decision Log entry.
- Every requirement MUST be covered by an automated test or a documented manual check before it is marked done.
- Items marked **(OI-n)** depend on an Open Item in §21.
- Numeric limits in this document are **starting values**. They live in config constants (never inline) and may be tuned after measurement.

---

## 1. Project Overview

ET Chess is a chess platform with three surfaces:

- **Web App** — play in the browser: online, vs friend, vs computer, local pass & play.
- **Admin Dashboard** — manage users, games, reports, and platform health.
- **Mobile App** — iOS/Android, same modes as web. Computer and local play work fully offline.

All three share logic and types through a monorepo package system.

**Play modes (four only):** Online (random matchmaking), Friend (challenge by in-app invite or link), Computer (Stockfish bots), Local (pass & play).

---

## 2. Tech Stack ✅ LOCKED (except items marked OI)

### 2.1 Language & Tooling

| Concern | Choice |
|---|---|
| Language | TypeScript everywhere — `strict: true` in every `tsconfig.json` |
| Monorepo tooling | Turborepo + pnpm workspaces |
| Linting / Formatting | Biome |
| Git hooks | Husky + lint-staged |
| Package manager | pnpm |

### 2.2 Frontend — Web App

| Concern | Choice |
|---|---|
| Framework | React |
| Routing | TanStack Router |
| Data fetching / caching | TanStack Query |
| Client state | Zustand |
| Styling | Tailwind CSS |
| Icons | lucide-react |
| Chess board UI | react-chessboard |
| Hosting | Cloudflare Workers |

### 2.3 Frontend — Admin Dashboard

| Concern | Choice |
|---|---|
| Framework | React |
| Routing | TanStack Router |
| Data fetching / caching | TanStack Query |
| Client state | Zustand |
| Styling | Tailwind CSS |
| Icons | lucide-react |
| Hosting | Cloudflare Pages, behind Cloudflare Access (**OI-2**: verify Pages vs Workers static assets before building) |

### 2.4 Frontend — Mobile App

| Concern | Choice |
|---|---|
| Framework | React Native + Expo. **Development build / installable APK. Expo Go is NOT supported** (native Stockfish). |
| Routing | Expo Router (file-based) |
| Data fetching / caching | TanStack Query |
| Client state | Zustand (`persist` + AsyncStorage for **non-sensitive** state only: preferences, offline game queue) |
| Secure storage | `expo-secure-store` for session/auth tokens (never AsyncStorage) |
| Styling | NativeWind |
| Icons | lucide-react-native |
| Chess board UI | react-native-chessboard (Skia + Reanimated) |
| Gestures / Animation | react-native-gesture-handler, react-native-reanimated, @shopify/react-native-skia |

### 2.5 Backend / API

| Concern | Choice |
|---|---|
| Backend framework | Hono |
| Type-safe API client | Hono RPC (`hc`) — used in web, admin, mobile |
| Validation | Zod |
| Authentication | Better Auth |
| Database | Cloudflare D1 (SQLite) |
| ORM | Drizzle ORM |
| Object storage | Cloudflare R2 (avatars) |
| Realtime / WebSockets | Cloudflare Durable Objects (WebSocket Hibernation API) |
| WebRTC Signaling | Routed via `GameRoomDO` WebSocket channel for 1-on-1 friend voice |
| CLI | Wrangler |
| API hosting | Cloudflare Workers |

### 2.6 Chess Logic & Bot

| Concern | Choice |
|---|---|
| Chess rules engine | chess.js — wrapped exclusively inside `packages/chess-core` |
| Bot engine (web) | Stockfish WASM, **single-threaded build**, in a Web Worker (no SharedArrayBuffer / COOP-COEP headers required) |
| Bot engine (mobile) | Stockfish on-device (**OI-1**: approach to be proven by a spike before locking) |
| Bot protocol | UCI, implemented in `packages/bot-engine` |
| **Backend never runs bots** | Bot games are unrated, so they need no server authority |

### 2.7 Shared Packages

| Package | Purpose |
|---|---|
| `packages/chess-core` | Wraps chess.js. Pure functions: move validation, game-end detection, **clock logic** (pure, time passed in as input) |
| `packages/rating` | Pure Glicko-2 functions + constants |
| `packages/bot-engine` | Wraps Stockfish — `createBot(tier)` → `BotHandle`; tier config |
| `packages/types` | Shared types and **shared constants**: time-control presets, rating categories, bot tiers, termination enums |
| `packages/realtime-protocol` | Zod schemas + inferred types for every WebSocket message (gameplay, chat, WebRTC signals) |
| `packages/assets` | Canonical piece SVGs, sprite build scripts, license files |
| `packages/config` | Shared Biome config, `tsconfig.base.json`, Tailwind preset, design tokens |

### 2.8 Testing & Quality Tooling

| Concern | Choice |
|---|---|
| Unit + integration (web, API, shared) | Vitest |
| Durable Object / Worker integration | Vitest with `@cloudflare/vitest-pool-workers` |
| Mobile tests | Jest + React Native Testing Library |
| Web end-to-end | Playwright |
| CI | GitHub Actions |
| Security tooling | gitleaks (secret scan), CodeQL, Dependabot, `pnpm audit` |

### 2.9 Chess Piece Artwork

| Concern | Choice |
| --- | --- |
| Visual style | Staunton-style pieces, Wikimedia Commons Standard SVG set as baseline. **V1 ships one piece style only (Classic).** |
| Source | [cm-chessboard standard SVG sprite](https://github.com/shaack/cm-chessboard/blob/master/assets/pieces/standard.svg), based on [Wikimedia Commons Standard SVG pieces](https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces/Standard) |
| Web rendering | Shared artwork via `react-chessboard` custom piece rendering |
| Mobile rendering | `react-native-chessboard` 6×2 sprite sheet derived from the same canonical artwork |
| Artwork license | CC BY-SA 3.0. Preserve attribution and notices; adaptations follow ShareAlike. See §19. |

Pieces must stay immediately recognizable. Colors/rendering may be adjusted to the product design. Chess.com's proprietary artwork must not be copied.

---

## 3. Hosting Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare Network                    │
│                                                         │
│  ┌──────────────────┐    ┌──────────────────────────┐   │
│  │ Cloudflare Pages │    │   Cloudflare Workers     │   │
│  │  (apps/admin)    │    │                          │   │
│  │  + Access        │    │  ┌────────────────────┐  │   │
│  └──────────────────┘    │  │   Hono API          │  │   │
│                          │  │   (services/api)    │  │   │
│  ┌──────────────────┐    │  └────────────────────┘  │   │
│  │ Cloudflare       │    │  ┌────────────────────┐  │   │
│  │ Workers          │    │  │  Durable Objects   │  │   │
│  │  (apps/web)      │    │  │  - GameRoomDO      │  │   │
│  └──────────────────┘    │  │  - MatchmakerDO    │  │   │
│                          │  │  - UserPresenceDO  │  │   │
│                          │  └────────────────────┘  │   │
│                          └──────────────────────────┘   │
│                                                         │
│  ┌─────────────────┐   ┌──────────────────────────┐     │
│  │ Cloudflare D1   │   │ Cloudflare R2            │     │
│  │ (main database) │   │ (avatars)                │     │
│  └─────────────────┘   └──────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

**Durable Object roles**

| DO | Keyed by | Responsibility |
|---|---|---|
| `GameRoomDO` | game id | Authoritative state of one live online game: moves, clocks, draw/takeback offers, in-game chat, WebRTC voice signaling, presence, termination, archival |
| `MatchmakerDO` | pool (`timeControl` + `isRated`) | Holds the queue for one pool, pairs players, creates games |
| `UserPresenceDO` | user id | The user's push channel: queue status, challenge notifications, game-ready events |

All three surfaces use a custom domain structure on **one registrable domain** (for example `app.`, `admin.`, `api.` subdomains) so auth cookies work across them (**OI-8**).

---

## 4. Repository Structure

```
et-chess/
├── apps/
│   ├── web/               # React web app — Cloudflare Workers
│   ├── admin/             # React admin dashboard — Cloudflare Pages
│   └── mobile/            # Expo React Native app
├── services/
│   └── api/               # Hono API + Durable Objects — Cloudflare Workers
├── packages/
│   ├── chess-core/        # chess.js wrapper, game-end detection, pure clock logic
│   ├── rating/            # pure Glicko-2 engine
│   ├── bot-engine/        # Stockfish wrapper (web + native), tier config
│   ├── types/             # shared types + constants (time controls, tiers, enums)
│   ├── realtime-protocol/ # WebSocket message schemas (Zod)
│   ├── assets/            # canonical SVGs, sprite scripts, CC license
│   └── config/            # shared tooling config
├── docs/
│   ├── SRS.md             # this document
│   └── THIRD_PARTY_LICENSES.md
├── .github/
│   ├── workflows/ci.yml
│   ├── dependabot.yml
│   └── CODEOWNERS
├── .husky/pre-commit
├── turbo.json
├── pnpm-workspace.yaml
├── biome.json
└── package.json
```

---

## 5. Engineering Principles

| ID | Principle |
|---|---|
| ENG-01 | **The server is the only authority** for move legality, clocks, results, and ratings. Client-supplied FEN, clocks, timestamps, and ratings are never trusted. |
| ENG-02 | **Durable Objects are thin shells.** Rules, clock math, and rating math live in pure, unit-tested packages (`chess-core`, `rating`). DOs only do I/O, persistence, and scheduling. |
| ENG-03 | **One source of truth for shared constants** (time-control presets, categories, tiers, enums) in `packages/types`. No duplicated lists in apps. |
| ENG-04 | **Validate every boundary with Zod**: REST bodies/params, WebSocket frames, imported PGNs, config. |
| ENG-05 | **No `any`**, and no `@ts-ignore` / `@ts-expect-error` without a comment explaining why. |
| ENG-06 | **DO state is persisted.** Memory can be evicted at any time; anything needed to resume a game lives in DO storage. |
| ENG-07 | **State-changing operations are idempotent** (move by `expectedPly`, archival by game id, imports by `importKey`). |
| ENG-08 | **No secrets in the repo or client bundles.** |

---

## 6. Game Engine & Core Rules

### 6.1 Rules & Termination

- **Ruleset**: FIDE classic chess. No variants in V1.
- **Moves**: castling (both sides), en passant, promotion (Q, R, B, N).

| ID | Outcome | Rule |
|---|---|---|
| GAME-01 | Checkmate | Win for the mating side. |
| GAME-02 | Stalemate | Draw. |
| GAME-03 | 50-move rule | Automatic draw when the halfmove clock reaches **100 plies** (50 moves by each side without a pawn move or capture). |
| GAME-04 | Threefold repetition | **Automatic** draw on the third occurrence of the same position (same side to move, castling rights, and en passant possibility). |
| GAME-05 | Insufficient material | Automatic draw: K vs K; K+B vs K; K+N vs K; K+B vs K+B with same-color bishops. |
| GAME-06 | Timeout | Flagged player loses, **unless** the opponent has insufficient mating material (king only, or king + one minor piece), in which case the game is a draw. |
| GAME-07 | Resignation | Immediate win for the opponent. |
| GAME-08 | Agreement | Draw by accepted offer. |
| GAME-09 | Abandonment | Forfeit loss for the disconnected player (§6.5). |
| GAME-10 | Aborted | No result, **no rating change** (§6.3). |

### 6.2 Server-Authoritative Validation

- `packages/chess-core` exposes pure, typed functions.
- **Client (optimistic)**: validates instantly for legal-move hints and smooth drag-and-drop.
- **Server (`GameRoomDO`)**: authority. Every `MOVE_INTENT` is verified through `chess-core`. Invalid moves get `MOVE_REJECTED` with canonical state.
- **State**: FEN snapshot + full move list. Moves carry `expectedPly`; a duplicate or stale intent is rejected without side effects (idempotent).

### 6.3 Game Lifecycle & Aborts

- **GAME-11** States: `active` → `finished` or `aborted`. The game is created with a `startsAt` timestamp (matches the 3-second countdown in the UI).
- **GAME-12** **First-move deadline**: each side has **30 s** to make their first move (White from `startsAt`, Black from White's first move). If a side fails, the game is **aborted**.
- **GAME-13** **Clocks do not run** until each side has made one move. **No increment** is added after a side's first move.
- **GAME-14** If a game would end by resignation, disconnect/abandonment, or timeout **before both players have made a move**, it is **aborted** instead (no rating change).
- **GAME-15** Aborted games are archived (`result = 'aborted'`) but never affect ratings, stats, or leaderboards.

### 6.4 Clocks, Premoves & Lag Compensation

- **GAME-20** The clock is authoritative in `GameRoomDO`, millisecond resolution. Each side stores `remainingMs`; the active side also has `turnStartedAt` (server time). Remaining time at time *t* = `remainingMs − (t − turnStartedAt)`.
- **GAME-21** On a valid `MOVE_INTENT` received at server time *tr*: `elapsed = max(0, tr − turnStartedAt − lagCredit)`, `lagCredit = min(oneWayLatencyMs, 100)`. If `remainingMs − elapsed ≤ 0` the mover loses on time; otherwise `remainingMs −= elapsed`, then the increment is added (not after the side's first move, GAME-13).
- **GAME-22** `oneWayLatencyMs` = median of the last 5 server-measured RTT/2 samples from heartbeats. **Client-reported timestamps are ignored for all clock math.**
- **GAME-23** Flag-fall is triggered by a **Durable Object alarm** scheduled at the earliest of: active side's flag time, first-move deadline, disconnect-grace expiry. No `setInterval`.
- **GAME-24** The server does **not** broadcast periodic clock ticks. Clients tick locally and resync from authoritative values carried in `GAME_SNAPSHOT`, `MOVE_ACCEPTED`, and `HEARTBEAT_PONG`.
- **GAME-25** **Premoves** are client-only and enabled in online human games (setting `premovesEnabled`). The client holds the premove and sends a normal `MOVE_INTENT` when the turn arrives. If the server rejects it, the client clears the premove with no penalty. There are no premove protocol messages.

### 6.5 Disconnection & Forfeit

- **GAME-30** **Grace period: 60 seconds.** A player is *disconnected* when their socket closes, or after 15 s of heartbeat silence (in which case the 60 s is counted from the last heartbeat received).
- **GAME-31** The player's **clock keeps running** during disconnection.
  - Clock reaches 0 first → loss on time.
  - 60 s expire first → **abandonment forfeit**, win for the connected opponent.
- **GAME-32** **Phones are not special-cased.** App backgrounding, calls, lost signal, and crashes are all disconnections. A phone gone for more than 60 s forfeits.
- **GAME-33** Each disconnection gets its own independent 60 s window. If both players are disconnected, whichever window expires first forfeits.
- **GAME-34** On reconnect the client receives `GAME_SNAPSHOT` and resumes. On app launch the client calls `GET /api/me/live-game` to rejoin an active game.
- **GAME-35** Disconnect before both players have moved → aborted (GAME-14).

### 6.6 In-Game Player Actions

- **Resignation** (GAME-40): any time; immediate loss. Before both players have moved it aborts instead (GAME-14).
- **Draw offers** (GAME-41):
  - An active player may offer a draw on their turn, **once each player has made at least 2 moves** (ply ≥ 4).
  - The opponent may accept (draw) or decline.
  - The offer expires automatically if either player makes a subsequent move.
  - After a declined or expired offer, the same player cannot re-offer until they have made another move.
- **Takebacks** (GAME-42):
  - **Disabled** in public matchmaking games and in **all rated games**.
  - **Allowed** in unrated friend games and Pass & Play; online requires the opponent's explicit acceptance.
  - A takeback undoes the requester's most recent move (and the opponent's reply, if any); clocks are restored from the move log.

### 6.7 Game History & Analysis

- **V1 deliverables**
  - Completed online games archived to D1 (§9); move list with SAN, UCI, clocks, timestamps; result and termination.
  - FEN at any ply is derived by replaying moves with `chess-core` (not stored per move).
  - Interactive move-list viewer to step through past games.
  - **PGN export** for the player's own completed games.
- **V2**: automated engine evaluation and accuracy scores.

---

## 7. Bot Engine

### 7.1 Tiers & Strength Mechanism

19 tiers, 500 to 3000+. Low-to-mid tiers step +200 Elo (500–1900); expert tiers step +100 (2000–3000+). **Target Elo values are approximate** and shown in the UI as `~1500`; they are not FIDE- or chess.com-equivalent.

| Tier | Persona | Target Elo | Max Depth | Method | Characteristics |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | *Sparky* | 500 | 1 | S | Frequent blunders, hangs pieces, instant play |
| 2 | *Rusty* | 700 | 2 | S | Misses obvious 1-move tactics |
| 3 | *Pawn Scout* | 900 | 3 | S | Basic openings, susceptible to forks/pins |
| 4 | *Knight Errant* | 1100 | 4 | S | Defends attacked pieces, misses deeper combinations |
| 5 | *Bishop Blue* | 1300 | 6 | S | Solid fundamentals, standard openings |
| 6 | *Rook Guard* | 1500 | 8 | U | Club-player strength, punishes unforced errors |
| 7 | *Tactician Theo* | 1700 | 10 | U | Strong tactical vision |
| 8 | *Queen's Vanguard* | 1900 | 12 | U | Positional awareness, sound endgames |
| 9 | *Master Magnus* | 2000 | 14 | U | Minimal unforced errors |
| 10 | *Aero* | 2100 | 15 | U | Deep calculation, aggressive counterplay |
| 11 | *Titan* | 2200 | 16 | U | Exploits subtle pawn weaknesses |
| 12 | *Valkyrie* | 2300 | 17 | U | Accurate in complex endgames |
| 13 | *Apex* | 2400 | 18 | U | Broad opening repertoire, strong conversion |
| 14 | *Colossus* | 2500 | 20 | U | GM-level calculation and prophylaxis |
| 15 | *Chronos* | 2600 | 22 | U | Near-flawless tactics |
| 16 | *Quantum* | 2700 | 24 | U | Elite tournament performance |
| 17 | *Nebula* | 2800 | 26 | U | Superhuman calculation |
| 18 | *Singularity* | 2900 | 28 | U | Relentless tactical pressure |
| 19 | *Zenith* | 3000+ | Max | M | Unconstrained Stockfish |

**Methods**
- **S (Skill/depth)** — tiers 1–5 sit below Stockfish's `UCI_Elo` minimum (about 1320; **verify against the bundled build**). Strength comes from `Skill Level`, depth cap, node/time cap, and **blunder injection** (probability of choosing a lower-ranked candidate from MultiPV). Parameters live in `packages/bot-engine/src/tiers.ts`.
- **U (UCI_Elo)** — `UCI_LimitStrength = true`, `UCI_Elo = <target>`; optional depth cap from the table.
- **M (Max)** — `UCI_LimitStrength = false`, `Skill Level = 20`.
- **BOT-01** Never set `Skill Level` together with `UCI_Elo`.
- **BOT-02** Human-like response delay per tier, never longer than 3 s.
- **BOT-03** Tier parameters are config, not inline constants.
- **BOT-04** **Calibration**: an offline self-play script checks that tier *N* scores ≥ 60% against tier *N−1* over ≥ 100 games (alternating colors, fixed time). Run when parameters change; not part of per-PR CI.

### 7.2 Execution (both platforms run locally)

1. **Mobile**: Stockfish on-device in a background thread; fully offline (airplane mode). **OI-1** spike must prove it on a mid-range Android before this is locked.
2. **Web**: Stockfish WASM (single-threaded) in a Web Worker, lazy-loaded; no server involvement.

`BotHandle` is minimal: `newGame()`, `getMove(fen, history, budgetMs)`, `stop()`, `dispose()`.

### 7.3 Bot Records & Progression

- Bot games are strictly **unrated**.
- Wins/losses/draws are tracked per persona. Signed-in users: derived from imported computer games (§10). Guests/offline: stored on the device.
- A star/badge unlocks the first time a tier is defeated.

---

## 8. Ratings, Matchmaking & Challenges

### 8.1 Rating System (Glicko-2)

- **RATE-01** Three independent ratings per user: **Bullet**, **Blitz**, **Rapid**. Each is a Glicko-2 triple: rating `r`, rating deviation `RD`, volatility `σ`. New players start at `r = 1500`, `RD = 350`, `σ = 0.06`.
- **RATE-02** Updated **only** on finished **rated online human** games. Unrated games, bot games, local games, and aborted games never change ratings.
- **RATE-03** Score `S`: win = 1, draw = 0.5, loss = 0. **Every termination counts the same way**: checkmate, resignation, timeout, and abandonment are all ordinary wins/losses.
- **RATE-04** Algorithm: Glicko-2 exactly as published by Mark Glickman (including the iterative volatility step), implemented as pure functions in `packages/rating`. Each rated game is treated as a **single-game rating period** for both players. Both players are updated from their **pre-game** values; each uses the opponent's pre-game `r` and `RD`.
- **RATE-05** **Inactivity**: at game start, each player's `RD` is grown for the time since their last rated game in that category using the Glicko-2 pre-period step (`φ* = √(φ² + σ²·t)`, `t = daysSinceLastRatedGame × RATING_PERIODS_PER_DAY`), capped at `RD = 350`. The DO takes a **snapshot** of both players' `r`, `RD`, and `σ` (after growth) at game start and uses it at finalization, so the outcome does not depend on when the write happens.
- **RATE-06** Constants (in `packages/rating`, starting values): system constant `τ = 0.5`; `r ≥ 100`; `30 ≤ RD ≤ 350`; `RATING_PERIODS_PER_DAY = 0.2`. Ratings, `RD`, and `σ` are stored **unrounded**. Rounding is for display only.
- **RATE-07** A player is **provisional** in a category while `RD > 110` (config), shown as `1500?`. Provisional players are excluded from leaderboards (including the admin top-players list).
- **RATE-08** Ratings and the game archive are written in **one atomic D1 batch**, idempotent per game id (§9.3).
- **RATE-09** **Pair cap**: at most **5 rated games between the same two users in a rolling 24 h**. At the cap, rated pairing is refused (challenge creation fails with a clear message; the matchmaker skips the pair).
- **RATE-10** Displayed rating change for each player is `round(after) − round(before)`, so shown numbers always add up. Under Glicko-2 the two players' changes are **not** mirror images (their `RD`s differ), and the UI must not imply they are.
- **RATE-11** Admin rating adjustments set `r` (and optionally reset `RD`), require a reason, are written to `audit_logs`, and are **refused while the target has a live game**.

**Test vectors and properties** (`packages/rating`)

| Case | Expected |
|---|---|
| Glickman's published example, `τ = 0.5`: player `r = 1500`, `RD = 200`, `σ = 0.06` vs. (1400, RD 30) win, (1550, RD 100) loss, (1700, RD 300) loss | `r' ≈ 1464.06`, `RD' ≈ 151.52`, `σ' ≈ 0.05999` |
| Equal `r` and `RD`, draw | `r` unchanged (within tolerance), `RD` decreases for both |
| Win | `r` up, `RD` down. Loss: `r` down, `RD` down |
| Same result for a new player (`RD = 350`) and an established player (`RD = 60`) | The new player's `r` moves more |
| Win against a higher-rated opponent vs. against a lower-rated one | Larger gain against the higher-rated opponent |
| Inactivity growth | Never exceeds `RD = 350`; zero elapsed time changes nothing |
| Bounds | `r` never below 100; `RD` stays within 30–350 |

### 8.2 Time Controls

Single source of truth: `TIME_CONTROLS` in `packages/types`.

| Category | Presets (minutes + increment seconds) |
|---|---|
| Bullet | `1+0`, `1+1`, `2+1` |
| Blitz | `3+0`, `3+2`, `5+0`, `5+3` |
| Rapid | `10+0`, `10+5`, `15+10`, `30+0` |
| Custom / Untimed | Unrated friend games, Computer, and Local only. Never rated. |

- **RATE-12** A consistency test asserts each preset's category equals the formula: estimated duration = `initial + 40 × increment` (seconds); `< 180` → bullet, `< 480` → blitz, otherwise rapid.
- **RATE-13** Rated games must use a preset; the server rejects any other time control for a rated game.

### 8.3 Public Matchmaking (`MatchmakerDO`)

- **MM-01** One `MatchmakerDO` per pool (`timeControl` × `isRated`). Players join via `QUEUE_JOIN` on their user socket. Requires an authenticated account (and verified email, **OI-3**) with no live game.
- **MM-02** Search range starts at **±100** rating, widens by **±50 every 5 s**, capped at **±600**. A pair matches when their rating difference is within both players' current range.
- **MM-03** Queue timeout **120 s** → `QUEUE_TIMEOUT`.
- **MM-04** Queue state is persisted in DO storage and expansion is alarm-driven (survives hibernation).
- **MM-05** A user cannot match themselves (two tabs/devices); a socket closing removes the entry.
- **MM-06** Pairs at the rated pair cap (RATE-09) are skipped.
- **MM-07** On match: insert the `live_games` + `live_game_players` rows (fails if either user already has a live game), create the `GameRoomDO`, assign colors randomly, send `GAME_READY` to both via `UserPresenceDO`.

### 8.4 Friend Challenges

- **CHAL-01** Challenges are **created and answered over REST** (§10) so every step is persisted and validated. `UserPresenceDO` only **pushes** notifications.
- **CHAL-02** Direct challenge: the challenger picks an accepted friend, a time control, **Rated** or **Unrated**, and a color preference. Link challenge: same options with an **open link** (`/c/<share_code>`) and optional QR code.
- **CHAL-03** The friend gets a live modal (§12.2) with avatar, rating, time control, rated/unrated, **Accept** / **Decline**. Accepting routes both players into the new `GameRoomDO` (`GAME_READY`). Declining notifies the challenger (`CHALLENGE_DECLINED`).
- **CHAL-04** **Expiry**: direct challenges expire after **60 s**; link challenges after **10 min**. Expiry is enforced server-side at accept time.
- **CHAL-05** Accept validation (server): challenge is `pending` and unexpired; acceptor ≠ challenger; if `challenged_id` is set, acceptor must match it; neither user has blocked the other; neither has a live game; rated pair cap not exceeded.
- **CHAL-06** Limits: ≤ 5 pending outgoing challenges per user; ≤ 1 pending per recipient.
- **CHAL-07** `share_code` is ≥ 128-bit random.
- **CHAL-08** Takebacks are available only in **unrated** friend games (GAME-42).

### 8.5 In-Game Chat & Voice in Friend Matches

- **CHAT-01** In-game text chat is supported in both Public Matchmaking and Private Friend games.
- **CHAT-02** Text chat UI is compact and secondary: on desktop, tabbed beside the move list; on mobile, in a collapsible panel/bottom sheet. **The board and clocks are never obstructed or covered.**
- **CHAT-03** Moderation controls: **Mute Player** (local match silence), **Block User** (bidirectional, persisted in D1 `user_blocks`), **Report** (`reports` table).
- **CHAT-04** **Voice Chat in Private Friend Games**: Optional 1-on-1 audio available **exclusively in Private Friend games**. Both players must explicitly click "Join Voice". Audio is peer-to-peer WebRTC with signaling routed through `GameRoomDO`. Either player can mute or leave at any time. Text chat remains usable simultaneously.

### 8.6 Concurrency & Anti-Abuse

- **MM-10** A user may have **one live online game** at a time across all devices. Enforced by `live_game_players.user_id` primary key.
- **MM-11** Other abuse controls are in §14.

### 8.7 Pass & Play

- Two players, one shared screen. No account required.
- Orientation: manual rotation or optional automatic 180° flip after each move.
- Clocks: untimed or custom.
- Takebacks enabled by default.
- Stored on-device; signed-in users may import to history (§10).

---

## 9. Database Schema (Cloudflare D1 + Drizzle ORM)

All persistence goes through Drizzle (parameterized queries; no string-built SQL). Live game state (moves, clocks, offers) is held in `GameRoomDO` **storage** (not just memory). On completion, results are committed to D1 in one batch.

```
users ──1:1── profiles
  │
  ├──1:N── ratings (bullet/blitz/rapid)
  ├──1:N── friendships
  ├──1:N── games ──1:N── game_moves
  ├──1:N── challenges
  ├──1:N── reports
  ├──1:N── user_blocks
  └──     live_game_players ── live_games
audit_logs (admin actions)
```

### 9.1 Tables

#### `users` (Better Auth)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | PK | User ID |
| `name` | text | not null | Full name |
| `email` | text | unique, not null | Never exposed to other users |
| `email_verified` | integer | 0/1 | Verification status |
| `image` | text | nullable | Avatar URL |
| `role` | text | default `'user'` | `'user'` or `'admin'` |
| ban fields | | | `banned`, `ban_reason`, `ban_expires` via Better Auth admin plugin (**confirm exact names in its docs at implementation**) |
| `created_at`, `updated_at` | integer | not null | Epoch ms |

#### `profiles`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | PK | |
| `user_id` | text | unique, FK users | |
| `username` | text | unique **NOCASE**, not null | 3–20 chars, `[A-Za-z0-9_]`, reserved-word blocklist (`admin`, `support`, ...) |
| `display_name` | text | not null | ≤ 40 chars |
| `avatar_url` | text | nullable | R2 object |
| `bio` | text | nullable | ≤ 200 chars, rendered as plain text |
| `country` | text | nullable | ISO 3166-1 alpha-2 |
| `preferences` | text | JSON, not null | `{ boardTheme, soundEnabled, autoQueen, premovesEnabled, coordinatesVisible, ... }` validated by Zod |
| `created_at`, `updated_at` | integer | not null | |

#### `ratings`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | PK | |
| `user_id` | text | FK users | |
| `category` | text | not null | `'bullet'`, `'blitz'`, `'rapid'` |
| `rating` | real | default 1500 | Glicko-2 rating `r`, unrounded |
| `rating_deviation` | real | default 350 | Glicko-2 `RD` |
| `volatility` | real | default 0.06 | Glicko-2 `σ` |
| `last_rated_at` | integer | nullable | Last rated game in this category (drives RD growth) |
| `games_played` | integer | default 0 | Rated games in category |
| `wins`, `losses`, `draws` | integer | default 0 | |
| `best_rating` | integer | default 1500 | |
| `updated_at` | integer | not null | |

Unique `(user_id, category)`. Provisional = `rating_deviation > 110`.

#### `games`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | PK | Random, unguessable (21-char nanoid) |
| `white_player_id` | text | nullable, FK users | Null for bot/guest side |
| `black_player_id` | text | nullable, FK users | |
| `game_type` | text | not null | `'online'`, `'friend'`, `'computer'`, `'local'` |
| `category` | text | not null | `'bullet'`, `'blitz'`, `'rapid'`, `'custom'` |
| `time_control_initial` | integer | not null | Seconds |
| `time_control_increment` | integer | not null | Seconds |
| `is_rated` | integer | 0/1 | |
| `result` | text | not null | `'white_win'`, `'black_win'`, `'draw'`, `'aborted'` |
| `termination_reason` | text | not null | `'checkmate'`, `'stalemate'`, `'timeout'`, `'resignation'`, `'agreement'`, `'threefold'`, `'fifty_moves'`, `'insufficient_material'`, `'abandonment'`, `'aborted'` |
| `final_fen` | text | not null | |
| `pgn` | text | not null | |
| `white_rating_before`/`_after` | integer | nullable | Rated games only |
| `black_rating_before`/`_after` | integer | nullable | Rated games only |
| `bot_tier` | integer | nullable | 1–19 |
| `import_key` | text | nullable, unique | Idempotency key for imported computer/local games |
| `started_at`, `ended_at` | integer | not null | |

Indexes: `(white_player_id, ended_at DESC)`, `(black_player_id, ended_at DESC)`.

#### `game_moves`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | PK | |
| `game_id` | text | FK games | |
| `ply` | integer | not null | 1, 2, 3, ... |
| `move_san` | text | not null | |
| `move_uci` | text | not null | |
| `white_time_remaining_ms` | integer | not null | |
| `black_time_remaining_ms` | integer | not null | |
| `played_at` | integer | not null | |

Unique `(game_id, ply)`. FEN per ply is derived by replay.

#### `live_games` / `live_game_players`
| Table | Columns | Purpose |
|---|---|---|
| `live_games` | `game_id` PK, `white_id`, `black_id`, `category`, `time_control_*`, `is_rated`, `started_at` | Registry of in-progress games (admin Live Games, resume) |
| `live_game_players` | `user_id` **PK**, `game_id` FK | Enforces one live game per user |

Both are inserted at game start and deleted in the archival batch.

#### `friendships`
| Column | Type | Constraints |
|---|---|---|
| `id` | text | PK |
| `requester_id`, `addressee_id` | text | FK users; unique `(requester_id, addressee_id)` |
| `status` | text | `'pending'`, `'accepted'`, `'declined'`, `'blocked'` |
| `created_at`, `updated_at` | integer | not null |

A `blocked` row stops challenges and friend requests in both directions.

#### `challenges`
| Column | Type | Constraints |
|---|---|---|
| `id` | text | PK |
| `challenger_id` | text | FK users |
| `challenged_id` | text | nullable FK users (null for open link) |
| `share_code` | text | unique, ≥ 128-bit random |
| `category` | text | not null |
| `time_control_initial`, `time_control_increment` | integer | not null |
| `is_rated` | integer | 0/1 |
| `preferred_color` | text | `'white'`, `'black'`, `'random'` |
| `status` | text | `'pending'`, `'accepted'`, `'declined'`, `'expired'`, `'cancelled'` |
| `game_id` | text | nullable FK games |
| `expires_at`, `created_at` | integer | not null |

Index `(status, expires_at)`. Expired rows are deleted after 7 days by a scheduled job.

#### `reports`
| Column | Type | Constraints |
|---|---|---|
| `id` | text | PK |
| `reporter_id`, `reported_user_id` | text | FK users |
| `game_id` | text | nullable FK games |
| `reason` | text | `'fair_play'`, `'griefing'`, `'harassment'`, `'spam'`, `'stalling'` |
| `details` | text | ≤ 1000 chars |
| `status` | text | `'open'`, `'resolved'`, `'dismissed'` |
| `resolved_by` | text | nullable FK users |
| `resolution_note` | text | nullable |
| `created_at`, `resolved_at` | integer | |

#### `user_blocks`
| Column | Type | Constraints |
|---|---|---|
| `id` | text | PK |
| `blocker_id` | text | FK users |
| `blocked_user_id` | text | FK users |
| `created_at` | integer | not null |

#### `audit_logs`
| Column | Type | Description |
|---|---|---|
| `id` | text PK | |
| `actor_id` | text FK users | Admin who acted |
| `action` | text | e.g. `user.ban`, `game.terminate`, `rating.adjust`, `report.resolve` |
| `target_type`, `target_id` | text | |
| `details` | text | JSON (before/after values, reason) |
| `created_at` | integer | Append-only; no update/delete routes |

### 9.2 Migrations

- Drizzle migrations, applied with Wrangler. Forward-only; never edit an applied migration.
- Backward-compatible changes (expand, then contract) so the previous Worker version still runs during deploy.
- CI runs `drizzle-kit check` and applies migrations to an ephemeral D1 database.

### 9.3 Archival Batch (end of a live game)

When a game ends, `GameRoomDO` commits one D1 **batch** (transactional):
1. Rating updates, guarded so they run **only if the `games` row does not yet exist** (idempotency).
2. Insert the `games` row and its `game_moves` rows.
3. Delete the `live_games` and `live_game_players` rows.

If the batch fails, the DO keeps the final state in its storage and retries via an **alarm with backoff**. Archive failures are alerted (§16). Tests must cover: retry after failure, duplicate archival attempt, and DO restart mid-archival.

---

## 10. REST API Surface (Hono, under `/api`)

Auth endpoints are served by Better Auth at `/api/auth/*`. All other routes validate input with Zod and return typed results via Hono RPC. Errors use one shape: `{ error: { code, message } }`.

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /ws-ticket` | user | Issue a short-lived WS ticket (scope: `user` or `game:<id>`) |
| `GET /me` · `PATCH /me/profile` · `POST /me/avatar` · `DELETE /me` | user | Own account, profile, avatar upload, account deletion |
| `GET /me/live-game` | user | Current live game, for rejoin |
| `GET /me/games` | user | Own game history (cursor paginated, filter by type) |
| `GET /games/:id` · `GET /games/:id/pgn` | participant or admin | Game detail / PGN |
| `POST /games/import` | user | Import a finished computer/local game (server replays and validates; unrated; idempotent by `importKey`) |
| `GET /users/search?q=` · `GET /users/:username` | user | Player search; public profile (username, avatar, country, ratings, stats) |
| `GET /leaderboard?category=` | user | Top players (cached ~60 s) |
| `GET /friends` · `POST /friends/requests` · `POST /friends/requests/:id/accept` · `.../decline` · `DELETE /friends/:id` · `POST /blocks` | user | Social graph |
| `POST /challenges` · `GET /challenges/:code` · `POST /challenges/:id/accept` · `.../decline` · `DELETE /challenges/:id` | user | Challenge flow (CHAL-01..07) |
| `POST /reports` | user | Report a player/game |
| `/admin/users`, `/admin/users/:id`, `POST /admin/users/:id/ban`, `.../unban`, `.../rating-adjust` | admin | User management |
| `GET /admin/games/live`, `GET /admin/games/:id`, `POST /admin/games/:id/terminate` | admin | Live monitoring; terminate = aborted, no rating change |
| `GET /admin/reports`, `POST /admin/reports/:id/resolve` | admin | Report resolution |
| `GET /admin/metrics` · `GET /admin/audit-logs` | admin | Dashboard metrics, audit trail |

---

## 11. Realtime WebSocket Protocol (`packages/realtime-protocol`)

Two socket channels, both authenticated by a short-lived ticket (SEC-07):

- **User channel** `/ws/user` → `UserPresenceDO`: queue, challenge notifications, game-ready events.
- **Game channel** `/ws/game/:gameId` → `GameRoomDO`: one live game (moves, clocks, text chat, friend voice signaling).

Every frame is JSON, validated against shared Zod schemas on both ends.

### 11.1 Envelope

```typescript
interface WebSocketEnvelope<TType extends string, TPayload> {
  v: number;            // protocol version
  type: TType;
  gameId?: string;
  timestamp: number;    // informational only; NEVER used for clocks or ordering
  requestId?: string;   // optional, for request-reply tracing
  payload: TPayload;
}
```

- **PROTO-01** The server rejects clients below `MIN_PROTOCOL_VERSION` with `ERROR { code: 'UPGRADE_REQUIRED' }`.
- **PROTO-02** Max frame size **4 KB**. Larger or malformed frames → `ERROR`, connection closed on repeat.
- **PROTO-03** Rate limit per connection: sustained 10 msg/s, burst 20 → `ERROR { code: 'RATE_LIMITED' }`.
- **PROTO-04** Every schema has round-trip and invalid-input tests.

### 11.2 Game Channel — Client → Server

| Type | Payload | Purpose |
|---|---|---|
| `MOVE_INTENT` | `{ from, to, promotion?: 'q'\|'r'\|'b'\|'n', expectedPly }` | Active player's move |
| `DRAW_OFFER` | `{}` | Offer a draw |
| `DRAW_RESPONSE` | `{ accept: boolean }` | Accept or decline draw |
| `RESIGN` | `{}` | Resign game |
| `TAKEBACK_REQUEST` | `{}` | Unrated friend games only |
| `TAKEBACK_RESPONSE` | `{ accept: boolean }` | Accept or decline takeback |
| `HEARTBEAT_PING` | `{ clientTimestamp }` | Latency measurement (every 5 s) |
| `CHAT_SEND` | `{ text: string }` | Send in-game text message (≤ 280 chars) |
| `VOICE_SIGNAL` | `{ signalType: 'offer'\|'answer'\|'candidate', data: any }` | WebRTC signaling (Private friend games only) |
| `VOICE_STATE` | `{ joined: boolean, muted: boolean }` | Update mic/audio state |

### 11.3 Game Channel — Server → Client

| Type | Payload | Purpose |
|---|---|---|
| `GAME_SNAPSHOT` | `{ fen, pgn, ply, whiteTimeMs, blackTimeMs, turn, status, serverTimestamp, whitePlayer, blackPlayer, rated, timeControl }` | Full state on connect/reconnect |
| `MOVE_ACCEPTED` | `{ san, uci, from, to, promotion?, fen, ply, whiteTimeMs, blackTimeMs, turn, serverTimestamp }` | Validated move, broadcast to both |
| `MOVE_REJECTED` | `{ reason, expectedPly, currentFen }` | Invalid/stale move; re-syncs sender |
| `DRAW_OFFERED` | `{ offeredBy }` | Opponent offered draw |
| `DRAW_DECLINED` | `{}` | Draw offer rejected |
| `TAKEBACK_OFFERED` | `{ requestedBy }` | Takeback requested |
| `TAKEBACK_RESOLVED` | `{ accepted, restoredFen, restoredPly, whiteTimeMs, blackTimeMs }` | Revert board state if accepted |
| `OPPONENT_PRESENCE` | `{ connected, graceRemainingSeconds? }` | Disconnect/reconnect with 60 s countdown |
| `GAME_TERMINATED` | `{ result: 'white_win'\|'black_win'\|'draw'\|'aborted', terminationReason, whiteRatingAfter?, blackRatingAfter?, whiteRatingDelta?, blackRatingDelta? }` | Game over |
| `HEARTBEAT_PONG` | `{ clientTimestamp, serverTimestamp, estimatedLagMs, whiteTimeMs, blackTimeMs, activeColor }` | Latency + authoritative clock resync |
| `CHAT_BROADCAST` | `{ senderId, senderUsername, text, timestamp }` | Broadcast sanitized chat message |
| `VOICE_SIGNAL` | `{ senderId, signalType, data }` | WebRTC signaling passthrough for 1-on-1 audio |
| `VOICE_STATE_UPDATE`| `{ userId, joined, muted }` | Voice status broadcast |
| `ERROR` | `{ code, message }` | Codes: `INVALID_MESSAGE`, `UNAUTHORIZED`, `RATE_LIMITED`, `UPGRADE_REQUIRED`, `NOT_YOUR_TURN`, `GAME_NOT_FOUND`, `INTERNAL` |

### 11.4 User Channel

| Direction | Type | Payload | Purpose |
|---|---|---|---|
| C → S | `QUEUE_JOIN` | `{ timeControl, isRated }` | Join a matchmaking pool |
| C → S | `QUEUE_LEAVE` | `{}` | Cancel queue |
| C → S | `HEARTBEAT_PING` | `{ clientTimestamp }` | Keep-alive |
| S → C | `QUEUE_STATUS` | `{ elapsedSeconds, currentRange }` | Search progress |
| S → C | `QUEUE_TIMEOUT` | `{}` | No match within 120 s |
| S → C | `GAME_READY` | `{ gameId, color, opponent, timeControl, isRated, startsAt }` | Matchmaker or accepted challenge produced a game |
| S → C | `CHALLENGE_RECEIVED` | `{ challengeId, challenger: { id, username, avatarUrl?, rating }, timeControl, isRated, expiresAt }` | Live modal |
| S → C | `CHALLENGE_DECLINED` | `{ challengeId }` | |
| S → C | `CHALLENGE_EXPIRED` | `{ challengeId }` | |
| S → C | `HEARTBEAT_PONG` / `ERROR` | as above | |

---

## 12. UI & Visual Specifications

The visual design derives from the canonical mockups (`web mockup.png`, `web mock up 2.png`, `app mockup 1.png`, `app mockup 1.2.png`, `admin page .png`). All numbers shown in mockups (user counts, ratings, uptime percentages) are placeholders.

### 12.1 Design System & Theme Tokens

```
┌────────────────────────────────────────────────────────────────────────┐
│                          ET-Chess Dark Theme                           │
│   Background:  #0B0F14 (Deep Void)   Surface: #1A1F26 (Slate Card)     │
│   Primary:     #10B981 (Emerald)     Warning: #F59E0B (Amber Gold)     │
│   Text Main:   #F8FAFC (Pure White)  Danger:  #EF4444 (Crimson)        │
│   Text Muted:  #94A3B8 (Slate Gray)  Info:    #06B6D4 (Cyan Blue)      │
└────────────────────────────────────────────────────────────────────────┘
```

- **Primary / action**: Emerald `#10B981` (hover `#059669`) for primary CTAs, wins, online status.
- **Background**: `#0B0F14`. **Surfaces**: `#1A1F26` (layer 1), `#222933` (layer 2/hover). **Borders**: `#2D3748` / `#334155`.
- **Text**: primary `#F8FAFC`, muted `#94A3B8`, tertiary `#64748B`.
- **Semantic**: green `#10B981` good/win/online; yellow `#F59E0B` warning/draw; red `#EF4444` loss/disconnected/resign; cyan/blue `#06B6D4` / `#3B82F6` info/premove highlight.
- **Typography**: `Inter, -apple-system, BlinkMacSystemFont, sans-serif`; 400 body, 500 labels, 700 headers and digital timers.
- **Iconography**: `lucide-react` (web/admin), `lucide-react-native` (mobile).
- **Brand**: stylized knight silhouette with neon emerald glow.
- Tokens live in `packages/config` and are the single source for all surfaces.

### 12.2 Web Application

1. **Global sidebar** (fixed left, 240 px, collapsible): knight logo + "ET-Chess" + tagline; **Home**, **Play** (Online, Friend, Computer, Local), **History**, **Profile**, **Settings**; footer with mini-profile, handle, online dot, logout.
2. **Top header**: universal search with `Cmd + K` pill (**searches players**); notification bell (badge = pending challenges); theme toggle (default dark); profile dropdown.
3. **Home dashboard**: hero banner with "Play Now"; Quick Play grid (Online, Friend, Computer, Local); Recent Games list (opponent, result tag `Win +17`, time-control badge, relative time); Ratings summary cards (Bullet/Blitz/Rapid, provisional marked `?`).
4. **Play Online**: category tabs; preset buttons from `TIME_CONTROLS` (§8.2); Rated toggle; large **"Find Match"** button.
5. **Searching**: pulsating radar with knight emblem; label e.g. `Blitz • 3+2`; status "Finding an opponent..." with **elapsed time and current rating range** (no ETA); player rating badge; **Cancel**.
6. **Match Found**: split card (you vs opponent: avatar, username, rating); parameter banner; **3-second countdown** (`3 → 2 → 1`) into the live board (matches `startsAt`).
7. **In-game (desktop)**:
   - Opponent header (avatar, username, rating, captured pieces, clock); main board; player header.
   - Board: Staunton SVG pieces, coordinates, last-move highlight, legal-move dots/rings, crimson check pulse.
   - Clock glows emerald when active; amber under 20 s; pulses red under 10 s.
   - Right utility panel with tabs: **[Moves]** (two-column notation, scrollable, active ply highlighted) and **[Chat]** (in-game text messages, mute, report, and optional 1-on-1 friend voice bar).
   - Footer: **Offer Draw**, **Resign**; in unrated friend games also **Takeback Request**.
8. **Friend challenge modal**: floats over the active screen; challenger avatar, name, rating, parameters (`Blitz 3+2 • Rated`); **Accept** / **Decline**; countdown bar matching the challenge's remaining time.
9. **Game Over modal**: trophy for victory; headline (`Victory by Checkmate`, `Defeat by Resignation`, `Draw by Agreement`, `Game Aborted`); rating delta (`You: 1567 → 1584 (+17)`, opponent likewise; none for unrated/aborted); metadata (`Blitz • 3+2 | 23 moves`); **Play Again**, **Review Game**, **Game History**.
10. **Review & History**: filter tabs (All, Online, Friend, Computer, Local); table (opponent, mode, time control, result badge, rating change, date); click to open the board with `< >` ply navigation and **Download PGN**.
11. **Profile & Ratings**: identity header (avatar, username, `@handle`, online badge, Edit Profile); rating cards; career stats (total games, win/draw/loss %, best rating); rating graph with range filters (`7D`, `30D`, `90D`, `1Y`, `All`) built from `rating_before/after` in `games`.
12. **Settings**: Board Theme (`Classic`, `Wood`, `Blue`, `Dark`); **Piece Style: Classic (Staunton) only in V1**; coordinates toggle; board size slider; sound toggles (move, capture, check, game end, clock warning); accessibility (Reduced Motion, High Contrast).

### 12.3 Mobile Application

1. **Bottom tab navigation** (fixed, 64 px): Home, Play / Games, History, Profile.
2. **Home**: top bar (avatar, username, rating, notification bell); Quick Play chips (`1 min`, `3 min`, `10 min`); mode cards (Online, Friend, Computer, Local).
3. **In-game**: full-width board (Skia + Reanimated); top/bottom player bars with captured pieces and clocks; floating action bar: `Moves` (bottom sheet), `Chat` (non-intrusive collapsible sheet), `Draw`, `Resign`, `Takeback` (unrated friend games only).
4. **Pass & Play**: optional automatic **180° animated rotation** per turn; optional per-player timer or untimed.
5. **Friend challenge flow**: (1) time control + Rated toggle; (2) friend list with search, online dots, **Invite**, plus **Share Link / QR Code**.

### 12.4 Admin Dashboard

1. **Sidebar**: **Dashboard**; **Users** (list, bans & suspensions); **Games** (live games, history); **Ratings** (overview, adjustments); **Reports** (queue with context); **Challenges** (pending); **System** (audit log, analytics).
2. **Metric cards**: Total Users, Active Players, Games Played, Online Now, each with a 7-day change. Computed from real data; **aborted, local, and computer games are excluded** from "Games Played".
3. **Charts**: platform usage donut by mode; player growth line (`7D`, `30D`, `90D`).
4. **Live Games monitor** (from `live_games`): game, players, mode, time control, `Live` badge, **Inspect** and **Terminate** (aborted, audit-logged). Recent finished games table.
5. **System health card**: values come from real Cloudflare analytics/observability data (API Worker, Durable Objects, D1, R2, WebSockets). Never hard-coded percentages.
6. **Top players leaderboard**: top by category.

### 12.5 In-Game Interactive States & Board UX

1. **Selection**: soft emerald glow `rgba(16, 185, 129, 0.3)` on the origin square.
2. **Legal moves**: centered emerald dot (radius 12% of square) on empty targets; ring on capture targets.
3. **Promotion modal**: compact modal above the promotion square (Queen, Knight, Rook, Bishop); selection sends the promotion.
4. **Check**: crimson radial pulse (`#EF4444`) under the threatened king.
5. **Premoves**: muted cyan/blue highlight of origin/destination; cancel by right-click or tapping an empty square. Held on the client (GAME-25).
6. **Clock urgency**: > 20 s crisp white on dark; active turn emerald glow; < 20 s amber; < 10 s pulsing red with subtle audio tick.

### 12.6 Network Status & Reconnection Overlays

1. **Connecting...** — amber badge during initial connection.
2. **Reconnecting...** — amber pulsating banner: "Reconnecting... Trying to restore connection".
3. **Opponent Disconnected** — persistent amber banner "Opponent Disconnected — waiting for them to return" with a visible **60-second countdown**.
4. **Connection Unstable** — red toast when server-measured RTT exceeds 250 ms.
5. **Game Resumed** — green toast "Game Resumed. Connection restored."
6. **You were disconnected too long** — if the grace window expired, show the game-over modal with the forfeit result after reconnecting.

### 12.7 In-Game Chat & Voice System

1. **Desktop Chat UI**:
   - Tabbed in the right panel alongside Move List.
   - The board and authoritative clocks are never covered or obscured.
   - Message bubbles show sender avatar, handle, timestamp, and sanitized text (max 280 chars).
2. **Mobile Chat UI**:
   - Non-intrusive collapsible panel / half-height bottom sheet.
   - Board remains pinned in the upper viewport with active clocks visible while chatting.
3. **Moderation Controls**:
   - Mute Player: locally silence opponent's chat.
   - Block User: mutual bidirectional block in `user_blocks`.
   - Report: submits report to `reports` table with recent chat transcript snapshot.
4. **1-on-1 Voice in Private Friend Games**:
   - Available exclusively in Private Friend games.
   - Opt-in: both players explicitly click "Join Voice".
   - Controls: Mute/Unmute microphone, deafen, leave voice.
   - Text chat remains interactive while voice is active.
   - Peer-to-peer WebRTC audio via `GameRoomDO` signaling.

---

## 13. Core Features by Surface

### 13.1 Web App
- [ ] Online matchmaking (Bullet, Blitz, Rapid), Glicko-2 ratings
- [ ] Play vs Bot (19 tiers, client-side Stockfish WASM)
- [ ] Play with Friend (rated/unrated, in-game invite modal, share link)
- [ ] Pass & Play (local 2-player)
- [ ] Premoves & server-measured lag compensation (capped at 100 ms)
- [ ] In-game text chat (public and friend games) with mute, block, and report
- [ ] 1-on-1 opt-in WebRTC voice in Private Friend games
- [ ] Profile, rating history graph, match archive
- [ ] PGN export and interactive move viewer
- [ ] Settings (board themes, sounds, coordinates, accessibility)

### 13.2 Mobile App
- [ ] Online matchmaking (Bullet, Blitz, Rapid), Glicko-2 ratings
- [ ] Play vs Bot (19 tiers, **100% offline on-device Stockfish**, OI-1)
- [ ] Play with Friend (invite modal and share link)
- [ ] Pass & Play with auto 180° flip
- [ ] Premoves & lag compensation
- [ ] Collapsible bottom-sheet in-game chat and optional friend voice
- [ ] Profile, rating history, PGN export
- [ ] Touch gestures, haptics, offline persistence

### 13.3 Admin Dashboard
- [ ] User management (search, inspection, rating adjustments, bans/suspensions)
- [ ] Match inspection (live monitor, past game PGN audit)
- [ ] Report resolution queue (review chat transcripts, investigate fair play, apply bans)
- [ ] Real Durable Object / platform health metrics
- [ ] Usage and player growth charts
- [ ] Audit log viewer

---

## 14. Security Requirements

### 14.1 Threat Model (summary)

**Assets**: accounts, rating integrity, game integrity, admin tools, user email/PII.
**Actors**: anonymous attacker, malicious player, cheater (engine assistance, collusion), tampered client, compromised admin, spam-account creator.

| # | Threat | Main controls |
|---|---|---|
| T1 | Client forges moves, clocks, or results | ENG-01, GAME-20..22, SEC-11 |
| T2 | WebSocket identity spoofing or hijack | SEC-07..10 |
| T3 | Rating manipulation (collusion, farming, takebacks) | RATE-09, GAME-42, MM-10, SEC-17..20 |
| T4 | Account takeover, credential stuffing | SEC-01..03 |
| T5 | Resource exhaustion (WS spam, queue/challenge spam, large payloads) | PROTO-02/03, SEC-12, rate limits |
| T6 | Admin abuse or admin takeover | SEC-04..05 |
| T7 | Data exposure / IDOR on games, challenges, PII | SEC-05, SEC-06, SEC-23 |
| T8 | XSS / injection via usernames, bios, PGN, chat | SEC-12, SEC-13 |
| T9 | Secret leakage / supply chain | SEC-15, SEC-16 |
| T10 | Stalling and griefing | GAME-12..14, GAME-30..33 |

### 14.2 Requirements

| ID | Requirement |
|---|---|
| SEC-01 | Authentication via Better Auth only; no custom crypto. Sign-in is rate-limited with progressive delay after repeated failures per account. Online play requires a verified email (**OI-3**). |
| SEC-02 | Web, admin, and API share one registrable domain; session cookies are `Secure`, `HttpOnly`, `SameSite=Lax`. CORS allows an **exact origin allowlist** (never `*` with credentials). State-changing requests verify `Origin`. |
| SEC-03 | Mobile stores tokens in `expo-secure-store` only. |
| SEC-04 | Admin requires **all of**: Cloudflare Access, `role = 'admin'` in the API, and (recommended) 2FA. Admin mutations always write `audit_logs`. |
| SEC-05 | Authorization is enforced server-side on every route per the matrix below. Every route has tests for unauthenticated, forbidden, and IDOR cases. |
| SEC-06 | Game ids are random (21-char nanoid); `share_code` ≥ 128-bit. No sequential public ids. |
| SEC-07 | **WS tickets**: HMAC-signed, **30 s** expiry, bound to `userId` + scope (+ `gameId`), single-use (nonce remembered in the DO for its lifetime). Verified in the Worker **before** upgrading to the DO. Sent via `Sec-WebSocket-Protocol`. |
| SEC-08 | Browser WS upgrades check the `Origin` allowlist. |
| SEC-09 | Frame size and rate limits (PROTO-02/03); max 3 user-channel sockets per user. |
| SEC-10 | At most one game-channel socket per user per game; a new connection replaces the old one. |
| SEC-11 | The server never uses client-supplied FEN, clock values, timestamps, or ratings. |
| SEC-12 | Zod on every boundary. Caps: PGN import ≤ 64 KB and ≤ 1000 plies; chat messages ≤ 280 chars; all strings length-capped; usernames per §9.1. No `dangerouslySetInnerHTML`. SQL only via Drizzle. |
| SEC-13 | Security headers on web, admin, and API: strict CSP, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, HSTS, `Referrer-Policy`, `Permissions-Policy`. |
| SEC-14 | Avatars: ≤ 2 MB; PNG/JPEG/WebP only, verified by magic bytes; served from a separate origin with `nosniff`; strip EXIF. |
| SEC-15 | Secrets via Wrangler secrets, separate per environment; `.dev.vars` gitignored; gitleaks in pre-commit and CI; only public config reaches client bundles; ticket-signing key rotatable. |
| SEC-16 | Lockfile committed; Dependabot on; `pnpm audit` fails CI on high/critical; GitHub Actions pinned to commit SHAs; CodeQL enabled. |
| SEC-17 | **Rated pair cap** (RATE-09). |
| SEC-18 | **One live game per user** (MM-10). |
| SEC-19 | **Abort rules** (GAME-12..15) so stalling and rating-free exits cost nothing and gain nothing. |
| SEC-20 | **No takebacks in rated games** (GAME-42). |
| SEC-21 | **Report flow**: players report from the game or profile screen; admins review PGN, clock timeline, and chat transcripts. |
| SEC-22 | Admin tools: ban/suspend, terminate game (aborted), audited rating adjustment. |
| SEC-23 | Email addresses are never returned to other users; logs redact tokens and emails; account deletion (`DELETE /me`) removes the profile and anonymizes the user in archived games. |
| SEC-24 | Per-move think time is retained (derivable from `game_moves` clocks) so engine-assistance detection can be added later. **V1 does not include automated cheat detection.** |
| SEC-25 | **Voice Privacy**: WebRTC audio streams peer-to-peer between friend clients and are never recorded or stored on server infrastructure. |

**Authorization matrix**

| Resource | Who can read | Who can write |
|---|---|---|
| Own account, email | self | self |
| Public profile (username, avatar, country, ratings, stats) | any signed-in user | self |
| Game detail / PGN | participants, admins | server only |
| Challenge (by `share_code`, summary only) | any signed-in user with the code | challenger (create/cancel), recipient (accept/decline) |
| Reports | reporter (own status), admins | reporter (create), admins (resolve) |
| Audit logs, admin metrics | admins | server only (append) |

**Rate limits (starting values; enforce at the edge or in code)**

| Surface | Limit |
|---|---|
| Sign-in | 10 / min / IP; progressive delay per account |
| Sign-up | 5 / hour / IP |
| REST (general) | 120 / min / user |
| `POST /ws-ticket` | 30 / min / user |
| `POST /challenges` | 10 / min / user |
| `POST /reports` | 10 / day / user |
| `POST /games/import` | 30 / hour / user |
| In-game chat | 5 messages / 5 s sustained |

---

## 15. Non-Functional Requirements (measurable)

Targets are initial and are validated by the load and performance tests in §17. Adjust them after the first measurements; record changes in the Decision Log.

| ID | Requirement | Target |
|---|---|---|
| NFR-01 | Server move processing (frame received → `MOVE_ACCEPTED` sent) | p95 < 50 ms |
| NFR-02 | Reconnect → `GAME_SNAPSHOT` delivered | p95 < 2 s on a stable network |
| NFR-03 | Clock precision | Server clock error from timing logic < 5 ms (excluding network latency) |
| NFR-04 | Read API latency | p95 < 300 ms |
| NFR-05 | 5xx error rate | < 0.5% over 5 min |
| NFR-06 | Web app shell | ≤ 250 KB gzip JS excluding Stockfish WASM; mobile Lighthouse performance ≥ 90 on Home |
| NFR-07 | Mobile board interaction | 60 fps on a mid-range Android (reference device chosen in **OI-1**); cold start ≤ 3 s |
| NFR-08 | Capacity (V1 target) | 200 concurrent live games sustained, no state loss, no errors beyond NFR-05 |
| NFR-09 | Durability | A DO eviction or restart mid-game loses **no** moves and resumes with correct clocks |
| NFR-10 | Offline | Computer and Local modes fully functional without network on mobile |
| NFR-11 | Type safety | `strict` TS; zero `any` in `packages/*` and `services/api` (Biome rule enforced in CI) |
| NFR-12 | Test coverage | `chess-core`, clock logic, `rating`, `realtime-protocol`: ≥ 95% line and ≥ 90% branch; everything else ≥ 70% line |

---

## 16. Observability

- **Structured JSON logs** with a request id, user id (hashed or id only, never email or tokens), game id, and event name.
- **Metrics**: active games, open WebSockets, move processing latency, alarm lag, archive successes/failures/retries, queue length per pool, D1 error rate.
- **Alerts**: archive failures or retries above threshold, 5xx rate (NFR-05), Durable Object exceptions, auth failure spikes.
- **Error tracking** for web, mobile, and API (**OI-4**).
- **Audit log** (`audit_logs`) is separate from operational logs; append-only.
- **Admin System Health** reads real data (§12.4).

---

## 17. Testing, CI/CD & Quality Gates

### 17.1 Required Tests

| Area | Must cover |
|---|---|
| `chess-core` | FEN fixtures for every termination (checkmate, stalemate, 50-move, threefold, insufficient material), timeout vs insufficient-material, promotion, castling, en passant |
| Clock logic | Pure-function tests: lag credit cap, increment rules, first-move rule (GAME-13), flag-fall |
| `rating` | The §8.1 test vectors (Glickman's published example), bounds, inactivity growth, and properties |
| `realtime-protocol` | Round-trip and invalid-input tests for every schema; oversized frames |
| Durable Objects (pool-workers) | Full-game scenarios: mate, resign, draw, timeout, disconnect forfeit, abort cases, hibernation/eviction resume mid-game, concurrent `MOVE_INTENT` on one ply, archival retry and idempotency |
| Matchmaker | Range expansion, timeout, self-match prevention, pair cap, persisted queue |
| API | Authz matrix (unauthenticated, forbidden, IDOR) for every route; validation failures; challenge accept rules (CHAL-05); import replay validation |
| Web e2e (Playwright) | Sign up, play local, play bot, two-browser online game, reconnect |
| Mobile | Component and store tests; **manual device checklist**: offline bot play, background-over-60-s forfeit, reconnect |
| Load / soak | Script with N concurrent games, malformed-frame fuzz, and message floods (NFR-08, PROTO-03) |

### 17.2 CI Pipeline (GitHub Actions)

1. Install with frozen lockfile.
2. `biome check`, `tsc --noEmit` across the workspace.
3. Unit and integration tests with coverage gates (NFR-12).
4. Build all apps and packages.
5. Durable Object and API integration tests.
6. Playwright e2e (on `main` and labeled PRs).
7. Security: `pnpm audit`, gitleaks, CodeQL.
8. Migrations: `drizzle-kit check` and apply to an ephemeral D1.

### 17.3 Deployment

- `main` auto-deploys to **staging**; **production** deploys by tag or manual approval.
- D1 migrations run **before** the Worker deploy and must be backward compatible (§9.2).
- Branch protection on `main`: PRs required, CI green, no force pushes.

### 17.4 Definition of Done (per feature)

- [ ] Requirement IDs implemented and linked in the PR description
- [ ] Tests written and passing, including authz and validation cases
- [ ] Lint and typecheck clean; no `any`
- [ ] Performance budgets (§15) checked where relevant
- [ ] Logging/metrics added for new server behavior
- [ ] SRS updated if behavior changed
- [ ] Quality-inspector report for the feature has **no open blocker or high findings**

### 17.5 Production Readiness Gate

Before "ready": all MUST requirements have passing tests; every blocker/high finding closed; load test meets NFR-08; threat-model controls (§14) verified; backup/restore and rollback procedure written and tried once on staging; secrets rotated from dev values; admin behind Access with 2FA.

---

## 18. Out of Scope

- Chess variants (Chess960, Crazyhouse, King of the Hill, etc.)
- **Tournaments and rooms** (dropped; not planned)
- Time gift in matches
- Public matchmaking voice chat (voice is strictly 1-on-1 opt-in for Private Friend games)
- Video chat
- Automated engine game review / accuracy analysis (V2)
- Automated cheat or engine-assistance detection (V2 candidate; data retained per SEC-24)
- Puzzles and lessons
- Clubs, teams, social forums
- Opening explorer / openings search
- Rating systems other than Glicko-2, rating seasons, and rating decay beyond the RD growth in RATE-05
- Push notifications (challenge modals work while the app is open)
- Additional piece styles beyond Classic

---

## 19. Licensing & Attribution

- **Stockfish** is GPL-3.0. The project is a hobby project shared informally and the repository is planned to be public (**OI-7**: confirm the repo license, GPL-3.0 recommended).
- **chess.js** is BSD-2-Clause.
- **Piece artwork** is CC BY-SA 3.0: keep attribution and license notices in `packages/assets` and in an in-app **About / Licenses** screen. Adaptations follow ShareAlike.
- **Sounds** must be original, CC0, or otherwise licensed for this use (**OI-6**).
- Maintain `docs/THIRD_PARTY_LICENSES.md`; CI checks that new dependencies have an allowed license.

---

## 20. Decision Log

| ID | Date | Decision | Status |
|---|---|---|---|
| D-01 | 2026-10-02 | No tournaments; `TournamentDO` removed | **Decided by HUN** |
| D-02 | 2026-10-02 | Glicko-2 ratings (reverses an earlier choice of simple Elo); resign, timeout, and abandonment count as ordinary losses; start 1500 / RD 350 / σ 0.06 | **Decided by HUN** |
| D-19 | 2026-10-02 | Glicko-2 parameters: per-game rating periods, `τ = 0.5`, provisional when `RD > 110`, `RATING_PERIODS_PER_DAY = 0.2`, leaderboards exclude provisional players | Proposed |
| D-03 | 2026-10-02 | Disconnected > 60 s = forfeit, phones included | **Decided by HUN** |
| D-20 | 2026-10-02 | In-game text chat enabled for all matches; 1-on-1 opt-in WebRTC voice enabled for Private Friend games only | **Decided by HUN** |
| D-04 | 2026-10-02 | Bots run client-side only on web and mobile; backend never runs Stockfish | Proposed |
| D-05 | 2026-10-02 | Expo Go dropped; development build / APK | Proposed |
| D-06 | 2026-10-02 | Takebacks disabled in all rated games; rated friend games allowed with a pair cap of 5 per 24 h | Proposed |
| D-07 | 2026-10-02 | Threefold repetition is automatic; 50-move rule is automatic at halfmove clock 100 | Proposed |
| D-08 | 2026-10-02 | Time-control list unified (11 presets, §8.2); category formula test | Proposed |
| D-09 | 2026-10-02 | Cut from V1: time gift, openings search, admin Verifications/Settlements, extra piece styles, mobile banner, matchmaking ETA | Proposed |
| D-10 | 2026-10-02 | Abort rules: 30 s first-move deadline, clocks start after each side's first move, no rating change when aborted | Proposed |
| D-11 | 2026-10-02 | One live online game per user; one game socket per user per game | Proposed |
| D-12 | 2026-10-02 | Challenges are REST-only; WebSocket only pushes. Direct challenges 60 s, link challenges 10 min | Proposed |
| D-13 | 2026-10-02 | Premoves are client-only; no periodic clock broadcast (clients tick locally, resync on moves and heartbeats) | Proposed |
| D-14 | 2026-10-02 | `fen_after` dropped from `game_moves`; FEN derived by replay | Proposed |
| D-15 | 2026-10-02 | Finished games readable only by participants and admins in V1 | Proposed |
| D-16 | 2026-10-02 | Local/computer games playable without an account; online requires an account | Proposed |
| D-17 | 2026-10-02 | Matchmaking range ±100, +50 per 5 s, cap ±600, timeout 120 s | Proposed |
| D-18 | 2026-10-02 | Draw offers allowed only once each side has made 2 moves | Proposed |

---

## 21. Open Items

| ID | Item | Needed before |
|---|---|---|
| OI-1 | **Spike**: prove on-device Stockfish on React Native (candidate approaches: native module in a dev build, or WASM in a WebView). Success = offline play at all tiers on a mid-range Android; choose the reference device here. | Locking mobile bot work |
| OI-2 | Verify whether Cloudflare Pages is still recommended for the admin app vs Workers static assets. | Building admin |
| OI-3 | Email provider for verification and password reset. | Auth implementation |
| OI-4 | Error-tracking service for web, mobile, and API. | Production |
| OI-5 | Confirm or change every **Proposed** decision in §20. | Starting implementation |
| OI-6 | Source for sound assets (CC0 or original). | Sound implementation |
| OI-7 | Repository license (GPL-3.0 recommended given Stockfish). | Making the repo public |
| OI-8 | Domain choice: web, admin, and API on one registrable domain for cookie auth. | Auth implementation |
| OI-9 | Confirm Better Auth ban and 2FA plugin names and cross-subdomain cookie settings against its current docs. | Auth implementation |
| OI-10 | Review and confirm the Glicko-2 parameters in RATE-05/06/07 (τ, RD threshold, rating periods per day). | `packages/rating` implementation |
| OI-11 | STUN/TURN server configuration for WebRTC 1-on-1 friend voice chat (free STUN vs Cloudflare Calls). | Voice implementation |

---

*Last updated: 2026-10-02 · v2.0*

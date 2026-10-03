# ET Chess — API & Realtime Protocol Contract (Phase 0)

This document specifies the authoritative, contract-first specification for all REST endpoints and WebSocket realtime messages across ET Chess, adhering to the v2 backend implementation plan.

---

## 1. Global Standards & Conventions

### 1.1 Error Representation
All API error responses strictly conform to the following schema:
```json
{
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable description for UI error banners or toasts",
    "details": null
  }
}
```

Standard Error Codes:
| Code | HTTP Status | Meaning |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Missing, invalid, or expired session/token |
| `FORBIDDEN` | 403 | Authenticated user lacks permission or account is banned |
| `NOT_FOUND` | 404 | Resource does not exist (never returned for empty lists) |
| `VALIDATION_FAILED` | 400 | Request body or parameters failed Zod schema validation |
| `CONFLICT` | 409 | Duplicate entity, concurrent active game, or state violation |
| `RATE_LIMITED` | 429 | Request quota exceeded; contains `Retry-After` header |
| `UPGRADE_REQUIRED` | 426 | HTTP request arrived at WebSocket upgrade endpoint |
| `INTERNAL` | 500 | Unhandled server exception |

### 1.2 Empty States & Pagination
- List endpoints always return HTTP `200` with an empty array `[]` when no items exist (never `404`).
- Paginated endpoints use cursor-based pagination with `{ items: T[], nextCursor: string | null }`.

### 1.3 Realtime Envelopes & Close Codes
Every WebSocket message follows the versioned envelope:
```json
// Client -> Server
{ "v": 1, "type": "MOVE_INTENT", "requestId": "req_123", "payload": { ... } }

// Server -> Client (serverTime always present)
{ "v": 1, "type": "MOVE_ACCEPTED", "requestId": "req_123", "serverTime": 1791028000000, "payload": { ... } }
```

WebSocket Close Codes:
| Close Code | Symbol | Reason |
|---|---|---|
| `4001` | `UNAUTHORIZED` | Invalid, expired, replayed ticket, or failed first-frame auth within 5s |
| `4002` | `VERSION_UNSUPPORTED` | Client protocol version does not match server `minProtocolVersion` |
| `4003` | `RATE_LIMITED` | Exceeded 10 msgs/s or 4 KB frame size limit |
| `4004` | `REPLACED_BY_NEWER_CONNECTION` | Player connected from another tab/device for the same session |

---

## 2. REST API Endpoints Contract

### 2.1 Meta & Discovery

#### `GET /api/meta`
- **Auth**: Public
- **Request**: None
- **Success**: `200 OK`
  ```json
  {
    "serverVersion": "0.1.0",
    "minProtocolVersion": 1,
    "rules": {
      "FIRST_MOVE_DEADLINE_MS": 30000,
      "DISCONNECT_GRACE_MS": 60000,
      "DISCONNECT_TIMEOUT_MS": 15000,
      "LAG_CREDIT_CAP_MS": 100,
      "RATED_PAIR_CAP_24H": 5,
      "MATCHMAKING_START_RANGE": 100,
      "MATCHMAKING_WIDEN_STEP": 50,
      "MATCHMAKING_WIDEN_INTERVAL_MS": 5000,
      "MATCHMAKING_CAP_RANGE": 600,
      "MATCHMAKING_TIMEOUT_MS": 120000,
      "CHALLENGE_DIRECT_EXPIRY_MS": 60000,
      "CHALLENGE_LINK_EXPIRY_MS": 600000,
      "MAX_PENDING_OUTGOING_CHALLENGES": 5,
      "DRAW_MIN_PLY_PER_SIDE": 2,
      "DRAW_COOLDOWN_PLIES": 5,
      "TAKEBACKS_ALLOWED_CASUAL_FRIEND_ONLY": true,
      "ONE_LIVE_GAME_PER_USER": true,
      "WS_TICKET_TTL_MS": 30000,
      "FIRST_FRAME_AUTH_TIMEOUT_MS": 5000,
      "WS_MAX_FRAME_BYTES": 4096,
      "WS_MAX_MESSAGES_PER_SEC": 10,
      "MAX_FRIENDS": 200,
      "GLICKO2_DEFAULT_RATING": 1500,
      "GLICKO2_DEFAULT_RD": 350,
      "GLICKO2_DEFAULT_VOL": 0.06,
      "GLICKO2_TAU": 0.5,
      "GLICKO2_PROVISIONAL_RD_THRESHOLD": 110,
      "GLICKO2_RATING_PERIODS_PER_DAY": 0.2
    },
    "timeControls": { ... }
  }
  ```
- **Errors**: `INTERNAL` (500)
- **Rate Limit**: 60 req/min
- **Idempotency**: Cacheable, idempotent
- **UI States**: Loaded at application boot. UI locks if `server.minProtocolVersion > client.version`.

---

### 2.2 Authentication & Tickets

#### `POST /api/ws-ticket`
- **Auth**: User (Session cookie or Bearer token)
- **Request**:
  ```json
  {
    "scope": "user" | "game:<gameId>"
  }
  ```
- **Success**: `200 OK`
  ```json
  {
    "ticket": "hmac_signed_base64_string",
    "expiresAt": 1791028030000,
    "scope": "game:8f3a9e11"
  }
  ```
- **Errors**:
  - `401 UNAUTHENTICATED`: Not logged in.
  - `403 FORBIDDEN`: User is not a participant in the requested `gameId` or account is banned.
  - `409 CONFLICT`: User has an active game and attempts to mint a ticket for a different game.
- **Rate Limit**: 20 tickets/min per user.
- **Idempotency**: Repeated calls mint new unique `jti` tickets.

---

### 2.3 User & Profile

#### `GET /api/users/me`
- **Auth**: User
- **Success**: `200 OK`
  ```json
  {
    "user": {
      "id": "u-123",
      "name": "AlexRook",
      "email": "alex@etchess.io",
      "emailVerified": true,
      "role": "user",
      "image": null,
      "ratings": {
        "bullet": 1500,
        "blitz": 1542,
        "rapid": 1605,
        "classical": 1500
      }
    }
  }
  ```
- **Errors**: `401 UNAUTHENTICATED`

#### `GET /api/users/leaderboard/:category`
- **Auth**: Public
- **Param**: `:category` $\in$ `["bullet", "blitz", "rapid", "classical"]`
- **Success**: `200 OK`
  ```json
  {
    "category": "blitz",
    "leaderboard": [
      { "rank": 1, "userId": "u-456", "name": "Hikaru", "rating": 2840, "image": null }
    ]
  }
  ```
- **Empty Case**: `{ "category": "blitz", "leaderboard": [] }`

---

### 2.4 Friends & Social Graph (Phase 6)

#### `GET /api/friends`
- **Auth**: User
- **Success**: `200 OK`
  ```json
  {
    "friends": [
      {
        "friendshipId": "f-123",
        "friend": { "id": "u-789", "name": "Kasparov", "rating": 2850, "image": null },
        "status": "online" | "in_game" | "offline",
        "currentGameId": "game-xyz" | null,
        "createdAt": 1791000000000
      }
    ]
  }
  ```
- **Empty Case**: `{ "friends": [] }`

#### `POST /api/friends/requests`
- **Auth**: User
- **Request**: `{ "username": "Kasparov" }`
- **Success**: `201 Created` with created friendship row
- **Errors**:
  - `400 VALIDATION_FAILED`: Cannot friend yourself.
  - `404 NOT_FOUND`: Username does not exist.
  - `409 CONFLICT`: Request already exists, users are already friends, or user blocked you.
  - `429 RATE_LIMITED`: Exceeded 10 requests / hour.

#### `POST /api/friends/requests/:id/accept` and `.../decline`
- **Auth**: User (must be addressee)
- **Success**: `200 OK`
- **Errors**: `403 FORBIDDEN` if not the addressee.

---

### 2.5 Challenges (Phase 6)

#### `POST /api/challenges`
- **Auth**: User
- **Request**:
  ```json
  {
    "challengedId": "u-789", // optional; omit for shareable link challenge
    "timeControlId": "3+2",
    "isRated": false, // true only allowed if friend and within rated pair cap
    "preferredColor": "random" | "white" | "black"
  }
  ```
- **Success**: `201 Created`
  ```json
  {
    "challenge": {
      "id": "chal-uuid",
      "shareCode": "ch_7a9f11b...",
      "timeControlId": "3+2",
      "isRated": false,
      "expiresAt": 1791028060000
    }
  }
  ```
- **Errors**:
  - `409 CONFLICT`: User has $\ge 5$ pending challenges, user already has live game, or rated pair cap ($5$ games / 24h) reached.

#### `POST /api/challenges/:id/accept`
- **Auth**: User
- **Success**: `200 OK`
  ```json
  {
    "gameId": "game-uuid-generated",
    "timeControlId": "3+2",
    "rated": false
  }
  ```
- **Errors**:
  - `409 CONFLICT`: Challenge expired, cancelled, or either user already has a live game.

---

## 3. Realtime WebSocket Protocol Contract

### 3.1 Game Channel (`/ws/game/:gameId`)

| Direction | Type | Payload Summary | Description |
|---|---|---|---|
| **C $\to$ S** | `AUTH` | `{ ticket: string }` | **Must be first frame** within 5s. Validates single-use ticket. |
| **C $\to$ S** | `MOVE_INTENT` | `{ from, to, promotion?, expectedPly }` | Submits candidate move. Expected ply guards against race conditions. |
| **C $\to$ S** | `DRAW_OFFER` | `{}` | Offers draw. Must satisfy RULE-09 (min ply 4, 5 ply cooldown). |
| **C $\to$ S** | `DRAW_RESPONSE` | `{ accept: boolean }` | Accepts or declines incoming draw offer. |
| **C $\to$ S** | `RESIGN` | `{}` | Resigns the game. Terminal state computed immediately. |
| **C $\to$ S** | `TAKEBACK_REQUEST` | `{}` | Unrated friend games only (RULE-10). |
| **C $\to$ S** | `TAKEBACK_RESPONSE` | `{ accept: boolean }` | Accepts/declines takeback. Rewinds board by 1 ply or 2 plies. |
| **C $\to$ S** | `HEARTBEAT_PING` | `{ clientSeq? }` | Measures RTT latency for lag credit calculation (RULE-04). |
| **S $\to$ C** | `GAME_SNAPSHOT` | `{ gameId, fen, pgn, moves, turn, ply, white, black, clocks... }` | Complete game state delivered upon connection or reconnection. |
| **S $\to$ C** | `MOVE_ACCEPTED` | `{ san, uci, from, to, promotion?, fen, ply, whiteMs, blackMs, turn, lagCreditMs }` | Authoritative move accepted and committed to DO storage. |
| **S $\to$ C** | `MOVE_REJECTED` | `{ reason, expectedPly, currentFen }` | Move rejected (illegal move, wrong turn, or stale ply). |
| **S $\to$ C** | `DRAW_OFFERED` | `{ fromRole: "white" \| "black" }` | Informs opponent that a draw has been offered. |
| **S $\to$ C** | `DRAW_DECLINED` | `{ byRole: "white" \| "black" }` | Informs player that draw was declined. |
| **S $\to$ C** | `TAKEBACK_OFFERED` | `{ fromRole: "white" \| "black" }` | Informs opponent that a takeback was requested. |
| **S $\to$ C** | `TAKEBACK_RESOLVED` | `{ accepted: boolean, fen?, ply?, whiteMs?, blackMs? }` | Broadcasts outcome of takeback request. |
| **S $\to$ C** | `OPPONENT_PRESENCE` | `{ role, status: "connected" \| "disconnected", gracePeriodRemainingMs? }` | Indicates disconnect status and starts 60s forfeit countdown (RULE-02). |
| **S $\to$ C** | `GAME_TERMINATED` | `{ result, termination, winnerRole?, whiteRatingAfter?, blackRatingAfter?... }` | Final game outcome with Glicko-2 rating updates. |
| **S $\to$ C** | `HEARTBEAT_PONG` | `{ clientSeq? }` | Echoes sequence and serverTime. |
| **S $\to$ C** | `ERROR` | `{ code, message }` | Informational protocol error frame. |

---

### 3.2 User Channel (`/ws/user`)

| Direction | Type | Payload Summary | Description |
|---|---|---|---|
| **C $\to$ S** | `AUTH` | `{ ticket: string }` | Single-use ticket with scope `user`. |
| **C $\to$ S** | `QUEUE_JOIN` | `{ timeControlId, rated }` | Joins matchmaking pool in `MatchmakerDO`. |
| **C $\to$ S** | `QUEUE_LEAVE` | `{}` | Leaves matchmaking pool. |
| **C $\to$ S** | `HEARTBEAT_PING` | `{ clientSeq? }` | Keepalive ping. |
| **S $\to$ C** | `QUEUE_STATUS` | `{ status: "queued" \| "idle", timeControlId?, queueTimeMs?, searchRange? }` | Matchmaking status with expanding rating range (RULE-06). |
| **S $\to$ C** | `MATCH_FOUND` | `{ gameId, timeControlId, rated, assignedColor, opponent: { id, name, rating } }` | Match formed! Client connects to `/ws/game/:gameId`. |
| **S $\to$ C** | `CHALLENGE_RECEIVED` | `{ challengeId, challenger: { id, name, rating }, timeControlId, expiresAt }` | Direct challenge received from friend. Shows modal. |
| **S $\to$ C** | `CHALLENGE_DECLINED` | `{ challengeId, reason? }` | Challenge was declined. |
| **S $\to$ C** | `CHALLENGE_ACCEPTED` | `{ challengeId, gameId }` | Challenge accepted! Both clients route to `/ws/game/:gameId`. |
| **S $\to$ C** | `CHALLENGE_EXPIRED` | `{ challengeId }` | 60s challenge deadline expired. |
| **S $\to$ C** | `HEARTBEAT_PONG` | `{ clientSeq? }` | Echoes sequence and serverTime. |
| **S $\to$ C** | `ERROR` | `{ code, message }` | User channel error. |

---

## 4. UI States Mapping

| Entity | Loading State | Empty State | Error State |
|---|---|---|---|
| **Matchmaking** | Radar animation, active timer, expanding range indicator | N/A | Timeout (`MATCHMAKING_TIMEOUT`), Pair cap reached |
| **Game Board** | Skeleton board + clock placeholders | N/A | Reconnect banner (grace period), Move rejected toast |
| **Leaderboard** | Table skeleton rows | "No players ranked in this category yet" | Retry button with error banner |
| **Friends List** | Profile card skeletons | "No friends added yet" + [Add Friend] button | Network error toast |
| **Game History** | PGN list skeleton | "No games played yet" + [Play a Game] button | Error alert banner |
| **Incoming Challenge** | Pulse modal with countdown | Auto-dismisses on expiry (60s) | "Challenge expired or was cancelled" |

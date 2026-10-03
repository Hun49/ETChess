/**
 * ET Chess — Authoritative Product Rules (v2)
 *
 * Single source of truth for all game rules, timing deadlines,
 * matchmaking parameters, ratings, and socket limits.
 * Exposed to clients via `GET /api/meta`.
 */
export const PRODUCT_RULES = {
  /** RULE-01: First-move deadline per player. Missing it aborts the game without rating change. */
  FIRST_MOVE_DEADLINE_MS: 30_000,

  /** RULE-02: Disconnect grace period before forfeit (clock runs concurrently). */
  DISCONNECT_GRACE_MS: 60_000,

  /** RULE-03: Disconnect detection timeout (socket close or missed heartbeat). */
  DISCONNECT_TIMEOUT_MS: 15_000,

  /** RULE-04: Maximum lag credit applied to a move (smoothed RTT capped at 100ms). */
  LAG_CREDIT_CAP_MS: 100,

  /** RULE-05: Maximum rated games between the same two users in a rolling 24-hour window. */
  RATED_PAIR_CAP_24H: 5,

  /** RULE-06: Matchmaking search range starting delta (±100 Elo). */
  MATCHMAKING_START_RANGE: 100,

  /** RULE-06: Matchmaking search range expansion step (+50 Elo). */
  MATCHMAKING_WIDEN_STEP: 50,

  /** RULE-06: Matchmaking range expansion interval (every 5 seconds). */
  MATCHMAKING_WIDEN_INTERVAL_MS: 5_000,

  /** RULE-06: Maximum matchmaking search range cap (±600 Elo). */
  MATCHMAKING_CAP_RANGE: 600,

  /** RULE-06: Total queue timeout before aborting search (120 seconds). */
  MATCHMAKING_TIMEOUT_MS: 120_000,

  /** RULE-07: Direct friend challenge expiration (60 seconds). */
  CHALLENGE_DIRECT_EXPIRY_MS: 60_000,

  /** RULE-07: Shareable link challenge expiration (10 minutes). */
  CHALLENGE_LINK_EXPIRY_MS: 600_000,

  /** RULE-08: Maximum pending outgoing challenges per user. */
  MAX_PENDING_OUTGOING_CHALLENGES: 5,

  /** RULE-09: Minimum plies made by both sides before draw offer allowed (2 moves per side = ply 4). */
  DRAW_MIN_PLY_PER_SIDE: 2,

  /** RULE-09: Cooldown in plies before same player can offer another draw. */
  DRAW_COOLDOWN_PLIES: 5,

  /** RULE-10: Takebacks allowed exclusively in unrated friend games. */
  TAKEBACKS_ALLOWED_CASUAL_FRIEND_ONLY: true,

  /** RULE-11: Strict invariant: one active live game per user. */
  ONE_LIVE_GAME_PER_USER: true,

  /** RULE-12: Single-use WebSocket ticket lifetime. */
  WS_TICKET_TTL_MS: 30_000,

  /** RULE-12: Maximum time after socket open to send AUTH frame before 4001 disconnect. */
  FIRST_FRAME_AUTH_TIMEOUT_MS: 5_000,

  /** RULE-13: Maximum WebSocket frame payload size (4 KB). */
  WS_MAX_FRAME_BYTES: 4_096,

  /** RULE-13: Maximum allowed WebSocket messages per second per connection. */
  WS_MAX_MESSAGES_PER_SEC: 10,

  /** RULE-14: Maximum friends allowed per user. */
  MAX_FRIENDS: 200,

  /** RULE-15: Canonical Glicko-2 default starting rating. */
  GLICKO2_DEFAULT_RATING: 1500,

  /** RULE-15: Canonical Glicko-2 default rating deviation (RD). */
  GLICKO2_DEFAULT_RD: 350,

  /** RULE-15: Canonical Glicko-2 default rating volatility (sigma). */
  GLICKO2_DEFAULT_VOL: 0.06,

  /** RULE-15: Canonical Glicko-2 system constant (tau). */
  GLICKO2_TAU: 0.5,

  /** RULE-15: Rating deviation threshold above which a rating is flagged provisional. */
  GLICKO2_PROVISIONAL_RD_THRESHOLD: 110,

  /** RULE-15: Rating periods per calendar day for inactivity RD growth. */
  GLICKO2_RATING_PERIODS_PER_DAY: 0.2,
} as const;

export type ProductRules = typeof PRODUCT_RULES;

import { describe, expect, it } from "vitest";
import {
  PRODUCT_RULES,
  TIME_CONTROLS,
  type TimeControlKey,
  classifyTimeControl,
  getRatingCategory,
} from "../src";

describe("Product Rules Invariants", () => {
  it("defines all RULE-01 through RULE-15 values according to v2 specification", () => {
    // RULE-01: First-move deadline 30s
    expect(PRODUCT_RULES.FIRST_MOVE_DEADLINE_MS).toBe(30_000);

    // RULE-02: Disconnect grace 60s
    expect(PRODUCT_RULES.DISCONNECT_GRACE_MS).toBe(60_000);

    // RULE-03: Disconnect detection 15s
    expect(PRODUCT_RULES.DISCONNECT_TIMEOUT_MS).toBe(15_000);

    // RULE-04: Lag credit cap 100ms
    expect(PRODUCT_RULES.LAG_CREDIT_CAP_MS).toBe(100);

    // RULE-05: Rated pair cap 5 games per 24h
    expect(PRODUCT_RULES.RATED_PAIR_CAP_24H).toBe(5);

    // RULE-06: Matchmaking range & timeouts
    expect(PRODUCT_RULES.MATCHMAKING_START_RANGE).toBe(100);
    expect(PRODUCT_RULES.MATCHMAKING_WIDEN_STEP).toBe(50);
    expect(PRODUCT_RULES.MATCHMAKING_WIDEN_INTERVAL_MS).toBe(5_000);
    expect(PRODUCT_RULES.MATCHMAKING_CAP_RANGE).toBe(600);
    expect(PRODUCT_RULES.MATCHMAKING_TIMEOUT_MS).toBe(120_000);

    // RULE-07: Challenge expiry: direct 60s, link 10m
    expect(PRODUCT_RULES.CHALLENGE_DIRECT_EXPIRY_MS).toBe(60_000);
    expect(PRODUCT_RULES.CHALLENGE_LINK_EXPIRY_MS).toBe(600_000);

    // RULE-08: Max 5 pending outgoing challenges
    expect(PRODUCT_RULES.MAX_PENDING_OUTGOING_CHALLENGES).toBe(5);

    // RULE-09: Draw offers allowed from move 2 (ply 4), 5 plies cooldown
    expect(PRODUCT_RULES.DRAW_MIN_PLY_PER_SIDE).toBe(2);
    expect(PRODUCT_RULES.DRAW_COOLDOWN_PLIES).toBe(5);

    // RULE-10 & 11: Invariants
    expect(PRODUCT_RULES.TAKEBACKS_ALLOWED_CASUAL_FRIEND_ONLY).toBe(true);
    expect(PRODUCT_RULES.ONE_LIVE_GAME_PER_USER).toBe(true);

    // RULE-12 & 13: WebSocket tickets and limits
    expect(PRODUCT_RULES.WS_TICKET_TTL_MS).toBe(30_000);
    expect(PRODUCT_RULES.FIRST_FRAME_AUTH_TIMEOUT_MS).toBe(5_000);
    expect(PRODUCT_RULES.WS_MAX_FRAME_BYTES).toBe(4_096);
    expect(PRODUCT_RULES.WS_MAX_MESSAGES_PER_SEC).toBe(10);

    // RULE-14: Max friends 200
    expect(PRODUCT_RULES.MAX_FRIENDS).toBe(200);

    // RULE-15: Canonical Glicko-2 constants
    expect(PRODUCT_RULES.GLICKO2_DEFAULT_RATING).toBe(1500);
    expect(PRODUCT_RULES.GLICKO2_DEFAULT_RD).toBe(350);
    expect(PRODUCT_RULES.GLICKO2_DEFAULT_VOL).toBe(0.06);
    expect(PRODUCT_RULES.GLICKO2_TAU).toBe(0.5);
    expect(PRODUCT_RULES.GLICKO2_PROVISIONAL_RD_THRESHOLD).toBe(110);
    expect(PRODUCT_RULES.GLICKO2_RATING_PERIODS_PER_DAY).toBe(0.2);
  });
});

describe("Time Control Classification Formula", () => {
  it("classifies bullet correctly (duration < 180s)", () => {
    expect(classifyTimeControl(60, 0)).toBe("bullet"); // 60s
    expect(classifyTimeControl(120, 0)).toBe("bullet"); // 120s
    expect(classifyTimeControl(60, 1)).toBe("bullet"); // 60 + 40 = 100s
    expect(classifyTimeControl(60, 2)).toBe("bullet"); // 60 + 80 = 140s
  });

  it("classifies blitz correctly (180s <= duration < 480s)", () => {
    expect(classifyTimeControl(180, 0)).toBe("blitz"); // 180s
    expect(classifyTimeControl(180, 2)).toBe("blitz"); // 180 + 80 = 260s
    expect(classifyTimeControl(300, 0)).toBe("blitz"); // 300s
    expect(classifyTimeControl(300, 3)).toBe("blitz"); // 300 + 120 = 420s
  });

  it("classifies rapid correctly (480s <= duration < 3600s, including 30+0 per SRS RATE-12)", () => {
    expect(classifyTimeControl(600, 0)).toBe("rapid"); // 600s
    expect(classifyTimeControl(600, 5)).toBe("rapid"); // 600 + 200 = 800s
    expect(classifyTimeControl(900, 10)).toBe("rapid"); // 900 + 400 = 1300s
    expect(classifyTimeControl(1800, 0)).toBe("rapid"); // 1800s (30+0)
  });

  it("classifies classical correctly (duration >= 3600s)", () => {
    expect(classifyTimeControl(3600, 30)).toBe("classical");
    expect(classifyTimeControl(5400, 30)).toBe("classical");
  });

  it("ensures all preset TIME_CONTROLS match their classified category", () => {
    const keys = Object.keys(TIME_CONTROLS) as TimeControlKey[];
    for (const key of keys) {
      const config = TIME_CONTROLS[key];
      const classified = classifyTimeControl(config.initialSeconds, config.incrementSeconds);
      expect(config.category).toBe(classified);
      expect(getRatingCategory(key)).toBe(classified);
    }
  });
});

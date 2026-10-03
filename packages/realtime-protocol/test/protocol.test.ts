import { describe, expect, it } from "vitest";
import {
  PROTOCOL_VERSION,
  parseClientGameFrame,
  parseClientUserFrame,
  parseServerGameFrame,
  parseServerUserFrame,
} from "../src";

describe("Client Game Protocol (/ws/game/:gameId)", () => {
  it("parses AUTH frame with valid ticket", () => {
    const raw = {
      type: "AUTH",
      payload: { ticket: "valid-hmac-ticket-12345" },
    };
    const parsed = parseClientGameFrame(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.v).toBe(PROTOCOL_VERSION);
    expect(parsed.data.type).toBe("AUTH");
    if (parsed.data.type === "AUTH") {
      expect(parsed.data.payload.ticket).toBe("valid-hmac-ticket-12345");
    }
  });

  it("parses MOVE_INTENT with valid squares and expectedPly", () => {
    const raw = {
      type: "MOVE_INTENT",
      payload: {
        from: "e2",
        to: "e4",
        expectedPly: 0,
      },
    };
    const parsed = parseClientGameFrame(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.type).toBe("MOVE_INTENT");
    if (parsed.data.type === "MOVE_INTENT") {
      expect(parsed.data.payload.from).toBe("e2");
      expect(parsed.data.payload.to).toBe("e4");
      expect(parsed.data.payload.expectedPly).toBe(0);
    }
  });

  it("parses MOVE_INTENT with promotion piece", () => {
    const raw = {
      type: "MOVE_INTENT",
      payload: {
        from: "e7",
        to: "e8",
        promotion: "q",
        expectedPly: 42,
      },
    };
    const parsed = parseClientGameFrame(raw);
    expect(parsed.success).toBe(true);
  });

  it("rejects MOVE_INTENT with invalid square format", () => {
    const raw = {
      type: "MOVE_INTENT",
      payload: {
        from: "e9",
        to: "z4",
        expectedPly: 1,
      },
    };
    const parsed = parseClientGameFrame(raw);
    expect(parsed.success).toBe(false);
  });

  it("parses DRAW_OFFER, DRAW_RESPONSE, RESIGN, and TAKEBACK frames", () => {
    expect(parseClientGameFrame({ type: "DRAW_OFFER", payload: {} }).success).toBe(true);
    expect(parseClientGameFrame({ type: "DRAW_RESPONSE", payload: { accept: true } }).success).toBe(
      true,
    );
    expect(parseClientGameFrame({ type: "RESIGN", payload: {} }).success).toBe(true);
    expect(parseClientGameFrame({ type: "TAKEBACK_REQUEST", payload: {} }).success).toBe(true);
    expect(
      parseClientGameFrame({ type: "TAKEBACK_RESPONSE", payload: { accept: false } }).success,
    ).toBe(true);
    expect(
      parseClientGameFrame({ type: "HEARTBEAT_PING", payload: { clientSeq: 101 } }).success,
    ).toBe(true);
  });
});

describe("Server Game Protocol (/ws/game/:gameId)", () => {
  it("parses GAME_SNAPSHOT frame with full state and serverTime", () => {
    const snapshot = {
      v: PROTOCOL_VERSION,
      type: "GAME_SNAPSHOT",
      serverTime: 1791028000000,
      payload: {
        gameId: "game-test-uuid-1234",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        pgn: "",
        moves: [],
        turn: "w",
        ply: 0,
        status: "active",
        white: {
          id: "u-1",
          name: "Magnus",
          rating: 2850,
          connected: true,
        },
        black: {
          id: "u-2",
          name: "Hikaru",
          rating: 2820,
          connected: true,
        },
        whiteMs: 180000,
        blackMs: 180000,
        initialMs: 180000,
        incrementMs: 2000,
        rated: true,
        isFriendGame: false,
        canTakeback: false,
      },
    };
    const parsed = parseServerGameFrame(snapshot);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.type).toBe("GAME_SNAPSHOT");
    if (parsed.data.type === "GAME_SNAPSHOT") {
      expect(parsed.data.serverTime).toBe(1791028000000);
      expect(parsed.data.payload.white?.name).toBe("Magnus");
      expect(parsed.data.payload.rated).toBe(true);
    }
  });

  it("parses MOVE_ACCEPTED and MOVE_REJECTED frames", () => {
    const accepted = {
      type: "MOVE_ACCEPTED",
      serverTime: Date.now(),
      payload: {
        san: "e4",
        uci: "e2e4",
        from: "e2",
        to: "e4",
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        ply: 1,
        whiteMs: 179500,
        blackMs: 180000,
        turn: "b",
        lagCreditMs: 50,
      },
    };
    expect(parseServerGameFrame(accepted).success).toBe(true);

    const rejected = {
      type: "MOVE_REJECTED",
      serverTime: Date.now(),
      payload: {
        reason: "OUT_OF_TURN",
        expectedPly: 2,
        currentFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      },
    };
    expect(parseServerGameFrame(rejected).success).toBe(true);
  });

  it("parses GAME_TERMINATED frame with Glicko-2 rating deltas", () => {
    const terminated = {
      type: "GAME_TERMINATED",
      serverTime: Date.now(),
      payload: {
        result: "1-0",
        termination: "checkmate",
        winnerRole: "white",
        whiteRatingBefore: 1500,
        whiteRatingAfter: 1515,
        whiteRatingDiff: 15,
        blackRatingBefore: 1500,
        blackRatingAfter: 1485,
        blackRatingDiff: -15,
      },
    };
    const parsed = parseServerGameFrame(terminated);
    expect(parsed.success).toBe(true);
  });

  it("parses OPPONENT_PRESENCE and TAKEBACK_RESOLVED frames", () => {
    const presence = {
      type: "OPPONENT_PRESENCE",
      serverTime: Date.now(),
      payload: {
        role: "black",
        status: "disconnected",
        gracePeriodRemainingMs: 60000,
      },
    };
    expect(parseServerGameFrame(presence).success).toBe(true);

    const takeback = {
      type: "TAKEBACK_RESOLVED",
      serverTime: Date.now(),
      payload: {
        accepted: true,
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        ply: 0,
        whiteMs: 180000,
        blackMs: 180000,
      },
    };
    expect(parseServerGameFrame(takeback).success).toBe(true);
  });
});

describe("User Channel Protocol (/ws/user)", () => {
  it("parses Client QUEUE_JOIN and QUEUE_LEAVE frames", () => {
    const join = {
      type: "QUEUE_JOIN",
      payload: {
        timeControlId: "3+2",
        rated: true,
      },
    };
    const parsedJoin = parseClientUserFrame(join);
    expect(parsedJoin.success).toBe(true);

    const leave = {
      type: "QUEUE_LEAVE",
      payload: {},
    };
    expect(parseClientUserFrame(leave).success).toBe(true);
  });

  it("parses Server MATCH_FOUND and QUEUE_STATUS frames", () => {
    const status = {
      type: "QUEUE_STATUS",
      serverTime: Date.now(),
      payload: {
        status: "queued",
        timeControlId: "3+2",
        rated: true,
        queueTimeMs: 12500,
        searchRange: { min: 1400, max: 1600 },
      },
    };
    expect(parseServerUserFrame(status).success).toBe(true);

    const matchFound = {
      type: "MATCH_FOUND",
      serverTime: Date.now(),
      payload: {
        gameId: "game-session-9876",
        timeControlId: "3+2",
        rated: true,
        assignedColor: "white",
        opponent: {
          id: "opp-user-456",
          name: "GarryKasparov",
          rating: 2800,
        },
      },
    };
    expect(parseServerUserFrame(matchFound).success).toBe(true);
  });

  it("parses Server CHALLENGE notifications", () => {
    const challengeReceived = {
      type: "CHALLENGE_RECEIVED",
      serverTime: Date.now(),
      payload: {
        challengeId: "chal-12345",
        challenger: {
          id: "user-abc",
          name: "FriendPlayer",
          rating: 1600,
        },
        timeControlId: "5+0",
        rated: false,
        preferredColor: "random",
        expiresAt: Date.now() + 60000,
      },
    };
    expect(parseServerUserFrame(challengeReceived).success).toBe(true);

    const challengeAccepted = {
      type: "CHALLENGE_ACCEPTED",
      serverTime: Date.now(),
      payload: {
        challengeId: "chal-12345",
        gameId: "game-session-777",
      },
    };
    expect(parseServerUserFrame(challengeAccepted).success).toBe(true);
  });
});
